# PipeVista Central Infrastructure Backbone

PipeVista is the **nervous system** of the VistaFam ecosystem. It is not a frontend application — it is the operational backbone that every other service communicates through.

## Architecture Overview

```
                    ┌─────────────────────────────────────┐
                    │           NGINX (Edge)              │
                    │   SSL / WAF / Rate Limit / Geo      │
                    └──────────────┬──────────────────────┘
                                   │
                    ┌──────────────▼──────────────────────┐
                    │      pipevista-gateway (4100)       │
                    │  Auth · Validation · Circuit Breaker  │
                    │  Request Aggregation · Cache          │
                    └──────────────┬──────────────────────┘
                                   │
         ┌──────────────────────────┼──────────────────────────┐
         │                          │                          │
    ┌────▼────┐  ┌──────────────────▼──────┐  ┌───────────────▼──┐
    │Realtime │  │     Event Hub (4101)    │  │ AI Router (4102) │
    │ (4105)  │  │  Pub/Sub · DLQ · Retry  │  │  Fallback Chain  │
    └────┬────┘  └──────────────────┬──────┘  └──────────┬───────┘
         │                          │                     │
    ┌────▼────┐  ┌──────────────────▼──────┐  ┌──────────▼───────┐
    │Registry │  │     Connector (4104)    │  │ Observability    │
    │ (4103)  │  │  Webhook · API Proxy    │  │ (4106)           │
    └────┬────┘  └─────────────────────────┘  └──────────┬───────┘
         │                                                 │
    ┌────▼────────────────────────────────────────────────▼────┐
    │              pipevista-admin (4107)                       │
    │         Topology · Config · Operational Commands          │
    └───────────────────────────────────────────────────────────┘
```

## 8 Microservices

| Service | Port | Responsibility |
|---|---|---|
| **pipevista-gateway** | 4100 | API Gateway: auth routing, validation, rate limiting, request aggregation, websocket routing, versioning, service discovery, circuit breaker |
| **pipevista-event-hub** | 4101 | Event Infrastructure: pub/sub, workflow triggers, retries, DLQ, failure recovery, event replay |
| **pipevista-ai-router** | 4102 | AI Routing: model selection, provider abstraction, load balancing, fallback, token tracking, cost optimization |
| **pipevista-registry** | 4103 | Service Registry: health monitoring, discovery, endpoint registry, dynamic routing, config distribution |
| **pipevista-connector** | 4104 | Integration Layer: webhook dispatcher, external API proxy, connector management, protocol adapters |
| **pipevista-realtime** | 4105 | Realtime Infrastructure: websocket gateway, Redis pub/sub bridge, notification streams, presence |
| **pipevista-observability** | 4106 | Observability Collector: log aggregation proxy, trace collector, metrics forwarder, request ID propagation |
| **pipevista-admin** | 4107 | Admin Dashboard API: cross-service configuration, topology visualization, operational commands |

## Request Lifecycle (HTTP API)

```
Client Request
     │
     ▼
┌─────────────┐    1. WAF / Geo-block / SSL
│    NGINX    │    2. X-Forwarded-* headers
└──────┬──────┘
       │
       ▼
┌──────────────────────────────┐
│   pipevista-gateway (4100)  │
│  ─────────────────────────── │
│  3. Rate limit check         │
│     (Redis sliding window)   │
│  4. JWT validation           │
│     (cached in Redis)        │
│  5. RBAC permission check    │
│  6. Request validation (Zod) │
│  7. Trace ID generation      │
│  8. Tenant context injection │
│  9. Response cache lookup    │
│     (Redis, configurable TTL)│
│  10. Circuit breaker check   │
│  11. Route to upstream       │
│      (fetched from Registry) │
│  12. Response aggregation    │
│      (if multi-service)      │
│  13. Cache store (if miss)   │
│  14. Audit log emission      │
│     (async to Event Hub)     │
└──────┬───────────────────────┘
       │
       ▼
   Target Service
   (authsphere, teamsync, etc.)
       │
       ▼
   Response back through
   Gateway to Client
```

## Realtime Lifecycle

