const { v4: uuidv4 } = require('uuid');
const config = require('../config');
const logger = require('../utils/logger');
const { getDB } = require('../models/store');
const { getProvisioner } = require('./provisioner');
const { getK8sClient } = require('./k8sClient');

class StoreManager {
    constructor() {
        this.reconcileTimer = null;
    }

    /**
     * Create a new store (async provisioning)
     */
    async createStore(name, engine = 'woocommerce', ipAddress = null) {
        const db = getDB();
        const provisioner = getProvisioner();

        // Validate engine
        if (!['woocommerce', 'medusa'].includes(engine)) {
            throw Object.assign(new Error(`Invalid engine: ${engine}. Supported: woocommerce, medusa`), { statusCode: 400 });
        }

        // MedusaJS is stubbed
        if (engine === 'medusa') {
            throw Object.assign(new Error('MedusaJS engine is not yet implemented. Architecture is ready for Round 2.'), { statusCode: 400 });
        }

        // Validate name (DNS-safe)
        if (!name || !/^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/.test(name)) {
            throw Object.assign(new Error('Store name must be DNS-safe: lowercase alphanumeric and hyphens, 1-63 chars'), { statusCode: 400 });
        }

        // Check for duplicate name
        if (db.getStoreByName(name)) {
            throw Object.assign(new Error(`Store with name "${name}" already exists`), { statusCode: 409 });
        }

        // Check quota
        const activeCount = db.getActiveStoreCount();
        if (activeCount >= config.maxTotalStores) {
            throw Object.assign(new Error(`Maximum total stores (${config.maxTotalStores}) reached`), { statusCode: 429 });
        }

        // Check concurrency capacity
        if (!provisioner.canProvision()) {
            throw Object.assign(new Error(`Too many concurrent provisions. Max: ${config.maxConcurrentProvisions}. Please try again shortly.`), { statusCode: 429 });
        }

        const storeId = uuidv4().substring(0, 8);
        const namespace = `${config.storeNamespacePrefix}${storeId}`;
        const storeHost = `${name}.${config.storeDomain}`;

        // Create store record
        const store = db.createStore({
            id: storeId,
            name,
            engine,
            status: 'Provisioning',
            namespace,
            storeUrl: `http://${storeHost}`,
            adminUrl: engine === 'woocommerce' ? `http://${storeHost}/wp-admin` : `http://${storeHost}/admin`,
        });

        // Audit log
        db.addAuditEntry({
            storeId,
            action: 'CREATE_STORE',
            details: { name, engine, namespace },
            ipAddress,
        });
        db.addEvent(storeId, 'info', `Store creation initiated (engine: ${engine})`);

        // Start async provisioning
        const provisionPromise = this._provisionStore(storeId, name, engine, namespace);
        provisioner.trackProvision(storeId, provisionPromise);

        return store;
    }

    /**
     * Async provisioning flow
     */
    async _provisionStore(storeId, name, engine, namespace) {
        const db = getDB();
        const provisioner = getProvisioner();

        try {
            db.addEvent(storeId, 'info', 'Creating Kubernetes namespace');

            let urls;
            if (engine === 'woocommerce') {
                db.addEvent(storeId, 'info', 'Installing WooCommerce via Helm');
                urls = await provisioner.installWooCommerce(storeId, name, namespace);
            }

            db.addEvent(storeId, 'info', 'Waiting for pods to become ready');
            await provisioner.waitForReady(namespace);

            db.addEvent(storeId, 'success', 'All pods ready — store is live!');
            db.updateStoreStatus(storeId, 'Ready', {
                storeUrl: urls.storeUrl,
                adminUrl: urls.adminUrl,
                errorMessage: null,
            });

            logger.info(`Store ${storeId} (${name}) is Ready`);
        } catch (err) {
            logger.error(`Provisioning failed for store ${storeId}: ${err.message}`);
            db.addEvent(storeId, 'error', `Provisioning failed: ${err.message}`);
            db.updateStoreStatus(storeId, 'Failed', { errorMessage: err.message });
        }
    }

