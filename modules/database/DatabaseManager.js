const mysql = require("mysql2/promise");
const BaseComponent = require("../core/BaseComponent");

class DatabaseManager extends BaseComponent {
  constructor(options = {}) {
    super(options);
    this.pool = null;
    // Database is enabled by default, will be updated in initialize
    this.isEnabled = true;
  }

  async initialize() {
    // Check if database is enabled in configuration
    this.isEnabled = this.options.enabled !== false;
    
    if (!this.isEnabled) {
      this.logger.info("Database storage is disabled in configuration");
      return;
    }

    try {
      this.pool = await this.createPool();
      await this.testConnection();
      await this.testTable();
      this.logger.info("Database connection established successfully");
    } catch (error) {
      this.logger.error("Failed to initialize database:", error);
      // Don't fail the entire application if database is not available
      this.logger.warn("Database not available, continuing without database storage");
      this.pool = null;
      this.isEnabled = false;
    }
  }

  async createPool() {
    return mysql.createPool({
      host: process.env.DB_HOST || "localhost",
      user: process.env.DB_USER || "root",
      password: process.env.DB_PASS || "",
      database: process.env.DB_NAME || "iot_middleware",
      ...this.options.connectionPool,
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

  async testTable() {
    try {
      const result = await this.query("SHOW TABLES LIKE 'sensor_data'");
      if (result.length === 0) {
        this.logger.error("sensor_data table does not exist in database");
        throw new Error("sensor_data table not found");
      }
    } catch (error) {
      this.logger.error("Error checking for sensor_data table:", error);
      throw error;
    }
  }

  async query(sql, params = []) {
    if (!this.isEnabled || !this.pool) {
      this.logger.debug("Database operations are disabled or not connected");
      return [];
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
    if (!this.isEnabled || !this.pool) {
      this.logger.debug("Database operations are disabled or not connected");
      return null;
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
    if (!this.isEnabled || !this.pool) {
      this.logger.debug("Database disabled or not connected, skipping batch save");
      return;
    }

    if (!messages || messages.length === 0) {
      return;
    }

    // Create placeholders for each message
    const placeholders = messages.map(() => "(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").join(", ");
    
    const sql = `
            INSERT INTO sensor_data (device_id, device_type, mod_add, mod_port, mod_id, sensor_type, msg_Type, timestamp, payload, meta, created_at)
            VALUES ${placeholders}
        `;

    // Flatten all values into a single array
    const values = [];
    messages.forEach((msg) => {
      values.push(
        msg.deviceId,
        msg.deviceType || "unknown",
        msg.modAdd || null,
        msg.modPort || null,
        msg.modId || null,
        msg.sensorType || null, // Map sensorType to sensor_type field
        msg.msgType || msg.sensorType || "unknown",
        this.toMySQLDateTime(msg.ts),
        JSON.stringify(msg.payload || {}),
        JSON.stringify(msg.meta || {}),
        this.toMySQLDateTime()
      );
    });

    try {
      await this.query(sql, values);
    } catch (error) {
      this.logger.error("Error saving batch:", error);
      throw error;
    }
  }

  /**
   * Save a single message to the database
   */
  async saveHistory(message) {
    if (!this.isEnabled || !this.pool) {
      this.logger.debug("Database disabled or not connected, skipping save");
      return;
    }

    const sql = `
            INSERT INTO sensor_data (device_id, device_type, mod_add, mod_port, mod_id, sensor_type, msg_Type, timestamp, payload, meta, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;

    const values = [
      message.deviceId,
      message.deviceType || "unknown",
      message.modAdd || null,
      message.modPort || null,
      message.modId || null,
      message.sensorType || null, // Map sensorType to sensor_type field
      message.msgType || message.sensorType || "unknown",
      this.toMySQLDateTime(message.ts),
      JSON.stringify(message.payload || {}),
      JSON.stringify(message.meta || {}),
      this.toMySQLDateTime(),
    ];

    try {
      await this.query(sql, values);
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
            SELECT device_id, device_type, mod_add, mod_port, mod_id, sensor_type, msg_Type, timestamp, payload, meta, created_at
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
            SELECT device_id, device_type, mod_add, mod_port, mod_id, sensor_type, msg_Type, timestamp, payload, meta, created_at
            FROM sensor_data
            WHERE device_id = ? AND mod_id = ?
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
            SELECT device_id, device_type, mod_add, mod_port, mod_id, sensor_type, msg_Type, timestamp, payload, meta, created_at
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

  // Test method to save a single message directly
  async testSaveMessage() {
    if (!this.isEnabled || !this.pool) {
      return false;
    }

    const testMessage = {
      deviceId: "test-device-001",
      deviceType: "V5008",
      modAdd: null,
      modPort: null,
      modId: null,
      msgType: "TempHum",
      sensorType: "TemHum",
      ts: new Date().toISOString(),
      payload: {
        rawHexString: "TEST123456",
        temperature: 25.5
      },
      meta: {
        rawTopic: "V5008Upload/test-device-001/TemHum",
        deviceType: "V5008",
        test: true
      }
    };

    try {
      await this.saveHistory(testMessage);
      return true;
    } catch (error) {
      this.logger.error("Failed to save test message:", error);
      return false;
    }
  }
}

module.exports = DatabaseManager;
