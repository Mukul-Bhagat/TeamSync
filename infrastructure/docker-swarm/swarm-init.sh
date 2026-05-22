#!/bin/bash
# VistaFam Docker Swarm Initialization Script
# Run on the primary manager node (VPS-4)

set -e

echo "=== VistaFam Docker Swarm Setup ==="

# Initialize swarm (if not already)
if ! docker info --format '{{.Swarm.LocalNodeState}}' | grep -q "active"; then
  echo "Initializing Docker Swarm..."
  docker swarm init --advertise-addr $(hostname -i)
else
  echo "Swarm already active"
fi

# Get join token for workers
WORKER_TOKEN=$(docker swarm join-token -q worker)
MANAGER_TOKEN=$(docker swarm join-token -q manager)

echo ""
echo "=== Join Commands ==="
echo ""
echo "Run on VPS-1, VPS-2, VPS-3 (workers):"
echo "  docker swarm join --token $WORKER_TOKEN $(hostname -i):2377"
echo ""
echo "Run on additional managers:"
echo "  docker swarm join --token $MANAGER_TOKEN $(hostname -i):2377"
echo ""

# Label nodes for topology
# After workers join, run:
echo "=== Label nodes (run after all nodes join) ==="
echo ""
echo "# VPS-1 (Edge)"
echo "docker node update --label-add layer=edge <vps1-node-id>"
echo ""
echo "# VPS-2 (Messaging + AI + Integration)"
echo "docker node update --label-add layer=messaging <vps2-node-id>"
echo "docker node update --label-add layer=ai <vps2-node-id>"
echo "docker node update --label-add layer=integration <vps2-node-id>"
echo ""
echo "# VPS-3 (Control Plane)"
echo "docker node update --label-add layer=control <vps3-node-id>"
echo ""
echo "# VPS-4 (Data Layer + Manager)"
echo "docker node update --label-add layer=data <vps4-node-id>"
echo "docker node update --label-add layer=app <vps4-node-id>"
echo ""

# Create secrets
echo "=== Creating Docker Secrets ==="
if ! docker secret ls | grep -q "postgres_password"; then
  echo "mysecretpassword" | docker secret create postgres_password -
fi
if ! docker secret ls | grep -q "minio_access_key"; then
  echo "minioadmin" | docker secret create minio_access_key -
fi
if ! docker secret ls | grep -q "minio_secret_key"; then
  echo "minioadmin" | docker secret create minio_secret_key -
fi

echo ""
echo "=== Deploy Stack ==="
echo "docker stack deploy -c infrastructure/docker-swarm/docker-stack.yml vistafam"
echo ""
echo "=== Verify ==="
echo "docker stack ps vistafam"
echo "docker service ls"
