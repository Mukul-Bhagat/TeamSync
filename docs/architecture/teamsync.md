# TeamSync Architecture

TeamSync is the **communication and collaboration nervous system** of VistaFam. It is not just a chat application — it is an enterprise communication layer, notification hub, collaboration system, workflow communication layer, AI collaboration assistant, and realtime coordination platform.

## Overview

TeamSync acts as the central nervous system connecting all VistaFam services. It receives events from FlowBoard, PipeVista, DeployHub, LogLens, and VaultSpace, converts them into actionable notifications and channel messages, and delivers them to users in real time.

### Key Capabilities

- **Messaging**: Channels, DMs, threads, reactions, mentions, file sharing
- **Realtime**: Websocket delivery via PipeVista Realtime, presence, typing indicators
- **Notifications**: Push, email, in-app alerts from ecosystem services
- **AI**: Meeting summaries, workflow summaries, semantic search
- **Voice**: Room management with external SFU integration
- **Collaboration**: Workflow approval chats, system channel discussions

## Architecture Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Database | Extend existing Supabase PostgreSQL | Unified data model, existing RLS policies, avoids second ORM |
| Realtime | Delegate to PipeVista Realtime | Reuses existing Socket.IO + Redis infrastructure |
| Voice/Video | External SFU placeholder | Manageable scope; clean integration point for LiveKit/Daily/Twilio |
| Search | PostgreSQL full-text + pgvector semantic | Sufficient for enterprise messaging; no external search engine needed |

## Service Topology

```
┌─────────────────────────────────────────────────────────────────┐
│                         Client Layer                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐ │
│  │  Web App    │  │ Mobile App  │  │  External Integrations  │ │
│  │  (Next.js)  │  │  (Future)   │  │  (Slack, Teams, etc.)   │ │
│  └──────┬──────┘  └──────┬──────┘  └─────────────────────────┘ │
└─────────┼────────────────┼──────────────────────────────────────┘
          │                │
          ▼                ▼
┌─────────────────────────────────────────────────────────────────┐
│                        Edge Layer (NGINX)                        │
│              Route: /teamsync → teamsync-web:3002               │
│              Route: /api/teamsync → teamsync-api:4002           │
└─────────────────────────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────────────┐
│                      TeamSync API (Port 4002)                    │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐ │
│  │  Channels   │  │  Messages   │  │  Notifications          │ │
│  │  DMs        │  │  Reactions  │  │  Presence               │ │
│  │  Voice      │  │  Threads    │  │  Search                 │ │
│  └──────┬──────┘  └──────┬──────┘  └─────────────────────────┘ │
│         │                │                                       │
│         ▼                ▼                                       │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │              Workers (BullMQ + NATS)                     │   │
│  │  Notification Worker  │  Event Integration Worker          │   │
│  │  AI Summary Worker    │                                    │   │
│  └──────────────────────────────────────────────────────────┘   │
└──────────────────────┬──────────────────────────────────────────┘
                       │
          ┌────────────┼────────────┐
          ▼            ▼            ▼
   ┌──────────┐ ┌──────────┐ ┌──────────┐
   │ Supabase  │ │  Redis   │ │  NATS    │
   │ PostgreSQL│ │  Cluster │ │  Cluster │
   └──────────┘ └──────────┘ └──────────┘
          │            │            │
          └────────────┼────────────┘
                       ▼
          ┌──────────────────────────┐
          │  PipeVista Realtime        │
          │  (Socket.IO + Redis)       │
          │  Port 4105                 │
          └──────────────────────────┘
```

## Database Schema

TeamSync extends the existing Supabase schema with the following tables:

### Core Messaging

| Table | Purpose |
|---|---|
| `channels` | Public/private channels per workspace |
| `channel_members` | Membership + role + notification preference |
| `messages` | Channel messages with search vector |
| `message_threads` | Thread metadata (reply count, last reply) |
| `message_reactions` | Emoji reactions per message |
| `message_mentions` | `@user` mentions with read status |
| `dm_conversations` | One-to-one DM conversations |
| `dm_messages` | DM messages with read status |

### Collaboration

