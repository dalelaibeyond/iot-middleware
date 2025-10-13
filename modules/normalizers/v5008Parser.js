const logger = require("../../utils/logger");

/**
 * Parser for V5008Upload devices
 * Handles both byte code messages and hex string messages
 */
function parse(topic, message, meta = {}) {
  try {
    // Extract device type and gateway ID from topic
    const topicParts = topic.split("/");
    const deviceType = topicParts[0].slice(0, 5); // V5008
    const gatewayId = topicParts[1] || "unknown";
    const sensorType = topicParts[2] || "unknown";

    // Debug: Log buffer information
    logger.debug(`[V5008 PARSER] Buffer length: ${message.length}`);
    logger.debug(`[V5008 PARSER] Buffer content (hex): ${message.toString("hex")}`);

    // V5008 messages are always buffers, convert directly to hex string
    const rawHexString = message.toString("hex").toUpperCase();

    // TODO: Implement hex string parsing logic here
    // This will extract sensorAdd, sensorId, and actual sensor data from the hex string
    // For now, we just store the raw hex and basic info

    // Create a basic normalized message with raw hex
    const parsedData = {
      deviceId: gatewayId,
      deviceType: deviceType,
      modAdd: null, // TODO: Extract from hex string
      modPort: null, // Not applicable for V5008
      modId: `${gatewayId}-${sensorType}`, // TODO: Extract from hex string
      sensorType: sensorType,
      ts: new Date().toISOString(),
      payload: {
        rawHexString: rawHexString,
        // TODO: Parse actual sensor data from hex and add here
      },
      meta: {
        rawTopic: topic,
        rawHexString: rawHexString,
        deviceType: deviceType,
        ...meta,
      },
    };

    console.log("[V5008 PARSER] Parsed data:", parsedData);

    logger.debug(
      `V5008 message parsed for gateway: ${gatewayId}, sensor: ${sensorType}`
    );
    return parsedData;
  } catch (error) {
    logger.error(`V5008 parsing failed: ${error.message}`);
    return null;
  }
}

module.exports = { parse };
