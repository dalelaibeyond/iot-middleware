const logger = require("../../utils/logger");
const { colorJson } = require("../../utils/colorJson");

// Message type mapping based on headers
const MSG_TYPE_MAP = {

  //identify message type by topic[2]
  "LabelState": "Rfid",
  "TemHum": "TempHum",
  "Noise": "Noise",

  //identify message type by header
  "CB": "Heartbeat",
  "CC": "Heartbeat",
  "BA": "Door",
  "EF01": "DeviceInfo",
  "EF02": "ModuleInfo"
};

/**
 * Parser for V5008Upload devices
 * Handles hex string messages from V5008 devices
 */
function parse(topic, message, meta = {}) {
  try {
    // Extract device type and gateway ID from topic
    const topicParts = topic.split("/");
    const deviceType = topicParts[0].slice(0, 5); // V5008
    const deviceId = topicParts[1] || "unknown";
    const sensorType = topicParts[2] || "unknown";

    // Debug: Log buffer information
    logger.debug(`[V5008 PARSER] Buffer length: ${message.length}`);
    logger.debug(`[V5008 PARSER] Buffer content (hex): ${message.toString("hex")}`);

    // V5008 messages are always buffers, convert directly to hex string
    const rawHexString = message.toString("hex").toUpperCase();
    const header = rawHexString.substring(0, 2);
    const subHeader = rawHexString.substring(2, 4);

    
    // Determine message type based on topic and header
    let msgType = "Unknown";
    if (sensorType === "TemHum") {
      msgType = "TempHum";
    } else if (sensorType === "Noise") {
      msgType = "Noise";
    } else if (sensorType === "LabelState") {
      msgType = "Rfid";
    } else if (sensorType === "OpeAck") {

      if (header === "CB" || header === "CC") {
        msgType = "Heartbeat";
        //const subHeader = rawHexString.substring(2, 4);
        //msgType = MSG_TYPE_MAP[header + subHeader] || "Unknown";
      } else if(header === "BA") {
        msgType = "Door";
      } else if (header === "EF" && subHeader === "01") {
        msgType = "DeviceInfo";
      } else if (header === "EF" && subHeader === "02") {
        msgType = "ModuleInfo";
      }

    }

     logger.debug(`[V5008 PARSER] Message Type: ${msgType}`);

    // Parse the hex string according to the V5008 message format
    const parsedMessage = parseV5008Message(rawHexString, msgType);
    
    if (!parsedMessage) {
      logger.error(`[V5008 PARSER] Failed to parse message: ${rawHexString}`);
      return null;
    }

    // Create normalized message
    const parsedData = {
      deviceId: deviceId,
      deviceType: "V5008",
      msgType: parsedMessage.msgType || msgType,
      sensorType: sensorType, // Use topic[2] as sensorType for consistency
      modAdd: parsedMessage.modAdd,
      modPort: parsedMessage.modPort,
      modId: parsedMessage.modId,
      ts: new Date().toISOString(),
      payload: parsedMessage.payload,
      meta: {
        rawTopic: topic, // Original topic for message relay compatibility
        rawHexString: rawHexString,
        ...meta,
      },
    };

    //logger.debug(`V5008 message parsed for device: ${deviceId}, type: ${parsedMessage.msgType}`);
    //logger.debug(colorJson(parsedData));
    logger.debug('[v5008parser] Normalized Message:\n', colorJson(parsedData));

    return parsedData;
  } catch (error) {
    logger.error(`V5008 parsing failed: ${error.message}`);
    return null;
  }
}

/**
 * Parse V5008 hex message according to the documented format
 * @param {string} hexString - The hex string to parse
 * @param {string} msgType - The message type determined from topic
 * @returns {Object|null} - Parsed message object or null if parsing failed
 */
