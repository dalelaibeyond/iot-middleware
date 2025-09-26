const express = require("express");
const path = require("path");
const dotenv = require("dotenv");
const http = require("http");
const compression = require("compression");
const rateLimit = require("express-rate-limit");

// Load environment variables first
dotenv.config();

// Import routes
const apiRoutes = require("./routes/api");
const indexRoutes = require("./routes/index");
const systemRoutes = require("./routes/system");

// Import modules
const logger = require("./utils/logger");
const WSServer = require("./modules/wsServer");
const WriteBuffer = require("./modules/writeBuffer");
const dbStore = require("./modules/dbStore");
const dataStore = require("./modules/dataStore");
const callbackManager = require("./modules/callbackManager");

// Create Express app
const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 3000;

// Initialize WebSocket server
const wsServer = new WSServer(server);
app.set('wsServer', wsServer);

// Initialize Write Buffer
const writeBuffer = new WriteBuffer(dbStore, {
    maxSize: process.env.WRITE_BUFFER_SIZE || 1000,
    flushInterval: process.env.WRITE_BUFFER_INTERVAL || 5000
});
app.set('writeBuffer', writeBuffer);

// Load configuration
const config = require('./config/config.json');

// Rate limiting
const limiter = rateLimit({
    windowMs: config.server.rateLimit.windowMs,
    max: config.server.rateLimit.maxRequests
});

// Middleware
app.use(compression(config.server.compression)); // Enable compression with config
app.use(express.json());
app.use(limiter); // Apply rate limiting

// Error handling middleware
app.use((err, req, res, next) => {
    logger.error('Unhandled error:', err);
    res.status(500).json({ error: 'Internal server error' });
});

// Static files
app.use(express.static(path.join(__dirname, "public")));

// Routes
app.use("/", indexRoutes);
app.use("/api", apiRoutes);
app.use("/system", systemRoutes);

// Initialize MQTT client with all dependencies
const createMQTTClient = require("./modules/mqttClient");
const mqttHandler = createMQTTClient({
    dataStore,
    writeBuffer,
    wsServer,
    callbackManager
});

// Graceful shutdown
process.on('SIGTERM', async () => {
    logger.info('SIGTERM received. Starting graceful shutdown...');
    
    // Close MQTT connection
    mqttClient.end();
    
    // Flush write buffer
    await writeBuffer.shutdown();
    
    // Close WebSocket server
    server.close(() => {
        logger.info('Server shut down complete');
        process.exit(0);
    });
});

// Start server
server.listen(PORT, () => {
    logger.info(`IoT Middleware v3 running at http://localhost:${PORT}`);
    logger.info('WebSocket server enabled');
    logger.info('Write buffer initialized');
    logger.info('Callback system ready');
});
