# Service Discovery Strategy

## 19. Service Discovery Strategy

### Why Custom Service Discovery?

In a Docker Compose environment without Kubernetes, we need a lightweight mechanism for:
- Services to find each other's addresses
- Health-aware routing
- Dynamic upstream configuration for NGINX
- Zero-downtime deployments

We build this into PipeVista rather than using Consul/ZooKeeper because:
1. We already run PostgreSQL + Redis + NATS
2. Service discovery is just a table + cache + heartbeat
3. No additional infrastructure to manage
4. Deep integration with our event-driven model

### Discovery Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    SERVICE DISCOVERY FLOW                        │
│                                                                  │
│  Service Startup:                                                │
│  ┌──────────┐                                                    │
│  │ Service  │                                                    │
│  │ (e.g.,  │                                                    │
│  │ TeamSync │                                                    │
│  │ API)     │                                                    │
│  └───┬──────┘                                                    │
│      │ 1. POST /registry/register                                │
│      │    { id: "teamsync-api-01",                             │
│      │      name: "teamsync-api",                               │
│      │      version: "1.2.3",                                   │
│      │      host: "teamsync-api",                               │
│      │      port: 4002,                                         │
│      │      healthEndpoint: "/health/ready",                    │
│      │      metadata: { region: "us-east", zone: "a" } }        │
│      │                                                          │
│      ▼                                                          │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │  PipeVista Registry                                         ││
│  │  • Persist to PostgreSQL (pipevista.services)               ││
│  │  • Cache in Redis (hot path)                                ││
│  │  • Publish `infra.service.registered` event                 ││
│  └────────────────────────┬────────────────────────────────────┘│
│                           │                                     │
│          ┌────────────────┼────────────────┐                   │
│          │                │                │                   │
│          ▼                ▼                ▼                   │
│     ┌──────────┐   ┌──────────┐   ┌──────────┐               │
│     │  Gateway │   │  Grafana │   │  Other   │               │
│     │ (Update │   │ (Update  │   │ Services │               │
│     │ upstream)│   │ topology)│   │ (Connect)│               │
│     └──────────┘   └──────────┘   └──────────┘               │
│                                                                  │
│  Heartbeat Loop (every 30s):                                    │
│  ┌──────────┐     ┌──────────┐                                  │
│  │ Service  │────>│ PipeVista│                                  │
│  │          │     │ Registry │                                  │
│  └──────────┘     └──────────┘                                  │
│      │                │                                          │
│      │ 2a. OK         │ 2b. Missed 3 heartbeats                  │
│      │                │    → Mark UNHEALTHY                       │
│      │                │    → Publish `infra.service.deregistered`  │
│      │                │    → Gateway removes from upstreams        │
│      │                │    → Alerts sent                          │
│      ▼                ▼                                          │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │  Graceful Shutdown:                                         ││
│  │  • Service calls DELETE /registry/deregister                ││
│  │  • PipeVista updates status, publishes event               ││
│  │  • Gateway removes from rotation                            ││
│  └─────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
```

### Registry Data Model

```sql
CREATE TABLE pipevista.services (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  version TEXT NOT NULL,
  host TEXT NOT NULL,
  port INTEGER NOT NULL,
  health_endpoint TEXT NOT NULL DEFAULT '/health/ready',
  status TEXT NOT NULL DEFAULT 'unknown' CHECK (status IN ('healthy', 'degraded', 'unhealthy', 'unknown')),
  metadata JSONB DEFAULT '{}',
  tenant_scoped BOOLEAN DEFAULT FALSE,
  last_heartbeat TIMESTAMPTZ DEFAULT now(),
  registered_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_services_name ON pipevista.services(name);
CREATE INDEX idx_services_status ON pipevista.services(status);
CREATE INDEX idx_services_heartbeat ON pipevista.services(last_heartbeat);
```

### Redis Cache Structure

```
// Hot cache for gateway lookups (30s TTL)
registry:service:teamsync-api  →  ["teamsync-api:4002", "teamsync-api:4002"]  // host:port list
registry:service:authsphere    →  ["authsphere:4001"]
registry:health:teamsync-api     →  "healthy"
registry:version:teamsync-api    →  "1.2.3"

// Updated on every heartbeat or registry change
```

### Gateway Dynamic Routing

```typescript
// Gateway fetches upstreams from PipeVista on startup
// And subscribes to registry changes via NATS

class DynamicRouter {
  private upstreams = new Map<string, string[]>();

  async initialize() {
    // Fetch initial state
    const services = await pipevista.listServices({ status: 'healthy' });
    for (const svc of services) {
      this.upstreams.set(svc.name, [`${svc.host}:${svc.port}`]);
    }

    // Subscribe to changes
    events.subscribe('infra.service.>', (event) => {
      if (event.type === 'infra.service.registered') {
        this.addUpstream(event.payload);
      } else if (event.type === 'infra.service.deregistered') {
        this.removeUpstream(event.payload);
      } else if (event.type === 'infra.service.health.changed') {
        this.updateHealth(event.payload);
      }
    });
  }

  getUpstream(serviceName: string): string | undefined {
    const hosts = this.upstreams.get(serviceName);
    if (!hosts || hosts.length === 0) return undefined;
    // Round-robin selection
    return hosts[Math.floor(Math.random() * hosts.length)];
  }
}
```

### Health-Based Filtering

```typescript
// Gateway only routes to healthy services
// PipeVista health checker polls every 15s

interface HealthCheckConfig {
  intervalMs: 15000;
  timeoutMs: 5000;
  healthyThreshold: 2;      // 2 consecutive successes → healthy
  unhealthyThreshold: 3;    // 3 consecutive failures → unhealthy
}

// Health states transition:
// unknown → (1 success) → healthy
// healthy → (1 failure) → degraded
// degraded → (1 success) → healthy
// degraded → (2 failures) → unhealthy
// unhealthy → (2 successes) → degraded → (1 more) → healthy
```

### DNS-Based Discovery (Alternative)

In Docker Compose, services are discoverable by name via Docker's embedded DNS:

```yaml
# docker-compose.yml
services:
  teamsync-api:
    # Accessible as "teamsync-api" from other containers
    networks:
      - vistafam

  gateway:
    environment:
      # Static upstream mapping for simple cases
      TEAMSYNC_API_URL: http://teamsync-api:4002
```

For cloud deployments, migrate to:
- **AWS**: CloudMap service discovery
- **GCP**: Cloud DNS + Load Balancer
- **Azure**: Azure DNS + Application Gateway

### Service Mesh (Future)

When moving to Kubernetes, add Istio/Linkerd for:
- mTLS between all services
- Traffic splitting (canary deployments)
- Circuit breaking at network level
- Observability (automatic metrics)

```
Phase 1 (Now):     HTTP + JWT between services
Phase 2 (Future):   mTLS + service mesh
Phase 3 (Future):   SPIFFE/SPIRE for workload identity
```
