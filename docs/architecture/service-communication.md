# Service Communication Flow

## 11. Service Communication Flow

### Communication Patterns Matrix

| Scenario | Pattern | Technology | Why |
|---|---|---|---|
| User login | Sync API | HTTP/REST | User waiting, must be fast |
| Send chat message | Async event | NATS + Socket.IO | Real-time, decoupled |
| Run workflow | Async event | NATS JetStream | Long-running, retryable |
| Process AI request | Async queue | BullMQ | Rate-limited by provider |
| File upload | Async event | NATS + MinIO | Large payload, background processing |
| Validate permission | Sync API | HTTP (cached) | Fast path, Redis-backed |
| Health check | Sync API | HTTP | Monitoring requirement |
| Cross-service query | Async event | NATS Request/Reply | Rare, 5s timeout |

### Sync vs Async Decision Tree

```
Does the caller need an immediate response?
  │
  ├─ YES ──> Is it a read or write operation?
  │            │
  │            ├─ READ ──> Sync API (HTTP GET/POST with cache)
  │            │           Cache hit: < 5ms
  │            │           Cache miss: < 200ms
  │            │
  │            └─ WRITE ──> Is it simple (< 100ms)?
  │                         │
  │                         ├─ YES ──> Sync API (HTTP POST)
  │                         └─ NO  ──> Async event + polling/Socket.IO
  │
  └─ NO  ──> Async event (NATS or BullMQ)
             Fire and forget, caller receives 202 Accepted
```

### Complete Request Flow: User Sends a Chat Message

```
┌─────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐
│  User   │     │  Browser │     │  NGINX   │     │ Gateway  │     │AuthSphere│
│  "Hello"│────>│(Next.js) │────>│ (Edge)   │────>│(Fastify) │────>│(Validate)│
└─────────┘     └──────────┘     └──────────┘     └────┬─────┘     └────┬─────┘
                                                      │                │
                                                      │ JWT Valid      │
                                                      │ Tenant=acme    │
                                                      │ Perm=send_msg  │
                                                      │                │
                                                      ▼                │
                                               ┌──────────┐            │
                                               │ TeamSync │            │
                                               │  API     │<───────────┘
                                               │(Fastify) │
                                               └────┬─────┘
                                                    │
                                                    │ 1. Validate channel membership
                                                    │ 2. Persist message to PostgreSQL
                                                    │ 3. Publish `teamsync.message.sent.v1`
                                                    │ 4. Update unread counters
                                                    │ 5. Return 201 with message ID
                                                    │
                          ┌─────────────────────────┼─────────────────────────┐
                          │                         │                         │
                          ▼                         ▼                         ▼
                   ┌─────────────┐          ┌─────────────┐          ┌─────────────┐
                   │    NATS     │          │    NATS     │          │    NATS     │
                   │  (Realtime  │          │  (InsightAI │          │  (LogLens   │
                   │   Bridge)   │          │  Analysis)  │          │  Audit)     │
                   └──────┬──────┘          └──────┬──────┘          └──────┬──────┘
                          │                         │                         │
                          ▼                         │                         ▼
                   ┌─────────────┐                 │                  ┌─────────────┐
                   │  Socket.IO  │                 │                  │    Loki     │
                   │  (Redis     │                 │                  │  (Logs)     │
                   │   Adapter)  │                 │                  └─────────────┘
                   └──────┬──────┘                 │
                          │                         │
                          ▼                         ▼
                   ┌─────────────┐          ┌─────────────┐
                   │  Browser    │          │  InsightAI  │
                   │  (Channel   │          │  (Sentiment │
                   │   Room)     │          │  Analysis)  │
                   └─────────────┘          └─────────────┘
                          │
                          ▼
                   ┌─────────────┐
                   │  Browser    │
                   │  (User B's  │
                   │   Client)   │
                   └─────────────┘
```

### Event Flow: Workflow Triggers Deployment

