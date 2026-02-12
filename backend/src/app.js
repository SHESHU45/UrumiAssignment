const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const config = require('./config');
const logger = require('./utils/logger');
const storeController = require('./controllers/storeController');
const auditMiddleware = require('./middleware/audit');
const errorHandler = require('./middleware/errorHandler');
const { getStoreManager } = require('./services/storeManager');

const app = express();

// --- Security middleware ---
app.set('trust proxy', 1); // Trust first proxy (NGINX Ingress)
app.use(helmet());
app.use(cors({
    origin: [config.dashboardUrl, 'http://localhost:5173', 'http://localhost:3000', /\.store\.localhost$/],
    methods: ['GET', 'POST', 'DELETE'],
    allowedHeaders: ['Content-Type'],
}));
app.use(express.json({ limit: '1mb' }));

// --- Rate limiting ---
const generalLimiter = rateLimit({
    windowMs: config.rateLimitWindowMs,
    max: config.rateLimitMax,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many requests, please try again later.' },
});

const createStoreLimiter = rateLimit({
    windowMs: config.rateLimitWindowMs,
    max: config.createStoreLimitMax,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many store creation requests. Please wait before creating another store.' },
});

// --- Routes ---
app.get('/api/health', storeController.healthCheck);

app.use('/api/', generalLimiter);

// --- Audit middleware ---
app.use(auditMiddleware);

app.get('/api/stores', storeController.listStores);
app.post('/api/stores', createStoreLimiter, storeController.createStore);
app.get('/api/stores/:id', storeController.getStore);
app.delete('/api/stores/:id', storeController.deleteStore);
app.get('/api/stores/:id/events', storeController.getStoreEvents);
app.get('/api/events', storeController.getAllEvents);
app.get('/api/metrics', storeController.getMetrics);
app.get('/api/audit-log', storeController.getAuditLog);

// --- Error handling ---
app.use(errorHandler);

// --- Start server ---
const server = app.listen(config.port, '0.0.0.0', () => {
    logger.info(`Store Platform API listening on port ${config.port}`);
    logger.info(`Environment: ${config.nodeEnv}`);
    logger.info(`Store domain: ${config.storeDomain}`);

    // Start reconciliation loop
    const manager = getStoreManager();
    manager.startReconcileLoop();
});

// Graceful shutdown
process.on('SIGTERM', () => {
    logger.info('SIGTERM received, shutting down gracefully');
    const manager = getStoreManager();
    manager.stopReconcileLoop();
    server.close(() => {
        logger.info('Server closed');
        process.exit(0);
    });
});

process.on('SIGINT', () => {
    logger.info('SIGINT received, shutting down');
    const manager = getStoreManager();
    manager.stopReconcileLoop();
    server.close(() => process.exit(0));
});

module.exports = app;
