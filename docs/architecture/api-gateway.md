# API Gateway Architecture

## 3. API Gateway Structure

### Why a Custom Gateway Instead of Off-the-Shelf?

Off-the-shelf gateways (Kong, Traefik) are excellent but require additional operational overhead and plugin development for our specific multi-tenant + AI-native requirements. A lightweight custom gateway built on Fastify gives us:

- **Native TypeScript integration** with our shared packages
- **Multi-tenant JWT validation** with tenant context injection
- **AI-specific request routing** (model provider failover, token usage tracking)
- **Event emission** for every request (automatic audit trail)
- **Dynamic service discovery** via PipeVista integration

### Gateway Layers

```
┌─────────────────────────────────────────────────────────────────┐
│                      NGINX (Edge)                                │
│  • TLS termination (Let's Encrypt / Cloudflare)                 │
│  • DDoS protection / rate limiting (per IP)                   │
│  • Static asset serving                                         │
│  • WebSocket upgrade proxying                                   │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│              VistaFam API Gateway (Fastify)                      │
│                                                                  │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐             │
│  │   Router    │  │   Auth      │  │   Metrics   │             │
│  │   Module    │  │   Module    │  │   Module    │             │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘             │
│         │                │                │                     │
│  ┌──────┴────────────────┴────────────────┴──────┐             │
│  │              Request Pipeline                    │             │
│  │  1. Parse tenant from hostname / header / JWT   │             │
│  │  2. Validate JWT with AuthSphere (cached)     │             │
│  │  3. Check RBAC permissions                     │             │
│  │  4. Rate limit (per tenant / per user)         │             │
│  │  5. Route to upstream service                  │             │
│  │  6. Transform request/response                 │             │
│  │  7. Emit `gateway.request` event               │             │
│  │  8. Return trace ID in response headers        │             │
│  └────────────────────────────────────────────────┘             │
│                                                                  │
│  ┌─────────────────────────────────────────────────────┐        │
│  │              Upstream Routing Table                  │        │
│  │  /api/v1/auth/*      →  authsphere:4001             │        │
│  │  /api/v1/teamsync/*  →  teamsync-api:4002           │        │
│  │  /api/v1/flowboard/* →  flowboard:4003              │        │
│  │  /api/v1/vaultspace/*→  vaultspace:4004             │        │
│  │  /api/v1/insightai/* →  insightai:4005              │        │
│  │  /api/v1/pipevista/* →  pipevista:4006              │        │
│  │  /api/v1/loglens/*   →  loglens:4007                │        │
│  │  /api/v1/devpulse/*  →  devpulse:4008               │        │
│  │  /api/v1/schemaforge/*→ schemaforge:4009            │        │
│  │  /api/v1/querymind/* →  querymind:4010              │        │
│  │  /api/v1/deployhub/* →  deployhub:4011              │        │
│  │  /ws/*               →  Socket.IO (realtime svc)    │        │
│  └─────────────────────────────────────────────────────┘        │
│                                                                  │
│  ┌─────────────────────────────────────────────────────┐        │
│  │              Caching Layer (Redis)                   │        │
│  │  • JWT public key cache (5 min TTL)                 │        │
│  │  • RBAC permission cache (1 min TTL)                │        │
│  │  • Tenant config cache (10 min TTL)                 │        │
│  │  • Service discovery cache (30 sec TTL)             │        │
│  └─────────────────────────────────────────────────────┘        │
└─────────────────────────────────────────────────────────────────┘
```

### Gateway Configuration

```typescript
// Gateway routes defined in config, dynamically reloadable via PipeVista
interface GatewayRoute {
  path: string;           // e.g., "/api/v1/teamsync/*"
  service: string;        // e.g., "teamsync-api"
  methods: HttpMethod[];
  authRequired: boolean;
  requiredPermissions: string[];
  rateLimit: RateLimitConfig;
  cache: CacheConfig;
  transform: TransformConfig;
}

interface RateLimitConfig {
  windowMs: number;       // e.g., 60000
  maxRequests: number;    // per tenant per window
  burstAllowance: number;
}
```

### Multi-Tenant Routing Strategy

Tenants are identified in order of precedence:
1. `X-Tenant-ID` header (for API clients)
2. `tenant` claim in JWT `sub` (for authenticated requests)
3. Subdomain extraction (`acme.vistafam.app` → tenant `acme`)
4. Default tenant (`vistafam-default`)

Each route config can specify:
- `authRequired`: whether JWT is mandatory
- `requiredPermissions`: RBAC checks before forwarding
- `rateLimit`: tenant-aware token bucket

### Why Fastify for the Gateway?

- **Throughput**: Fastify handles 30,000+ req/s on a single core, critical for gateway bottleneck
- **Plugin ecosystem**: `@fastify/http-proxy` for upstream routing, `@fastify/rate-limit` for throttling
- **TypeScript-native**: Full type safety across shared packages
- **Low memory**: ~100MB baseline, scales linearly with connections

### Failover & Resilience

- **Circuit breaker**: If a service returns 5xx for 30s, gateway returns 503 + `Retry-After` header
- **Retry policy**: Idempotent GET/PUT requests retry once on 502/503
- **Fallback**: Health check endpoints bypass circuit breaker; degraded mode serves cached responses
