# Logging + Monitoring Architecture

## 10. Logging + Monitoring Setup

### Philosophy: Three Pillars of Observability

Every service must emit:
1. **Metrics** (numbers) — "How many? How fast?"
2. **Logs** (text) — "What happened?"
3. **Traces** (request flow) — "Where did time go?"

### Why Loki + Grafana + Prometheus?

| Technology | Role | Why |
|---|---|---|
| **Prometheus** | Metrics collection & storage | Industry standard, pull-based (scales well), powerful PromQL |
| **Grafana** | Visualization dashboards | Best-in-class, supports all data sources, alert rules |
| **Loki** | Log aggregation | Lightweight, labels-based indexing, integrates with Grafana |
| **OpenTelemetry** | Distributed tracing | Vendor-neutral, automatic instrumentation, context propagation |

Loki is chosen over ELK/EFK because:
- **Resource efficient**: No full-text indexing, just label-based filtering
- **Simple operation**: Single binary, no Elasticsearch cluster to manage
- **Grafana native**: Seamless correlation between logs, metrics, and traces

### Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         SERVICES                                │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐       │
│  │ AuthSphere│  │ TeamSync │  │ FlowBoard│  │ InsightAI│       │
│  │ ...      │  │ ...      │  │ ...      │  │ ...      │       │
│  └──┬───┬───┘  └──┬───┬───┘  └──┬───┬───┘  └──┬───┬───┘       │
│     │   │        │   │        │   │        │   │             │
│     │   │        │   │        │   │        │   │             │
│  metrics│logs   metrics│logs   metrics│logs   metrics│logs    │
│     │   │        │   │        │   │        │   │             │
└─────┼───┼────────┼───┼────────┼───┼────────┼───┼─────────────┘
      │   │        │   │        │   │        │   │
      │   │        │   │        │   │        │   │
      ▼   ▼        ▼   ▼        ▼   ▼        ▼   ▼
┌─────────────────────────────────────────────────────────────────┐
│                    DATA COLLECTION                               │
│                                                                  │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐             │
│  │ Prometheus  │  │    Loki     │  │  OTel       │             │
│  │ (Scrape     │  │ (Push API   │  │  Collector  │             │
│  │  /metrics)  │  │  /loki/api) │  │  (gRPC/HTTP)│             │
│  └─────────────┘  └─────────────┘  └─────────────┘             │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │  Prometheus Node Exporter (host metrics)                    ││
│  │  PostgreSQL Exporter (DB metrics)                           ││
│  │  Redis Exporter (cache metrics)                             ││
│  │  NATS Exporter (messaging metrics)                          ││
│  │  NGINX Exporter (proxy metrics)                             ││
│  └─────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
         │                │                │
         ▼                ▼                ▼
┌─────────────────────────────────────────────────────────────────┐
│                    VISUALIZATION & ALERTING                    │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │  Grafana (Unified Dashboards)                              ││
│  │                                                             ││
│  │  Dashboards:                                                ││
│  │  • "System Overview" (all services health)                 ││
│  │  • "Service: {Name}" (per-service deep dive)               ││
│  │  • "API Gateway" (request rates, latency, errors)          ││
│  │  • "AI Usage" (token consumption, costs, model performance)  ││
│  │  • "Database" (connections, query time, replication lag)   ││
│  │  • "Real-time" (Socket.IO connections, message throughput) ││
│  │                                                             ││
│  │  Alert Rules:                                               ││
│  │  • CPU > 80% for 5 min                                      ││
│  │  • Error rate > 1% for 2 min                                ││
│  │  • P95 latency > 500ms for 3 min                            ││
│  │  • DB connections > 80% of max                              ││
│  │  • Disk usage > 85%                                         ││
│  │  • Service down (no heartbeat for 30s)                      ││
│  └─────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
```

### Structured Logging Format

Every log line is JSON with correlation IDs:

```json
{
  "timestamp": "2024-01-15T10:23:45.123Z",
  "level": "info",
  "message": "User created new channel",
  "service": "teamsync-api",
  "version": "1.2.3",
  "traceId": "abc123def456",
  "spanId": "span789",
  "tenantId": "tenant-550e8400",
  "userId": "user-1234",
  "requestId": "req-5678",
  "method": "POST",
  "path": "/api/v1/teamsync/channels",
  "statusCode": 201,
  "latencyMs": 45,
  "metadata": {
    "channelName": "engineering",
    "channelType": "public"
  }
}
```

### Log Levels per Environment

| Environment | Level | Retention |
|---|---|---|
| Development | `debug` | Console only |
| Staging | `info` | 7 days |
| Production | `warn` (default), `info` (per-request) | 30 days |
| Audit | Always `info` | 90 days (compliance) |

### Distributed Tracing with OpenTelemetry

```typescript
// @vistafam/telemetry package
import { NodeSDK } from '@opentelemetry/sdk-node';
import { FastifyInstrumentation } from '@opentelemetry/instrumentation-fastify';
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http';
import { PgInstrumentation } from '@opentelemetry/instrumentation-pg';
import { RedisInstrumentation } from '@opentelemetry/instrumentation-redis';

const sdk = new NodeSDK({
  traceExporter: new OTLPTraceExporter({ url: 'http://otel-collector:4318' }),
  instrumentations: [
    new FastifyInstrumentation(),
    new HttpInstrumentation(),
    new PgInstrumentation(),
    new RedisInstrumentation(),
  ],
});

sdk.start();
```

### Trace Context Propagation

Trace ID must flow through:
1. HTTP headers (`traceparent`, `tracestate`)
2. NATS message headers
3. BullMQ job metadata
4. Socket.IO connection metadata

```typescript
// NATS message with trace context
nats.publish('teamsync.message.sent.v1', payload, {
  headers: {
    'traceparent': '00-abc123def456-789012-01',
    'tenant-id': 'tenant-550e8400',
  },
});
```

### Key Metrics per Service

```typescript
// Standard metrics emitted by every service
interface ServiceMetrics {
  // Request metrics
  'http_requests_total': Counter;       // Labels: method, path, status
  'http_request_duration_seconds': Histogram; // Labels: method, path

  // Business metrics
  'business_events_total': Counter;     // Labels: event_type, tenant_id
  'active_users': Gauge;                // Labels: tenant_id

  // Infrastructure metrics
  'db_connections_active': Gauge;
  'db_query_duration_seconds': Histogram;
  'redis_operations_total': Counter;
  'nats_messages_published': Counter;
  'nats_messages_consumed': Counter;

  // AI-specific metrics
  'ai_tokens_used': Counter;            // Labels: model, provider, tenant_id
  'ai_request_duration_seconds': Histogram;
  'ai_provider_failures': Counter;       // Labels: provider, reason
}
```

### LogLens as Observability Hub

LogLens doesn't just collect logs—it provides:
- **Log querying**: `service="teamsync-api" AND tenantId="acme" AND level="error"`
- **Pattern detection**: "This error spikes every Tuesday at 9 AM"
- **Anomaly alerts**: "Error rate 5x above baseline"
- **Root cause analysis**: "This trace shows DB timeout → queue backup → 503s"

### Alert Escalation

```
Alert Fires
  │
  ├──> PagerDuty / Slack (immediate, P1)
  │    • Service down
  │    • Error rate > 10%
  │    • DB connection failure
  │
  ├──> Slack #alerts (within 5 min, P2)
  │    • Error rate > 1%
  │    • Latency P95 > 1s
  │    • Disk > 90%
  │
  └──> Daily digest email (P3)
       • Token usage 2x average
       • Cache hit rate < 80%
```
