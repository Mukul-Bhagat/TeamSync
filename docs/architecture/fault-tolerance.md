# Fault Tolerance Strategy

## 17. Fault Tolerance Strategy

### Design Principle: Graceful Degradation

When a component fails, the entire system must not fail. Services degrade to reduced functionality rather than crashing completely.

### Failure Modes & Responses

```
┌─────────────────────────────────────────────────────────────────┐
│              FAILURE MODE RESPONSE MATRIX                        │
├──────────────────┬──────────────────────────────────────────────┤
│  Failure         │  Response                                    │
├──────────────────┼──────────────────────────────────────────────┤
│  Redis down      │  Skip caching, direct DB queries (slower)  │
│  NATS down       │  Queue events in local memory, retry       │
│  PostgreSQL down │  Return 503 with Retry-After header        │
│  AI provider down│  Fallback to next provider, or queue       │
│  Single service  │  Circuit breaker opens, degraded mode      │
│    instance down │  Load balancer routes to healthy instances │
│  Disk full       │  Alert + stop accepting uploads            │
│  Memory pressure │  Shed load, return 429, scale up           │
│  Network partition│ Split-brain detection, prefer consistency │
└──────────────────┴──────────────────────────────────────────────┘
```

### Circuit Breaker Implementation

Every outbound HTTP call and event publish uses a circuit breaker:

```typescript
// @vistafam/utils
class CircuitBreaker {
  private state: 'closed' | 'open' | 'half-open' = 'closed';
  private failures = 0;
  private successes = 0;
  private lastFailureTime: number | null = null;

  constructor(
    private name: string,
    private threshold = 5,          // Failures before opening
    private timeout = 30000,         // 30s cooling period
    private halfOpenMax = 3         // Test requests in half-open
  ) {}

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'open') {
      const elapsed = Date.now() - (this.lastFailureTime || 0);
      if (elapsed < this.timeout) {
        throw new CircuitBreakerOpenError(
          `Circuit ${this.name} is OPEN. Retry after ${this.timeout - elapsed}ms`
        );
      }
      this.state = 'half-open';
      this.successes = 0;
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
    if (this.state === 'half-open') {
      this.successes++;
      if (this.successes >= this.halfOpenMax) {
        this.state = 'closed';
        this.failures = 0;
      }
    } else {
      this.failures = 0;
    }
  }

  private onFailure() {
    this.failures++;
    this.lastFailureTime = Date.now();

    if (this.state === 'half-open') {
      this.state = 'open';
    } else if (this.failures >= this.threshold) {
      this.state = 'open';
      logger.error(`Circuit ${this.name} OPENED after ${this.failures} failures`);
      events.publish('infra.circuit_breaker.opened', { service: this.name });
    }
  }
}
```

### Retry Policies

```typescript
interface RetryPolicy {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
  retryableErrors: (Error | number)[];
  onRetry?: (attempt: number, error: Error, delayMs: number) => void;
}

// Default policies by service type
const defaultPolicies: Record<string, RetryPolicy> = {
  'database': {
    maxRetries: 3,
    baseDelayMs: 100,
    maxDelayMs: 5000,
    backoffMultiplier: 2,
    retryableErrors: ['ECONNREFUSED', 'ETIMEDOUT', 'ECONNRESET', 503],
  },
  'ai_provider': {
    maxRetries: 2,
    baseDelayMs: 1000,
    maxDelayMs: 30000,
    backoffMultiplier: 2,
    retryableErrors: [429, 500, 502, 503, 'ECONNRESET'],
  },
  'event_bus': {
    maxRetries: 5,
    baseDelayMs: 100,
    maxDelayMs: 10000,
    backoffMultiplier: 2,
    retryableErrors: ['NATS_DISCONNECTED', 'TIMEOUT'],
  },
  'http_service': {
    maxRetries: 2,
    baseDelayMs: 200,
    maxDelayMs: 5000,
    backoffMultiplier: 2,
    retryableErrors: [408, 429, 500, 502, 503, 504],
  },
};

// Exponential backoff with full jitter
function calculateDelay(attempt: number, policy: RetryPolicy): number {
  const exponential = policy.baseDelayMs * Math.pow(policy.backoffMultiplier, attempt);
  const clamped = Math.min(exponential, policy.maxDelayMs);
  const jitter = Math.random() * clamped; // Full jitter prevents thundering herd
  return Math.floor(jitter);
}
```

### Dead Letter Queue (DLQ)