```
Client WebSocket Connection
     │
     ▼
┌──────────────────────────────┐
│  pipevista-gateway (4100)     │
│  ─ WebSocket upgrade routing   │
└──────┬───────────────────────┘
       │
       ▼
┌──────────────────────────────┐
│ pipevista-realtime (4105)    │
│  ─────────────────────────── │
│  1. Validate JWT             │
│  2. Extract tenantId, userId │
│  3. Join tenant room         │
│  4. Join user DM room        │
│  5. Update Redis presence    │
│     (TTL 30s)                │
│  6. Broadcast presence change  │
│     to tenant room           │
└──────┬───────────────────────┘
       │
       │   NATS Event
       │   (e.g., message.sent)
       │
       ▼
┌──────────────────────────────┐
│  Event Bridge:               │
│  1. Determine target room    │
│     from event metadata        │
│  2. Broadcast to Socket.IO   │
│     room                     │
│  3. Check offline users      │
│  4. Enqueue push notification│
│     for offline recipients   │
└──────────────────────────────┘
```

## AI Request Lifecycle

```
Service/Client
     │
     ▼ POST /v1/ai/chat
┌──────────────────────────────┐
│ pipevista-ai-router (4102)   │
│  ─────────────────────────── │
│  1. Authenticate (JWT)       │
│  2. Check tenant token quota  │
│     (Redis counter, 24h TTL) │
│  3. Validate request         │
│     (schema, max tokens)     │
│  4. Check semantic cache     │
│     (exact/embedding match)  │
│  5. Select model             │
│     (tenant config + request)│
│  6. Select provider          │
│     (health + rate limit)    │
│  7. Call provider API        │
│  8. On failure:              │
│     ├─ Retry same provider   │
│     └─ Fallback chain:      │
│        OpenAI → Anthropic →  │
│        Google → DeepSeek →   │
│        Ollama                │
│  9. Record tokens, latency,  │
│     cost to PostgreSQL       │
│  10. Publish                 │
│      insightai.tokens.used   │
│      event                   │
└──────┬───────────────────────┘
       │
       ▼
   LLM Response
```

## Event Processing Lifecycle

```
Service A wants to emit event
     │
     ▼ POST /v1/events/publish
┌──────────────────────────────┐
│ pipevista-event-hub (4101)   │
│  ─────────────────────────── │
│  1. Validate event schema    │
│     (Zod)                    │
│  2. Enrich metadata          │
│     (traceId, timestamp,     │
│      hubReceivedAt)          │
│  3. Determine routing        │
│     (subject + tenant filter)│
│  4. Publish to NATS          │
│     JetStream                │
│  5. Persist to event store   │
│     (PostgreSQL)             │
│  6. Check workflow triggers  │
│     → Enqueue FlowBoard      │
│  7. Return 202 Accepted      │
└──────┬───────────────────────┘
       │
       │ NATS JetStream
       │
       ▼
┌──────────────────────────────┐
│  Consumer (Event Hub)        │
│  ─────────────────────────── │
│  1. Route to subscribed      │
│     services via HTTP        │
│     webhook or NATS push      │
│  2. Track delivery attempts  │
│  3. On success: Ack message  │
│  4. On failure:              │
│     ├─ Retry queue (BullMQ)  │
│     │   Exponential backoff: │
│     │   1s → 5s → 15s → 30s  │
│     │   → 60s (max 5)        │
│     └─ On max retries: DLQ   │
│        (PostgreSQL)           │
└──────────────────────────────┘
       │
       │ DLQ
       ▼
┌──────────────────────────────┐
│  Dead Letter Queue           │
│  ─────────────────────────── │
│  POST /v1/events/dlq/:id/   │
│         replay               │
│  → Re-publish to NATS        │
│  → Remove from DLQ           │
└──────────────────────────────┘
```

## Service Discovery Lifecycle

```
Service Startup
     │
     ▼
┌──────────────────────────────┐
│  POST /v1/registry/register    │
│  → pipevista-registry (4103) │
│  ─────────────────────────── │
│  1. Persist to PostgreSQL    │
│  2. Set Redis key            │
│     pv:registry:service:{name}│
│     (TTL 30s)                │
│  3. Publish                  │
│     infra.service.registered │
│     event                    │
└──────┬───────────────────────┘
       │
       │ Other services learn
       │ via event or Redis
       ▼
┌──────────────────────────────┐
│  Gateway updates upstream    │
│  table from Redis cache      │
└──────────────────────────────┘

Health Check Loop (every 15s)
     │
     ▼
┌──────────────────────────────┐
│  Registry polls each service │
│  /health/ready               │
│  ─────────────────────────── │
│  1. 3 consecutive failures → │
│     mark UNHEALTHY           │
│  2. Publish                  │
│     infra.service.deregistered│
│  3. Gateway removes from     │
│     rotation                 │
│  4. Alert sent to            │
│     pipevista-observability  │
└──────────────────────────────┘
```

