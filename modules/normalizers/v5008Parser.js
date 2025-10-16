const logger = require("../../utils/logger");

/**
 * Parser for V5008Upload devices
 * Handles hex string messages from V5008 devices
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
    
    // Parse the hex string according to the V5008 message format
    const parsedMessage = parseV5008Message(rawHexString);
    
    if (!parsedMessage) {
      logger.error(`[V5008 PARSER] Failed to parse message: ${rawHexString}`);
      return null;
    }

    // Create normalized message
    const parsedData = {
      deviceId: gatewayId,
      deviceType: deviceType,
      modAdd: parsedMessage.modAdd,
      modPort: null, // Not applicable for V5008
      modId: parsedMessage.modId || `${gatewayId}-${sensorType}`,
      msg_Type: parsedMessage.sensorType || sensorType,
      ts: new Date().toISOString(),
      payload: {
        rawHexString: rawHexString,
        messageType: parsedMessage.messageType,
        ...parsedMessage.data
      },
      meta: {
        rawTopic: topic,
        rawHexString: rawHexString,
        deviceType: deviceType,
        ...meta,
      },
    };

    logger.debug(
      `V5008 message parsed for gateway: ${gatewayId}, type: ${parsedMessage.messageType}`
    );
    return parsedData;
  } catch (error) {
    logger.error(`V5008 parsing failed: ${error.message}`);
    return null;
  }
}

/**
 * Parse V5008 hex message according to the documented format
 * @param {string} hexString - The hex string to parse
 * @returns {Object|null} - Parsed message object or null if parsing failed
 */
function parseV5008Message(hexString) {
  try {
    // Basic validation - minimum message length
    if (hexString.length < 2) {
      logger.error(`[V5008 PARSER] Message too short: ${hexString}`);
      return null;
    }

    // Extract header to determine message type
    const header = hexString.substring(0, 2);
    
    // Parse based on message type
    if (header === "CB" || header === "CC") {
      return parseOpeAckMessage(hexString);
    } else if (header === "BB") {
      return parseLabelStateMessage(hexString);
    } else {
      logger.error(`[V5008 PARSER] Unknown message header: ${header}`);
      return null;
    }
  } catch (error) {
    logger.error(`[V5008 PARSER] Error parsing message: ${error.message}`);
    return null;
  }
}

/**
 * Parse OpeAck message (CB or CC header)
 * Based on actual message: cc010000000000028c090995120300000000000400000000000500000000000600000000000700000000000800000000000900000000000a0000000000c40061b2
 * @param {string} hexString - The hex string to parse
 * @returns {Object|null} - Parsed OpeAck message object
 */
function parseOpeAckMessage(hexString) {
  try {
    const header = hexString.substring(0, 2);
    const messageType = hexString.substring(2, 4);
    
    // Based on the actual message, it seems to have a different structure than expected
    // Let's parse it more flexibly based on the observed pattern
    
    // The message appears to contain:
    // cc 01 00000000 0000 28c090995 12030000000000 04000000000000 05000000000000 06000000000000 07000000000000 08000000000000 09000000000000 0a000000000000 c40061b2
    
    // Extract device ID from position 8-16 (4 bytes)
    const deviceId = hexString.substring(8, 16);
    const deviceIdDecimal = parseInt(deviceId, 16).toString();
    
    // The rest of the message appears to be a series of operation codes and statuses
    const operations = [];
    let offset = 16;
    
    // Parse operations until we reach the end (minus 4 bytes for checksum)
    while (offset < hexString.length - 4) {
      if (offset + 16 <= hexString.length - 4) {
        const operationCode = hexString.substring(offset, offset + 2);
        const status = hexString.substring(offset + 2, offset + 16);
        
        operations.push({
          operation: operationCode,
          status: status
        });
        
        offset += 16;
      } else {
        break;
      }
    }
    
    // Extract checksum
    const checksum = hexString.substring(hexString.length - 4);
    
    return {
      messageType: "OpeAck",
      modAdd: null, // Not applicable for OpeAck
      modId: deviceIdDecimal,
      msg_Type: "opeack",
      data: {
        deviceId: deviceIdDecimal,
        operations,
        checksum
      }
    };
  } catch (error) {
    logger.error(`[V5008 PARSER] Error parsing OpeAck message: ${error.message}`);
    return null;
  }
}

/**
 * Parse LabelState message (BB header)
 * Based on actual message: bb028c0909950012030200dd2874840400dd3950641200dd27ee34c3006669
 * @param {string} hexString - The hex string to parse
 * @returns {Object|null} - Parsed LabelState message object
 */
function parseLabelStateMessage(hexString) {
  try {
    const header = hexString.substring(0, 2);
    
    // Based on the actual message, let's parse it according to the observed structure
    // bb 02 8c090995 00 12 03 02 00 dd2874840400dd3950641200dd27ee34c3006669
    
    // Extract fields
    const messageType = hexString.substring(2, 4);
    const deviceId = hexString.substring(4, 12);
    const deviceIdDecimal = parseInt(deviceId, 16).toString();
    const reserved = hexString.substring(12, 14);
    const totalUNum = parseInt(hexString.substring(14, 16), 16);
    const unknown1 = hexString.substring(16, 18);
    const totalOnlineTagNum = parseInt(hexString.substring(18, 20), 16);
    
    // Parse tag data
    const uData = [];
    let offset = 20;
    
    // Parse tags based on totalOnlineTagNum
    for (let i = 0; i < totalOnlineTagNum; i++) {
      if (offset + 12 <= hexString.length - 4) { // Leave room for checksum
        const uPos = parseInt(hexString.substring(offset, offset + 2), 16);
        const uIfAlarm = parseInt(hexString.substring(offset + 2, offset + 4), 16);
        const uTag = hexString.substring(offset + 4, offset + 12);
        
        uData.push({
          uPos,
          uIfAlarm,
          uTag
        });
        
        offset += 12;
      }
    }
    
    // Extract any remaining data and checksum
    const remainingData = hexString.substring(offset, hexString.length - 4);
    const checksum = hexString.substring(hexString.length - 4);
    
    return {
      messageType: "LabelState",
      modAdd: parseInt(messageType, 16),
      modId: deviceIdDecimal,
      msg_Type: "labelstate",
      data: {
        modAdd: parseInt(messageType, 16),
        modId: deviceIdDecimal,
        totalUNum,
        u_data: uData,
        remainingData,
        checksum
      }
    };
  } catch (error) {
    logger.error(`[V5008 PARSER] Error parsing LabelState message: ${error.message}`);
    return null;
  }
}

module.exports = { parse };
