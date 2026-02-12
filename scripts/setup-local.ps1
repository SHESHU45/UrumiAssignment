# Store Platform — Local Setup Script (PowerShell)
# Creates a Kind cluster and deploys the platform

$ErrorActionPreference = 'Stop'

Write-Host 'Checking for tools...'
# Ensure tools are in PATH
$winGetPath = "$env:LOCALAPPDATA\Microsoft\WinGet\Packages"
if (Test-Path $winGetPath) {
    $packages = Get-ChildItem -Path $winGetPath -Recurse -Include kind.exe, helm.exe, kubectl.exe -ErrorAction SilentlyContinue
    foreach ($pkg in $packages) {
        if ($env:Path -notlike "*$($pkg.DirectoryName)*") {
            $env:Path += ";$($pkg.DirectoryName)"
            Write-Host "Added to PATH: $($pkg.DirectoryName)"
        }
    }
}

# Verify tools
try {
    kind version
    helm version
    kubectl version --client
}
catch {
    Write-Error 'Required tools (kind, helm, kubectl) not found in PATH. Please restart your terminal or ensure they are installed.'
    exit 1
}

$CLUSTER_NAME = 'store-platform'
$SCRIPT_DIR = $PSScriptRoot
$PROJECT_DIR = Split-Path -Parent $SCRIPT_DIR

Write-Host '============================================'
Write-Host '  Store Platform — Local Setup'
Write-Host '============================================'

# Step 1: Create Kind cluster
Write-Host ''
Write-Host '[1/5] Creating Kind cluster...'

$clusters = kind get clusters
if ($clusters -contains $CLUSTER_NAME) {
    Write-Host "  Cluster '$CLUSTER_NAME' already exists, skipping creation."
}
else {
    # Construct config using array join (newline must be handled as `n)
    $lines = @(
        'kind: Cluster',
        'apiVersion: kind.x-k8s.io/v1alpha4',
        'nodes:',
        '  - role: control-plane',
        '    kubeadmConfigPatches:',
        '      - |',
        '        kind: InitConfiguration',
        '        nodeRegistration:',
        '          kubeletExtraArgs:',
        "            node-labels: 'ingress-ready=true'",
        '    extraPortMappings:',
        '      - containerPort: 80',
        '        hostPort: 80',
        '        protocol: TCP',
        '      - containerPort: 443',
        '        hostPort: 443',
        '        protocol: TCP'
    )
    $kindConfigContent = $lines -join "`n"
    
    $tempConfig = [System.IO.Path]::GetTempFileName()
    Set-Content -Path $tempConfig -Value $kindConfigContent -Encoding ASCII
    
    try {
        Write-Host "Creating cluster with config from $tempConfig"
        kind create cluster --name "$CLUSTER_NAME" --config "$tempConfig"
        Write-Host '  Kind cluster created!'
    }
    finally {
        Remove-Item -Path $tempConfig -Force -ErrorAction SilentlyContinue
    }
}

# Step 2: Install NGINX Ingress Controller
Write-Host ''
Write-Host '[2/5] Installing NGINX Ingress Controller...'
kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/main/deploy/static/provider/kind/deploy.yaml

Write-Host '  Waiting for ingress controller to be ready...'
# Wait with timeout
kubectl wait --namespace ingress-nginx --for=condition=ready pod --selector=app.kubernetes.io/component=controller --timeout=300s

Write-Host '  NGINX Ingress Controller ready!'

# Step 3: Build Docker images
Write-Host ''
Write-Host '[3/5] Building Docker images...'

Write-Host "  Building backend from $PROJECT_DIR/backend..."
docker build -t store-platform-backend:latest "$PROJECT_DIR/backend"

Write-Host "  Building dashboard from $PROJECT_DIR/dashboard..."
docker build -t store-platform-dashboard:latest "$PROJECT_DIR/dashboard"

Write-Host '  Loading images into Kind...'
kind load docker-image store-platform-backend:latest --name "$CLUSTER_NAME"
kind load docker-image store-platform-dashboard:latest --name "$CLUSTER_NAME"

Write-Host '  Images built and loaded!'

# Step 4: Create platform namespace
Write-Host ''
Write-Host '[4/5] Preparing platform namespace...'
# Check if namespace exists
$ns = kubectl get ns store-platform --ignore-not-found
if (-not $ns) {
    kubectl create namespace store-platform
}

# Step 5: Deploy platform using Helm
Write-Host ''
Write-Host '[5/5] Deploying Store Platform via Helm...'
helm upgrade --install store-platform "$PROJECT_DIR/helm/store-platform" -n store-platform -f "$PROJECT_DIR/helm/store-platform/values-local.yaml" --wait --timeout 300s

Write-Host ''
Write-Host '============================================'
Write-Host '  Setup Complete!'
Write-Host '============================================'
Write-Host ''
Write-Host '  Dashboard:  http://dashboard.store.localhost'
Write-Host '  API:        http://api.store.localhost/api/health'
Write-Host ''
Write-Host '  Note: Add these to your hosts file (C:\Windows\System32\drivers\etc\hosts):'
Write-Host '    127.0.0.1 dashboard.store.localhost api.store.localhost'
Write-Host ''
Write-Host '  For store URLs, add:'
Write-Host '    127.0.0.1 [store-name].store.localhost'
Write-Host ''
Write-Host '  To check status:'
Write-Host '    kubectl get pods -n store-platform'
Write-Host '    kubectl get ingress -n store-platform'
Write-Host ''
