const mysql = require("mysql2/promise");
const BaseComponent = require("../core/BaseComponent");

class DatabaseManager extends BaseComponent {
  constructor(options = {}) {
    super(options);
    this.pool = null;
    this.isEnabled = this.config.database.enabled;
  }

  async initialize() {
    if (!this.isEnabled) {
      this.logger.info("Database storage is disabled in configuration");
      return;
    }

    try {
      this.pool = await this.createPool();
      await this.testConnection();
      this.logger.info("Database connection established successfully");
    } catch (error) {
      this.logger.error("Failed to initialize database:", error);
      throw error;
    }
  }

  async createPool() {
    return mysql.createPool({
      host: process.env.DB_HOST || "localhost",
      user: process.env.DB_USER || "root",
      password: process.env.DB_PASS || "",
      database: process.env.DB_NAME || "iot_middleware",
      ...this.config.database.connectionPool,
    });
  }

  async testConnection() {
    const connection = await this.pool.getConnection();
    try {
      await connection.ping();
    } finally {
      connection.release();
    }
  }

  async query(sql, params = []) {
    if (!this.isEnabled) {
      throw new Error("Database operations are disabled");
    }

    try {
      const [results] = await this.pool.query(sql, params);
      return results;
    } catch (error) {
      this.logger.error("Database query error:", error);
      throw error;
    }
  }

  async transaction(callback) {
    if (!this.isEnabled) {
      throw new Error("Database operations are disabled");
    }

    const connection = await this.pool.getConnection();
    await connection.beginTransaction();

    try {
      const result = await callback(connection);
      await connection.commit();
      return result;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  /**
   * Convert ISO timestamp to MySQL datetime format
   */
  toMySQLDateTime(timestamp) {
    const date = timestamp ? new Date(timestamp) : new Date();
    return date.toISOString().slice(0, 19).replace("T", " ");
  }

  /**
   * Save a batch of messages to the database
   */
  async saveBatch(messages) {
    if (!this.isEnabled) {
      this.logger.debug("Database disabled, skipping batch save");
      return;
    }

    if (!messages || messages.length === 0) {
      return;
    }

    const sql = `
            INSERT INTO sensor_data (device_id, device_type, sensor_add, sensor_port, sensor_id, sensor_type, timestamp, payload, meta, created_at)
            VALUES ?
        `;

    const values = messages.map((msg) => [
      msg.deviceId,
      msg.deviceType || "unknown",
      msg.sensorAdd || null,
      msg.sensorPort || null,
      msg.sensorId || `${msg.deviceId}-unknown`,
      msg.sensorType || "unknown",
      this.toMySQLDateTime(msg.ts),
      JSON.stringify(msg.payload || {}),
      JSON.stringify(msg.meta || {}),
      this.toMySQLDateTime(),
    ]);

    try {
      await this.query(sql, [values]);
      this.logger.debug(`Saved batch of ${messages.length} messages`);
    } catch (error) {
      this.logger.error("Error saving batch:", error);
      throw error;
    }
  }

  /**
   * Save a single message to the database
   */
  async saveHistory(message) {
    if (!this.isEnabled) {
      this.logger.debug("Database disabled, skipping save");
      return;
    }

    const sql = `
            INSERT INTO sensor_data (device_id, device_type, sensor_add, sensor_port, sensor_id, sensor_type, timestamp, payload, meta, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;

    const values = [
      message.deviceId,
      message.deviceType || "unknown",
      message.sensorAdd || null,
      message.sensorPort || null,
      message.sensorId || `${message.deviceId}-unknown`,
      message.sensorType || "unknown",
      this.toMySQLDateTime(message.ts),
      JSON.stringify(message.payload || {}),
      JSON.stringify(message.meta || {}),
      this.toMySQLDateTime(),
    ];

    try {
      await this.query(sql, values);
      this.logger.debug(`Saved message for device ${message.deviceId}`);
    } catch (error) {
      this.logger.error("Error saving message:", error);
      throw error;
    }
  }

  /**
   * Get history for a device
   */
  async getHistory(deviceId, limit = 50) {
    if (!this.isEnabled) {
      return [];
    }

    const sql = `
            SELECT device_id, device_type, sensor_add, sensor_port, sensor_id, sensor_type, timestamp, payload, meta, created_at
            FROM sensor_data
            WHERE device_id = ?
            ORDER BY timestamp DESC
            LIMIT ?
        `;

    try {
      const rows = await this.query(sql, [deviceId, limit]);
      return rows.map((row) => ({
        ...row,
        // MySQL JSON columns are already parsed as objects by mysql2
        payload:
          typeof row.payload === "string"
            ? JSON.parse(row.payload)
            : row.payload,
        meta: typeof row.meta === "string" ? JSON.parse(row.meta) : row.meta,
      }));
    } catch (error) {
      this.logger.error("Error fetching history:", error);
      throw error;
    }
  }

  /**
   * Get history for a specific sensor
   */
  async getSensorHistory(deviceId, sensorId, limit = 50) {
    if (!this.isEnabled) {
      return [];
    }

    const sql = `
            SELECT device_id, device_type, sensor_add, sensor_port, sensor_id, sensor_type, timestamp, payload, meta, created_at
            FROM sensor_data
            WHERE device_id = ? AND sensor_id = ?
            ORDER BY timestamp DESC
            LIMIT ?
        `;

    try {
      const rows = await this.query(sql, [deviceId, sensorId, limit]);
      return rows.map((row) => ({
        ...row,
        // MySQL JSON columns are already parsed as objects by mysql2
        payload:
          typeof row.payload === "string"
            ? JSON.parse(row.payload)
            : row.payload,
        meta: typeof row.meta === "string" ? JSON.parse(row.meta) : row.meta,
      }));
    } catch (error) {
      this.logger.error("Error fetching sensor history:", error);
      throw error;
    }
  }

  /**
   * Get history by device type
   */
  async getHistoryByDeviceType(deviceType, limit = 50) {
    if (!this.isEnabled) {
      return [];
    }

    const sql = `
            SELECT device_id, device_type, sensor_add, sensor_port, sensor_id, sensor_type, timestamp, payload, meta, created_at
            FROM sensor_data
            WHERE device_type = ?
            ORDER BY timestamp DESC
            LIMIT ?
        `;

    try {
      const rows = await this.query(sql, [deviceType, limit]);
      return rows.map((row) => ({
        ...row,
        // MySQL JSON columns are already parsed as objects by mysql2
        payload:
          typeof row.payload === "string"
            ? JSON.parse(row.payload)
            : row.payload,
        meta: typeof row.meta === "string" ? JSON.parse(row.meta) : row.meta,
      }));
    } catch (error) {
      this.logger.error("Error fetching history by device type:", error);
      throw error;
    }
  }

  async shutdown() {
    if (this.pool) {
      await this.pool.end();
    }
    super.shutdown();
  }
}

module.exports = DatabaseManager;
