# VistaFam Enterprise Architecture Overview

## 1. Complete Architecture Diagram Explanation

VistaFam is a distributed, event-driven, AI-native SaaS ecosystem composed of 11 independently deployable products. The architecture follows a hexagonal/ports-and-adapters pattern with clean separation between domain logic, infrastructure concerns, and delivery mechanisms.

### System Layers

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              CLIENT LAYER                                    │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐          │
│  │  Web UI  │ │  Mobile  │ │   CLI    │ │  SDK     │ │ Webhooks │          │
│  │(Next.js) │ │(ReactNat)│ │(Node.js) │ │(OpenAPI) │ │(HTTP)    │          │
│  └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘          │
└───────┼────────────┼────────────┼────────────┼────────────┼────────────────┘
        │            │            │            │            │
        ▼            ▼            ▼            ▼            ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         EDGE / GATEWAY LAYER                                 │
│  ┌─────────────────────────────────────────────────────────────────────┐     │
│  │  NGINX Reverse Proxy  (SSL, Rate Limit, WAF, Geo-blocking)         │     │
│  └────────────────────────┬──────────────────────────────────────────┘     │
│                           ▼                                                 │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  API Gateway Service  (Auth, Routing, Caching, Request Validation)   │    │
│  │  • JWT verification via AuthSphere                                    │    │
│  │  • Tenant context injection                                          │    │
│  │  • Rate limiting per tenant/API key                                   │    │
│  │  • Request/response transformation                                   │    │
│  └────────────────────────┬──────────────────────────────────────────┘    │
└───────────────────────────┼───────────────────────────────────────────────────┘
                            │
        ┌───────────────────┼───────────────────┐
        │                   │                   │
        ▼                   ▼                   ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                      APPLICATION / SERVICE LAYER                             │
│                                                                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │  AuthSphere │  │  PipeVista  │  │  FlowBoard  │  │  TeamSync   │         │
│  │  (Identity) │  │(Infra/Disc) │  │ (Workflows) │  │ (Comm/Chat) │         │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘         │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │  VaultSpace │  │  LogLens    │  │  DevPulse   │  │SchemaForge  │         │
│  │  (Storage)  │  │(Observab.)  │  │ (Analytics) │  │ (API/DB)    │         │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘         │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────────┐        │
│  │  QueryMind  │  │  DeployHub  │  │        InsightAI            │        │
│  │  (AI DB)    │  │  (CI/CD)    │  │    (AI Orchestration)       │        │
│  └─────────────┘  └─────────────┘  └─────────────────────────────┘        │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
                            │
        ┌───────────────────┼───────────────────┐
        │                   │                   │
        ▼                   ▼                   ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                      MESSAGING / EVENT LAYER                                 │
│                                                                              │
│  ┌─────────────────────┐    ┌─────────────────────┐    ┌─────────────────┐   │
│  │   NATS Core         │    │   NATS JetStream    │    │   Redis Pub/Sub │   │
│  │   (Pub/Sub)         │    │   (Persistence)     │    │   (Realtime)    │   │
│  └─────────────────────┘    └─────────────────────┘    └─────────────────┘   │
│                                                                              │
│  ┌─────────────────────┐    ┌─────────────────────┐                          │
│  │   BullMQ (Queues)   │    │   Webhook Dispatcher│                          │
│  │   (Job Processing)  │    │   (External Hooks)  │                          │
│  └─────────────────────┘    └─────────────────────┘                          │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
                            │
        ┌───────────────────┼───────────────────┐
        │                   │                   │
        ▼                   ▼                   ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                        DATA / INFRASTRUCTURE LAYER                           │
│                                                                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│  │  PostgreSQL │  │    Redis    │  │    MinIO    │  │   OpenAI    │        │
│  │  (Primary)  │  │  (Cache/RT) │  │   (S3 API)  │  │   (LLM)     │        │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘        │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│  │   Gemini    │  │   Claude    │  │  DeepSeek   │  │   Ollama    │        │
│  │   (LLM)     │  │   (LLM)     │  │   (LLM)     │  │  (Local LLM)│        │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘        │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
                            │
        ┌───────────────────┼───────────────────┐
        │                   │                   │
        ▼                   ▼                   ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                      OBSERVABILITY / SECURITY LAYER                          │
│                                                                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│  │  Grafana    │  │ Prometheus  │  │    Loki     │  │OpenTelemetry│        │
│  │(Dashboards) │  │  (Metrics)  │  │   (Logs)    │  │  (Traces)   │        │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘        │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

## 2. Microservice Boundaries

Each product is a bounded context with its own database schema, API surface, and event contract. No service may directly access another service's database.

### Product: AuthSphere
- **Responsibility**: Identity provider (IdP), authentication, authorization, RBAC, tenant management, audit logging
- **API Surface**: OAuth2/OIDC endpoints, tenant admin API, role management API
- **Events Published**: `auth.user.created`, `auth.user.login`, `auth.user.logout`, `auth.role.changed`, `auth.audit.event`
- **Events Consumed**: None (is at root of trust)
- **Database**: `authsphere` schema — users, tenants, roles, permissions, sessions, audit_logs

