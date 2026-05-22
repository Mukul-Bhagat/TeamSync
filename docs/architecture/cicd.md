# CI/CD Strategy

## 20. CI/CD Strategy

### CI/CD Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    CI/CD PIPELINE                                │
│                                                                  │
│  ┌──────────┐     ┌──────────┐     ┌──────────┐              │
│  │  GitHub  │────>│  GitHub  │────>│  Docker  │              │
│  │  Push    │     │  Actions │     │  Registry│              │
│  │  (main)  │     │  (CI)    │     │  (Build) │              │
│  └──────────┘     └────┬─────┘     └────┬─────┘              │
│                        │                │                      │
│                        │                │                      │
│              ┌─────────┴────────┐      │                      │
│              │                  │      │                      │
│              ▼                  ▼      ▼                      │
│  ┌──────────────────┐  ┌──────────────────┐                  │
│  │  Static Analysis │  │  DeployHub (CD)  │                  │
│  │  (SAST/DAST)     │  │  (Deployment)    │                  │
│  └──────────────────┘  └──────────────────┘                  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### GitHub Actions CI Pipeline

```yaml
# .github/workflows/ci.yml
name: VistaFam CI

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  # ── Job 1: Lint & Type Check ──────────────────────────────────
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
        with:
          version: 9
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'pnpm'
      - run: pnpm install --frozen-lockfile
      - run: pnpm lint
      - run: pnpm typecheck

  # ── Job 2: Test Matrix ────────────────────────────────────────
  test:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        service:
          - authsphere
          - teamsync-api
          - teamsync-web
          - flowboard
          - vaultspace
          - loglens
          - devpulse
          - schemaforge
          - querymind
          - deployhub
          - insightai
          - pipevista
          - gateway
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'pnpm'
      - run: pnpm install --frozen-lockfile
      - run: pnpm test --filter=@vistafam/${{ matrix.service }}
      - uses: codecov/codecov-action@v3
        with:
          flags: ${{ matrix.service }}

  # ── Job 3: Security Scanning ──────────────────────────────────
  security:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Run Trivy vulnerability scanner
        uses: aquasecurity/trivy-action@master
        with:
          scan-type: 'fs'
          scan-ref: '.'
          severity: 'CRITICAL,HIGH'
      - name: Run npm audit
        run: pnpm audit --audit-level=high

  # ── Job 4: Build Docker Images ────────────────────────────────
  build:
    needs: [lint, test]
    runs-on: ubuntu-latest
    strategy:
      matrix:
        service:
          - gateway
          - authsphere
          - teamsync-api
          - teamsync-web
          - flowboard
          - vaultspace
          - loglens
          - devpulse
          - schemaforge
          - querymind
          - deployhub
          - insightai
          - pipevista
    steps:
      - uses: actions/checkout@v4
      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3
      - name: Login to Docker Hub
        uses: docker/login-action@v3
        with:
          username: ${{ secrets.DOCKER_USERNAME }}
          password: ${{ secrets.DOCKER_PASSWORD }}
      - name: Build and push
        uses: docker/build-push-action@v5
        with:
          context: .
          file: ./docker/${{ matrix.service }}.Dockerfile
          push: ${{ github.ref == 'refs/heads/main' }}
          tags: |
            vistafam/${{ matrix.service }}:${{ github.sha }}
            vistafam/${{ matrix.service }}:latest
          cache-from: type=gha
          cache-to: type=gha,mode=max

  # ── Job 5: Deploy to Staging ──────────────────────────────────
  deploy-staging:
    needs: [build]
    if: github.ref == 'refs/heads/develop'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Deploy to staging
        run: |
          ssh staging-server "cd /opt/vistafam && \
            docker-compose pull && \
            docker-compose up -d"

  # ── Job 6: Deploy to Production ───────────────────────────────
  deploy-production:
    needs: [build, deploy-staging]
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    environment: production
    steps:
      - uses: actions/checkout@v4
      - name: Deploy to production
        run: |
          ssh production-server "cd /opt/vistafam && \
            docker-compose pull && \
            docker-compose up -d --no-deps"
```

### Docker Build Strategy

```dockerfile
# docker/gateway.Dockerfile
# Multi-stage build for minimal image size

FROM node:20-alpine AS builder
WORKDIR /app
RUN npm install -g pnpm

# Copy workspace files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY packages ./packages
COPY apps/gateway ./apps/gateway

# Install and build
RUN pnpm install --frozen-lockfile
RUN pnpm build --filter=@vistafam/gateway...

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

# Copy only production artifacts
COPY --from=builder /app/apps/gateway/dist ./dist
COPY --from=builder /app/apps/gateway/package.json ./
COPY --from=builder /app/node_modules ./node_modules

# Security: run as non-root
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodejs -u 1001
USER nodejs

EXPOSE 4000
CMD ["node", "dist/main.js"]
```

