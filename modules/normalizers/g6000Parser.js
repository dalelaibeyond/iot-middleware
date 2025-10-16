const logger = require("../../utils/logger");

/**
 * Parser for G6000Upload devices
 * Handles hex string format messages
 */
function parse(topic, message, meta = {}) {
  try {
    // Extract device type and gateway ID from topic
    const topicParts = topic.split("/");
    const deviceType = topicParts[0].slice(0, 5); // G6000
    const gatewayId = topicParts[1] || "unknown";
    const sensorType = topicParts[2] || "unknown";

    // Convert message to string if it's not already
    const hexString =
      typeof message === "string" ? message : message.toString();

    // TODO: Add hex string parsing logic here
    // For now, store the raw hex string
    const parsedData = {
      deviceId: gatewayId,
      deviceType: deviceType,
      modAdd: null, // Will be determined after hex parsing
      modPort: null, // Not applicable for G6000
      modId: `${gatewayId}-${sensorType}`, // Default sensor ID, will be updated after hex parsing
      msg_Type: sensorType,
      ts: new Date().toISOString(),
      payload: {
        rawHex: hexString,
      },
      meta: {
        rawTopic: topic,
        deviceType: deviceType,
        ...meta,
      },
    };

    logger.debug(
      `G6000 message parsed for gateway: ${gatewayId}, sensor: ${sensorType}`
    );
    return parsedData;
  } catch (error) {
    logger.error(`G6000 parsing failed: ${error.message}`);
    return null;
  }
}

module.exports = { parse };
