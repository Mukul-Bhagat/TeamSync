#!/bin/bash
# VistaFam Backup Script
# Run daily at 3 AM UTC via cron or GitHub Actions
# Usage: ./scripts/backup.sh

set -euo pipefail

BACKUP_DIR="/opt/vistafam/backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
S3_BUCKET="s3://vistafam-backups"
RETENTION_DAYS=7

mkdir -p "$BACKUP_DIR"/{postgres,redis,minio,config}

echo "=== VistaFam Backup: $TIMESTAMP ==="

# ── PostgreSQL Backup ──────────────────────────────────────
echo "[1/5] Backing up PostgreSQL..."
docker exec vistafam-postgres pg_dump -U vistafam -d vistafam \
  | gzip > "$BACKUP_DIR/postgres/vistafam_${TIMESTAMP}.sql.gz"
echo "  -> $BACKUP_DIR/postgres/vistafam_${TIMESTAMP}.sql.gz"

# ── Redis Backup ───────────────────────────────────────────
echo "[2/5] Backing up Redis..."
docker exec vistafam-redis redis-cli BGSAVE
sleep 5
cp /var/lib/docker/volumes/vistafam_postgres_data/_data/appendonly.aof \
   "$BACKUP_DIR/redis/redis_${TIMESTAMP}.aof" 2>/dev/null || true
echo "  -> Redis AOF copied"

# ── MinIO Backup ───────────────────────────────────────────
echo "[3/5] Backing up MinIO buckets..."
mc mirror --overwrite minio/teamsync-attachments \
  "$BACKUP_DIR/minio/${TIMESTAMP}/" 2>/dev/null || true
echo "  -> MinIO buckets mirrored"

# ── Config Backup ──────────────────────────────────────────
echo "[4/5] Backing up configuration..."
tar czf "$BACKUP_DIR/config/config_${TIMESTAMP}.tar.gz" \
  -C /opt/vistafam infrastructure/nginx \
  docker-compose.production.yml .env 2>/dev/null || true
echo "  -> Config archived"

# ── Upload to Object Storage ───────────────────────────────
echo "[5/5] Uploading to Object Storage..."
if command -v aws &> /dev/null; then
  aws s3 sync "$BACKUP_DIR/postgres/" "$S3_BUCKET/postgres/" --storage-class STANDARD
  aws s3 sync "$BACKUP_DIR/redis/" "$S3_BUCKET/redis/" --storage-class STANDARD
  aws s3 sync "$BACKUP_DIR/minio/" "$S3_BUCKET/minio/" --storage-class STANDARD
  aws s3 sync "$BACKUP_DIR/config/" "$S3_BUCKET/config/" --storage-class STANDARD
  echo "  -> Upload complete"
else
  echo "  -> AWS CLI not available, skipping S3 upload"
fi

# ── Prune old local backups ────────────────────────────────
echo "[Cleanup] Removing backups older than $RETENTION_DAYS days..."
find "$BACKUP_DIR" -type f -mtime +$RETENTION_DAYS -delete
echo "  -> Cleanup complete"

echo "=== Backup finished: $TIMESTAMP ==="