```typescript
// NATS JetStream DLQ configuration
const dlqConfig = {
  stream: 'DLQ',
  subjects: ['dlq.>'],
  retention: 'limits',
  maxMsgs: 1000000,
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
};

// When a message fails maxDeliver times, it's republished to DLQ
// With header: `NATS-Last-Consumer: consumer-name`
// And header: `NATS-Last-Stream: original-stream`

// DLQ processing service:
class DLQProcessor {
  async process(message: NATSMessage) {
    const originalSubject = message.headers.get('NATS-Last-Stream');
    const failureCount = message.headers.get('NATS-Deliver-Count');

    // 1. Log to Loki
    await loglens.ingest({
      level: 'error',
      message: `DLQ message from ${originalSubject}`,
      metadata: { subject: originalSubject, attempts: failureCount },
    });

    // 2. Send P1 alert if critical
    if (this.isCritical(message)) {
      await alertService.sendP1Alert(`Critical DLQ: ${originalSubject}`);
    }

    // 3. Store for manual replay
    await db.dlqMessages.insert({
      subject: originalSubject,
      payload: message.data,
      attempts: parseInt(failureCount, 10),
      receivedAt: new Date(),
    });

    // 4. Acknowledge (remove from DLQ)
    message.ack();
  }
}
```

### Graceful Shutdown

```typescript
// Every service implements graceful shutdown
async function gracefulShutdown(signal: string) {
  logger.info(`Received ${signal}, starting graceful shutdown...`);

  // 1. Stop accepting new requests
  server.close();

  // 2. Wait for in-flight requests to complete (30s timeout)
  await waitForRequestsToComplete(30000);

  // 3. Stop NATS consumers (finish processing current messages)
  await nats.drain();

  // 4. Stop BullMQ workers (finish current jobs)
  await queue.close();

  // 5. Flush logs
  await logger.flush();

  // 6. Close database connections
  await db.end();

  // 7. Deregister from PipeVista
  await pipevista.deregister(serviceId);

  logger.info('Graceful shutdown complete');
  process.exit(0);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
```

### Health Check Deep Dive

```typescript
interface HealthCheckResult {
  status: 'healthy' | 'degraded' | 'unhealthy';
  version: string;
  uptime: number;
  timestamp: string;
  checks: DependencyCheck[];
}

interface DependencyCheck {
  name: string;
  status: 'up' | 'down' | 'degraded';
  latencyMs: number;
  message?: string;
}

// Liveness probe: is process running?
// Kubernetes/Docker calls this every 10s
// Failure threshold: 3 → restart container
app.get('/health/live', async (req, res) => {
  res.status(200).send({ status: 'alive' });
});

// Readiness probe: can it accept traffic?
// Failure threshold: 3 → remove from load balancer
app.get('/health/ready', async (req, res) => {
  const checks = await Promise.all([
    checkDatabase(),
    checkRedis(),
    checkNATS(),
  ]);

  const allUp = checks.every((c) => c.status === 'up');
  const anyDown = checks.some((c) => c.status === 'down');

  const status = anyDown ? 'unhealthy' : allUp ? 'healthy' : 'degraded';
  const code = anyDown ? 503 : allUp ? 200 : 200;

  res.status(code).send({ status, checks });
});

// Deep health: dependency chain
app.get('/health/dependencies', async (req, res) => {
  const checks = await Promise.all([
    checkDatabase(),
    checkRedis(),
    checkNATS(),
    checkMinIO(),
    checkAuthSphere(),
  ]);
  res.send({ checks });
});
```

### Bulkhead Pattern (Resource Isolation)

Prevent one tenant or one feature from consuming all resources:

```typescript
// Per-tenant request queues
const tenantQueues = new Map<string, PQueue>();

function getTenantQueue(tenantId: string): PQueue {
  if (!tenantQueues.has(tenantId)) {
    tenantQueues.set(tenantId, new PQueue({ concurrency: 10 }));
  }
  return tenantQueues.get(tenantId)!;
}

// Route request through tenant's queue
async function handleRequest(req: FastifyRequest) {
  const tenantId = req.tenantId;
  const queue = getTenantQueue(tenantId);

  return queue.add(() => processRequest(req), {
    timeout: 30000,
    throwOnTimeout: true,
  });
}
```

### Backup & Recovery

```
┌─────────────────────────────────────────────────────────────────┐
│                    BACKUP STRATEGY                             │
├──────────────────┬──────────────────────────────────────────────┤
│  Data Type       │  Backup Method                               │
├──────────────────┼──────────────────────────────────────────────┤
│  PostgreSQL      │  pg_dump daily + WAL-E continuous archiving │
│  Redis           │  RDB snapshot every 6 hours + AOF          │
│  NATS JetStream  │  Stream replication (3x) + snapshot         │
│  MinIO           │  Erasure coding (4 nodes, 2 parity)        │
│  Config          │  Git version control + encrypted secrets    │
│  Logs            │  Loki retention 30 days, archived to S3    │
└──────────────────┴──────────────────────────────────────────────┘

Recovery Time Objectives (RTO):
  • Service restart: < 30 seconds
  • Container restart: < 10 seconds
  • Database restore: < 1 hour
  • Full system restore: < 4 hours

Recovery Point Objectives (RPO):
  • Critical data: 0 (WAL streaming)
  • Standard data: < 1 hour (RDB snapshot)
  • Logs: < 6 hours (acceptable loss)
```