| Table | Purpose |
|---|---|
| `file_attachments` | File metadata + MinIO storage path |
| `voice_rooms` | Voice room config + SFU provider |
| `voice_room_participants` | Join/leave tracking |

### AI & Search

| Table | Purpose |
|---|---|
| `ai_summaries` | AI-generated summaries per channel/thread |
| `messages.search_vector` | PostgreSQL tsvector for full-text search |
| `messages.embedding` | pgvector(1536) for semantic search |

### Observability

| Table | Purpose |
|---|---|
| `notifications` | In-app notification queue |
| `message_audit_logs` | Create/edit/delete/react audit trail |

## Realtime Architecture

TeamSync does **not** run its own websocket server. Instead, it delegates all realtime delivery to **PipeVista Realtime** (port 4105).

### Integration Pattern

```
TeamSync API ──HTTP──> PipeVista Realtime ──WebSocket──> Client
   POST /v1/realtime/notify        Socket.IO rooms
   POST /v1/realtime/presence     Presence room broadcast
   POST /v1/realtime/bridge       NATS event bridging
```

### Room Naming

| Room Pattern | Purpose |
|---|---|
| `tenant:{tenantId}` | Tenant-wide broadcasts |
| `tenant:{tenantId}:channel:{channelId}` | Channel message delivery |
| `tenant:{tenantId}:user:{userId}` | Targeted user notifications |
| `tenant:{tenantId}:presence` | Presence change broadcasts |

### Client Events

| Event | Direction | Payload |
|---|---|---|
| `message:new` | Server → Client | Message object |
| `message:updated` | Server → Client | Updated message |
| `reaction:added` | Server → Client | `{ messageId, userId, emoji }` |
| `typing:started` | Server → Client | `{ userId, channelId }` |
| `presence:changed` | Server → Client | `{ userId, status, lastSeen }` |
| `notification:new` | Server → Client | Notification object |

## Notification Architecture

### Delivery Pipeline

```
Ecosystem Event → NATS → Event Integration Worker → PostgreSQL
                                                     │
                                                     ├──> In-app notification
                                                     ├──> Realtime broadcast
                                                     ├──> Push (FCM)
                                                     └──> Email (Resend)
```

### Notification Types

| Type | Source | Delivery Channels |
|---|---|---|
| mention | Message `@user` | In-app + push |
| reply | Thread reply | In-app + push |
| reaction | Emoji reaction | In-app only |
| workflow | FlowBoard execution | In-app + push |
| deployment | DeployHub release | In-app + push |
| incident | LogLens alert | In-app + push + email |
| approval | FlowBoard approval | In-app + push + email |
| ai_summary | AI Assistant | In-app only |

### System Channels

Auto-created channels for ecosystem events:

| Channel | Events |
|---|---|
| `#workflows` | FlowBoard execution updates |
| `#deployments` | DeployHub deployment status |
| `#incidents` | LogLens critical alerts |
| `#security` | VaultSpace secret rotations |
| `#system` | PipeVista system events |

## Event Integration

TeamSync subscribes to NATS JetStream subjects from ecosystem services:

| NATS Subject | Source | Action |
|---|---|---|
| `flowboard.execution.completed` | FlowBoard | Post to #workflows + notify |
| `flowboard.approval.requested` | FlowBoard | Post to #approvals + notify approvers |
| `deployhub.deployment.succeeded` | DeployHub | Post to #deployments + notify team |
| `deployhub.deployment.failed` | DeployHub | Post to #incidents + urgent notify |
| `loglens.alert.critical` | LogLens | Post to #incidents + urgent notify |
| `vaultspace.secret.rotated` | VaultSpace | Post to #security + notify admins |

## AI Integration

### AI Summary Worker

- Consumes from `teamsync:ai-summaries` BullMQ queue
- Fetches messages from PostgreSQL (last 24h or thread context)
- Calls PipeVista AI Router (`POST /v1/ai/chat`) with GPT-4o
- Stores summary in `ai_summaries` table
- Posts summary as AI message in channel

### Semantic Search

- **Embeddings**: Generated via PipeVista AI Router
- **Storage**: pgvector `vector(1536)` column on `messages`
- **Index**: HNSW index with cosine similarity
- **Query**: Hybrid keyword + semantic ranking

