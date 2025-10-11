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

    // Handle different message formats
    let rawHexString;
    if (Buffer.isBuffer(message)) {
      // Message is a Buffer - check if it contains hex string text or actual byte code
      const messageStr = message.toString();

      // Check if the string contains only hex characters (0-9, A-F)
      const isHexString = /^[0-9A-Fa-f]+$/.test(messageStr);

      if (isHexString) {
        // Buffer contains hex string text - use as-is
        rawHexString = messageStr.toUpperCase();
      } else {
        // Buffer contains actual byte code - convert to hex
        rawHexString = message.toString("hex").toUpperCase();
      }
    } else if (message && message.payload && Buffer.isBuffer(message.payload)) {
      // Message has a payload property that is a Buffer
      const payloadStr = message.payload.toString();

      // Check if the string contains only hex characters (0-9, A-F)
      const isHexString = /^[0-9A-Fa-f]+$/.test(payloadStr);

      if (isHexString) {
        // Buffer contains hex string text - use as-is
        rawHexString = payloadStr.toUpperCase();
      } else {
        // Buffer contains actual byte code - convert to hex
        rawHexString = message.payload.toString("hex").toUpperCase();
      }
    } else {
      // Message is a string - check if it's already a hex string
      const messageStr =
        typeof message === "string" ? message : message.toString();

      // Check if the string contains only hex characters (0-9, A-F)
      const isHexString = /^[0-9A-Fa-f]+$/.test(messageStr);

      if (isHexString) {
        // Already a hex string - use as-is
        rawHexString = messageStr.toUpperCase();
      } else {
        // Not a hex string - convert to hex
        rawHexString = Buffer.from(messageStr, "utf8")
          .toString("hex")
          .toUpperCase();
      }
    }

    // TODO: Implement hex string parsing logic here
    // This will extract sensorAdd, sensorId, and actual sensor data from the hex string
    // For now, we just store the raw hex and basic info

    // Create a basic normalized message with raw hex
    const parsedData = {
      deviceId: gatewayId,
      deviceType: deviceType,
      sensorAdd: null, // TODO: Extract from hex string
      sensorPort: null, // Not applicable for V5008
      sensorId: `${gatewayId}-${sensorType}`, // TODO: Extract from hex string
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
