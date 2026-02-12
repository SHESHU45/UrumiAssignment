const { execSync, exec } = require('child_process');
const config = require('../config');
const logger = require('../utils/logger');
const { getK8sClient } = require('./k8sClient');
const crypto = require('crypto');

class Provisioner {
    constructor() {
        this.activeProvisions = new Map(); // storeId -> provisionPromise
    }

    /**
     * Generate a random secure password
     */
    _generatePassword(length = 24) {
        return crypto.randomBytes(length).toString('base64url').substring(0, length);
    }

    /**
     * Check if a Helm release exists
     */
    releaseExists(releaseName, namespace) {
        try {
            execSync(`helm status ${releaseName} -n ${namespace}`, { stdio: 'pipe' });
            return true;
        } catch {
            return false;
        }
    }

    /**
     * Install a WooCommerce store via Helm
     * Idempotent: if release already exists, return without error
     */
    async installWooCommerce(storeId, storeName, namespace) {
        const k8s = getK8sClient();
        const releaseName = `woo-${storeId}`;
        const storeHost = `${storeName}.${config.storeDomain}`;

        // Idempotent: skip if release exists
        if (this.releaseExists(releaseName, namespace)) {
            logger.info(`Helm release ${releaseName} already exists, skipping install (idempotent)`);
            return { storeUrl: `http://${storeHost}`, adminUrl: `http://${storeHost}/wp-admin` };
        }

        // Create namespace (idempotent)
        await k8s.createNamespace(namespace, {
            'store-platform/store-id': storeId,
            'store-platform/store-name': storeName,
            'store-platform/engine': 'woocommerce',
            'app.kubernetes.io/managed-by': 'store-platform',
        });

        // Generate secrets
        const mysqlRootPassword = this._generatePassword();
        const mysqlPassword = this._generatePassword();
        const wpAdminPassword = this._generatePassword(16);

        // Helm install
        const helmValues = [
            `storeName=${storeName}`,
            `storeId=${storeId}`,
            `wordpress.host=${storeHost}`,
            `wordpress.adminUser=admin`,
            `wordpress.adminPassword=${wpAdminPassword}`,
            `wordpress.adminEmail=admin@${storeHost}`,
            `mysql.rootPassword=${mysqlRootPassword}`,
            `mysql.database=wordpress`,
            `mysql.user=wordpress`,
            `mysql.password=${mysqlPassword}`,
            `ingress.host=${storeHost}`,
            `ingress.className=nginx`,
        ].map(v => `--set ${v}`).join(' ');

        const helmCmd = `helm install ${releaseName} ${config.helmChartPath} -n ${namespace} ${helmValues} --timeout ${config.helmTimeout} --wait=false`;

        logger.info(`Installing WooCommerce store: ${releaseName} in ${namespace}`);
        logger.debug(`Helm command: helm install ${releaseName} ... -n ${namespace}`);

        try {
            execSync(helmCmd, { stdio: 'pipe', timeout: 60000 });
        } catch (err) {
            const stderr = err.stderr ? err.stderr.toString() : '';
            // If it already exists (race condition), treat as success
            if (stderr.includes('already exists')) {
                logger.warn(`Release ${releaseName} already exists (race condition)`);
            } else {
                throw new Error(`Helm install failed: ${stderr || err.message}`);
            }
        }

        return {
            storeUrl: `http://${storeHost}`,
            adminUrl: `http://${storeHost}/wp-admin`,
        };
    }

    /**
     * Install a MedusaJS store via Helm (stubbed)
     */
    async installMedusa(storeId, storeName, namespace) {
        throw new Error('MedusaJS engine is not yet implemented. Architecture is ready for integration.');
    }

    /**
     * Uninstall a store via Helm and clean up namespace
     */
    async uninstallStore(storeId, namespace, engine = 'woocommerce') {
        const releaseName = engine === 'woocommerce' ? `woo-${storeId}` : `medusa-${storeId}`;
        const k8s = getK8sClient();

        // Uninstall Helm release
        try {
            execSync(`helm uninstall ${releaseName} -n ${namespace} --timeout 120s`, {
                stdio: 'pipe',
                timeout: 130000,
            });
            logger.info(`Uninstalled Helm release ${releaseName}`);
        } catch (err) {
            const stderr = err.stderr ? err.stderr.toString() : '';
            if (stderr.includes('not found')) {
                logger.warn(`Release ${releaseName} not found, skipping uninstall`);
            } else {
                logger.error(`Helm uninstall error: ${stderr || err.message}`);
            }
        }

        // Delete namespace (this cleans up all resources including PVCs)
        await k8s.deleteNamespace(namespace);
        logger.info(`Store ${storeId} fully cleaned up`);
    }

    /**
     * Wait for all pods in a namespace to be ready
     */
    async waitForReady(namespace, timeoutMs = config.provisioningTimeoutMs) {
        const k8s = getK8sClient();
        const startTime = Date.now();
        const pollInterval = 5000; // 5 seconds

        while (Date.now() - startTime < timeoutMs) {
            try {
                const ready = await k8s.areAllPodsReady(namespace);
                if (ready) {
                    logger.info(`All pods ready in namespace ${namespace}`);
                    return true;
                }
            } catch (err) {
                logger.debug(`Readiness check error for ${namespace}: ${err.message}`);
            }
            await new Promise(resolve => setTimeout(resolve, pollInterval));
        }

        throw new Error(`Provisioning timeout: pods not ready after ${timeoutMs / 1000}s`);
    }

    /**
     * Get current number of active provisions
     */
    getActiveProvisionCount() {
        return this.activeProvisions.size;
    }

    /**
     * Check if another provision can start
     */
    canProvision() {
        return this.activeProvisions.size < config.maxConcurrentProvisions;
    }

    /**
     * Track active provision
     */
    trackProvision(storeId, promise) {
        this.activeProvisions.set(storeId, promise);
        promise.finally(() => this.activeProvisions.delete(storeId));
    }
}

// Singleton
let instance = null;
function getProvisioner() {
    if (!instance) {
        instance = new Provisioner();
    }
    return instance;
}

module.exports = { getProvisioner };