## Redis Architecture

```
Redis Cluster (6 nodes)
├── Master-1: slots 0-5460
│   └── Replica-1
├── Master-2: slots 5461-10922
│   └── Replica-2
└── Master-3: slots 10923-16383
    └── Replica-3

Key Patterns:
pv:gateway:jwt:{jti}          → JWT validation cache (5 min)
pv:gateway:rbac:{userId}      → Permission cache (1 min)
pv:gateway:rate:{tenantId}     → Rate limit counters (window)
pv:gateway:cache:{hash}        → Response cache (route TTL)
pv:registry:service:{name}     → Service upstream list (30 sec)
pv:registry:health:{serviceId} → Health status (15 sec)
pv:registry:config:{key}       → Hot config (persistent)
pv:ai:quota:{tenantId}         → Token usage (24 hours)
pv:ai:cache:{hash}             → Semantic/exact cache (1 hour)
pv:realtime:presence:{tid}:{uid} → Presence (30 sec)
pv:event:dlq:{eventId}         → DLQ metadata (7 days)
pv:session:{sessionId}         → Session binding (session TTL)
```

## Docker Swarm Topology

```
VPS-1 (Edge Layer)
  ├── NGINX (reverse proxy, SSL)
  ├── pipevista-gateway × 2
  └── pipevista-realtime × 2

VPS-2 (Processing Layer)
  ├── pipevista-event-hub × 2
  ├── pipevista-ai-router × 2
  └── pipevista-connector × 2

VPS-3 (Control Layer)
  ├── pipevista-registry × 2
  ├── pipevista-observability × 2
  └── pipevista-admin × 1

VPS-4 (Data Layer + Manager)
  ├── Redis Cluster (3 master + 3 replica)
  ├── NATS Cluster (3 nodes)
  ├── PostgreSQL (primary + replica)
  ├── MinIO (4-node distributed)
  ├── Loki
  ├── Prometheus
  └── Grafana
```

## Queue Architecture (BullMQ)

| Queue | Purpose | Workers | Consumers |
|---|---|---|---|
| `pv:event-retries` | Failed event retry delivery | 3 | pipevista-event-hub |
| `pv:webhook-delivery` | Outbound webhook dispatch | 5 | pipevista-connector |
| `pv:ai-requests` | AI provider calls (rate-limited) | 10 | pipevista-ai-router |
| `pv:audit-log` | Async audit log persistence | 2 | pipevista-observability |
| `pv:config-reload` | Service config update propagation | 1 | pipevista-registry |
| `pv:notification-push` | Offline user push notifications | 3 | pipevista-realtime |
| `pv:workflow-triggers` | FlowBoard workflow execution | 5 | pipevista-event-hub |

## Security Model

```
Edge (NGINX)
  ├─ TLS 1.3 termination
  ├─ Geo-blocking
  └─ DDoS rate limits

Gateway (pipevista-gateway)
  ├─ JWT validation (cached)
  ├─ RBAC permission enforcement
  ├─ Request schema validation (Zod)
  ├─ API key authentication
  └─ Response header security

Inter-service
  ├─ Service-to-service JWT
  ├─ mTLS (future)
  └─ Request ID + tenant context propagation

Data Layer
  ├─ PostgreSQL row-level security
  ├─ Redis AUTH + ACL
  ├─ NATS credentials file
  └─ Docker Secrets for credentials
```

## Scaling Strategy

| Component | Scaling Approach | Trigger |
|---|---|---|
| Gateway | Horizontal (replicas) | CPU > 70% or latency p95 > 200ms |
| Event Hub | Horizontal + partition | Backlog depth > 10K |
| AI Router | Horizontal + queue | Queue depth > 50 or latency > 5s |
| Registry | Horizontal (read replicas) | Read QPS > 10K |
| Realtime | Horizontal (rooms shard) | Connections per node > 10K |
| Redis | Cluster expansion | Memory > 80% |
| NATS | Cluster expansion | Message throughput > 100K/s |
| PostgreSQL | Read replicas | Read QPS > 5K |
