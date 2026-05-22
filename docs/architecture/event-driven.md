# Event-Driven Communication Design

## 4. Event-Driven Communication Design

### Why Event-Driven?

- **Loose Coupling**: Services do not know each other's existence. They only know event contracts.
- **Scalability**: Event consumers can scale independently of producers.
- **Resilience**: If a consumer is down, events persist in JetStream and are delivered when it recovers.
- **Auditability**: Every state change is an immutable event. Complete system history is reconstructible.
- **Real-time**: Events power real-time features (notifications, live updates) without polling.

### Technology Choice: NATS + JetStream

**Why NATS over RabbitMQ / Kafka?**

| Criteria | NATS | RabbitMQ | Kafka |
|---|---|---|---|
| Operational Complexity | Very Low (single binary) | Medium | High (ZooKeeper/KRaft) |
| Resource Usage | ~20MB RAM | ~100MB+ | ~1GB+ |
| Pub/Sub | Native | Via exchanges | Via consumer groups |
| Persistence | JetStream built-in | Quorum queues | Native (complex) |
| Request/Reply | Native | RPC plugin | Not native |
| Subject Wildcards | `teamsync.>`, `teamsync.channel.*` | Limited | Not supported |
| Node.js SDK | Excellent | Good | Good |
| K8s Required | No | Optional | Yes (recommended) |

For a team of 10 users scaling to 100K+ without K8s, NATS is the pragmatic choice. It handles millions of messages per second, has built-in persistence via JetStream, and supports both pub/sub and request/reply patterns.

### Event Topology

```
                    ┌──────────────────┐
                    │   All Services   │
                    │   (Publishers)   │
                    └────────┬─────────┘
                             │
              ┌──────────────┼──────────────┐
              │              │              │
              ▼              ▼              ▼
     ┌────────────┐  ┌────────────┐  ┌────────────┐
     │  NATS Core │  │ NATS JS    │  │  BullMQ    │
     │  (Pub/Sub) │  │ (Persistent│  │  (Queues)  │
     │            │  │  Streams)  │  │            │
     └─────┬──────┘  └─────┬──────┘  └─────┬──────┘
           │               │               │
     ┌─────┴──────┐  ┌─────┴──────┐  ┌─────┴──────┐
     │ Subscribers│  │ Consumers  │  │ Workers    │
     │ (Realtime) │  │ (Services) │  │ (Jobs)     │
     └────────────┘  └────────────┘  └────────────┘
```

### Subject Naming Convention

```
<domain>.<entity>.<action>.<version>

Examples:
- auth.user.created.v1
- teamsync.message.sent.v1
- flowboard.workflow.step.completed.v1
- vaultspace.asset.tagged.v1
- insightai.agent.action.v1
- infra.service.health.changed.v1
```

### Wildcard Subscriptions

| Pattern | Matches | Used By |
|---|---|---|
| `teamsync.>` | All TeamSync events | LogLens, InsightAI |
| `*.user.created.v1` | User creation in any domain | TeamSync, DevPulse |
| `flowboard.workflow.>.v1` | All workflow events | LogLens, TeamSync |
| `>` | ALL events | LogLens (aggregator) |

### Core Event Schema (Zod)

```typescript
// @vistafam/events package
const BaseEventSchema = z.object({
  id: z.string().uuid(),              // Event UUID
  timestamp: z.string().datetime(), // ISO 8601
  source: z.string(),                 // Service name (e.g., "teamsync-api")
  subject: z.string(),              // NATS subject
  tenantId: z.string(),               // Multi-tenant isolation
  traceId: z.string(),                // OpenTelemetry trace ID
  version: z.string(),              // Semantic version (e.g., "v1")
  type: z.string(),                   // Event type discriminator
  payload: z.record(z.unknown()),   // Domain-specific data
  metadata: z.object({
    userId: z.string().optional(),
    clientIp: z.string().optional(),
    requestId: z.string().optional(),
  }).optional(),
});
```

### Event Categories & Streams

| Stream Name | Subjects | Retention | Max Age | Description |
|---|---|---|---|---|
| `AUDIT` | `auth.audit.>` | Limits (10M msgs) | 90 days | Security audit events |
| `DOMAIN` | `*.>.v1` | Limits (50M msgs) | 30 days | All domain events |
| `WORKFLOW` | `flowboard.>` | Work Queue | 7 days | Workflow execution events |
| `LOGS` | `log.>` | Limits (100M msgs) | 7 days | Structured log events |
| `AI` | `insightai.>` | Limits (10M msgs) | 30 days | AI agent events |
| `REALTIME` | `realtime.>` | Interest | 1 hour | Ephemeral presence events |

### Inter-Service Communication Patterns

#### Pattern 1: Fire-and-Forget (Pub/Sub)
```
Service A ──publish──> NATS ──deliver──> Service B, Service C
```
Used for: Notifications, audit logging, analytics

#### Pattern 2: Work Queue (Competing Consumers)
```
Service A ──publish──> NATS JetStream Work Queue ──deliver──> [Worker 1 | Worker 2 | Worker 3]
```
Used for: Background jobs, AI processing, bulk operations

#### Pattern 3: Request/Reply (Synchronous)
```
Service A ──request──> NATS ──deliver──> Service B ──reply──> Service A
```
Used for: Rare cases where async is impossible (e.g., real-time validation). Timeout: 5s.

#### Pattern 4: Event Sourcing (State Reconstruction)
```
Service A ──persist event──> NATS JetStream
                                     │
                                     ▼
                              Projection Service ──updates──> Read Model
```
Used for: Audit logs, workflow state machines

### BullMQ for Job Processing

NATS handles event delivery; BullMQ handles reliable job execution with:
- **Delayed jobs**: Schedule workflow triggers at specific times
- **Repeatable jobs**: Cron-like execution
- **Job priorities**: AI tasks vs background analytics
- **Dead letter queues**: Failed jobs retried 3x, then moved to DLQ
- **Progress tracking**: Long-running AI model inference

### Webhook Dispatcher

For external integrations, a dedicated webhook service:
- Listens to `webhook.trigger.v1` events
- Manages retry logic (exponential backoff, max 5 attempts)
- Signature verification (HMAC-SHA256)
- Webhook endpoint registry per tenant
