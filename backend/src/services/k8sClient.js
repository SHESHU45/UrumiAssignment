const { exec } = require('child_process');
const util = require('util');
const execAsync = util.promisify(exec);
const logger = require('../utils/logger');

class K8sClient {
    constructor() {
        // No explicit initialization needed for kubectl CLI wrapper
    }

    /**
     * Helper to execute kubectl and return parsed JSON
     */
    async _execJson(cmd) {
        try {
            logger.debug(`Executing: ${cmd}`);
            const { stdout } = await execAsync(cmd, { maxBuffer: 1024 * 1024 * 10 }); // 10MB buffer
            if (!stdout || stdout.trim() === '') return { items: [] };
            return JSON.parse(stdout);
        } catch (err) {
            const stderr = err.stderr || '';
            logger.error(`Command failed: ${cmd}. Error: ${stderr || err.message}`);
            if (stderr.includes('NotFound') || stderr.includes('not found') || stderr.includes('No resources found')) {
                return { items: [] };
            }
            throw err;
        }
    }

    // Namespace operations
    async createNamespace(name, labels = {}) {
        try {
            // Idempotent check
            try {
                await execAsync(`kubectl get ns ${name}`);
                logger.info(`Namespace ${name} already exists (idempotent)`);
                return;
            } catch {
                // Not found, proceed to create
            }

            await execAsync(`kubectl create ns ${name}`);

            // Apply labels
            const labelArgs = Object.entries(labels)
                .map(([k, v]) => `${k}="${v}"`)
                .join(' ');

            if (labelArgs) {
                await execAsync(`kubectl label ns ${name} ${labelArgs} --overwrite`);
            }

            logger.info(`Created namespace ${name}`);
        } catch (err) {
            throw new Error(`Failed to create namespace: ${err.message}`);
        }
    }

    async deleteNamespace(name) {
        try {
            await execAsync(`kubectl delete ns ${name} --timeout=120s`);
            logger.info(`Deleted namespace ${name}`);
        } catch (err) {
            const stderr = err.stderr || '';
            if (stderr.includes('not found')) {
                logger.warn(`Namespace ${name} not found, skipping delete`);
                return;
            }
            logger.error(`Failed to delete namespace ${name}: ${err.message}`);
        }
    }

    async namespaceExists(name) {
        try {
            await execAsync(`kubectl get ns ${name}`);
            return true;
        } catch (err) {
            const stderr = err.stderr || '';
            if (stderr.includes('NotFound') || stderr.includes('not found')) {
                return false;
            }
            throw err;
        }
    }

    // Pod status
    async getPodsInNamespace(namespace) {
        try {
            const data = await this._execJson(`kubectl get pods -n ${namespace} -o json`);
            const items = data.items || [];

            return items.map(pod => {
                const conditions = pod.status.conditions || [];
                const readyCondition = conditions.find(c => c.type === 'Ready');
                const containerStatuses = pod.status.containerStatuses || [];

                return {
                    name: pod.metadata.name,
                    status: pod.status.phase,
                    ready: readyCondition ? readyCondition.status === 'True' : false,
                    restarts: containerStatuses.reduce((sum, cs) => sum + cs.restartCount, 0),
                };
            });
        } catch (err) {
            logger.error(`getPodsInNamespace (${namespace}) error: ${err.message}`);
            return [];
        }
    }

    async areAllPodsReady(namespace) {
        const pods = await this.getPodsInNamespace(namespace);
        if (pods.length === 0) return false;
        // Exclude completed job pods (like the setup job)
        const runningPods = pods.filter(p => p.status !== 'Succeeded');
        // We need at least one running pod (e.g. mysql/wordpress) to be ready
        return runningPods.length > 0 && runningPods.every(p => p.ready);
    }

    // Events
    async getEventsInNamespace(namespace, limit = 50) {
        try {
            // Sort by creationTimestamp (descending logic handling in JS after fetch, or via kubectl sort)
            // kubectl sort-by is ascending. We'll reverse in JS.
            const data = await this._execJson(`kubectl get events -n ${namespace} --sort-by=.metadata.creationTimestamp -o json`);
            const items = data.items || [];

            return items.reverse().slice(0, limit).map(event => ({
                type: event.type,
                reason: event.reason,
                message: event.message,
                object: event.involvedObject ? `${event.involvedObject.kind}/${event.involvedObject.name}` : '',
                timestamp: event.metadata.creationTimestamp,
            }));
        } catch (err) {
            logger.error(`getEventsInNamespace (${namespace}) error: ${err.message}`);
            return [];
        }
    }

    // Ingress URLs
    async getIngressUrls(namespace) {
        try {
            const data = await this._execJson(`kubectl get ingress -n ${namespace} -o json`);
            const items = data.items || [];
            const urls = [];

            for (const ingress of items) {
                if (ingress.spec && ingress.spec.rules) {
                    for (const rule of ingress.spec.rules) {
                        if (rule.host) {
                            const protocol = (ingress.spec.tls && ingress.spec.tls.length > 0) ? 'https' : 'http';
                            urls.push(`${protocol}://${rule.host}`);
                        }
                    }
                }
            }
            return urls;
        } catch (err) {
            logger.error(`getIngressUrls (${namespace}) error: ${err.message}`);
            return [];
        }
    }

    // Job status
    async getJobStatus(namespace, jobName) {
        try {
            // If job doesn't exist, _execJson returns empty items or throws
            // We need to target specific job. 
            // kubectl get job <name> -n <ns> -o json
            const { stdout } = await execAsync(`kubectl get job ${jobName} -n ${namespace} -o json`, { maxBuffer: 1024 * 1024 * 5 });
            const job = JSON.parse(stdout);
            const status = job.status || {};
            return {
                active: status.active || 0,
                succeeded: status.succeeded || 0,
                failed: status.failed || 0,
                complete: (status.succeeded || 0) > 0,
            };
        } catch (err) {
            // parsing error or not found
            return null;
        }
    }

    // List all store namespaces
    async listStoreNamespaces() {
        try {
            const data = await this._execJson(`kubectl get ns -l app.kubernetes.io/managed-by=store-platform -o json`);
            const items = data.items || [];
            return items.map(ns => ns.metadata.name);
        } catch (err) {
            logger.error(`listStoreNamespaces error: ${err.message}`);
            return [];
        }
    }
}

// Singleton
let instance = null;
function getK8sClient() {
    if (!instance) {
        instance = new K8sClient();
    }
    return instance;
}

module.exports = { getK8sClient };