### Product: PipeVista
- **Responsibility**: Infrastructure intelligence, service discovery, health monitoring, configuration distribution
- **API Surface**: Service registry API, health dashboard API, config API
- **Events Published**: `infra.service.registered`, `infra.service.deregistered`, `infra.health.changed`, `infra.alert`
- **Events Consumed**: `auth.audit.event` (for security anomaly detection)
- **Database**: `pipevista` schema — services, health_checks, configs, metrics_snapshots

### Product: FlowBoard
- **Responsibility**: Workflow orchestration, automation engine, DAG execution, cron scheduling
- **API Surface**: Workflow CRUD, execution API, trigger API, template API
- **Events Published**: `flowboard.workflow.started`, `flowboard.workflow.completed`, `flowboard.workflow.failed`, `flowboard.step.executed`
- **Events Consumed**: All domain events (can trigger workflows on any event)
- **Database**: `flowboard` schema — workflows, executions, steps, triggers, templates

### Product: TeamSync
- **Responsibility**: Real-time communication, channels, DMs, threads, notifications, presence
- **API Surface**: Message API, channel API, presence API, notification API, search API
- **Events Published**: `teamsync.message.sent`, `teamsync.channel.created`, `teamsync.user.typing`, `teamsync.notification.delivered`
- **Events Consumed**: `flowboard.workflow.*` (send notifications), `auth.user.*` (user lifecycle)
- **Database**: `teamsync` schema — channels, messages, threads, reactions, presence, notifications

### Product: VaultSpace
- **Responsibility**: Object storage, asset management, AI-powered asset tagging, version control
- **API Surface**: Upload API, download API, asset metadata API, search API, versioning API
- **Events Published**: `vaultspace.asset.uploaded`, `vaultspace.asset.tagged`, `vaultspace.asset.deleted`
- **Events Consumed**: `insightai.task.completed` (for AI tagging results)
- **Database**: `vaultspace` schema — assets, versions, tags, collections, shares

### Product: LogLens
- **Responsibility**: Centralized log aggregation, log querying, alerting, observability API
- **API Surface**: Log ingestion API, query API, alert API, dashboard API
- **Events Published**: `loglens.alert.triggered`
- **Events Consumed**: ALL events from ALL services (subscribes to `>` wildcard on NATS)
- **Database**: `loglens` schema — alerts, dashboards, queries, sources; raw logs in Loki

### Product: DevPulse
- **Responsibility**: Developer analytics, DORA metrics, git integration, pipeline insights
- **API Surface**: Metrics API, webhook ingestion API, dashboard API, report API
- **Events Published**: `devpulse.metric.calculated`, `devpulse.alert.threshold`
- **Events Consumed**: `deployhub.deployment.*`, `auth.user.login`
- **Database**: `devpulse` schema — repositories, deployments, commits, metrics, reports

### Product: SchemaForge
- **Responsibility**: Database schema design, API specification generation, migration planning
- **API Surface**: Schema designer API, spec generator API, migration API, diff API
- **Events Published**: `schemaforge.schema.changed`, `schemaforge.migration.applied`
- **Events Consumed**: `database.change.requested` (from QueryMind)
- **Database**: `schemaforge` schema — schemas, tables, columns, migrations, specs

### Product: QueryMind
- **Responsibility**: Natural language to SQL translation, query explanation, safe execution sandbox
- **API Surface**: NL-to-SQL API, explain API, execute API, schema context API
- **Events Published**: `querymind.query.executed`, `querymind.schema.discovered`
- **Events Consumed**: `insightai.task.completed` (NL-to-SQL results), `schemaforge.schema.changed`
- **Database**: `querymind` schema — queries, results, sandboxes, contexts

### Product: DeployHub
- **Responsibility**: CI/CD pipeline management, artifact storage, environment promotion
- **API Surface**: Pipeline API, build API, deploy API, environment API, artifact API
- **Events Published**: `deployhub.build.started`, `deployhub.build.completed`, `deployhub.deployment.promoted`
- **Events Consumed**: `flowboard.workflow.completed` (post-deploy automation)
- **Database**: `deployhub` schema — pipelines, builds, deployments, artifacts, environments

### Product: InsightAI
- **Responsibility**: AI orchestration, multi-provider LLM gateway, agent runtime, tool registry, memory
- **API Surface**: Chat API, agent API, model config API, tool registry API, memory API
- **Events Published**: `insightai.task.completed`, `insightai.agent.action`, `insightai.model.error`
- **Events Consumed**: ALL domain events (agents observe the entire system), `auth.user.login`
- **Database**: `insightai` schema — agents, conversations, tools, memories, model_configs

## Architectural Principles

1. **Event-First**: Every significant state change publishes an event. Services react to events, they do not poll.
2. **Database-per-Service**: Each product owns its data. No shared tables, no cross-service joins.
3. **API Gateway as Facade**: External clients interact with one URL. Internal routing is gateway's job.
4. **CQRS Where Needed**: Read models (search, analytics) are separate from write models.
5. **Async by Default**: Synchronous HTTP calls are reserved for user-facing queries. Everything else is async.
6. **Multi-Tenancy at Every Layer**: Tenant ID is in JWT, in headers, in events, in database queries.
7. **Zero-Trust Internal Network**: Services authenticate each other via mTLS or signed JWTs.
