const { getStoreManager } = require('../services/storeManager');
const { getDB } = require('../models/store');
const { getProvisioner } = require('../services/provisioner');
const logger = require('../utils/logger');

const storeController = {
    // GET /api/stores
    async listStores(req, res, next) {
        try {
            const db = getDB();
            const stores = db.getAllStores();
            res.json({ stores });
        } catch (err) {
            next(err);
        }
    },

    // POST /api/stores
    async createStore(req, res, next) {
        try {
            const { name, engine } = req.body;
            if (!name) {
                return res.status(400).json({ error: 'Store name is required' });
            }

            const manager = getStoreManager();
            const store = await manager.createStore(
                name.toLowerCase().trim(),
                engine || 'woocommerce',
                req.ip
            );

            logger.info(`Store creation started: ${store.id} (${store.name})`);
            res.status(201).json({ store });
        } catch (err) {
            if (err.statusCode) {
                return res.status(err.statusCode).json({ error: err.message });
            }
            next(err);
        }
    },

    // GET /api/stores/:id
    async getStore(req, res, next) {
        try {
            const manager = getStoreManager();
            const store = await manager.getStoreDetails(req.params.id);
            if (!store) {
                return res.status(404).json({ error: 'Store not found' });
            }
            res.json({ store });
        } catch (err) {
            next(err);
        }
    },

    // DELETE /api/stores/:id
    async deleteStore(req, res, next) {
        try {
            const manager = getStoreManager();
            const result = await manager.deleteStore(req.params.id, req.ip);
            res.json(result);
        } catch (err) {
            if (err.statusCode) {
                return res.status(err.statusCode).json({ error: err.message });
            }
            next(err);
        }
    },

    // GET /api/stores/:id/events
    async getStoreEvents(req, res, next) {
        try {
            const db = getDB();
            const store = db.getStore(req.params.id);
            if (!store) {
                return res.status(404).json({ error: 'Store not found' });
            }
            const events = db.getStoreEvents(req.params.id);
            res.json({ events });
        } catch (err) {
            next(err);
        }
    },

    // GET /api/events
    async getAllEvents(req, res, next) {
        try {
            const db = getDB();
            const events = db.getAllEvents(parseInt(req.query.limit) || 100);
            res.json({ events });
        } catch (err) {
            next(err);
        }
    },

    // GET /api/metrics
    async getMetrics(req, res, next) {
        try {
            const db = getDB();
            const provisioner = getProvisioner();
            const metrics = db.getMetrics();
            metrics.activeProvisions = provisioner.getActiveProvisionCount();
            res.json({ metrics });
        } catch (err) {
            next(err);
        }
    },

    // GET /api/audit-log
    async getAuditLog(req, res, next) {
        try {
            const db = getDB();
            const limit = parseInt(req.query.limit) || 100;
            const log = db.getAuditLog(limit);
            res.json({ auditLog: log });
        } catch (err) {
            next(err);
        }
    },

    // GET /api/health
    async healthCheck(req, res) {
        res.json({ status: 'ok', timestamp: new Date().toISOString() });
    },
};

module.exports = storeController;