### Deployment Environments

```
┌─────────────────────────────────────────────────────────────────┐
│                    DEPLOYMENT ENVIRONMENTS                       │
│                                                                  │
│  Development (dev):                                             │
│  ├── Local Docker Compose                                       │
│  ├── Hot reload enabled                                         │
│  ├── Debug logging                                              │
│  ├── Seed data populated                                        │
│  └── AI providers: OpenAI (dev key)                             │
│                                                                  │
│  Staging (staging):                                             │
│  ├── Separate VM / ECS cluster                                  │
│  ├── Production-like data (anonymized)                          │
│  ├── Same infra stack (PostgreSQL, Redis, NATS)                │
│  ├── Automated E2E tests run post-deploy                        │
│  └── AI providers: OpenAI (test key)                            │
│                                                                  │
│  Production (prod):                                             │
│  ├── Primary VM / ECS cluster                                   │
│  ├── Real user data                                             │
│  ├── Full observability stack                                   │
│  ├── Blue-green deployment (zero downtime)                      │
│  └── AI providers: OpenAI + Gemini (with fallback)              │
│                                                                  │
│  Feature Previews (per PR):                                     │
│  ├── Vercel / Netlify for frontend previews                     │
│  ├── Render / Railway for backend previews                      │
│  ├── Isolated database (ephemeral)                              │
│  └── Auto-destroyed after 7 days of inactivity                  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Database Migrations in CI/CD

```yaml
# Migrations run BEFORE service deployment
# Using node-pg-migrate

- name: Run database migrations
  run: |
    pnpm migrate:up --filter=@vistafam/database
  env:
    DATABASE_URL: ${{ secrets.STAGING_DATABASE_URL }}

- name: Verify migrations
  run: |
    pnpm migrate:check --filter=@vistafam/database

# Rollback strategy:
# - Migrations are backward-compatible (add columns, don't remove)
# - Old code can run against new schema
# - Next deploy removes deprecated columns
# - If rollback needed, run: pnpm migrate:down
```

### Zero-Downtime Deployment

```bash
#!/bin/bash
# scripts/deploy.sh

SERVICE=$1
VERSION=$2

echo "Deploying $SERVICE:$VERSION..."

# 1. Pull new image
docker-compose pull $SERVICE

# 2. Start new container alongside old
docker-compose up -d --no-deps --scale $SERVICE=2 $SERVICE

# 3. Wait for health check (30s max)
NEW_CONTAINER=$(docker-compose ps -q $SERVICE | tail -1)
for i in {1..6}; do
  if docker exec $NEW_CONTAINER wget -qO- http://localhost:4000/health/ready; then
    echo "Health check passed"
    break
  fi
  sleep 5
done

# 4. Update NGINX upstream (if using dynamic config)
curl -X POST http://nginx:80/reload

# 5. Stop old container
OLD_CONTAINER=$(docker-compose ps -q $SERVICE | head -1)
docker stop -t 30 $OLD_CONTAINER

# 6. Scale back to 1
docker-compose up -d --no-deps --scale $SERVICE=1 $SERVICE

echo "Deployment complete"
```

### Feature Flags

```typescript
// Deploy code behind feature flags
// Enable gradually via PipeVista config

interface FeatureFlag {
  name: string;
  enabled: boolean;
  rolloutPercentage: number; // 0-100
  targetUsers?: string[];    // Specific user IDs
  targetTenants?: string[];  // Specific tenant IDs
}

// Usage in code:
if (await featureFlags.isEnabled('new-chat-ui', { userId, tenantId })) {
  return <NewChatUI />;
} else {
  return <LegacyChatUI />;
}

// Rollout strategy:
// Day 1: 0% (internal testing)
// Day 2: 5% (canary)
// Day 3: 25% (early adopters)
// Day 4: 50%
// Day 5: 100% (full rollout)
// Day 6: Remove flag, clean up legacy code
```

### Monorepo-Specific CI Optimizations

```typescript
// Turbo build caching in GitHub Actions
// Only build services that changed

// turbo.json
{
  "pipeline": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**", ".next/**"]
    },
    "test": {
      "dependsOn": ["build"]
    },
    "lint": {},
    "typecheck": {}
  }
}

// GitHub Actions uses Turborepo remote caching
env:
  TURBO_TOKEN: ${{ secrets.TURBO_TOKEN }}
  TURBO_TEAM: vistafam
```

### Incident Response Integration

```
Deployment triggers:
  ├─> DeployHub records deployment event
  ├─> LogLens monitors error rate for 15 min post-deploy
  ├─> If error rate > 1%:
  │   ├─> Auto-rollback to previous version
  │   ├─> Alert sent to #incidents channel
  │   └─> Post-mortem template created in TeamSync
  └─> If healthy after 15 min:
      └─> Mark deployment as successful in DevPulse
```