function parseV5008Message(hexString, msgType) {
  try {
    // Basic validation - minimum message length
    if (hexString.length < 2) {
      logger.error(`[V5008 PARSER] Message too short: ${hexString}`);
      return null;
    }

    // Parse based on message type
    switch (msgType) {
      case "Heartbeat":
        return parseHeartbeatMessage(hexString);
      case "Rfid":
        return parseRfidMessage(hexString);
      case "TempHum":
        return parseTempHumMessage(hexString);
      case "Noise":
        return parseNoiseMessage(hexString);
      case "Door":
        return parseDoorMessage(hexString);
      case "DeviceInfo":
        return parseDeviceInfoMessage(hexString);
      case "ModuleInfo":
        return parseModuleInfoMessage(hexString);
      default:
        logger.error(`[V5008 PARSER] Unknown message type: ${msgType}`);
        return null;
    }
  } catch (error) {
    logger.error(`[V5008 PARSER] Error parsing message: ${error.message}`);
    return null;
  }
}

/**
 * Parse Heartbeat message (CB or CC header)
 * @param {string} hexString - The hex string to parse
 * @returns {Object|null} - Parsed Heartbeat message object
 */
function parseHeartbeatMessage(hexString) {
  try {
    const header = hexString.substring(0, 2);
    
    // Format: [CB or CC] ( [modAdd + modId(4B) + uNum] x 10 ) [msgCode(4B)]
    let modules = [];
    let offset = 2;
    
    // Parse up to 10 modules
    for (let i = 0; i < 10; i++) {
      if (offset + 7 > hexString.length - 4) break; // Leave room for msgCode
      
      const modAdd = readNum(hexString, offset, 2);
      const modIdHex = readHex(hexString, offset + 2, 8);
      const modId = parseInt(modIdHex, 16).toString();
      const uNum = readNum(hexString, offset + 10, 2);
      
      // Only include valid module addresses (1-5)
      if (modAdd >= 1 && modAdd <= 5) {
        modules.push({
          modAdd: modAdd,
          modId: modId,
          uNum: uNum
        });
      }
      
      offset += 12;
    }
    
    return {
      msgType: "Heartbeat",
      modAdd: null,
      modPort: null,
      modId: null,
      payload: modules
    };
  } catch (error) {
    logger.error(`[V5008 PARSER] Error parsing Heartbeat message: ${error.message}`);
    return null;
  }
}

/**
 * Parse RFID Tag Update message (BB header)
 * @param {string} hexString - The hex string to parse
 * @returns {Object|null} - Parsed RFID message object
 */
function parseRfidMessage(hexString) {
  try {
    // Format: [BB][modAdd][modId(4B)][Reserved][uNum][rifdNum] ( [uPos + uIfAlarm + uRFID(4B)] x rfidNum ) [msgCode(4B)]
    const modAdd = readNum(hexString, 2, 2);
    const modIdHex = readHex(hexString, 4, 8);
    const modId = parseInt(modIdHex, 16).toString();
    const reserved = readHex(hexString, 12, 2);
    const uNum = readNum(hexString, 14, 2);
    const rfidNum = readNum(hexString, 16, 2);
    
    let rfidData = [];
    let offset = 18;
    
    // Parse RFID data
    for (let i = 0; i < rfidNum; i++) {
      if (offset + 10 > hexString.length - 4) break; // Leave room for msgCode
      
      const uPos = readNum(hexString, offset, 2);
      const uIfAlarm = readNum(hexString, offset + 2, 2);
      const uRfid = readHex(hexString, offset + 4, 8);
      
      rfidData.push({
        uPos: uPos,
        uIfAlarm: uIfAlarm,
        uRfid: uRfid
      });
      
      offset += 12;
    }
    
    return {
      msgType: "Rfid",
      modAdd: modAdd,
      modPort: null,
      modId: modId,
      payload: {
        uNum: uNum,
        rfidNum: rfidNum,
        rfidData: rfidData
      }
    };
  } catch (error) {
    logger.error(`[V5008 PARSER] Error parsing RFID message: ${error.message}`);
    return null;
  }
}

