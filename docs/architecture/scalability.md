# Scalability Strategy

## 16. Scalability Strategy

### Scaling Philosophy: Start Simple, Scale Proven Bottlenecks

Do not optimize prematurely. Start with a single VM running Docker Compose. Monitor metrics. Scale the component that actually becomes the bottleneck.

### Scaling Phases

```
Phase 1: Single VM (10 - 1,000 users)
├─ 1 VM (4 vCPU, 8GB RAM)
├─ Docker Compose: all services + infra on one machine
├─ PostgreSQL single instance
├─ Redis single instance
├─ NATS single instance
└─ Estimated cost: $50-100/month

Phase 2: Vertical Scaling (1,000 - 10,000 users)
├─ 1 VM (8 vCPU, 32GB RAM)
├─ PostgreSQL on separate VM (4 vCPU, 16GB RAM)
├─ Redis on separate VM (2 vCPU, 8GB RAM)
├─ Application services scaled via Docker replicas
├─ Read replica for PostgreSQL (analytics queries)
└─ Estimated cost: $300-500/month

Phase 3: Horizontal Scaling (10,000 - 100,000 users)
├─ Load balancer + 2-3 application VMs
├─ PostgreSQL primary + 2 read replicas
├─ Redis Cluster (3 master + 3 replica)
├─ NATS Cluster (3 nodes with JetStream replication)
├─ MinIO distributed (4 nodes)
├─ Separate observability stack VM
├─ Services independently scaled based on load
└─ Estimated cost: $1,000-3,000/month

Phase 4: Cloud-Native (100,000+ users)
├─ Managed services: RDS, ElastiCache, SQS/SNS
├─ Or Kubernetes with auto-scaling
├─ CDN for static assets
├─ Database sharding by tenant
├─ Event-driven microservices on serverless (Lambda/Cloud Functions)
└─ Estimated cost: $5,000+/month
```

### Stateless Service Design

Every service must be stateless. No in-memory sessions, no local file storage, no singleton assumptions.

```typescript
// ❌ BAD: Stateful service
class BadService {
  private sessions = new Map(); // In-memory, lost on restart
  private uploadDir = '/tmp/uploads'; // Local filesystem
}

// ✅ GOOD: Stateless service
class GoodService {
  private redis: Redis;        // External cache for sessions
  private storage: MinIOClient; // External storage for files
  private db: PostgresClient;   // External database for state
}
```

### Database Scaling Strategies

| Strategy | When | Implementation |
|---|---|---|
| **Connection Pooling** | Always | PgBouncer, max 100 connections per service |
| **Read Replicas** | Read-heavy workloads | Route SELECT queries to replicas |
| **Query Optimization** | Slow queries | Add indexes, denormalize read models |
| **Caching** | Repeated queries | Redis for hot data (5 min TTL) |
| **Partitioning** | Large tables (> 10M rows) | Time-based partitions for logs/events |
| **Vertical Scaling** | CPU/memory bound | Bigger PostgreSQL instance |
| **Read Model Separation** | Complex analytics | Elasticsearch for search, ClickHouse for analytics |
| **Sharding** | 100K+ users, single DB bottleneck | Shard by tenant_id (consistent hashing) |

### Cache Strategy by Layer

```
┌─────────────────────────────────────────────────────────────────┐
│                      CACHING HIERARCHY                           │
├─────────────────────────────────────────────────────────────────┤
│  L1: In-Memory (Node.js process)                                  │
│  • JWT public keys (5 min TTL)                                  │
│  • RBAC permission maps (1 min TTL)                             │
│  • Hot configuration (10 min TTL)                               │
│  • Hit: < 1ms | Miss: N/A (in-process)                         │
├─────────────────────────────────────────────────────────────────┤
│  L2: Redis (Distributed Cache)                                  │
│  • Entity objects (5 min TTL)                                   │
│  • Query results (1 min TTL for mutable, 1 hour for static)   │
│  • Session data (TTL = session expiry)                          │
│  • Rate limit counters (window TTL)                             │
│  • Presence data (30s TTL)                                      │
│  • Hit: 1-5ms | Miss: PostgreSQL query                          │
├─────────────────────────────────────────────────────────────────┤
│  L3: PostgreSQL (Primary + Read Replicas)                       │
│  • All persistent data                                          │
│  • Event store                                                   │
│  • Read models (materialized views refreshed every 5 min)       │
│  • Hit: 5-50ms | Miss: N/A (source of truth)                    │
├─────────────────────────────────────────────────────────────────┤
│  L4: Search Index (Elasticsearch / Meilisearch)                 │
│  • Full-text search (messages, files, docs)                    │
│  • Faceted search                                                │
│  • Hit: 10-50ms | Miss: Fallback to PostgreSQL LIKE             │
└─────────────────────────────────────────────────────────────────┘
```

### Event Bus Scaling

| Load | NATS Setup | JetStream |
|---|---|---|
| < 1,000 msg/s | Single instance | Disabled (pure pub/sub) |
| 1,000 - 10,000 msg/s | Single instance | Enabled, memory storage |
| 10,000 - 100,000 msg/s | 3-node cluster | Enabled, file storage, 3x replication |
| > 100,000 msg/s | 5+ node cluster | File storage, leaf nodes |

### Frontend Scaling

```
┌─────────────────────────────────────────────────────────────────┐
│                    FRONTEND SCALING                              │
│                                                                  │
│  1. Static Generation (Next.js ISR)                               │
│     • Dashboard shells, settings pages → pre-rendered            │
│     • Revalidate: 60 seconds                                     │
│                                                                  │
│  2. Edge Caching (Cloudflare / Vercel Edge)                     │
│     • API responses cached at edge (10s-5min based on endpoint) │
│                                                                  │
│  3. Bundle Splitting                                              │
│     • Each product app is code-split                             │
│     • Heavy AI chat component loaded on demand                   │
│                                                                  │
│  4. Realtime Optimization                                       │
│     • Socket.IO rooms prevent broadcast storms                   │
│     • Presence updates batched (every 5s, not instant)           │
│     • Message history paginated (50 messages per fetch)            │
│                                                                  │
│  5. Image/Asset Optimization                                      │
│     • Next.js Image component with CDN                           │
│     • VaultSpace presigned URLs for direct S3/MinIO access       │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### AI Scaling

| Users | AI Architecture |
|---|---|
| 1-100 | Direct API calls to OpenAI, no queue |
| 100-1,000 | BullMQ queue for AI requests, 5 workers |
| 1,000-10,000 | BullMQ + token bucket rate limiting, provider fallback |
| 10,000+ | Dedicated AI inference cluster (Ollama on GPU VMs) + cloud fallback |

### Cost Optimization

```typescript
// Per-tenant resource quotas
interface TenantQuota {
  maxUsers: number;
  maxStorageGB: number;
  maxAITokensPerDay: number;
  maxWorkflowExecutionsPerHour: number;
  maxConcurrentSocketConnections: number;
  maxAPIRequestsPerMinute: number;
}

// Enforced at:
// - Gateway (rate limiting)
// - InsightAI (token budget)
// - FlowBoard (execution throttle)
// - VaultSpace (storage quota)
// - PostgreSQL (connection limit per tenant)
```

### Multi-Region (Future)

When expanding globally:
- Primary region: US-East (write master)
- Read replicas: EU-West, APAC (read-only)
- Event replication: NATS leaf nodes bridge regions
- Data residency: EU tenant data stays in EU
