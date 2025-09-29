const { pool, isEnabled } = require("../config/db");
const logger = require("../utils/logger");

function formatTimestamp(isoTimestamp) {
  return new Date(isoTimestamp).toISOString().slice(0, 19).replace('T', ' ');
}

async function saveHistory(data) {
  // If database is disabled, return immediately
  if (!isEnabled) {
    logger.debug("Database storage is disabled, skipping save operation");
    return true;
  }

  const { deviceId, sensorType, ts, payload, meta } = data;
  
  try {
    // Convert ISO timestamp to MySQL datetime format
    const mysqlTimestamp = formatTimestamp(ts);
    
    // Ensure payload and meta are properly stringified
    const payloadJson = typeof payload === 'string' ? payload : JSON.stringify(payload);
    const metaJson = typeof meta === 'string' ? meta : JSON.stringify(meta);
    
    logger.debug(`Saving to database with timestamp: ${mysqlTimestamp}`);
    
    const [result] = await pool.query(
      "INSERT INTO sensor_data (device_id, sensor_type, timestamp, payload, meta) VALUES (?, ?, ?, ?, ?)",
      [deviceId, sensorType, mysqlTimestamp, payloadJson, metaJson]
    );
    
    return true;
  } catch (err) {
    logger.error(`Database error in saveHistory:`, err, {
      deviceId,
      sensorType,
      timestamp: ts
    });
    throw new Error(`Failed to save sensor history: ${err.message}`);
  }
}

async function getHistory(deviceId, limit = 50) {
  // If database is disabled, return empty array
  if (!isEnabled) {
    logger.debug("Database storage is disabled, returning empty history");
    return [];
  }

  try {
    const [rows] = await pool.query(
      "SELECT * FROM sensor_data WHERE device_id = ? ORDER BY timestamp DESC LIMIT ?",
      [deviceId, limit]
    );
    
    return rows.map(row => {
      try {
        // Safely parse JSON fields
        const payload = typeof row.payload === 'string' ? JSON.parse(row.payload) : row.payload;
        const meta = typeof row.meta === 'string' ? JSON.parse(row.meta) : row.meta;
        
        return {
          id: row.id,
          device_id: row.device_id,
          sensor_type: row.sensor_type,
          timestamp: new Date(row.timestamp).toISOString(),
          payload: payload,
          meta: meta,
          created_at: row.created_at ? new Date(row.created_at).toISOString() : null
        };
      } catch (parseErr) {
        logger.error(`Failed to parse row data for device ${deviceId}:`, parseErr);
        // Return raw row data if parsing fails
        return {
          ...row,
          timestamp: new Date(row.timestamp).toISOString(),
          created_at: row.created_at ? new Date(row.created_at).toISOString() : null
        };
      }
    });
  } catch (err) {
    logger.error(`Database error in getHistory:`, err, {
      deviceId,
      limit
    });
    throw new Error(`Failed to fetch sensor history: ${err.message}`);
  }
}

async function saveBatch(dataArray) {
  if (!Array.isArray(dataArray) || dataArray.length === 0) {
    return;
  }

  // If database is disabled, return successfully without doing anything
  if (!isEnabled) {
    logger.debug(`Database storage is disabled, skipping batch save of ${dataArray.length} records`);
    return { affectedRows: dataArray.length };
  }

  try {
    // Prepare the batch insert values
    const values = dataArray.map(data => {
      const { deviceId, sensorType, ts, payload, meta } = data;
      const mysqlTimestamp = formatTimestamp(ts);
      const payloadJson = typeof payload === 'string' ? payload : JSON.stringify(payload);
      const metaJson = typeof meta === 'string' ? meta : JSON.stringify(meta);
      
      return [deviceId, sensorType, mysqlTimestamp, payloadJson, metaJson];
    });

    // Perform batch insert
    const [result] = await pool.query(
      "INSERT INTO sensor_data (device_id, sensor_type, timestamp, payload, meta) VALUES ?",
      [values]
    );

    logger.debug(`Successfully saved batch of ${dataArray.length} records`);
    return result;
  } catch (err) {
    logger.error(`Database error in saveBatch:`, err);
    throw new Error(`Failed to save batch: ${err.message}`);
  }
}

module.exports = { saveHistory, getHistory, saveBatch };
