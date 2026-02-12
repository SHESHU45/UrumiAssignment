const logger = require('../utils/logger');

/**
 * Global error handling middleware
 */
function errorHandler(err, req, res, _next) {
    logger.error(`${req.method} ${req.originalUrl} — ${err.message}`, {
        stack: err.stack,
        statusCode: err.statusCode,
    });

    const statusCode = err.statusCode || 500;
    res.status(statusCode).json({
        error: statusCode === 500 ? 'Internal server error' : err.message,
        ...(process.env.NODE_ENV !== 'production' && { stack: err.stack }),
    });
}

module.exports = errorHandler;
