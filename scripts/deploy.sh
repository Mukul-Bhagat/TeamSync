#!/bin/bash
# VistaFam Production Deploy Script
# Usage: ./scripts/deploy.sh [tag]
#   tag: Docker image tag (default: latest)

set -euo pipefail

TAG="${1:-latest}"
COMPOSE_FILE="/opt/vistafam/docker-compose.production.yml"

echo "=== VistaFam Production Deploy: $TAG ==="

# ── Validate Environment ───────────────────────────────────
if [ ! -f "$COMPOSE_FILE" ]; then
  echo "ERROR: $COMPOSE_FILE not found"
  exit 1
fi

if [ ! -f "/opt/vistafam/.env" ]; then
  echo "ERROR: .env file not found"
  exit 1
fi

# ── Pre-deploy Backup ──────────────────────────────────────
echo "[1/4] Creating pre-deploy backup..."
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
mkdir -p /opt/vistafam/backups/pre-deploy
docker exec vistafam-postgres pg_dump -U vistafam vistafam \
  | gzip > "/opt/vistafam/backups/pre-deploy/pre-${TIMESTAMP}.sql.gz"
echo "  -> Backup: pre-${TIMESTAMP}.sql.gz"

# ── Pull Images ────────────────────────────────────────────
echo "[2/4] Pulling images..."
export TAG
# For each service using ghcr.io images, pull the specific tag
# The compose file uses :latest by default; override with env if needed
docker-compose -f "$COMPOSE_FILE" pull

# ── Rolling Update ─────────────────────────────────────────
echo "[3/4] Rolling update..."
docker-compose -f "$COMPOSE_FILE" up -d

# ── Health Checks ──────────────────────────────────────────
echo "[4/4] Running health checks..."
sleep 15

HEALTH_ENDPOINTS=(
  "http://localhost/nginx-health:nginx"
  "http://localhost:4000/health/live:gateway"
  "http://localhost:4001/health/live:authsphere"
  "http://localhost:4002/health/live:teamsync-api"
  "http://localhost:4003/health/live:flowboard"
  "http://localhost:4004/health/live:vaultspace"
  "http://localhost:4006/health/live:pipevista"
  "http://localhost:4012/health/live:insightai"
)

FAILED=0
for endpoint in "${HEALTH_ENDPOINTS[@]}"; do
  url=$(echo "$endpoint" | cut -d: -f1-3)
  name=$(echo "$endpoint" | cut -d: -f4)
  if curl -sf "$url" > /dev/null 2>&1; then
    echo "  [OK] $name"
  else
    echo "  [FAIL] $name"
    FAILED=1
  fi
done

# ── Cleanup ────────────────────────────────────────────────
echo "[Cleanup] Pruning old Docker images..."
docker image prune -af --filter "until=168h" || true

if [ $FAILED -eq 0 ]; then
  echo "=== Deploy successful: $TAG ==="
else
  echo "=== Deploy completed with warnings: $TAG ==="
  echo "Some services failed health checks. Check logs:"
  echo "  docker-compose -f $COMPOSE_FILE logs --tail=100 [service]"
fi
