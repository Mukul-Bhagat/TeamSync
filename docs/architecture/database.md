# Database Strategy

## 8. Database Strategy

### Why PostgreSQL as the Primary Database?

| Requirement | PostgreSQL Capability |
|---|---|
| Relational data | Native, battle-tested |
| JSON documents | `jsonb` with GIN indexes |
| Full-text search | `tsvector` / `tsquery` |
| Vector search | `pgvector` extension for AI embeddings |
| Geospatial | `PostGIS` extension |
| Time-series | `timescaledb` extension (if needed) |
| Row-level security | Native RLS policies |
| Extensions | Rich ecosystem |
| Operational maturity | 30+ years, extensive tooling |
| Cost | Open source, no licensing |

For an ecosystem starting at 10 users and scaling to 100K+, PostgreSQL is the right choice because:
1. It handles both structured relational data and semi-structured JSON
2. Read replicas provide horizontal read scaling without application changes
3. Connection pooling (PgBouncer) handles thousands of concurrent connections
4. Partitioning supports time-series data (logs, events, metrics)

### Database-per-Service with Shared Cluster

```
┌─────────────────────────────────────────────────────────────────┐
│              PostgreSQL Primary Cluster                          │
│  (Managed: AWS RDS, GCP Cloud SQL, or self-hosted)              │
│                                                                  │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐             │
│  │  authsphere │  │  pipevista  │  │  flowboard  │             │
│  │   schema    │  │   schema    │  │   schema    │             │
│  └─────────────┘  └─────────────┘  └─────────────┘             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐             │
│  │  teamsync   │  │  vaultspace │  │  loglens    │             │
│  │   schema    │  │   schema    │  │   schema    │             │
│  └─────────────┘  └─────────────┘  └─────────────┘             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐             │
│  │  devpulse   │  │schemaforge  │  │  querymind  │             │
│  │   schema    │  │   schema    │  │   schema    │             │
│  └─────────────┘  └─────────────┘  └─────────────┘             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐             │
│  │  deployhub  │  │  insightai  │  │   shared    │             │
│  │   schema    │  │   schema    │  │   (events,  │             │
│  └─────────────┘  └─────────────┘  │   config)   │             │
│                                    └─────────────┘             │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │  Extensions: pgvector, uuid-ossp, citext, pgcrypto         ││
│  └─────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────────┐
│              PostgreSQL Read Replicas                            │
│  (For: LogLens queries, analytics dashboards, AI embeddings)     │
│  (Lag: < 1 second typical)                                      │
└─────────────────────────────────────────────────────────────────┘
```

### Schema Isolation Strategy

Each service connects to the same Postgres cluster but uses its own schema:

```typescript
// Connection string per service
const connectionStrings = {
  authsphere: 'postgresql://user:pass@db:5432/vistafam?schema=authsphere',
  teamsync: 'postgresql://user:pass@db:5432/vistafam?schema=teamsync',
  flowboard: 'postgresql://user:pass@db:5432/vistafam?schema=flowboard',
  // ... etc
};
```

**Why schemas instead of separate databases?**
- **Operational simplicity**: One backup/restore strategy, one monitoring target
- **Resource efficiency**: Shared connection pool, shared WAL
- **Future split-ready**: When a service needs its own cluster, `pg_dump --schema=teamsync` and restore
- **Cross-schema reads prohibited**: Enforced by application layer, not database grants

**When to split to separate clusters?**
- When a single service's data exceeds 500GB
- When a service needs different backup SLAs
- When compliance requires isolated storage
- When query patterns conflict (OLTP vs OLAP)

### Multi-Tenancy at the Database Layer

```sql
-- Every table in every schema has tenant_id
CREATE TABLE teamsync.channels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Row Level Security policy
CREATE POLICY tenant_isolation ON teamsync.channels
  USING (tenant_id = current_setting('app.current_tenant')::UUID);

-- Application sets tenant context per request
SET app.current_tenant = '550e8400-e29b-41d4-a716-446655440000';
```

### Event Store Pattern

For event sourcing and audit trails, a dedicated event store table:

```sql
CREATE TABLE shared.events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  stream_id TEXT NOT NULL,
  stream_name TEXT NOT NULL,
  event_type TEXT NOT NULL,
  event_version TEXT NOT NULL DEFAULT 'v1',
  payload JSONB NOT NULL,
  metadata JSONB,
  sequence_number BIGINT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),

  UNIQUE(stream_id, stream_name, sequence_number)
);

CREATE INDEX idx_events_tenant_type ON shared.events(tenant_id, event_type);
CREATE INDEX idx_events_stream ON shared.events(stream_id, stream_name, sequence_number);
```

### QueryMind + pgvector for AI

```sql
-- Enable pgvector
CREATE EXTENSION IF NOT EXISTS vector;

-- Store conversation embeddings for semantic search
CREATE TABLE insightai.memories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  user_id UUID NOT NULL,
  conversation_id UUID NOT NULL,
  content TEXT NOT NULL,
  embedding VECTOR(1536),  -- OpenAI ada-002 dimension
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Vector similarity search
CREATE INDEX idx_memories_embedding ON insightai.memories
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- Usage:
-- SELECT content, 1 - (embedding <=> query_embedding) AS similarity
-- FROM insightai.memories
-- WHERE tenant_id = $1
-- ORDER BY embedding <=> $2
-- LIMIT 5;
```

### Migration Strategy

- **Tool**: `node-pg-migrate` or `prisma migrate` per service
- **Process**: Each service owns its schema migrations
- **CI**: Migrations run before deployment in CI pipeline
- **Rollback**: Down migrations tested in staging
- **Locking**: Advisory locks prevent concurrent migration runs

### Read Model Projections

For complex queries (search, analytics), dedicated read models:

```
Write Model (PostgreSQL) ──events──> Projection Worker ──writes──> Read Model
                                                                         │
                                                                         ▼
                                                              ┌─────────────────┐
                                                              │  Elasticsearch  │
                                                              │  (Full-text)    │
                                                              │  or             │
                                                              │  PostgreSQL     │
                                                              │  (Materialized) │
                                                              │  or             │
                                                              │  Redis (Cache)  │
                                                              └─────────────────┘
```

### Connection Management

| Scale | Setup |
|---|---|
| 1-1,000 users | Direct connections (100 max) |
| 1,000-10,000 | PgBouncer (transaction pool, 1,000 max) |
| 10,000-100,000 | PgBouncer + Read replicas |
| 100,000+ | Connection per service, RDS Proxy / PgBouncer cluster |

### Caching Strategy

```
┌─────────────────────────────────────────────────────────────────┐
│                        REDIS CACHE                               │
│                                                                  │
│  Layer 1: Query Cache (per tenant)                             │
│  • Cache key: `q:{tenantId}:{sql_hash}`                        │
│  • TTL: 60 seconds for frequently changing data                  │
│  • TTL: 1 hour for reference data (roles, permissions)           │
│                                                                  │
│  Layer 2: Entity Cache                                          │
│  • Cache key: `e:{tenantId}:{entity}:{id}`                     │
│  • TTL: 5 minutes                                               │
│  • Invalidation on write (via event)                            │
│                                                                  │
│  Layer 3: Session / Token Cache                                 │
│  • Cache key: `s:{tokenJti}`                                    │
│  • TTL: matches token expiry                                    │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Data Retention & Archiving

```sql
-- Partition tables by time for log/event data
CREATE TABLE loglens.logs_2024_01 PARTITION OF loglens.logs
  FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');

-- Auto-archive partitions older than 90 days to S3/MinIO
-- Using pg_dump + compression, then DROP partition
```
