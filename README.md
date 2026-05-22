# VistaFam Enterprise

Production-grade, event-driven, AI-native SaaS ecosystem monorepo. Built with Next.js, Fastify, PostgreSQL, NATS, and Redis.

## Architecture Overview

VistaFam is a distributed ecosystem of 11 independently deployable products, all communicating through **PipeVista** — the central infrastructure backbone:

## PipeVista Infrastructure (8 Microservices)

| Service | Responsibility | Port |
|---|---|---|
| **pipevista-gateway** | API Gateway: auth, validation, rate limiting, aggregation, circuit breaker | 4100 |
| **pipevista-event-hub** | Event Infrastructure: pub/sub, workflow triggers, DLQ, retries | 4101 |
| **pipevista-ai-router** | AI Routing: model selection, provider fallback, token tracking | 4102 |
| **pipevista-registry** | Service Registry: health, discovery, config distribution | 4103 |
| **pipevista-connector** | Integration Layer: webhooks, external API proxy, adapters | 4104 |
| **pipevista-realtime** | Realtime Infrastructure: WebSocket gateway, presence, notifications | 4105 |
| **pipevista-observability** | Observability: log aggregation, traces, metrics | 4106 |
| **pipevista-admin** | Admin Dashboard: topology, cross-service config, ops commands | 4107 |

## Ecosystem Products (11 Apps)

| Product | Responsibility | Port |
|---|---|---|
| **AuthSphere** | Identity provider, RBAC, tenant management | 4001 |
| **TeamSync** | Real-time communication, channels, presence | 4002 (API), 3002 (Web) |
| **FlowBoard** | Workflow orchestration, automation engine | 4003 |
| **VaultSpace** | Object storage, asset intelligence | 4004 |
| **LogLens** | Centralized logs, observability | 4007 |
| **DevPulse** | Developer analytics, DORA metrics | 4008 |
| **SchemaForge** | Database schema design, API architecture | 4009 |
| **QueryMind** | AI database intelligence, NL-to-SQL | 4010 |
| **DeployHub** | CI/CD pipeline management | 4011 |
| **InsightAI** | AI orchestration, multi-provider LLM gateway | 4012 |
| **Legacy Gateway** | Old API gateway (migrating to pipevista-gateway) | 4000 |

## Monorepo Structure

```
├── apps/
│   ├── pipevista-gateway/      # API Gateway (Fastify)
│   ├── pipevista-event-hub/    # Event Infrastructure (Fastify)
│   ├── pipevista-ai-router/    # AI Routing Layer (Fastify)
│   ├── pipevista-registry/     # Service Registry (Fastify)
│   ├── pipevista-connector/   # Integration Layer (Fastify)
│   ├── pipevista-realtime/    # Realtime Gateway (Fastify + Socket.IO)
│   ├── pipevista-observability/ # Observability Collector (Fastify)
│   ├── pipevista-admin/       # Admin Dashboard API (Fastify)
│   ├── gateway/               # Legacy API Gateway (Fastify)
│   ├── authsphere/            # Identity provider (Fastify)
│   ├── teamsync/
│   │   ├── api/               # TeamSync backend (Fastify)
│   │   └── web/               # TeamSync frontend (Next.js)
│   ├── flowboard/             # Workflow engine (Fastify)
│   ├── vaultspace/            # Storage service (Fastify)
│   ├── loglens/              # Observability service (Fastify)
│   ├── devpulse/             # Analytics service (Fastify)
│   ├── schemaforge/          # Schema designer (Fastify)
│   ├── querymind/            # AI DB service (Fastify)
│   ├── deployhub/            # CI/CD service (Fastify)
│   ├── insightai/            # AI orchestration (Fastify)
│   ├── pipevista/            # Legacy infrastructure (Fastify)
│   ├── web/                  # Legacy web app (Next.js)
│   └── api/                  # Legacy API (Fastify)
├── packages/
│   ├── pipevista-core/       # Shared types, middleware, Redis/NATS clients
│   ├── events/               # NATS event bus client
│   ├── telemetry/            # OpenTelemetry instrumentation
│   ├── ai-client/            # Multi-provider LLM abstraction
│   ├── auth-client/          # JWT verification, RBAC
│   ├── queue/                # BullMQ wrapper
│   ├── storage/              # MinIO/S3 client
│   ├── logger/               # Structured logging (Pino)
│   ├── config/               # Environment validation
│   ├── types/                # Shared TypeScript types
│   ├── validation/           # Zod schemas
│   ├── utils/                # Circuit breakers, retry logic
│   ├── ui/                   # shadcn/ui component library
│   ├── sdk/                  # Auto-generated API clients
│   ├── hooks/                # React hooks
│   ├── realtime/             # Socket.IO + Redis adapter
│   ├── cache/                # Redis cache wrapper
│   ├── store/                # Zustand stores
│   └── database/             # PostgreSQL utilities
├── docs/
│   ├── architecture/       # 20 detailed architecture documents
│   └── pipevista/           # PipeVista backbone architecture & lifecycles
├── infrastructure/
│   ├── nginx/               # Reverse proxy config
│   ├── loki/                # Log aggregation config
│   ├── prometheus/          # Metrics config
│   ├── grafana/             # Dashboards and datasources
│   ├── docker-swarm/        # Docker Swarm stack & init scripts
│   ├── redis-cluster/       # Redis cluster setup scripts
│   └── nats-cluster/        # NATS cluster setup scripts
├── docker-compose.yml     # Full stack orchestration
└── turbo.json             # Monorepo task orchestration
```

