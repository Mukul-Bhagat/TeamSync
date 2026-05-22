# Runbook: Database Recovery

## Symptoms
- PostgreSQL container not starting
- Data corruption errors in logs
- Application errors: "connection refused" or "invalid page"

## Quick Checks

```bash
# Check postgres container status
docker ps | grep postgres
docker logs vistafam-postgres --tail=100

# Check disk space
df -h
```

## Scenario 1: Minor Corruption (WAL Replay)

```bash
# Stop all services that connect to DB
cd /opt/vistafam
docker-compose -f docker-compose.production.yml stop gateway teamsync-api flowboard vaultspace

# Restart postgres with recovery
docker-compose -f docker-compose.production.yml restart postgres

# Check if it comes up healthy
docker ps | grep postgres
```

## Scenario 2: Restore from Latest Backup

```bash
cd /opt/vistafam

# 1. Stop all DB-connected services
docker-compose -f docker-compose.production.yml stop gateway teamsync-api flowboard vaultspace loglens devpulse schemaforge querymind deployhub insightai pipevista

# 2. Stop postgres
docker-compose -f docker-compose.production.yml stop postgres

# 3. Backup current (corrupted) data
docker run --rm -v vistafam_postgres_data:/data alpine tar czf /tmp/postgres_corrupted_$(date +%Y%m%d).tar.gz -C /data .

# 4. Remove corrupted data
# CAUTION: This destroys current data. Only do if backup confirmed!
docker volume rm vistafam_postgres_data

# 5. Restore from latest backup
LATEST=$(ls -t backups/postgres/*.sql.gz | head -1)
docker volume create vistafam_postgres_data

docker run --rm \
  -v vistafam_postgres_data:/var/lib/postgresql/data \
  -v $(pwd)/backups/postgres:/backups \
  postgres:16-alpine \
  sh -c "gunzip < /backups/$(basename $LATEST) | psql -U vistafam -d vistafam"

# 6. Start postgres
docker-compose -f docker-compose.production.yml up -d postgres

# 7. Start all services
docker-compose -f docker-compose.production.yml up -d

# 8. Verify
curl -sf http://localhost:4000/health/live
```

## Scenario 3: Point-in-Time Recovery (WAL)

If WAL archiving is enabled (`archive_mode=on`):

```bash
# Requires manual PostgreSQL config. See PostgreSQL docs for PITR.
# This is the most granular recovery but requires setup.
```

## Prevention
- Backups run daily at 3 AM UTC automatically
- Monitor disk space
- Never run out of disk space (PostgreSQL will crash)