/**
 * Parse Temperature & Humidity message
 * @param {string} hexString - The hex string to parse
 * @returns {Object|null} - Parsed TempHum message object
 */
function parseTempHumMessage(hexString) {
  try {
    // Format: [modAdd][modId(4B)] ([thAdd + temp(4B) + hum(4B)] x 6) [msgCode(4B)]
    const modAdd = readNum(hexString, 0, 2);
    const modIdHex = readHex(hexString, 2, 8);
    const modId = parseInt(modIdHex, 16).toString();
    
    let tempHumData = [];
    let offset = 10;
    
    // Parse up to 6 temperature/humidity sets
    for (let i = 0; i < 6; i++) {
      if (offset + 8 > hexString.length - 4) break; // Leave room for msgCode
      
      const thAdd = readNum(hexString, offset, 2);
      
      // Parse temperature as 4-byte value with 2 decimal places
      const tempInt = readNum(hexString, offset + 2, 2);
      const tempFrac = readNum(hexString, offset + 4, 2);
      const temp = parseFloat(`${tempInt}.${tempFrac.toString().padStart(2, '0')}`);
      
      // Parse humidity as 4-byte value with 2 decimal places
      const humInt = readNum(hexString, offset + 6, 2);
      const humFrac = readNum(hexString, offset + 8, 2);
      const hum = parseFloat(`${humInt}.${humFrac.toString().padStart(2, '0')}`);
      
      tempHumData.push({
        thAdd: thAdd,
        temp: temp,
        hum: hum
      });
      
      offset += 10;
    }
    
    return {
      msgType: "TempHum",
      modAdd: modAdd,
      modPort: null,
      modId: modId,
      payload: tempHumData
    };
  } catch (error) {
    logger.error(`[V5008 PARSER] Error parsing TempHum message: ${error.message}`);
    return null;
  }
}

/**
 * Parse Noise Level message
 * @param {string} hexString - The hex string to parse
 * @returns {Object|null} - Parsed Noise message object
 */
function parseNoiseMessage(hexString) {
  try {
    // Format: [modAdd][modId(4B)] ( [nsAdd + nsLevel(4B)] x 3 ) [msgCode(4B)]
    const modAdd = readNum(hexString, 0, 2);
    const modIdHex = readHex(hexString, 2, 8);
    const modId = parseInt(modIdHex, 16).toString();
    
    let noiseData = [];
    let offset = 10;
    
    // Parse up to 3 noise level sets
    for (let i = 0; i < 3; i++) {
      if (offset + 12 > hexString.length - 4) break; // Leave room for msgCode
      
      const nsAdd = readNum(hexString, offset, 2);
      const nsLevel = readNum(hexString, offset + 2, 8);
      
      noiseData.push({
        nsAdd: nsAdd,
        nsLevel: nsLevel
      });
      
      offset += 14;
    }
    
    return {
      msgType: "Noise",
      modAdd: modAdd,
      modPort: null,
      modId: modId,
      payload: noiseData
    };
  } catch (error) {
    logger.error(`[V5008 PARSER] Error parsing Noise message: ${error.message}`);
    return null;
  }
}

/**
 * Parse Door Status message (BA header)
 * @param {string} hexString - The hex string to parse
 * @returns {Object|null} - Parsed Door message object
 */
function parseDoorMessage(hexString) {
  try {
    // Format: [BA][modAdd][modId(4B)][drStatus] [msgCode(4B)]
    const modAdd = readNum(hexString, 2, 2);
    const modIdHex = readHex(hexString, 4, 8);
    const modId = parseInt(modIdHex, 16).toString();
    const drStatus = "0x" + readHex(hexString, 12, 2);
    
    return {
      msgType: "Door",
      modAdd: modAdd,
      modPort: null,
      modId: modId,
      payload: {
        drStatus: drStatus
      }
    };
  } catch (error) {
    logger.error(`[V5008 PARSER] Error parsing Door message: ${error.message}`);
    return null;
  }
}

