# PipeVista Infrastructure Responsibilities

## 15. PipeVista Infrastructure Responsibilities

### Why a Dedicated Infrastructure Intelligence Service?

In a distributed system of 11+ products, someone must answer:
- "Is the database healthy?"
- "Which services are running?"
- "What version of AuthSphere is in production?"
- "Why is latency spiking on the gateway?"

PipeVista is the **observability and control plane** of VistaFam. It does not run business logic—it runs the system that runs the business logic.

### Core Responsibilities

```
┌─────────────────────────────────────────────────────────────────┐
│                    PIPEVISTA SERVICE                             │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │  1. SERVICE DISCOVERY & REGISTRY                            ││
│  │                                                             ││
│  │  • Services register on startup:                            ││
│  │    POST /registry/register { name, version, host, port,     ││
│  │                            healthEndpoint, metadata }     ││
│  │                                                             ││
│  │  • Heartbeat every 30 seconds (TTL: 90 seconds)              ││
│  │  • Deregistration on graceful shutdown                       ││
│  │  • Query: GET /registry/services (filtered by tenant)     ││
│  │  • Query: GET /registry/services/{name} (all instances)   ││
│  │                                                             ││
│  │  Storage: PostgreSQL (pipevista.services table) + Redis    ││
│  │  (hot cache for gateway lookups)                             ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                  │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │  2. HEALTH MONITORING & AGGREGATION                         ││
│  │                                                             ││
│  │  • Polls every service's /health/ready every 15s            ││
│  │  • Aggregates health into system-wide dashboard             ││
│  │  • Detects cascading failures (if DB down → all services     ││
│  │    show degraded)                                           ││
│  │  • Publishes `infra.service.health.changed` events            ││
│  │  • Triggers alerts when critical services fail               ││
│  │                                                             ││
│  │  Health States: healthy, degraded, critical, unknown        ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                  │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │  3. CONFIGURATION DISTRIBUTION                               ││
│  │                                                             ││
│  │  • Centralized config store (per-tenant, per-service)        ││
│  │  • Hot-reload: services subscribe to config changes         ││
│  │    via NATS `pipevista.config.changed` events               ││
│  │  • No service restarts needed for config updates             ││
│  │  • Config versioning and rollback support                  ││
│  │  • Secret management (encrypted at rest, decrypted in      ││
│  │    memory only)                                             ││
│  │                                                             ││
│  │  Example configs:                                           ││
│  │    • Gateway routes (add/remove upstreams dynamically)        ││
│  │    • Rate limits per tenant                                  ││
│  │    • Feature flags (per-tenant A/B testing)                 ││
│  │    • AI model defaults (per-tenant provider preference)     ││
│  │    • Log retention policies                                  ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                  │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │  4. INFRASTRUCTURE METRICS & CAPACITY PLANNING              ││
│  │                                                             ││
│  │  • Collects host metrics (CPU, memory, disk, network)       ││
│  │  • Collects container metrics (Docker stats)                ││
│  │  • Capacity forecasting: "At current growth, you'll need     ││
│  │    to scale Redis in 14 days"                               ││
│  │  • Cost attribution per tenant (based on resource usage)    ││
│  │  • Recommendations: "TeamSync API has 95% cache miss rate,   ││
│  │    consider increasing Redis memory"                        ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                  │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │  5. SYSTEM TOPOLOGY & DEPENDENCY GRAPH                       ││
│  │                                                             ││
│  │  • Discovers service dependencies via event subscriptions    ││
│  │  • Builds visual dependency graph:                           ││
│  │    "FlowBoard depends on DeployHub, TeamSync, and QueryMind"││
│  │  • Impact analysis: "If Redis goes down, these services     ││
│  │    are affected: ..."                                       ││
│  │  • Circular dependency detection                             ││
│  └─────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
```

### Service Registry API

