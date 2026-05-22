#!/bin/bash
# VistaFam End-to-End Health Check
# Usage: ./scripts/health-check.sh
# Exits with non-zero if any critical service is unhealthy

set -uo pipefail

CRITICAL_SERVICES=(
  "vistafam-nginx"
  "vistafam-gateway"
  "vistafam-authsphere"
  "vistafam-teamsync-api"
  "vistafam-postgres"
  "vistafam-redis"
  "vistafam-nats"
)

HTTP_CHECKS=(
  "http://localhost/nginx-health:NGINX"
  "http://localhost:4000/health/live:Gateway"
  "http://localhost:4001/health/live:AuthSphere"
  "http://localhost:4002/health/live:TeamSync API"
  "http://localhost:4003/health/live:FlowBoard"
  "http://localhost:4004/health/live:VaultSpace"
  "http://localhost:4006/health/live:PipeVista"
  "http://localhost:4012/health/live:InsightAI"
)

EXIT_CODE=0

echo "=== VistaFam Health Check ==="
echo ""

# ── Docker Container Status ────────────────────────────────
echo "--- Docker Containers ---"
for service in "${CRITICAL_SERVICES[@]}"; do
  status=$(docker inspect --format='{{.State.Status}}' "$service" 2>/dev/null || echo "missing")
  health=$(docker inspect --format='{{.State.Health.Status}}' "$service" 2>/dev/null || echo "N/A")
  
  if [ "$status" == "running" ] && ([ "$health" == "healthy" ] || [ "$health" == "N/A" ]); then
    echo "  [OK] $service ($status, $health)"
  else
    echo "  [FAIL] $service ($status, $health)"
    EXIT_CODE=1
  fi
done

echo ""

# ── HTTP Health Endpoints ──────────────────────────────────
echo "--- HTTP Health Checks ---"
for check in "${HTTP_CHECKS[@]}"; do
  url=$(echo "$check" | cut -d: -f1-3)
  name=$(echo "$check" | cut -d: -f4)
  
  if curl -sf -o /dev/null "$url"; then
    echo "  [OK] $name ($url)"
  else
    echo "  [FAIL] $name ($url)"
    EXIT_CODE=1
  fi
done

echo ""

# ── Resource Usage ─────────────────────────────────────────
echo "--- Resource Usage ---"
docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}" \
  $(docker ps -q) 2>/dev/null || true

echo ""

# ── Disk Space ─────────────────────────────────────────────
echo "--- Disk Space ---"
df -h / | tail -1 | awk '{ print "  Root: " $5 " used (" $4 " free)" }'

echo ""

if [ $EXIT_CODE -eq 0 ]; then
  echo "=== ALL CHECKS PASSED ==="
else
  echo "=== SOME CHECKS FAILED ==="
  echo "Check service logs: docker-compose logs --tail=100 [service]"
fi

exit $EXIT_CODE
