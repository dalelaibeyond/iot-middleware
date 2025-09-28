const mysql = require("mysql2/promise");
const logger = require("../utils/logger");
require("dotenv").config();

const pool = mysql.createPool({
  host: process.env.DB_HOST || "localhost",
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASS || "",
  database: process.env.DB_NAME || "iot_middleware",
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
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
      password: process.env.DB_PASS,
      error: err.message
    });
  });

module.exports = pool;
