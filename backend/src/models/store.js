const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const config = require('../config');
const logger = require('../utils/logger');

class StoreDB {
    constructor() {
        const dbDir = path.dirname(config.dbPath);
        if (!fs.existsSync(dbDir)) {
            fs.mkdirSync(dbDir, { recursive: true });
        }
        this.db = new Database(config.dbPath);
        this.db.pragma('journal_mode = WAL');
        this._initSchema();
    }

    _initSchema() {
        this.db.exec(`
      CREATE TABLE IF NOT EXISTS stores (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        engine TEXT NOT NULL DEFAULT 'woocommerce',
        status TEXT NOT NULL DEFAULT 'Provisioning',
        namespace TEXT NOT NULL,
        store_url TEXT,
        admin_url TEXT,
        error_message TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        ready_at TEXT,
        deleted_at TEXT
      );

      CREATE TABLE IF NOT EXISTS audit_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        store_id TEXT,
        action TEXT NOT NULL,
        details TEXT,
        ip_address TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS store_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        store_id TEXT NOT NULL,
        event_type TEXT NOT NULL,
        message TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (store_id) REFERENCES stores(id)
      );
    `);
        logger.info('Database schema initialized');
    }

    // Store CRUD
    createStore(store) {
        const stmt = this.db.prepare(`
      INSERT INTO stores (id, name, engine, status, namespace, store_url, admin_url)
      VALUES (@id, @name, @engine, @status, @namespace, @storeUrl, @adminUrl)
    `);
        stmt.run({
            id: store.id,
            name: store.name,
            engine: store.engine,
            status: store.status || 'Provisioning',
            namespace: store.namespace,
            storeUrl: store.storeUrl || null,
            adminUrl: store.adminUrl || null,
        });
        return this.getStore(store.id);
    }

    getStore(id) {
        return this.db.prepare('SELECT * FROM stores WHERE id = ? AND deleted_at IS NULL').get(id);
    }

    getStoreByName(name) {
        return this.db.prepare('SELECT * FROM stores WHERE name = ? AND deleted_at IS NULL').get(name);
    }

    getAllStores() {
        return this.db.prepare(
            'SELECT * FROM stores WHERE deleted_at IS NULL ORDER BY created_at DESC'
        ).all();
    }

    getActiveStoreCount() {
        const result = this.db.prepare(
            "SELECT COUNT(*) as count FROM stores WHERE deleted_at IS NULL AND status != 'Failed'"
        ).get();
        return result.count;
    }

    updateStoreStatus(id, status, extras = {}) {
        const sets = ['status = @status', "updated_at = datetime('now')"];
        const params = { id, status };

        if (extras.storeUrl) { sets.push('store_url = @storeUrl'); params.storeUrl = extras.storeUrl; }
        if (extras.adminUrl) { sets.push('admin_url = @adminUrl'); params.adminUrl = extras.adminUrl; }
        if (extras.errorMessage !== undefined) { sets.push('error_message = @errorMessage'); params.errorMessage = extras.errorMessage; }
        if (status === 'Ready') { sets.push("ready_at = datetime('now')"); }
        if (status === 'Deleted') { sets.push("deleted_at = datetime('now')"); }

        this.db.prepare(`UPDATE stores SET ${sets.join(', ')} WHERE id = @id`).run(params);
        return this.getStore(id);
    }

    markDeleted(id) {
        this.db.prepare(
            "UPDATE stores SET status = 'Deleted', deleted_at = datetime('now'), updated_at = datetime('now') WHERE id = ?"
        ).run(id);
    }

    getProvisioningStores() {
        return this.db.prepare(
            "SELECT * FROM stores WHERE status = 'Provisioning' AND deleted_at IS NULL"
        ).all();
    }

    // Audit Log
    addAuditEntry(entry) {
        this.db.prepare(`
      INSERT INTO audit_log (store_id, action, details, ip_address)
      VALUES (@storeId, @action, @details, @ipAddress)
    `).run({
            storeId: entry.storeId || null,
            action: entry.action,
            details: typeof entry.details === 'object' ? JSON.stringify(entry.details) : (entry.details || null),
            ipAddress: entry.ipAddress || null,
        });
    }

    getAuditLog(limit = 100) {
        return this.db.prepare(
            'SELECT * FROM audit_log ORDER BY created_at DESC LIMIT ?'
        ).all(limit);
    }

    // Store Events
    addEvent(storeId, eventType, message) {
        this.db.prepare(`
      INSERT INTO store_events (store_id, event_type, message)
      VALUES (?, ?, ?)
    `).run(storeId, eventType, message);
    }

    getStoreEvents(storeId, limit = 50) {
        return this.db.prepare(
            'SELECT * FROM store_events WHERE store_id = ? ORDER BY created_at DESC LIMIT ?'
        ).all(storeId, limit);
    }

    getAllEvents(limit = 100) {
        return this.db.prepare(
            'SELECT * FROM store_events ORDER BY created_at DESC LIMIT ?'
        ).all(limit);
    }

    // Metrics
    getMetrics() {
        const total = this.db.prepare("SELECT COUNT(*) as count FROM stores WHERE deleted_at IS NULL").get();
        const byStatus = this.db.prepare(
            "SELECT status, COUNT(*) as count FROM stores WHERE deleted_at IS NULL GROUP BY status"
        ).all();
        const avgProvisionTime = this.db.prepare(`
      SELECT AVG(
        (julianday(ready_at) - julianday(created_at)) * 86400
      ) as avg_seconds
      FROM stores WHERE ready_at IS NOT NULL
    `).get();
        const totalCreated = this.db.prepare("SELECT COUNT(*) as count FROM stores").get();
        const totalDeleted = this.db.prepare("SELECT COUNT(*) as count FROM stores WHERE deleted_at IS NOT NULL").get();

        const statusMap = {};
        byStatus.forEach(s => { statusMap[s.status] = s.count; });

        return {
            totalActive: total.count,
            totalCreated: totalCreated.count,
            totalDeleted: totalDeleted.count,
            byStatus: statusMap,
            avgProvisionTimeSeconds: avgProvisionTime.avg_seconds ? Math.round(avgProvisionTime.avg_seconds) : null,
        };
    }

    close() {
        this.db.close();
    }
}

// Singleton
let instance = null;
function getDB() {
    if (!instance) {
        instance = new StoreDB();
    }
    return instance;
}

module.exports = { getDB };
