#!/bin/bash
set -e

# Build and load images for Kind
CLUSTER_NAME="store-platform"
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "Building backend image..."
docker build -t store-platform-backend:latest "$PROJECT_DIR/backend"

echo "Building dashboard image..."
docker build -t store-platform-dashboard:latest "$PROJECT_DIR/dashboard"

echo "Loading images into Kind cluster..."
kind load docker-image store-platform-backend:latest --name "$CLUSTER_NAME"
kind load docker-image store-platform-dashboard:latest --name "$CLUSTER_NAME"

echo "Restarting deployments..."
kubectl rollout restart deployment/store-platform-backend -n store-platform 2>/dev/null || true
kubectl rollout restart deployment/store-platform-dashboard -n store-platform 2>/dev/null || true

echo "Images rebuilt and loaded!"