## Tech Stack

- **Frontend:** Next.js 15, Tailwind CSS, TypeScript, shadcn/ui
- **Backend:** Fastify, Prisma, PostgreSQL
- **Realtime:** Socket.IO + Redis adapter
- **Event Bus:** NATS + JetStream
- **Queue:** BullMQ + Redis
- **Cache:** Redis
- **Storage:** MinIO (S3-compatible)
- **Observability:** Grafana + Prometheus + Loki + OpenTelemetry
- **AI Providers:** OpenAI, Gemini, Claude, DeepSeek, Ollama
- **Monorepo:** pnpm workspaces + Turbo

## Quick Start

1. **Install dependencies:**
   ```bash
   pnpm install
   ```

2. **Configure environment:**
   ```bash
   cp .env.example .env
   # Edit .env with your credentials
   ```

3. **Start infrastructure services:**
   ```bash
   pnpm infra:up
   # Or manually: docker-compose up -d postgres redis nats minio loki prometheus grafana
   ```

4. **Run database migrations:**
   ```bash
   pnpm db:migrate
   ```

5. **Start all services in dev mode:**
   ```bash
   pnpm dev
   ```

## Docker Deployment

```bash
# Build all services
pnpm docker:build

# Start full stack
pnpm docker:up

# View logs
docker-compose logs -f gateway
```

## Architecture Documentation

Complete architecture covering all 20 required domains:

1. [Architecture Overview](docs/architecture/overview.md)
2. [API Gateway](docs/architecture/api-gateway.md)
3. [Event-Driven Communication](docs/architecture/event-driven.md)
4. [Realtime Architecture](docs/architecture/realtime.md)
5. [Authentication & RBAC](docs/architecture/authentication.md)
6. [AI Orchestration](docs/architecture/ai-orchestration.md)
7. [Database Strategy](docs/architecture/database.md)
8. [Deployment Strategy](docs/architecture/deployment.md)
9. [Logging & Monitoring](docs/architecture/logging-monitoring.md)
10. [Service Communication](docs/architecture/service-communication.md)
11. [Workflow Execution](docs/architecture/workflows.md)
12. [TeamSync Integration](docs/architecture/teamsync-integration.md)
13. [FlowBoard Orchestration](docs/architecture/flowboard-orchestration.md)
14. [PipeVista Infrastructure](docs/architecture/pipevista.md)
15. [Scalability Strategy](docs/architecture/scalability.md)
16. [Fault Tolerance](docs/architecture/fault-tolerance.md)
17. [Security Strategy](docs/architecture/security.md)
18. [Service Discovery](docs/architecture/service-discovery.md)
19. [CI/CD Strategy](docs/architecture/cicd.md)

## Scripts

- `pnpm dev` — Start all apps in dev mode
- `pnpm build` — Build all packages and apps
- `pnpm typecheck` — TypeScript type checking
- `pnpm test` — Run all tests
- `pnpm docker:up` — Start full stack with Docker
- `pnpm db:migrate` — Run database migrations
