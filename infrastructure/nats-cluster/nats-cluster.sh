#!/bin/sh
# NATS Cluster Setup Script for Docker Swarm
# The NATS containers auto-cluster via --routes flag in docker-stack.yml
# This script verifies cluster formation

echo "Checking NATS cluster status..."
for i in 1 2 3; do
  echo "=== NATS Node $i ==="
  curl -s http://nats-cluster-$i:8222/varz | grep -E '"server_name"|"cluster_size"|"connections"' || echo "Node $i not responding"
done

echo ""
echo "Checking JetStream status..."
curl -s http://nats-cluster-1:8222/jsz | grep -E '"streams"|"consumers"|"messages"' || echo "JetStream not available"

echo ""
echo "NATS cluster setup complete"
