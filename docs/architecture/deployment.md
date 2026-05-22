# Deployment Strategy

## 9. Deployment Strategy

### Why Docker Compose Initially (Not Kubernetes)?

| Aspect | Docker Compose | Kubernetes |
|---|---|---|
| Operational Complexity | Low (single docker-compose.yml) | High (manifests, operators, networking) |
| Learning Curve | Days | Months |
| Resource Overhead | ~5% | ~20-30% |
| Scaling Method | Vertical + horizontal (replicas) | Horizontal (pods) |
| Service Discovery | DNS via Docker network | CoreDNS + Ingress |
| Ideal For | 10-10,000 concurrent users | 10,000+ concurrent users |
| Team Size Needed | 1-2 DevOps engineers | 2-5 dedicated platform engineers |

For a team of 10 users scaling to 100K, Docker Compose on a single VM or ECS/Fargate is the pragmatic starting point. Kubernetes is added only when:
- You need auto-scaling based on CPU/memory metrics
- You have 5+ microservices each needing independent scaling
- You need advanced deployment strategies (canary, blue-green)
- You have dedicated platform engineering resources

### Phase 1: Docker Compose (Current)

```yaml
# docker-compose.yml (production variant)
version: '3.8'

services:
  # --- Edge Layer ---
  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./infrastructure/nginx/nginx.conf:/etc/nginx/nginx.conf
      - ./infrastructure/nginx/ssl:/etc/nginx/ssl
    depends_on:
      - gateway

  # --- Gateway ---
  gateway:
    build:
      context: .
      dockerfile: docker/gateway.Dockerfile
    environment:
      - NODE_ENV=production
      - NATS_URL=nats://nats:4222
      - REDIS_URL=redis://redis:6379
      - AUTHSPHERE_URL=http://authsphere:4001
    depends_on:
      - nats
      - redis
      - authsphere

  # --- Services (each independently deployable) ---
  authsphere:
    build:
      context: .
      dockerfile: docker/authsphere.Dockerfile
    environment:
      - PORT=4001
      - DATABASE_URL=postgresql://postgres:password@postgres:5432/vistafam?schema=authsphere
      - NATS_URL=nats://nats:4222
      - REDIS_URL=redis://redis:6379
    depends_on:
      - postgres
      - nats
      - redis

  teamsync-api:
    build:
      context: .
      dockerfile: docker/teamsync-api.Dockerfile
    environment:
      - PORT=4002
      - DATABASE_URL=postgresql://postgres:password@postgres:5432/vistafam?schema=teamsync
      - NATS_URL=nats://nats:4222
      - REDIS_URL=redis://redis:6379
    depends_on:
      - postgres
      - nats
      - redis
    deploy:
      replicas: 2  # Horizontally scalable

  teamsync-web:
    build:
      context: .
      dockerfile: docker/teamsync-web.Dockerfile
    environment:
      - PORT=3002
      - NEXT_PUBLIC_API_URL=/api/v1
    depends_on:
      - gateway

  # ... repeat for all 11 products

  flowboard:     # port 4003
  vaultspace:    # port 4004
  loglens:       # port 4007
  devpulse:      # port 4008
  schemaforge:   # port 4009
  querymind:     # port 4010
  deployhub:     # port 4011
  insightai:     # port 4012
  pipevista:     # port 4006

  # --- Infrastructure ---
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: vistafam
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./supabase/migrations:/docker-entrypoint-initdb.d
    ports:
      - "5432:5432"

  redis:
    image: redis:7-alpine
    volumes:
      - redis_data:/data
    ports:
      - "6379:6379"

  nats:
    image: nats:2-alpine
    command: "--js --store_dir /data/jetstream"
    volumes:
      - nats_data:/data/jetstream
    ports:
      - "4222:4222"
      - "8222:8222"  # Monitoring

  minio:
    image: minio/minio
    command: server /data --console-address ":9001"
    environment:
      MINIO_ROOT_USER: ${MINIO_ACCESS_KEY}
      MINIO_ROOT_PASSWORD: ${MINIO_SECRET_KEY}
    volumes:
      - minio_data:/data
    ports:
      - "9000:9000"
      - "9001:9001"

  # --- Observability ---
  loki:
    image: grafana/loki:latest
    volumes:
      - ./infrastructure/loki/loki.yml:/etc/loki/local-config.yaml
    ports:
      - "3100:3100"

  prometheus:
    image: prom/prometheus
    volumes:
      - ./infrastructure/prometheus/prometheus.yml:/etc/prometheus/prometheus.yml
      - prometheus_data:/prometheus
    ports:
      - "9090:9090"

  grafana:
    image: grafana/grafana
    volumes:
      - grafana_data:/var/lib/grafana
      - ./infrastructure/grafana/dashboards:/etc/grafana/provisioning/dashboards
      - ./infrastructure/grafana/datasources:/etc/grafana/provisioning/datasources
    ports:
      - "3001:3000"

volumes:
  postgres_data:
  redis_data:
  nats_data:
  minio_data:
  prometheus_data:
  grafana_data:
```

