const v5008Parser = require("./v5008Parser");
const v6800Parser = require("./v6800Parser");
const g6000Parser = require("./g6000Parser");
const logger = require("../../utils/logger");

/**
 * Main normalize function that dispatches messages to appropriate parsers
 * @param {string} topic - MQTT topic
 * @param {string|object} message - Message payload
 * @param {object} meta - Additional metadata
 * @returns {object|null} - Normalized message or null if parsing failed
 */
function normalize(topic, message, meta = {}) {
  try {
    // Extract device type from topic
    const topicParts = topic.split("/");
    const deviceType = topicParts[0].slice(0, 5); // V5008, V6800, G6000 (remove "Upload")

    // Dispatch to appropriate parser based on device type
    let parsedMessage;
    switch (deviceType) {
      case "V5008":
        parsedMessage = v5008Parser.parse(topic, message, meta);
        break;
      case "V6800":
        parsedMessage = v6800Parser.parse(topic, message, meta);
        break;
      case "G6000":
        parsedMessage = g6000Parser.parse(topic, message, meta);
        break;
      default:
        logger.warn(`Unknown device type: ${deviceType}`);
        // Return a basic normalized message for unknown device types
        parsedMessage = {
          deviceId: topicParts[1] || "unknown",
          deviceType: deviceType,
          sensorType: "unknown",
          ts: new Date().toISOString(),
          payload: typeof message === "string" ? message : message.toString(),
          meta: {
            rawTopic: topic,
            deviceType: deviceType,
            ...meta,
          },
        };
    }

    return parsedMessage;
  } catch (error) {
    logger.error(`Normalization failed for topic ${topic}: ${error.message}`);
    return null;
  }
}

module.exports = { normalize };