```typescript
interface ServiceRegistry {
  // Registration
  register(service: ServiceRegistration): Promise<void>;
  deregister(serviceId: string): Promise<void>;
  heartbeat(serviceId: string): Promise<void>;

  // Discovery
  listServices(filter?: ServiceFilter): Promise<ServiceInstance[]>;
  getService(name: string): Promise<ServiceInstance[]>;
  getServiceById(serviceId: string): Promise<ServiceInstance | null>;

  // Health
  getSystemHealth(): Promise<SystemHealth>;
  getServiceHealth(serviceName: string): Promise<ServiceHealth>;
}

interface ServiceRegistration {
  id: string;           // Unique instance ID
  name: string;         // Service name (e.g., "teamsync-api")
  version: string;      // Semantic version
  host: string;
  port: number;
  healthEndpoint: string;
  metadata: {
    region?: string;
    instanceType?: string;
    capabilities?: string[];
  };
}

interface ServiceInstance extends ServiceRegistration {
  status: 'healthy' | 'degraded' | 'unhealthy' | 'unknown';
  lastHeartbeat: Date;
  registeredAt: Date;
}
```

### Dynamic Configuration Distribution

```typescript
// PipeVista config store
interface ConfigStore {
  // Set config for a service (optionally tenant-scoped)
  set(
    key: string,
    value: unknown,
    options?: { tenantId?: string; service?: string; secret?: boolean }
  ): Promise<void>;

  // Get config with fallback hierarchy
  get(key: string, context?: { tenantId?: string; service?: string }): Promise<unknown>;

  // Subscribe to changes
  subscribe(
    pattern: string,
    callback: (change: ConfigChange) => void
  ): Promise<Subscription>;
}

// Usage in a service:
const config = await pipevistaConfig.get('gateway.rate_limit', {
  tenantId: currentTenant,
  service: 'gateway',
});
// Returns: tenant-specific > service-specific > global default

// Hot reload on change:
pipevistaConfig.subscribe('gateway.*', (change) => {
  logger.info(`Config changed: ${change.key} = ${change.value}`);
  updateRateLimiter(change.value);
});
```

### Configuration Event Flow

```
Admin updates config in PipeVista UI
│
├─> PipeVista persists to PostgreSQL
├─> PipeVista publishes `pipevista.config.changed`
│   payload: { key, value, scope: { tenantId?, service? } }
│
├─> All services subscribed to matching patterns receive event
│
├─> Gateway service: updates rate limiter in memory
├─> InsightAI service: switches default model
├─> TeamSync service: toggles feature flag
│
└─> No service restart required
```

### System Health Dashboard Data Model

```typescript
interface SystemHealth {
  overall: 'healthy' | 'degraded' | 'critical';
  lastUpdated: Date;
  services: ServiceHealth[];
  infrastructure: {
    database: ResourceHealth;
    cache: ResourceHealth;
    messaging: ResourceHealth;
    storage: ResourceHealth;
  };
  alerts: ActiveAlert[];
}

interface ServiceHealth {
  name: string;
  instances: {
    total: number;
    healthy: number;
    degraded: number;
    unhealthy: number;
  };
  latency: {
    p50: number;
    p95: number;
    p99: number;
  };
  errorRate: number;
  throughput: number; // requests/min
}

interface ResourceHealth {
  status: 'healthy' | 'degraded' | 'critical';
  utilization: number; // percentage
  capacity: {
    current: number;
    max: number;
    unit: string;
  };
}
```

### Why Not Use Consul / etcd / ZooKeeper?

| Tool | Pros | Cons | Decision |
|---|---|---|---|
| Consul | Full-featured, health checks, DNS | Heavy (Go binary + agent), overkill for 11 services | Rejected |
| etcd | Kubernetes-native, Raft consensus | Complex clustering, primarily for K8s | Rejected |
| ZooKeeper | Battle-tested | Java-based, operational complexity, legacy | Rejected |
| **PipeVista (custom)** | Tailored to our event-driven model, integrates with NATS, lightweight | Must build and maintain | **Chosen** |

Building our own registry on NATS + PostgreSQL + Redis is simpler because:
1. We already run all three dependencies
2. Service registration is just an HTTP POST + NATS heartbeat
3. Discovery is a PostgreSQL query + Redis cache
4. No additional infrastructure to operate
