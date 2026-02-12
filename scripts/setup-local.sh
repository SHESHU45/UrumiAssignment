#!/bin/bash
set -e

# ==========================================
# Store Platform — Local Setup Script
# Creates a Kind cluster and deploys the platform
# ==========================================

CLUSTER_NAME="store-platform"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

echo "============================================"
echo "  Store Platform — Local Setup"
echo "============================================"

# Step 1: Create Kind cluster
echo ""
echo "[1/5] Creating Kind cluster..."
if kind get clusters 2>/dev/null | grep -q "$CLUSTER_NAME"; then
  echo "  Cluster '$CLUSTER_NAME' already exists, skipping creation."
else
  cat <<EOF | kind create cluster --name "$CLUSTER_NAME" --config=-
kind: Cluster
apiVersion: kind.x-k8s.io/v1alpha4
nodes:
  - role: control-plane
    kubeadmConfigPatches:
      - |
        kind: InitConfiguration
        nodeRegistration:
          kubeletExtraArgs:
            node-labels: "ingress-ready=true"
    extraPortMappings:
      - containerPort: 80
        hostPort: 80
        protocol: TCP
      - containerPort: 443
        hostPort: 443
        protocol: TCP
EOF
  echo "  Kind cluster created!"
fi

# Step 2: Install NGINX Ingress Controller
echo ""
echo "[2/5] Installing NGINX Ingress Controller..."
kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/main/deploy/static/provider/kind/deploy.yaml

echo "  Waiting for ingress controller to be ready..."
kubectl wait --namespace ingress-nginx \
  --for=condition=ready pod \
  --selector=app.kubernetes.io/component=controller \
  --timeout=120s

echo "  NGINX Ingress Controller ready!"

# Step 3: Build Docker images
echo ""
echo "[3/5] Building Docker images..."

echo "  Building backend..."
docker build -t store-platform-backend:latest "$PROJECT_DIR/backend"

echo "  Building dashboard..."
docker build -t store-platform-dashboard:latest "$PROJECT_DIR/dashboard"

echo "  Loading images into Kind..."
kind load docker-image store-platform-backend:latest --name "$CLUSTER_NAME"
kind load docker-image store-platform-dashboard:latest --name "$CLUSTER_NAME"

echo "  Images built and loaded!"

# Step 4: Create platform namespace and copy helm chart
echo ""
echo "[4/5] Preparing platform namespace..."
kubectl create namespace store-platform --dry-run=client -o yaml | kubectl apply -f -

# Copy the WooCommerce Helm chart into a ConfigMap so the backend can access it
# In production, charts would be in a Helm repo or baked into the backend image
echo "  Packaging WooCommerce chart for backend access..."
cd "$PROJECT_DIR/helm"
# We'll rely on the chart being mounted or baked into the image
# For Kind, we'll use a volume mount approach

# Step 5: Deploy platform using Helm
echo ""
echo "[5/5] Deploying Store Platform via Helm..."
helm upgrade --install store-platform \
  "$PROJECT_DIR/helm/store-platform" \
  -n store-platform \
  -f "$PROJECT_DIR/helm/store-platform/values-local.yaml" \
  --wait \
  --timeout 120s

echo ""
echo "============================================"
echo "  Setup Complete!"
echo "============================================"
echo ""
echo "  Dashboard:  http://dashboard.store.localhost"
echo "  API:        http://api.store.localhost/api/health"
echo ""
echo "  Note: Add these to your /etc/hosts file:"
echo "    127.0.0.1 dashboard.store.localhost api.store.localhost"
echo ""
echo "  For store URLs, add:"
echo "    127.0.0.1 <store-name>.store.localhost"
echo ""
echo "  To check status:"
echo "    kubectl get pods -n store-platform"
echo "    kubectl get ingress -n store-platform"
echo ""
