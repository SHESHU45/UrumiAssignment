#!/bin/bash
set -e

# Clean up everything
CLUSTER_NAME="store-platform"

echo "============================================"
echo "  Store Platform — Cleanup"
echo "============================================"

# Delete all store namespaces
echo "Deleting store namespaces..."
kubectl get ns -l app.kubernetes.io/managed-by=store-platform -o name 2>/dev/null | \
  xargs -r kubectl delete --timeout=60s || true

# Uninstall platform
echo "Uninstalling platform Helm release..."
helm uninstall store-platform -n store-platform 2>/dev/null || true
kubectl delete ns store-platform --timeout=60s 2>/dev/null || true

# Delete Kind cluster
echo "Deleting Kind cluster..."
kind delete cluster --name "$CLUSTER_NAME" 2>/dev/null || true

echo ""
echo "Cleanup complete!"