    /**
     * Delete a store
     */
    async deleteStore(storeId, ipAddress = null) {
        const db = getDB();
        const provisioner = getProvisioner();

        const store = db.getStore(storeId);
        if (!store) {
            throw Object.assign(new Error('Store not found'), { statusCode: 404 });
        }

        if (store.status === 'Deleting') {
            throw Object.assign(new Error('Store is already being deleted'), { statusCode: 409 });
        }

        db.updateStoreStatus(storeId, 'Deleting');
        db.addEvent(storeId, 'info', 'Store deletion initiated');
        db.addAuditEntry({
            storeId,
            action: 'DELETE_STORE',
            details: { name: store.name, engine: store.engine },
            ipAddress,
        });

        // Async cleanup
        (async () => {
            try {
                await provisioner.uninstallStore(storeId, store.namespace, store.engine);
                db.markDeleted(storeId);
                db.addEvent(storeId, 'success', 'Store and all resources deleted');
                logger.info(`Store ${storeId} deleted successfully`);
            } catch (err) {
                logger.error(`Delete failed for store ${storeId}: ${err.message}`);
                db.addEvent(storeId, 'error', `Deletion failed: ${err.message}`);
                db.updateStoreStatus(storeId, 'Failed', { errorMessage: `Delete failed: ${err.message}` });
            }
        })();

        return { message: 'Store deletion initiated', storeId };
    }

    /**
     * Get store details with live K8s status
     */
    async getStoreDetails(storeId) {
        const db = getDB();
        const k8s = getK8sClient();

        const store = db.getStore(storeId);
        if (!store) return null;

        let pods = [];
        let k8sEvents = [];
        try {
            pods = await k8s.getPodsInNamespace(store.namespace);
            k8sEvents = await k8s.getEventsInNamespace(store.namespace, 20);
        } catch (err) {
            logger.debug(`Could not fetch K8s data for ${storeId}: ${err.message}`);
        }

        const events = db.getStoreEvents(storeId);

        return {
            ...store,
            pods,
            k8sEvents,
            events,
        };
    }

    /**
     * Reconciliation: check provisioning stores and update status
     */
    async reconcile() {
        const db = getDB();
        const k8s = getK8sClient();
        const provisioningStores = db.getProvisioningStores();

        for (const store of provisioningStores) {
            try {
                // Check if provisioning has timed out
                const elapsed = Date.now() - new Date(store.created_at).getTime();
                if (elapsed > config.provisioningTimeoutMs) {
                    logger.warn(`Store ${store.id} provisioning timed out`);
                    db.updateStoreStatus(store.id, 'Failed', {
                        errorMessage: 'Provisioning timed out during reconciliation',
                    });
                    db.addEvent(store.id, 'error', 'Provisioning timed out');
                    continue;
                }

                // Check if pods are actually ready
                const nsExists = await k8s.namespaceExists(store.namespace);
                if (!nsExists) {
                    db.updateStoreStatus(store.id, 'Failed', {
                        errorMessage: 'Namespace no longer exists',
                    });
                    db.addEvent(store.id, 'error', 'Namespace disappeared');
                    continue;
                }

                const ready = await k8s.areAllPodsReady(store.namespace);
                if (ready) {
                    logger.info(`Reconciler: Store ${store.id} is now Ready`);
                    db.updateStoreStatus(store.id, 'Ready', { errorMessage: null });
                    db.addEvent(store.id, 'success', 'Store became ready (detected by reconciler)');
                }
            } catch (err) {
                logger.error(`Reconcile error for store ${store.id}: ${err.message}`);
            }
        }
    }

    /**
     * Start the reconciliation loop
     */
    startReconcileLoop() {
        if (this.reconcileTimer) return;
        this.reconcileTimer = setInterval(() => {
            this.reconcile().catch(err =>
                logger.error(`Reconciliation loop error: ${err.message}`)
            );
        }, config.reconcileIntervalMs);
        logger.info(`Reconciliation loop started (interval: ${config.reconcileIntervalMs}ms)`);
    }

    stopReconcileLoop() {
        if (this.reconcileTimer) {
            clearInterval(this.reconcileTimer);
            this.reconcileTimer = null;
        }
    }
}

// Singleton
let instance = null;
function getStoreManager() {
    if (!instance) {
        instance = new StoreManager();
    }
    return instance;
}

module.exports = { getStoreManager };