## File Upload Architecture

1. Client requests presigned URL from TeamSync API
2. API generates URL from MinIO (or S3-compatible)
3. Client uploads directly to object storage
4. Client registers attachment metadata with API
5. File access controlled by RLS policies

## Voice Room Architecture

1. **Create Room**: TeamSync API calls external SFU (LiveKit/Daily) to create room
2. **Join Room**: API generates participant token from SFU
3. **Signaling**: WebRTC peer connection established via SFU
4. **Media**: Audio/video routed through external SFU
5. **Cleanup**: Room deleted when last participant leaves

## Security

### RBAC

| Role | Permissions |
|---|---|
| Owner | Full control, delete channel, manage members |
| Admin | Manage members, edit settings |
| Member | Post messages, react, thread, view |
| Viewer | Read-only (private channels) |

### Message Permissions

- Row Level Security on `channel_members`, `notifications`, `dm_conversations`
- File access restricted to channel/DM participants
- Audit log tracks all message CRUD operations

### Encryption

- Database at-rest encryption via Supabase
- File attachments encrypted in MinIO
- Websocket connections via WSS/TLS

## Deployment

### Docker Swarm Services

```yaml
teamsync-api:
  replicas: 2
  placement: node.labels.layer == app
  ports: 4002:4002
  env: SUPABASE_URL, REDIS_URL, NATS_URL, REALTIME_URL, AI_ROUTER_URL

teamsync-web:
  replicas: 2
  placement: node.labels.layer == edge
  ports: 3002:3002
  env: NEXT_PUBLIC_TEAMSYNC_API_URL, NEXT_PUBLIC_REALTIME_URL
```

### Environment Variables

| Variable | Description |
|---|---|
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key for admin operations |
| `REDIS_URL` | Redis cluster connection |
| `NATS_URL` | NATS cluster connection |
| `REALTIME_URL` | PipeVista Realtime service URL |
| `AI_ROUTER_URL` | PipeVista AI Router service URL |
| `MINIO_URL` | MinIO object storage URL |
| `SFU_PROVIDER` | External SFU provider (livekit/daily/twilio) |
| `SFU_URL` | SFU service URL |
| `SFU_API_KEY` | SFU API key |
| `FCM_SERVER_KEY` | Firebase Cloud Messaging server key |

## Monitoring

### Metrics

| Metric | Source | Threshold |
|---|---|---|
| API latency p99 | Prometheus | > 500ms |
| Message throughput | Custom counter | — |
| Notification queue depth | BullMQ exporter | > 1000 |
| Presence sync failures | Custom counter | > 5% |
| DB connection pool | PostgreSQL exporter | > 80% |

### Health Checks

| Endpoint | Depth |
|---|---|
| `/health/live` | Process running |
| `/health/ready` | Service initialized |
| `/health/deep` | DB + Redis + NATS + Realtime connectivity |

## API Routes

| Route | Method | Description |
|---|---|---|
| `/api/v1/channels` | GET, POST | List/create channels |
| `/api/v1/channels/:id/messages` | GET, POST | Channel messages |
| `/api/v1/messages/:id/reactions` | GET, POST, DELETE | Reactions |
| `/api/v1/messages/:id/thread` | GET | Thread replies |
| `/api/v1/dms` | GET, POST | DM conversations |
| `/api/v1/dms/:id/messages` | GET, POST | DM messages |
| `/api/v1/notifications` | GET | List notifications |
| `/api/v1/notifications/read-all` | POST | Mark all read |
| `/api/v1/presence/heartbeat` | POST | Update presence |
| `/api/v1/typing/start` | POST | Typing indicator |
| `/api/v1/files/upload-url` | POST | Presigned URL |
| `/api/v1/search` | GET | Full-text search |
| `/api/v1/search/semantic` | GET | Semantic search |
| `/api/v1/voice-rooms` | GET, POST | Voice rooms |
| `/api/v1/voice-rooms/:id/token` | POST | SFU join token |
| `/api/v1/integrations/events` | POST | Ingest ecosystem events |
| `/api/v1/integrations/setup-channels` | POST | Create system channels |
