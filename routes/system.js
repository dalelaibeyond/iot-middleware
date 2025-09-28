const express = require('express');
const router = express.Router();
const os = require('os');
const logger = require('../utils/logger');

// Get system metrics
function getSystemMetrics() {
    return {
        cpu: {
            loadAvg: os.loadavg(),
            uptime: os.uptime()
        },
        memory: {
            total: os.totalmem(),
            free: os.freemem(),
            used: os.totalmem() - os.freemem()
        }
    };
}

// Health check endpoint
router.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString()
    });
});

// Metrics endpoint
router.get('/metrics', async (req, res) => {
    const wsServer = req.app.get('wsServer');
    const writeBuffer = req.app.get('writeBuffer');

    const metrics = {
        system: getSystemMetrics(),
        application: {
            wsClients: wsServer ? wsServer.getConnectedClientsCount() : 0,
            writeBufferSize: writeBuffer ? writeBuffer.getBufferSize() : 0,
            uptime: process.uptime()
        }
    };

    res.json(metrics);
});

// Debug endpoint - only available in development
if (process.env.NODE_ENV !== 'production') {
    router.get('/debug', (req, res) => {
        res.json({
            env: process.env,
            memory: process.memoryUsage(),
            cpu: process.cpuUsage()
        });
    });
}

module.exports = router;
