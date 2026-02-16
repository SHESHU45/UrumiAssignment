# Store Provisioning Platform

A Kubernetes-native platform that provisions isolated ecommerce stores (WooCommerce) with a single click. Built for local development (Kind) and production deployment (k3s/VPS) using the **same Helm charts** with different values files.

![Architecture](docs/architecture-diagram.png)

## 🚀 Features

- **One-click store provisioning** — Create WooCommerce stores from a React dashboard
- **Namespace isolation** — Each store runs in its own Kubernetes namespace
- **Helm-based deployment** — Same charts for local and production
- **Full WooCommerce setup** — Stores come pre-configured with products, COD payment, and storefront
- **Security** — RBAC, NetworkPolicies, non-root containers, rate limiting
- **Observability** — Activity logs, metrics, audit trail, Kubernetes events
- **Resource guardrails** — ResourceQuota + LimitRange per store namespace
- **Idempotent provisioning** — Safe to retry, handles failures cleanly
- **Clean teardown** — Deleting a store removes all K8s resources including PVCs

## 📋 Prerequisites

- **Docker Desktop** (with WSL2 on Windows)
- **Kind** — `go install sigs.k8s.io/kind@latest` or [install page](https://kind.sigs.k8s.io/docs/user/quick-start/#installation)
- **kubectl** — [install page](https://kubernetes.io/docs/tasks/tools/)
- **Helm 3** — [install page](https://helm.sh/docs/intro/install/)
- **Node.js 20+** (for local development)

## 🏗️ Project Structure

```
├── backend/                  # Node.js + Express API
│   ├── src/
│   │   ├── controllers/      # REST endpoints
│   │   ├── services/         # Provisioner, K8s client, Store manager
│   │   ├── middleware/       # Audit, error handling
│   │   ├── models/           # SQLite store database
│   │   └── config/           # Configuration
│   └── Dockerfile
├── dashboard/                # React + Vite frontend
│   ├── src/
│   │   ├── components/       # UI components
│   │   └── services/         # API client
│   └── Dockerfile
├── helm/
│   ├── store-platform/       # Platform chart (dashboard + backend)
│   │   ├── values.yaml
│   │   ├── values-local.yaml
│   │   └── values-prod.yaml
│   └── woocommerce/          # Per-store chart
│       └── templates/        # MySQL, WordPress, Ingress, NetworkPolicy...
├── scripts/                  # Setup and management scripts
└── docs/                     # Architecture docs
```

## 🖥️ Local Setup (Kind)

### Quick Start

```bash
# 1. Clone the repo
git clone <repo-url> && cd UrumiAssignment

# 2. Run setup script (creates Kind cluster, builds images, deploys platform)
chmod +x scripts/setup-local.sh
./scripts/setup-local.sh

# 3. Add hosts entries (run as admin)
# Windows: Add to C:\Windows\System32\drivers\etc\hosts
# Linux/Mac: Add to /etc/hosts
127.0.0.1 dashboard.store.localhost api.store.localhost

# 4. Open the dashboard
open http://dashboard.store.localhost
```

### Manual Setup

```bash
# 1. Create Kind cluster with ingress ports
cat <<EOF | kind create cluster --name store-platform --config=-
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
      - containerPort: 443
        hostPort: 443
EOF

# 2. Install NGINX Ingress Controller
kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/main/deploy/static/provider/kind/deploy.yaml
kubectl wait --namespace ingress-nginx --for=condition=ready pod --selector=app.kubernetes.io/component=controller --timeout=120s

# 3. Build and load images
docker build -t store-platform-backend:latest ./backend
docker build -t store-platform-dashboard:latest ./dashboard
kind load docker-image store-platform-backend:latest --name store-platform
kind load docker-image store-platform-dashboard:latest --name store-platform

# 4. Deploy platform
kubectl create namespace store-platform
helm upgrade --install store-platform ./helm/store-platform \
  -n store-platform -f ./helm/store-platform/values-local.yaml --wait

# 5. Check status
kubectl get pods -n store-platform
kubectl get ingress -n store-platform
```

## 🛒 Creating a Store and Placing an Order

### Via Dashboard
1. Open `http://dashboard.store.localhost`
2. Click **"Create New Store"**
3. Enter a name (e.g., `my-shop`) and select **WooCommerce**
4. Click **"🚀 Create Store"**
5. Watch status change from **Provisioning** → **Ready** (3-5 minutes)
6. Add `127.0.0.1 my-shop.store.localhost` to hosts file
7. Click **"Open Store"** to browse the storefront

### Via API
```bash
# Create store
curl -X POST http://api.store.localhost/api/stores \
  -H "Content-Type: application/json" \
  -d '{"name": "my-shop", "engine": "woocommerce"}'

# Check status (poll until "Ready")
curl http://api.store.localhost/api/stores

# Delete store
curl -X DELETE http://api.store.localhost/api/stores/<store-id>
```

### Placing a WooCommerce Order
1. Open `http://my-shop.store.localhost`
2. Browse products (3 sample products pre-created)
3. **Add a product to cart** (e.g., "Classic T-Shirt")
4. Go to **Checkout**
5. Fill in shipping details (any test data)
6. Select payment method: **Cash on Delivery**
7. Click **Place Order**
8. ✅ Order confirmed!
9. Verify in admin: `http://my-shop.store.localhost/wp-admin` → **WooCommerce → Orders**
   - Default login: `admin` / (generated password shown in setup job logs)

## 🌐 Production Setup (VPS/k3s)

### Install k3s on VPS
```bash
curl -sfL https://get.k3s.io | sh -

# Install Helm
curl https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3 | bash
```

### Deploy with Production Values
```bash
# Edit values-prod.yaml with your domain
# Update global.storeDomain, ingress hosts, etc.

helm upgrade --install store-platform ./helm/store-platform \
  -n store-platform --create-namespace \
  -f ./helm/store-platform/values-prod.yaml --wait
```

### What Changes via Helm Values (Local → Prod)

| Setting | Local (Kind) | Production (k3s/VPS) |
|---|---|---|
| Domain | `*.store.localhost` | `*.yourdomain.com` |
| TLS | Disabled | Enabled (cert-manager) |
| Storage Class | `standard` | `local-path` |
| Backend replicas | 1 | 2 |
| Dashboard replicas | 1 | 2 |
| Image pull policy | `Never` | `Always` |
| Max stores | 20 | 100 |
| Resources | Lower | Higher |

### TLS with cert-manager (Optional)
```bash
# Install cert-manager
kubectl apply -f https://github.com/cert-manager/cert-manager/releases/latest/download/cert-manager.yaml

# Create ClusterIssuer for Let's Encrypt
cat <<EOF | kubectl apply -f -
apiVersion: cert-manager.io/v1
kind: ClusterIssuer
metadata:
  name: letsencrypt-prod
spec:
  acme:
    server: https://acme-v02.api.letsencrypt.org/directory
    email: your@email.com
    privateKeySecretRef:
      name: letsencrypt-prod
    solvers:
      - http01:
          ingress:
            class: nginx
EOF
```

## 🧹 Cleanup

```bash
# Delete everything (stores, platform, Kind cluster)
chmod +x scripts/cleanup.sh
./scripts/cleanup.sh

# Or manually:
helm uninstall store-platform -n store-platform
kind delete cluster --name store-platform
```

## 📚 Documentation

- [System Design & Tradeoffs](docs/system-design.md)

## 🏅 Standout Features

| Feature | Details |
|---|---|
| Namespace isolation | Each store in `store-<id>` namespace |
| ResourceQuota + LimitRange | CPU/memory/PVC limits per store |
| NetworkPolicies | Deny-all default + explicit WordPress↔MySQL + ingress allows |
| RBAC | Dedicated ServiceAccount with least-privilege ClusterRole |
| Idempotency | Checks before create, Helm release names match store IDs |
| Recovery | Reconciliation loop detects and recovers stuck stores |
| Rate limiting | Per-endpoint, configurable via Helm values |
| Quotas | Max stores total and per-user |
| Provisioning timeout | Auto-fails after configurable timeout |
| Audit trail | SQLite-backed, all actions logged with timestamps |
| Observability | Events stream, metrics, failure reasons |
| Non-root containers | SecurityContext enforced in all deployments |
| Clean teardown | Helm uninstall + namespace delete + PVC cleanup |
| Horizontal scaling | Backend stateless (except SQLite), dashboard fully stateless |
