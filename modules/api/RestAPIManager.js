const express = require("express");
const BaseComponent = require("../core/BaseComponent");
const logger = require("../../utils/logger");

class RestAPIManager extends BaseComponent {
  constructor(options = {}) {
    super(options);
    this.router = express.Router();
    this.routes = [];
  }

  async initialize() {
    try {
      this.setupRoutes();
      logger.info("REST API Manager initialized");
    } catch (error) {
      logger.error("Failed to initialize REST API Manager:", error);
      throw error;
    }
  }

  setupRoutes() {
    // Health check endpoint
    this.router.get("/health", (req, res) => {
      res.json({
        status: "ok",
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
      });
    });

    // Get application stats
    this.router.get("/stats", (req, res) => {
      try {
        const application = req.app.get("application");
        if (!application) {
          return res.status(500).json({ error: "Application not available" });
        }

        const stats = application.getStats();
        res.json(stats);
      } catch (error) {
        logger.error("Error getting stats:", error);
        res.status(500).json({ error: "Failed to get stats" });
      }
    });

    // Get device data
    this.router.get("/devices/:deviceId/data", (req, res) => {
      try {
        const { deviceId } = req.params;
        const { limit = 50, startTime, endTime } = req.query;
        
        const application = req.app.get("application");
        if (!application) {
          return res.status(500).json({ error: "Application not available" });
        }

        const dataStore = application.getComponent("dataStore");
        if (!dataStore) {
          return res.status(500).json({ error: "Data store not available" });
        }

        const options = {
          limit: parseInt(limit),
          startTime: startTime ? new Date(startTime).getTime() : undefined,
          endTime: endTime ? new Date(endTime).getTime() : undefined
        };

        const data = dataStore.getDeviceData(deviceId, options);
        res.json({
          deviceId,
          count: data.length,
          data
        });
      } catch (error) {
        logger.error("Error getting device data:", error);
        res.status(500).json({ error: "Failed to get device data" });
      }
    });

    // Get all devices
    this.router.get("/devices", (req, res) => {
      try {
        const application = req.app.get("application");
        if (!application) {
          return res.status(500).json({ error: "Application not available" });
        }

        const dataStore = application.getComponent("dataStore");
        if (!dataStore) {
          return res.status(500).json({ error: "Data store not available" });
        }

        const devices = dataStore.getAllDevices();
        res.json({
          count: devices.length,
          devices
        });
      } catch (error) {
        logger.error("Error getting devices:", error);
        res.status(500).json({ error: "Failed to get devices" });
      }
    });

    // Get device history from database
    this.router.get("/devices/:deviceId/history", async (req, res) => {
      try {
        const { deviceId } = req.params;
        const { limit = 50 } = req.query;
        
        const application = req.app.get("application");
        if (!application) {
          return res.status(500).json({ error: "Application not available" });
        }

        const database = application.getComponent("database");
        if (!database) {
          return res.status(500).json({ error: "Database not available" });
        }

        const history = await database.getHistory(deviceId, parseInt(limit));
        res.json({
          deviceId,
          count: history.length,
          history
        });
      } catch (error) {
        logger.error("Error getting device history:", error);
        res.status(500).json({ error: "Failed to get device history" });
      }
    });

    // Get configuration
    this.router.get("/config", (req, res) => {
      try {
        const application = req.app.get("application");
        if (!application) {
          return res.status(500).json({ error: "Application not available" });
        }

        const config = application.getConfig();
        
        // Return only safe configuration (no passwords or sensitive data)
        const safeConfig = {
          modules: {},
          server: config.server
        };

        for (const [moduleName, moduleConfig] of Object.entries(config.modules)) {
          safeConfig.modules[moduleName] = {
            enabled: moduleConfig.enabled,
            description: moduleConfig.description,
            components: {}
          };

          for (const [componentName, componentConfig] of Object.entries(moduleConfig.components)) {
            safeConfig.modules[moduleName].components[componentName] = {
              enabled: componentConfig.enabled,
              description: componentConfig.description
            };
          }
        }

        res.json(safeConfig);
      } catch (error) {
        logger.error("Error getting configuration:", error);
        res.status(500).json({ error: "Failed to get configuration" });
      }
    });

    // Get normalizer information
    this.router.get("/normalizers", (req, res) => {
      try {
        const application = req.app.get("application");
        if (!application) {
          return res.status(500).json({ error: "Application not available" });
        }

        const normalizer = application.getComponent("normalizer");
        if (!normalizer || !normalizer.getRegistry) {
          return res.status(500).json({ error: "Normalizer not available" });
        }

        const registry = normalizer.getRegistry();
        const parsers = registry.getAllParsers();
        const stats = registry.getStats();

        res.json({
          stats,
          parsers
        });
      } catch (error) {
        logger.error("Error getting normalizer information:", error);
        res.status(500).json({ error: "Failed to get normalizer information" });
      }
    });

    // Test database connection and save a test message
    this.router.post("/test/database", async (req, res) => {
      try {
        const application = req.app.get("application");
        if (!application) {
          return res.status(500).json({ error: "Application not available" });
        }

        const database = application.getComponent("database");
        if (!database) {
          return res.status(500).json({ error: "Database not available" });
        }

        const success = await database.testSaveMessage();
        if (success) {
          res.json({
            status: "success",
            message: "Test message saved to database successfully",
            timestamp: new Date().toISOString()
          });
        } else {
          res.status(500).json({
            status: "error",
            message: "Failed to save test message to database"
          });
        }
      } catch (error) {
        logger.error("Error testing database:", error);
        res.status(500).json({
          error: "Failed to test database",
          details: error.message
        });
      }
    });

    // Get write buffer status
    this.router.get("/status/writebuffer", (req, res) => {
      try {
        const application = req.app.get("application");
        if (!application) {
          return res.status(500).json({ error: "Application not available" });
        }

        const writeBuffer = application.getComponent("writeBuffer");
        if (!writeBuffer) {
          return res.status(500).json({ error: "Write buffer not available" });
        }

        const stats = writeBuffer.getStats();
        res.json({
          status: "success",
          buffer: stats,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        logger.error("Error getting write buffer status:", error);
        res.status(500).json({
          error: "Failed to get write buffer status",
          details: error.message
        });
      }
    });

    // Store the routes for reference
    this.routes = this.router.stack
      .filter(r => r.route)
      .map(r => ({
        method: Object.keys(r.route.methods)[0].toUpperCase(),
        path: r.route.path
      }));
  }

  /**
   * Get the Express router
   * @returns {express.Router} - The Express router
   */
  getRouter() {
    return this.router;
  }

  /**
   * Get all registered routes
   * @returns {Array} - Array of route objects
   */
  getRoutes() {
    return this.routes;
  }

  async shutdown() {
    logger.info("Shutting down REST API Manager");
    super.shutdown();
  }
}

module.exports = RestAPIManager;