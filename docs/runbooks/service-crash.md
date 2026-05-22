# Runbook: Service Crash Recovery

## Symptoms
- Service health endpoint returns non-200
- Docker container shows `unhealthy` or `exited` status
- Grafana alert fires: `ServiceDown`

## Quick Fix (2 minutes)

```bash
# SSH to VPS
ssh user@your-vps-ip

# Restart the failing service
cd /opt/vistafam
docker-compose -f docker-compose.production.yml restart <service-name>

# Example: restart TeamSync API
docker-compose -f docker-compose.production.yml restart teamsync-api

# Check if healthy
docker ps | grep teamsync-api
curl -sf http://localhost:4002/health/live
```

## If restart fails (check logs)

```bash
# Check logs
docker-compose -f docker-compose.production.yml logs --tail=200 <service-name>

# Common issues:
# 1. Out of memory -> increase memory limit in compose file
# 2. DB connection failed -> check postgres is running
# 3. Env var missing -> check .env file
```

## Rollback to previous version

```bash
cd /opt/vistafam

# Pull previous image (if tagged)
docker pull ghcr.io/vistafam/<service>:<previous-sha>

# Or revert to :latest
docker-compose -f docker-compose.production.yml pull <service>
docker-compose -f docker-compose.production.yml up -d <service>
```

## Escalation
If service keeps crashing after restart + log investigation:
1. Check disk space: `df -h`
2. Check memory: `free -h`
3. Check for OOM kills: `dmesg | grep -i kill`
4. Restore from backup if database corruption suspected
