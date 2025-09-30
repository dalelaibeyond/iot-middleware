const express = require("express");
const dataStore = require("../modules/storage/dataStore");
const logger = require("../utils/logger");
const configManager = require("../config/ConfigManager");

const router = express.Router();

// Lazy load DatabaseManager only if needed
let DatabaseManager;
let dbManager;

async function getDbManager() {
  if (!configManager.database.enabled) {
    return null;
  }
  
  if (!dbManager) {
    DatabaseManager = require("../modules/database/DatabaseManager");
    dbManager = new DatabaseManager();
    await dbManager.initialize();
  }
  
  return dbManager;
}

// Debug endpoint to check dataStore contents
router.get("/debug", (req, res) => {
  const allDevices = dataStore.getAllDevices();
  const result = {};
  allDevices.forEach(deviceId => {
    const data = dataStore.getDeviceData(deviceId);
    result[deviceId] = data;
  });
  res.json(result);
});

// Test endpoint to inject sample data
router.post("/test-data", (req, res) => {
  const sampleMessages = [
    { deviceId: "sensor1", temperature: 25.5, humidity: 60 },
    { deviceId: "sensor2", temperature: 22.0, humidity: 55 },
    { deviceId: "sensor1", temperature: 26.0, humidity: 62 }
  ];

  sampleMessages.forEach(message => {
    dataStore.handleMessage(message);
  });

  res.json({ message: "Sample data injected", count: sampleMessages.length });
});

// Get all latest data
router.get("/latest", (req, res) => {
  const allDevices = dataStore.getAllDevices();
  const result = {};
  allDevices.forEach(deviceId => {
    const data = dataStore.getDeviceData(deviceId);
    if (data.length > 0) {
      result[deviceId] = data[data.length - 1].data; // Latest data
    }
  });
  res.json(result);
});

// Get latest data for one sensor
router.get("/latest/:deviceId", (req, res) => {
  const data = dataStore.getDeviceData(req.params.deviceId);
  if (data && data.length > 0) {
    return res.json(data[data.length - 1].data); // Latest data
  }
  res.status(404).json({ error: "Sensor not found" });
});

// Get history - from database if enabled, otherwise from in-memory dataStore
router.get("/history/:deviceId", async (req, res) => {
  const { deviceId } = req.params;
  const limit = parseInt(req.query.limit, 10) || 50;
  
  try {
    const db = await getDbManager();
    
    if (db) {
      // Get from database
      const rows = await db.getHistory(deviceId, limit);
      res.json(rows);
    } else {
      // Get from in-memory dataStore
      const data = dataStore.getDeviceData(deviceId);
      
      if (!data || data.length === 0) {
        return res.status(404).json({ error: "No history found for this device" });
      }
      
      // Return the most recent entries up to the limit
      const history = data
        .slice(-limit)  // Get last N entries
        .reverse()      // Most recent first
        .map(entry => ({
          device_id: deviceId,
          timestamp: new Date(entry.timestamp).toISOString(),
          data: entry.data,
          created_at: new Date(entry.timestamp).toISOString()
        }));
      
      res.json(history);
    }
  } catch (err) {
    logger.error("Failed to fetch history:", err);
    res.status(500).json({ error: "Failed to fetch sensor history" });
  }
});

module.exports = router;
