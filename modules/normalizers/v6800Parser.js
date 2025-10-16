const logger = require("../../utils/logger");

/**
 * Parser for V6800Upload devices
 * Handles JSON format messages
 */
function parse(topic, message, meta = {}) {
  try {
    // Extract device type and gateway ID from topic
    const topicParts = topic.split("/");
    const deviceType = topicParts[0].slice(0, 5); // V6800
    const gatewayId = topicParts[1] || "unknown";
    const sensorType = topicParts[2] || "unknown";

    // Parse JSON message
    const payload = typeof message === "string" ? JSON.parse(message) : message;

    // Determine sensor type from payload if not in topic
    let detectedSensorType = sensorType;
    if (sensorType === "unknown") {
      if (
        payload.tmp !== undefined ||
        payload.temperature !== undefined ||
        payload.value !== undefined
      ) {
        detectedSensorType = "temperature";
      } else if (payload.humidity !== undefined) {
        detectedSensorType = "humidity";
      } else if (payload.rfid !== undefined) {
        detectedSensorType = "rfid";
      } else if (payload.noise !== undefined) {
        detectedSensorType = "noise";
      }
    }

    // Create normalized message
    const parsedData = {
      deviceId: gatewayId,
      deviceType: deviceType,
      modAdd: null, // Not applicable for V6800
      modPort: payload.port || null, // Extract port from payload
      modId: payload.sensorId || `${gatewayId}-${detectedSensorType}`, // Use payload sensorId or create default
      msg_Type: detectedSensorType,
      ts: payload.time
        ? new Date(payload.time).toISOString()
        : new Date().toISOString(),
      seq: payload.seq,
      payload: payload,
      meta: {
        rawTopic: topic,
        deviceType: deviceType,
        ...meta,
      },
    };

    logger.debug(
      `V6800 message parsed for gateway: ${gatewayId}, sensor: ${detectedSensorType}`
    );
    return parsedData;
  } catch (error) {
    logger.error(`V6800 parsing failed: ${error.message}`);
    return null;
  }
}

module.exports = { parse };
