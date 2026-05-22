# Runbook: Complete VPS Failure

## Symptoms
- VPS unreachable (no SSH, no HTTP)
- Hetzner Cloud shows server offline
- All services down simultaneously

## Recovery Steps

### 1. Provision New VPS (Hetzner Cloud)

```bash
# Order new CPX31 (or larger if scaling up)
# Use Ubuntu 22.04 LTS
# Select same region as original for data locality
# Add Floating IP if used
```

### 2. Initial Setup

```bash
# SSH to new VPS
ssh root@new-vps-ip

# Update system
apt update && apt upgrade -y

# Install Docker
apt install -y docker.io docker-compose-plugin
systemctl enable docker

# Install AWS CLI (for backup retrieval)
apt install -y awscli
```

### 3. Restore Configuration

```bash
mkdir -p /opt/vistafam
cd /opt/vistafam

# Restore .env and configs from secure storage
# Option A: Download from 1Password/Bitwarden manually
# Option B: If backed up to S3:
#   aws s3 sync s3://vistafam-backups/config/ ./

# Copy compose file
cp /path/to/docker-compose.production.yml .
```

### 4. Restore Data

```bash
# Download latest backup from Object Storage
aws s3 sync s3://vistafam-backups/postgres/ ./backups/postgres/
aws s3 sync s3://vistafam-backups/redis/ ./backups/redis/
aws s3 sync s3://vistafam-backups/minio/ ./backups/minio/

# Start infrastructure services
docker-compose -f docker-compose.production.yml up -d postgres redis nats minio

# Wait for postgres to be ready
sleep 10

# Restore database
LATEST=$(ls -t backups/postgres/*.sql.gz | head -1)
docker exec -i vistafam-postgres psql -U vistafam -d vistafam < <(gunzip -c $LATEST)

# Restore Redis (if needed)
# cp backups/redis/latest.aof /var/lib/docker/volumes/vistafam_redis_data/_data/appendonly.aof

# Restore MinIO
mc mirror backups/minio/latest/ minio/teamsync-attachments/
```

### 5. Start All Services

```bash
cd /opt/vistafam
docker-compose -f docker-compose.production.yml up -d

# Verify
./scripts/health-check.sh
```

### 6. Update DNS / Floating IP

```bash
# If using Floating IP, assign to new server via Hetzner Console
# If using DNS, update A record to new IP
```

## RTO: ~30 minutes
## RPO: ~1 hour (last backup)

## Prevention
- Daily automated backups
- Floating IP for quick failover
- Consider Hetzner snapshot feature for instant restore
