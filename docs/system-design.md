# System Design & Tradeoffs

## Architecture Overview

The platform follows a **3-tier architecture**:

1. **Dashboard (React)** — User interface for store management
2. **Backend API (Node.js/Express)** — REST API + Provisioning Engine
3. **Kubernetes Resources** — Per-store namespaces with isolated workloads

### Key Design Decisions

**Helm CLI via child_process** instead of Go Helm SDK:
- Pros: Simpler, leverages proven Helm logic, consistent behavior
- Cons: Slower than native API calls, requires Helm binary in container
- Tradeoff: Accepted because reliability > raw speed for provisioning

**SQLite for platform state** instead of PostgreSQL:
- Pros: Zero external dependencies, file-based, WAL mode for concurrency
- Cons: Single-writer limitation, not horizontally scalable
- Tradeoff: For a platform managing <100 stores, SQLite is sufficient; for production scale, migrate to PostgreSQL

**Namespace-per-store** isolation:
- Strongest isolation available without separate clusters
- Each namespace gets: ResourceQuota, LimitRange, NetworkPolicies
- Blast radius limited: a compromised store cannot affect others

---

## Provisioning Flow

```
User clicks "Create Store"
        │
        ▼
POST /api/stores { name, engine }
        │
        ├── Validate input (DNS-safe name, no duplicates)
        ├── Check quotas (max total, max per user)
        ├── Check concurrency (max parallel provisions)
        │
        ▼
Create store record in SQLite (status: Provisioning)
        │
        ▼
Start async provisioning:
        │
        ├── Create K8s namespace with labels (IDEMPOTENT)
        ├── Generate random secrets (MySQL, WordPress)
        ├── helm install (IDEMPOTENT: checks if release exists)
        │     └── Creates: MySQL StatefulSet, WordPress Deployment,
        │                  Services, Ingress, PVC, Secrets,
        │                  NetworkPolicy, ResourceQuota, LimitRange,
        │                  WP-CLI Setup Job
        │
        ▼
Poll pod readiness (5s intervals, 10min timeout)
        │
        ├── Success → status: Ready
        └── Timeout → status: Failed (with error message)
```

## Idempotency

1. **Namespace creation**: Uses `get → create if not found` pattern
2. **Helm install**: Checks `helm status` before install; `already exists` treated as success
3. **Duplicate names**: Rejected at API level before provisioning starts
4. **Store ID generation**: UUID-based, collision-free

## Failure & Recovery

| Scenario | Handling |
|---|---|
| Helm install fails | Status → Failed, error message stored |
| Pods never become ready | Timeout → Failed after 10 minutes |
| Backend restarts mid-provision | Reconciliation loop checks Provisioning stores |
| Namespace deleted externally | Reconciler detects, marks Failed |
| Delete fails | Status → Failed with delete error |
| Network timeout | Helm timeout + retry via reconciliation |

## Cleanup Guarantees

Deleting a store:
1. `helm uninstall` removes all Helm-managed resources
2. `kubectl delete namespace` catches any remaining resources
3. Namespace deletion cascades to: Pods, PVCs, Secrets, Services, Ingress, NetworkPolicies
4. SQLite record marked as deleted (soft delete for audit trail)

## Security Posture

| Layer | Implementation |
|---|---|
| **RBAC** | Dedicated ServiceAccount + ClusterRole with minimum permissions |
| **Secrets** | Generated per-store, stored in K8s Secrets, never hardcoded |
| **NetworkPolicies** | Deny-all default + explicit per-store allows |
| **Containers** | Non-root user, read-only where possible |
| **API** | Rate limiting, input validation, Helmet.js headers |
| **Audit** | Every mutating action logged with IP, timestamp, details |

## What Changes for Production

| Component | Local | Production |
|---|---|---|
| K8s cluster | Kind | k3s on VPS |
| Domain | `*.store.localhost` | `*.yourdomain.com` |
| TLS | None | cert-manager + Let's Encrypt |
| Storage | `standard` StorageClass | `local-path` or cloud PV |
| Image pull | `Never` (pre-loaded) | `Always` (from registry) |
| Replicas | 1 each | 2+ backend, 2+ dashboard |
| DNS | /etc/hosts entries | Wildcard DNS record |
| Secrets | Generated locally | Sealed Secrets / Vault |
| Ingress | NGINX (Kind deploy) | NGINX (standard) or Traefik |

All differences handled via `values-local.yaml` vs `values-prod.yaml` — **zero code changes**.

## Horizontal Scaling

- **Dashboard**: Fully stateless (NGINX serving static files), scale with `replicas`
- **Backend API**: Stateless except SQLite file. For horizontal:
  - Move state to PostgreSQL
  - Add Redis for session/rate-limit sharing
  - Use leader election for reconciliation loop
- **Provisioning**: Max concurrent provisions configurable; Helm releases are idempotent
- **Stores**: Each store is independent; no cross-store dependencies

## Upgrade/Rollback with Helm

```bash
# Upgrade platform
helm upgrade store-platform ./helm/store-platform -n store-platform -f values-prod.yaml

# Rollback
helm rollback store-platform 1 -n store-platform

# Upgrade a store's WordPress version
helm upgrade woo-<store-id> ./helm/woocommerce -n store-<id> --set wordpress.image=wordpress:6.8-apache
```
