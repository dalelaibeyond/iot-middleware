const express = require("express");
const dataStore = require("../modules/dataStore");
const dbStore = require("../modules/dbStore");

const router = express.Router();

// Get all latest data
router.get("/latest", (req, res) => {
  res.json(dataStore.getAll());
});

// Get latest data for one sensor
router.get("/latest/:deviceId", (req, res) => {
  const data = dataStore.get(req.params.deviceId);
  if (data) return res.json(data);
  res.status(404).json({ error: "Sensor not found" });
});

// Get history from MySQL with optional time range and limit
router.get("/history/:deviceId", async (req, res) => {
  const { deviceId } = req.params;
  const limit = parseInt(req.query.limit, 10) || 50;
  
  try {
    const rows = await dbStore.getHistory(deviceId, limit);
    res.json(rows);
  } catch (err) {
    console.error("Failed to fetch history:", err);
    res.status(500).json({ error: "Failed to fetch sensor history" });
  }
});

module.exports = router;
