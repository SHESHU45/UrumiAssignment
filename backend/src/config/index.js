const config = {
  port: process.env.PORT || 3001,
  nodeEnv: process.env.NODE_ENV || 'development',

  // Kubernetes
  kubeContext: process.env.KUBE_CONTEXT || '',
  storeNamespacePrefix: process.env.STORE_NS_PREFIX || 'store-',

  // Helm
  helmChartPath: process.env.HELM_CHART_PATH || '/app/helm/woocommerce',
  helmTimeout: process.env.HELM_TIMEOUT || '600s',

  // Provisioning
  maxConcurrentProvisions: parseInt(process.env.MAX_CONCURRENT_PROVISIONS || '10', 10),
  provisioningTimeoutMs: parseInt(process.env.PROVISIONING_TIMEOUT_MS || '600000', 10),
  reconcileIntervalMs: parseInt(process.env.RECONCILE_INTERVAL_MS || '30000', 10),

  // Rate limiting
  rateLimitWindowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10),
  rateLimitMax: parseInt(process.env.RATE_LIMIT_MAX || '100000', 10),
  createStoreLimitMax: parseInt(process.env.CREATE_STORE_LIMIT_MAX || '100000', 10),

  // Quotas
  maxStoresPerUser: parseInt(process.env.MAX_STORES_PER_USER || '10', 10),
  maxTotalStores: parseInt(process.env.MAX_TOTAL_STORES || '50', 10),

  // Store defaults
  storeDomain: process.env.STORE_DOMAIN || 'store.localhost',
  defaultStoreEngine: process.env.DEFAULT_STORE_ENGINE || 'woocommerce',

  // Database
  dbPath: process.env.DB_PATH || '/app/data/store-platform.db',

  // Dashboard URL (for CORS)
  dashboardUrl: process.env.DASHBOARD_URL || 'http://localhost:5173',
};

module.exports = config;
