const mqtt = require("mqtt");
const { normalize } = require("./normalizers");
const dataStore = require("./dataStore");
const dbStore = require("./dbStore");
const logger = require("../utils/logger");

logger.info("Initializing MQTT client...");
const mqttUrl = process.env.MQTT_URL || "mqtt://localhost:1883";
const client = mqtt.connect(mqttUrl);

client.on("connect", () => {
    logger.info(`Connected to MQTT broker at ${mqttUrl}`);
    client.subscribe("sensors/#", (err) => {
        if (err) {
            logger.error("Failed to subscribe to sensors/#:", err.message);
        } else {
            logger.info("Subscribed to sensors/#");
        }
    });
});

client.on("message", async (topic, message) => {
  logger.debug(`Received message on topic ${topic}`);
  
  const meta = {
    gatewayId: topic.split("/")[1] // Assuming topic format: sensors/gateway-id/...
  };

  const normalized = normalize(topic, message, meta);
  if (normalized) {
    logger.debug(`Normalized message for device ${normalized.deviceId}:`, normalized);
    
    // Store latest data in memory
    dataStore.set(normalized.deviceId, normalized);
    logger.debug(`Updated latest data for device ${normalized.deviceId}`);
    
    // Save to history database
    try {
      await dbStore.saveHistory(normalized);
      logger.debug(`Saved history for device ${normalized.deviceId}`);
    } catch (err) {
      logger.error(`Failed to save history for device ${normalized.deviceId}:`, err.message);
    }
  } else {
    logger.error(`Failed to normalize message for topic ${topic}`);
  }
});

module.exports = client;
