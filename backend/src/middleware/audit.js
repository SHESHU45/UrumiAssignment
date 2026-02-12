const { getDB } = require('../models/store');
const logger = require('../utils/logger');

/**
 * Audit logging middleware — logs every mutating request
 */
function auditMiddleware(req, res, next) {
    // Only audit mutating requests
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
        const originalEnd = res.end;
        res.end = function (...args) {
            try {
                const db = getDB();
                db.addAuditEntry({
                    action: `${req.method} ${req.originalUrl}`,
                    details: {
                        method: req.method,
                        path: req.originalUrl,
                        statusCode: res.statusCode,
                        body: req.body && Object.keys(req.body).length ? req.body : undefined,
                    },
                    ipAddress: req.ip,
                });
            } catch (err) {
                logger.error(`Audit log error: ${err.message}`);
            }
            originalEnd.apply(res, args);
        };
    }
    next();
}

module.exports = auditMiddleware;