### Phase 2: Cloud-Native (Future)

When scaling beyond Docker Compose:

```
Phase 2a: AWS ECS / GCP Cloud Run / Azure Container Apps
  • Same Docker images, managed orchestration
  • Auto-scaling based on request count / CPU
  • Managed load balancer
  • No Kubernetes complexity

Phase 2b: Kubernetes (when team size > 10 engineers)
  • Helm charts per service
  • Istio service mesh (mTLS, traffic management)
  • Horizontal Pod Autoscaler
  • ArgoCD for GitOps deployments
  • Vault for secrets management
```

### Dockerfile Strategy

Multi-stage builds for minimal attack surface:

```dockerfile
# docker/service.Dockerfile (template)
FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages ./packages
COPY apps/service-name ./apps/service-name
RUN npm install -g pnpm && pnpm install --frozen-lockfile
RUN pnpm build --filter=@vistafam/service-name...

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
# Only copy built artifacts and production deps
COPY --from=builder /app/apps/service-name/dist ./dist
COPY --from=builder /app/apps/service-name/package.json ./
COPY --from=builder /app/node_modules ./node_modules
# Run as non-root
USER node
EXPOSE 4000
CMD ["node", "dist/main.js"]
```

### Environment Configuration

```
┌─────────────────────────────────────────────────────────────┐
│              Configuration Hierarchy                         │
├─────────────────────────────────────────────────────────────┤
│  Layer 1: Default (in code)                                 │
│  Layer 2: Config files (config/default.yml)                 │
│  Layer 3: Environment variables (process.env)               │
│  Layer 4: Runtime config from PipeVista (hot reload)      │
└─────────────────────────────────────────────────────────────┘
```

### Health Checks

Every service exposes:
- `GET /health/live` — Liveness probe (is process running?)
- `GET /health/ready` — Readiness probe (can it accept traffic?)
- `GET /health/dependencies` — Dependency health (DB, Redis, NATS)

```typescript
// Standard health check response
interface HealthCheck {
  status: 'healthy' | 'degraded' | 'unhealthy';
  version: string;
  uptime: number;
  checks: {
    database: { status: 'up' | 'down'; latencyMs: number };
    redis: { status: 'up' | 'down'; latencyMs: number };
    nats: { status: 'up' | 'down'; latencyMs: number };
  };
}
```

### Zero-Downtime Deployment

With Docker Compose:
1. Start new container with `docker-compose up -d --no-deps --scale service=2 service`
2. Wait for health check on new container
3. Update NGINX upstream to point to new container
4. Gracefully stop old container (`docker stop -t 30 old_container`)
5. Scale down: `docker-compose up -d --no-deps --scale service=1 service`

With a managed load balancer (future), this becomes rolling updates.
