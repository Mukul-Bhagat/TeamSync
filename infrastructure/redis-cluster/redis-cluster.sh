#!/bin/sh
# Redis Cluster Setup Script for Docker Swarm
# Run after stack deploy: docker exec -it <redis-container> /usr/local/bin/redis-cli --cluster create ...

# Get Redis container IPs
CONTAINERS=$(docker service ps vistafam_redis-cluster --format "{{.Node}}")
HOSTS=""
for node in $CONTAINERS; do
  HOSTS="$HOSTS $node:6379"
done

echo "Creating Redis cluster with nodes: $HOSTS"

# Create cluster (3 masters + 3 replicas)
redis-cli --cluster create $HOSTS --cluster-replicas 1 --cluster-yes

echo "Redis cluster created successfully"