```
┌─────────────┐
│  FlowBoard  │
│  "Deploy to  │
│   staging"  │
└──────┬──────┘
       │ 1. Publish `flowboard.workflow.step.executed`
       │    payload: { stepType: "deploy", environment: "staging" }
       │
       ▼
┌─────────────────────────────────────────────────────────────────┐
│  NATS JetStream (flowboard.> stream)                           │
└─────────────────────────────────────────────────────────────────┘
       │
       ▼
┌─────────────┐
│  DeployHub  │
│  Listener   │
└──────┬──────┘
       │ 2. Parse event, start build pipeline
       │ 3. Publish `deployhub.build.started`
       │
       ▼
┌─────────────────────────────────────────────────────────────────┐
│  NATS (deployhub.> stream)                                     │
└─────────────────────────────────────────────────────────────────┘
       │
       ├──────────────┬──────────────┬──────────────┐
       │              │              │              │
       ▼              ▼              ▼              ▼
┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐
│ LogLens  │  │ DevPulse │  │ TeamSync │  │PipeVista │
│ (Log it) │  │ (Metrics)│  │(Notify)  │  │(Health)  │
└──────────┘  └──────────┘  └──────────┘  └──────────┘
       │
       ▼ (Build completes)
┌─────────────┐
│  DeployHub  │
│  "Build OK" │
└──────┬──────┘
       │ 4. Publish `deployhub.build.completed`
       │
       ▼
┌─────────────┐
│  FlowBoard  │
│  "Next step │
│   approved" │
└─────────────┘
```

### Internal API Calling Convention

```typescript
// @vistafam/sdk package generates typed clients
interface ServiceClient {
  // Every internal API call includes:
  // Authorization: Bearer <service_jwt>
  // X-Tenant-ID: <tenantId>
  // X-Trace-ID: <traceId>
  // X-Request-ID: <requestId>

  // Example: FlowBoard calls DeployHub
  deployHub: {
    triggerBuild(params: {
      workflowId: string;
      pipelineId: string;
      environment: string;
      commitSha: string;
    }): Promise<{ buildId: string; status: 'queued' }>;
  };
}

// Service-to-service auth
const serviceToken = await authClient.getServiceToken({
  clientId: 'flowboard-service',
  clientSecret: process.env.FLOWBOARD_SERVICE_SECRET,
});
```

### Circuit Breaker Pattern

```typescript
// @vistafam/utils package
class CircuitBreaker {
  private state: 'closed' | 'open' | 'half-open' = 'closed';
  private failures = 0;
  private lastFailureTime: number | null = null;

  constructor(
    private threshold = 5,
    private timeout = 30000,
    private halfOpenMaxCalls = 3
  ) {}

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'open') {
      if (Date.now() - (this.lastFailureTime || 0) > this.timeout) {
        this.state = 'half-open';
      } else {
        throw new CircuitBreakerOpenError();
      }
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess() {
    this.failures = 0;
    this.state = 'closed';
  }

  private onFailure() {
    this.failures++;
    this.lastFailureTime = Date.now();
    if (this.failures >= this.threshold) {
      this.state = 'open';
    }
  }
}
```

### Retry Policy

```typescript
// Exponential backoff with jitter
interface RetryConfig {
  maxRetries: 3;
  baseDelayMs: 100;
  maxDelayMs: 10000;
  backoffMultiplier: 2;
  retryableStatusCodes: [408, 429, 500, 502, 503, 504];
}

function calculateDelay(attempt: number, config: RetryConfig): number {
  const exponential = config.baseDelayMs * Math.pow(config.backoffMultiplier, attempt);
  const clamped = Math.min(exponential, config.maxDelayMs);
  const jitter = Math.random() * 0.3 * clamped; // 0-30% jitter
  return Math.floor(clamped + jitter);
}
```

### Dead Letter Queue (DLQ)

Failed events are routed to DLQ after max retries:

```typescript
// NATS JetStream consumer config
const consumerConfig = {
  deliverPolicy: 'all',
  ackPolicy: 'explicit',
  maxDeliver: 5,           // Retry 5 times
  backoff: [1000, 5000, 15000, 30000, 60000], // Exponential backoff
  // After 5 failures, message goes to DLQ stream
};

// DLQ processing
nats.subscribe('dlq.>', async (msg) => {
  await alertService.sendP1Alert(`DLQ message: ${msg.subject}`);
  await loglens.ingest({ level: 'error', message: 'Event failed permanently', event: msg });
});
```
