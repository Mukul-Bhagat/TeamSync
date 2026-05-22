# Realtime Architecture

## 5. Realtime Architecture

### Why Socket.IO + Redis?

| Technology | Pros | Cons | Decision |
|---|---|---|---|
| Socket.IO | Auto-reconnect, fallbacks, rooms, typed events | Requires Redis adapter for multi-instance | **Chosen** |
| WebSocket (raw) | Lightweight, no library needed | No fallback, manual reconnection, no rooms | Rejected |
| SSE (Server-Sent Events) | Simple for server→client | No client→server, no rooms | Rejected (supplement only) |
| NATS (direct) | Already in stack, pub/sub rooms | No client SDK, harder to auth | Rejected for client-facing |

Socket.IO provides the best developer experience for real-time features (chat, presence, live cursors, notifications) with built-in fallback to HTTP long-polling when WebSockets are blocked by corporate firewalls.

### Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         CLIENTS                                  │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐        │
│  │  Browser │  │  Mobile  │  │   CLI    │  │  Desktop │        │
│  │(SocketIO)│  │(SocketIO)│  │(SocketIO)│  │(SocketIO)│        │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘        │
└───────┼─────────────┼─────────────┼─────────────┼──────────────┘
        │             │             │             │
        └─────────────┴──────┬──────┴─────────────┘
                               │
                    ┌──────────┴──────────┐
                    │   NGINX (WebSocket  │
                    │   Upgrade + Sticky  │
                    │   Session Optional) │
                    └──────────┬──────────┘
                               │
              ┌────────────────┼────────────────┐
              │                │                │
              ▼                ▼                ▼
     ┌─────────────┐   ┌─────────────┐   ┌─────────────┐
     │  Socket.IO  │   │  Socket.IO  │   │  Socket.IO  │
     │  Server #1  │   │  Server #2  │   │  Server #3  │
     │  (Fastify)  │   │  (Fastify)  │   │  (Fastify)  │
     └──────┬──────┘   └──────┬──────┘   └──────┬──────┘
            │                 │                 │
            └─────────────────┼─────────────────┘
                              │
                    ┌─────────┴─────────┐
                    │   Redis Adapter   │
                    │  (Pub/Sub Room   │
                    │   Synchronization)│
                    └─────────┬─────────┘
                              │
              ┌───────────────┼───────────────┐
              │               │               │
              ▼               ▼               ▼
     ┌─────────────┐  ┌─────────────┐  ┌─────────────┐
     │   Redis     │  │    NATS     │  │  PostgreSQL │
     │  (Presence  │  │  (Event     │  │  (Socket    │
     │   Store)    │  │   Bridge)   │  │  Sessions)  │
     └─────────────┘  └─────────────┘  └─────────────┘
```

### Room Design (Multi-Tenant Isolation)

Every Socket.IO connection is scoped to a tenant. Rooms are prefixed with tenant ID:

```typescript
// Room naming convention
const room = {
  tenant: (tenantId: string) => `tenant:${tenantId}`,
  channel: (tenantId: string, channelId: string) => `tenant:${tenantId}:channel:${channelId}`,
  user: (tenantId: string, userId: string) => `tenant:${tenantId}:user:${userId}`,
  presence: (tenantId: string) => `tenant:${tenantId}:presence`,
  notification: (tenantId: string, userId: string) => `tenant:${tenantId}:notifications:${userId}`,
  workflow: (tenantId: string, workflowId: string) => `tenant:${tenantId}:workflow:${workflowId}`,
};
```

### Connection Lifecycle

```
Client connects
  │
  ├──> Gateway authenticates JWT
  │
  ├──> Extract tenantId, userId from token
  │
  ├──> Join `tenant:{tenantId}` room (global tenant events)
  │
  ├──> Join `tenant:{tenantId}:user:{userId}` room (DMs, notifications)
  │
  ├──> Publish `realtime.user.connected` event to NATS
  │
  └──> Update presence in Redis (SET with TTL)

Client disconnects
  │
  ├──> TTL expires in Redis (30s grace)
  │
  ├──> Publish `realtime.user.disconnected` event to NATS
  │
  └──> Other clients receive presence update
```

### Presence Tracking

```typescript
// Redis data structure for presence
interface PresenceEntry {
  userId: string;
  tenantId: string;
  socketId: string;
  status: 'online' | 'away' | 'dnd' | 'offline';
  lastSeen: string; // ISO timestamp
  clientInfo: {
    platform: 'web' | 'mobile' | 'desktop';
    version: string;
  };
}

// Stored as Redis Hash: presence:{tenantId}:{userId}
// Also in Redis Set for quick "who's online": online:{tenantId}
```

### Event Bridge: NATS → Socket.IO

A dedicated bridge service listens to NATS events and broadcasts to Socket.IO rooms:

```typescript
// Bridge pattern
nats.subscribe('teamsync.message.sent.v1', (event) => {
  const { tenantId, payload } = event;
  const { channelId, message } = payload;

  // Broadcast to all clients in this channel
  io.to(`tenant:${tenantId}:channel:${channelId}`)
    .emit('message:new', message);
});

nats.subscribe('flowboard.workflow.step.completed.v1', (event) => {
  const { tenantId, payload } = event;
  const { workflowId, stepName } = payload;

  io.to(`tenant:${tenantId}:workflow:${workflowId}`)
    .emit('workflow:step_completed', { stepName });
});
```

### Scalability Path

| Users | Setup | Notes |
|---|---|---|
| 1-1,000 | Single Socket.IO instance | No Redis adapter needed |
| 1,000-10,000 | Socket.IO + Redis adapter | Horizontal scaling begins |
| 10,000-100,000 | Multiple Socket.IO nodes + Redis Cluster | Shard by tenant |
| 100,000+ | Socket.IO nodes + Redis Cluster + CDN edge | Consider custom WebSocket infra |

### Message Protocol (Typed Events)

```typescript
// Shared types between client and server
interface ServerToClientEvents {
  'message:new': (msg: Message) => void;
  'message:updated': (msg: Message) => void;
  'message:deleted': (msgId: string) => void;
  'presence:changed': (presence: PresenceUpdate) => void;
  'notification:new': (notification: Notification) => void;
  'workflow:step_completed': (data: WorkflowStepEvent) => void;
  'workflow:started': (data: WorkflowEvent) => void;
  'workflow:failed': (data: WorkflowErrorEvent) => void;
  'agent:typing': (data: AgentTypingEvent) => void;
  'agent:response': (data: AgentResponseEvent) => void;
}

interface ClientToServerEvents {
  'message:send': (msg: NewMessage, cb: (err?: Error) => void) => void;
  'message:typing': (channelId: string) => void;
  'presence:update': (status: UserStatus) => void;
  'channel:join': (channelId: string) => void;
  'channel:leave': (channelId: string) => void;
  'workflow:subscribe': (workflowId: string) => void;
  'agent:send': (prompt: string, conversationId: string) => void;
}
```
