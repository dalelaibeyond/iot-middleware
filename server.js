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

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100 // limit each IP to 100 requests per windowMs
});

// Middleware
app.use(compression()); // Enable compression
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

// Initialize MQTT client
const mqttClient = require("./modules/mqttClient");
const { normalize } = require("./modules/normalizers");

// Handle MQTT messages
mqttClient.removeAllListeners('message'); // Remove existing message handler
mqttClient.on("message", async (topic, message) => {
    try {
        logger.debug(`Received message on topic ${topic}`);
        
        const meta = {
            gatewayId: topic.split("/")[1]
        };

        const normalized = normalize(topic, message, meta);
        if (normalized) {
            logger.debug(`Normalized message for device ${normalized.deviceId}`);
            
            // Store latest data in memory
            dataStore.set(normalized.deviceId, normalized);
            logger.debug(`Updated latest data for device ${normalized.deviceId}`);
            
            // Broadcast to WebSocket clients
            wsServer.broadcast(normalized);
            logger.debug(`Broadcasted to WebSocket clients`);
            
            // Send to registered callbacks
            await callbackManager.notify(normalized);
            logger.debug(`Notified registered callbacks`);
            
            // Use write buffer for database operations
            await writeBuffer.push(normalized);
            logger.debug(`Pushed to write buffer`);
        } else {
            logger.error(`Failed to normalize message for topic ${topic}`);
        }
    } catch (error) {
        logger.error('Error processing MQTT message:', error);
    }
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
