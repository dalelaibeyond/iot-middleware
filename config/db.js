const mysql = require("mysql2/promise");
const logger = require("../utils/logger");
const ModularConfigManager = require("./ModularConfigManager");
require("dotenv").config");

const configManager = new ModularConfigManager();
const config = configManager.getConfig();

let pool = null;

if (configManager.isModuleEnabled("storage") && configManager.isComponentEnabled("storage", "database")) {
  pool = mysql.createPool({
    host: process.env.DB_HOST || "localhost",
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASS || "",
    database: process.env.DB_NAME || "iot_middleware",
    ...configManager.getComponentConfig("storage", "database").connectionPool
  });

  // Test the connection
  pool.getConnection()
    .then(connection => {
      logger.info("Database connection established successfully");
      connection.release();
    })
    .catch(err => {
      logger.error("Failed to connect to database:", {
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        database: process.env.DB_NAME,
        error: err.message
      });
    });
} else {
  logger.info("Database storage is disabled in configuration");
}

module.exports = {
  pool,
  isEnabled: configManager.isModuleEnabled("storage") && configManager.isComponentEnabled("storage", "database")
};
