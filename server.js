const express = require("express");
const path = require("path");
const dotenv = require("dotenv");
const http = require("http");
const compression = require("compression");
const rateLimit = require("express-rate-limit");

// Load environment variables first
dotenv.config();

// Import core modules
const logger = require("./utils/logger");
const Application = require("./modules/Application");

// Import routes
const apiRoutes = require("./routes/api");
const indexRoutes = require("./routes/index");
const systemRoutes = require("./routes/system");

async function startServer() {
    try {
        // Create Express app
        const app = express();
        const server = http.createServer(app);
        const PORT = process.env.PORT || 3000;

        // Load configuration
        const config = require('./config/config.json');

        // Rate limiting
        const limiter = rateLimit({
            windowMs: config.server.rateLimit.windowMs,
            max: config.server.rateLimit.maxRequests
        });

        // Initialize application
        const application = new Application({
            server: server,
            config: config
        });
        await application.initialize();

        // Middleware
        app.use(compression(config.server.compression));
        app.use(limiter);
        app.use(express.json());
        app.use(express.static(path.join(__dirname, "public")));

        // Routes
        app.use("/", indexRoutes);
        app.use("/api", apiRoutes);
        app.use("/system", systemRoutes);

        // Handle graceful shutdown
        process.on('SIGTERM', async () => {
            logger.info('SIGTERM received. Starting graceful shutdown...');
            await application.shutdown();
            process.exit(0);
        });

        process.on('SIGINT', async () => {
            logger.info('SIGINT received. Starting graceful shutdown...');
            await application.shutdown();
            process.exit(0);
        });

        // Start server
        server.listen(PORT, () => {
            logger.info(`IoT Middleware v3 running at http://localhost:${PORT}`);
        });

    } catch (error) {
        logger.error('Failed to start server:', error);
        process.exit(1);
    }
}

// Start the server
startServer().catch(error => {
    logger.error('Unhandled error during startup:', error);
    process.exit(1);
});