/**
 * Parse Device Info message (EF01 header)
 * @param {string} hexString - The hex string to parse
 * @returns {Object|null} - Parsed DeviceInfo message object
 */
function parseDeviceInfoMessage(hexString) {
  try {
    // Format: [EF][01][deviceType(2B)][firmwareVer(4B)][ip(4B)][mask(4B)][gateway(4B)][mac(6B)][msgCode(4B)]
    const deviceType = readHex(hexString, 4, 4);
    const firmwareVerHex = readHex(hexString, 8, 8);
    const firmwareVer = parseInt(firmwareVerHex, 16).toString();
    
    // Parse IP address (each component is 1 byte, but represented as 2 hex chars)
    const ip1 = readNum(hexString, 16, 2);
    const ip2 = readNum(hexString, 18, 2);
    const ip3 = readNum(hexString, 20, 2);
    const ip4 = readNum(hexString, 22, 2);
    const ip = `${ip1}.${ip2}.${ip3}.${ip4}`;
    
    // Parse subnet mask
    const mask1 = readNum(hexString, 24, 2);
    const mask2 = readNum(hexString, 26, 2);
    const mask3 = readNum(hexString, 28, 2);
    const mask4 = readNum(hexString, 30, 2);
    const mask = `${mask1}.${mask2}.${mask3}.${mask4}`;
    
    // Parse gateway
    const gw1 = readNum(hexString, 32, 2);
    const gw2 = readNum(hexString, 34, 2);
    const gw3 = readNum(hexString, 36, 2);
    const gw4 = readNum(hexString, 38, 2);
    const gateway = `${gw1}.${gw2}.${gw3}.${gw4}`;
    
    // Parse MAC address
    const mac1 = readHex(hexString, 40, 2);
    const mac2 = readHex(hexString, 42, 2);
    const mac3 = readHex(hexString, 44, 2);
    const mac4 = readHex(hexString, 46, 2);
    const mac5 = readHex(hexString, 48, 2);
    const mac6 = readHex(hexString, 50, 2);
    const mac = `${mac1}:${mac2}:${mac3}:${mac4}:${mac5}:${mac6}`;
    
    return {
      msgType: "DeviceInfo",
      modAdd: null,
      modPort: null,
      modId: null,
      payload: {
        firmwareVer: firmwareVer,
        ip: ip,
        mask: mask,
        gateway: gateway,
        mac: mac
      }
    };
  } catch (error) {
    logger.error(`[V5008 PARSER] Error parsing DeviceInfo message: ${error.message}`);
    return null;
  }
}

/**
 * Parse Module Info message (EF02 header)
 * @param {string} hexString - The hex string to parse
 * @returns {Object|null} - Parsed ModuleInfo message object
 */
function parseModuleInfoMessage(hexString) {
  try {
    // Format: [EF][02] ( [modAdd + modFirwareVer(6B)] x (until the rest bytes < 7) ) [msgCode(4B)]
    let modules = [];
    let offset = 4;
    
    // Parse modules until we have less than 7 bytes left (for msgCode)
    while (offset + 14 <= hexString.length - 4) {
      const modAdd = readNum(hexString, offset, 2);
      const modFirwareVerHex = readHex(hexString, offset + 2, 12);
      const modFirwareVer = parseInt(modFirwareVerHex, 16).toString();
      
      modules.push({
        modAdd: modAdd,
        modFirwareVer: modFirwareVer
      });
      
      offset += 14;
    }
    
    return {
      msgType: "ModuleInfo",
      modAdd: null,
      modPort: null,
      modId: null,
      payload: modules
    };
  } catch (error) {
    logger.error(`[V5008 PARSER] Error parsing ModuleInfo message: ${error.message}`);
    return null;
  }
}

// Helper functions
function readHex(str, start, len) {
  return str.slice(start, start + len);
}

function readNum(str, start, len) {
  return parseInt(str.slice(start, start + len), 16);
}


module.exports = { parse };
