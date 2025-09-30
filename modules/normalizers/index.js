const temperatureNormalizer = require("./temperatureNormalizer");
const logger = require("../../utils/logger");

function normalize(topic, message, meta = {}) {
  try {
    const payload = JSON.parse(message.toString());
    
    // Determine the sensor type from the topic
    if (topic.includes("/temperature")) {
      return temperatureNormalizer(payload, topic, meta);
    }
    
    // Default normalization for unknown sensor types
    return {
      deviceId: payload.deviceId || payload.id || "unknown",
      sensorType: "unknown",
      ts: payload.timestamp || new Date().toISOString(),
      seq: payload.seq,
      payload: payload,
      meta: {
        rawTopic: topic,
        ...meta
      }
    };
  } catch (err) {
    logger.error("Normalization failed:", err.message);
    return null;
  }
}

module.exports = { normalize };
