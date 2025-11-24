const logger = require("../../utils/logger");
const { colorJson } = require("../../utils/colorJson");
const UnifiedNormalizer = require("./UnifiedNormalizer");

/**
 * Configuration constants for V5008 parser
 */
const CONFIG = {
  DEVICE_TYPE: "V5008",
  DEVICE_TYPE_LENGTH: 5,
  
  // Message type mapping based on topic segments
  TOPIC_MSG_TYPE_MAP: {
    "LabelState": "Rfid",
    "TemHum": "TempHum",
    "Noise": "Noise"
  },
  
  // Message type mapping based on headers
  HEADER_MSG_TYPE_MAP: {
    "CB": "Heartbeat",
    "CC": "Heartbeat",
    "BA": "Door",
    "EF01": "DeviceInfo",
    "EF02": "ModuleInfo",
    "E4": "ColorReq",
    "E2": "ClrTamperAlarmResponse",
    "E1": "ColorSetResponse"
  },
  
  // Color name mapping for color codes
  COLOR_NAME_MAP: {
    "0": "off",
    "1": "red",
    "2": "purple",
    "3": "yellow",
    "4": "green",
    "5": "cyan",
    "6": "blue",
    "7": "white",
    "8": "red_f",
    "9": "purple_f",
    "10": "yellow_f", // "0x0a"
    "11": "green_f",  // "0x0b"
    "12": "cyan_f",   // "0x0c"
    "13": "blue_f",   // "0x0d"
    "14": "white_f"   // "0x0e"
  },
  
  // Message format specifications
  MESSAGE_FORMATS: {
    Heartbeat: {
      header: ["CB", "CC"],
      maxModules: 10,
      moduleSize: 12,
      validModRange: { min: 1, max: 5 }
    },
    Rfid: {
      header: "BB",
      rfidEntrySize: 12
    },
    TempHum: {
      maxSensors: 6,
      sensorSize: 10
    },
    Noise: {
      maxSensors: 3,
      sensorSize: 10  // 1 byte for add + 4 bytes for noise = 5 bytes = 10 hex characters
    },
    Door: {
      header: "BA"
    },
    DeviceInfo: {
      header: "EF01"
    },
    ModuleInfo: {
      header: "EF02",
      moduleSize: 14
    },
    ColorReq: {
      header: "E4"
    },
    ClrTamperAlarmResponse: {
      header: "E2"
    },
    ColorSetResponse: {
      header: "E1"
    }
  }
};

/**
 * Utility functions for hex parsing and data transformation
 */
const HexUtils = {
  /**
   * Read a hex substring from a string
   * @param {string} str - The source string
   * @param {number} start - Starting position
   * @param {number} len - Length to read
   * @returns {string} Hex substring
   */
  readHex(str, start, len) {
    return str.slice(start, start + len);
  },

  /**
   * Read a hex substring and convert to number
   * @param {string} str - The source string
   * @param {number} start - Starting position
   * @param {number} len - Length to read
   * @returns {number} Numeric value
   */
  readNum(str, start, len) {
    return parseInt(str.slice(start, start + len), 16);
  },

  /**
   * Parse IP address from hex string
   * @param {string} hexString - The hex string containing IP
   * @param {number} offset - Starting offset
   * @returns {string} IP address in dotted decimal format
   */
  parseIpAddress(hexString, offset) {
    const parts = [];
    for (let i = 0; i < 4; i++) {
      parts.push(this.readNum(hexString, offset + i * 2, 2));
    }
    return parts.join(".");
  },

  /**
   * Parse MAC address from hex string
   * @param {string} hexString - The hex string containing MAC
   * @param {number} offset - Starting offset
   * @returns {string} MAC address in colon-separated format
   */
  parseMacAddress(hexString, offset) {
    const parts = [];
    for (let i = 0; i < 6; i++) {
      parts.push(this.readHex(hexString, offset + i * 2, 2));
    }
    return parts.join(":");
  },

  /**
   * Parse decimal value with 2 decimal places from hex
   * @param {string} hexString - The hex string
   * @param {number} offset - Starting offset
   * @returns {number} Decimal value with 2 places
   */
  parseDecimalWithTwoPlaces(hexString, offset) {
    const intPart = this.readNum(hexString, offset, 2);
    const fracPart = this.readNum(hexString, offset + 2, 2);
    return parseFloat(`${intPart}.${fracPart.toString().padStart(2, '0')}`);
  },

  /**
   * Format hex value with 0x prefix
   * @param {string} hexString - The hex string
   * @param {number} offset - Starting offset
   * @param {number} length - Length of hex value
   * @returns {string} Formatted hex string
   */
  formatHexWithPrefix(hexString, offset, length) {
    return "0x" + this.readHex(hexString, offset, length);
  }
};

/**
 * Message parsing utilities
 */
const MessageUtils = {
  /**
   * Extract device information from topic
   * @param {string} topic - MQTT topic
   * @returns {Object} Device information
   */
  extractDeviceInfo(topic) {
    const topicParts = topic.split("/");
    return {
      deviceType: topicParts[0].slice(0, CONFIG.DEVICE_TYPE_LENGTH),
      deviceId: topicParts[1] || "unknown",
      sensorType: topicParts[2] || "unknown"
    };
  },

  /**
   * Determine message type from topic and headers
   * @param {string} sensorType - Sensor type from topic
   * @param {string} header - Message header
   * @param {string} subHeader - Message sub-header
   * @returns {string} Message type
   */
  determineMessageType(sensorType, header, subHeader) {
    // First check topic-based message types
    if (CONFIG.TOPIC_MSG_TYPE_MAP[sensorType]) {
      return CONFIG.TOPIC_MSG_TYPE_MAP[sensorType];
    }
    
    // Then check header-based message types
    if (CONFIG.HEADER_MSG_TYPE_MAP[header]) {
      return CONFIG.HEADER_MSG_TYPE_MAP[header];
    }
    
    // Check combined header for EF messages
    if (header === "EF") {
      const combinedHeader = header + subHeader;
      return CONFIG.HEADER_MSG_TYPE_MAP[combinedHeader] || "Unknown";
    }
    
    return "Unknown";
  },

  /**
   * Parse module ID from hex
   * @param {string} hexString - The hex string
   * @param {number} offset - Starting offset
   * @returns {string} Module ID as decimal string
   */
  parseModuleId(hexString, offset) {
    const modIdHex = HexUtils.readHex(hexString, offset, 8);
    return parseInt(modIdHex, 16).toString();
  }
};

/**
 * Payload processors for different message types
 */
const PayloadProcessors = {
  /**
   * Process heartbeat payload
   * @param {string} hexString - The hex string to parse
   * @returns {Object} Processed payload
   */
  Heartbeat(hexString) {
    const format = CONFIG.MESSAGE_FORMATS.Heartbeat;
    let modules = [];
    let offset = 2; // Skip header
    
    // Parse up to maxModules
    for (let i = 0; i < format.maxModules; i++) {
      if (offset + format.moduleSize > hexString.length - 4) break; // Leave room for msgCode
      
      const modAdd = HexUtils.readNum(hexString, offset, 2);
      const modId = MessageUtils.parseModuleId(hexString, offset + 2);
      const uCount = HexUtils.readNum(hexString, offset + 10, 2);
      
      // Only include valid module addresses and non-empty/zero modId
      if (modAdd >= format.validModRange.min && modAdd <= format.validModRange.max &&
          modId && modId !== "" && modId !== "0") {
        modules.push({
          modNum: modAdd,
          modId: modId,
          uCount: uCount
        });
      }
      
      offset += format.moduleSize;
    }
    
    return {
      modNum: null,
      modId: null,
      payload: modules
    };
  },

  /**
   * Process RFID payload
   * @param {string} hexString - The hex string to parse
   * @returns {Object} Processed payload
   */
  Rfid(hexString) {
    const modAdd = HexUtils.readNum(hexString, 2, 2);
    const modId = MessageUtils.parseModuleId(hexString, 4);
    const reserved = HexUtils.readHex(hexString, 12, 2);
    const uCount = HexUtils.readNum(hexString, 14, 2);
    const rfidCount = HexUtils.readNum(hexString, 16, 2);
    
    let rfidData = [];
    let offset = 18;
    
    // Parse RFID data
    for (let i = 0; i < rfidCount; i++) {
      if (offset + CONFIG.MESSAGE_FORMATS.Rfid.rfidEntrySize > hexString.length - 4) break;
      
      const uPos = HexUtils.readNum(hexString, offset, 2);
      const uIfAlarm = HexUtils.readNum(hexString, offset + 2, 2);
      const uRfid = HexUtils.readHex(hexString, offset + 4, 8);
      
      rfidData.push({
        num: uPos,
        alarm: uIfAlarm,
        rfid: uRfid
      });
      
      offset += CONFIG.MESSAGE_FORMATS.Rfid.rfidEntrySize;
    }
    
    return {
      modNum: modAdd,
      modId: modId,
      payload: {
        uCount: uCount,
        rfidCount: rfidCount,
        rfidData: rfidData
      }
    };
  },

  /**
   * Process temperature & humidity payload
   * @param {string} hexString - The hex string to parse
   * @returns {Object} Processed payload
   */
  TempHum(hexString) {
    const modAdd = HexUtils.readNum(hexString, 0, 2);
    const modId = MessageUtils.parseModuleId(hexString, 2);
    
    let tempHumData = [];
    let offset = 10;
    
    // Parse up to maxSensors temperature/humidity sets
    for (let i = 0; i < CONFIG.MESSAGE_FORMATS.TempHum.maxSensors; i++) {
      if (offset + CONFIG.MESSAGE_FORMATS.TempHum.sensorSize > hexString.length - 4) break;
      
      const thAdd = HexUtils.readNum(hexString, offset, 2);
      const temp = HexUtils.parseDecimalWithTwoPlaces(hexString, offset + 2);
      const hum = HexUtils.parseDecimalWithTwoPlaces(hexString, offset + 6);
      
      tempHumData.push({
        add: thAdd,
        temp: temp,
        hum: hum
      });
      
      offset += CONFIG.MESSAGE_FORMATS.TempHum.sensorSize;
    }
    
    return {
      modNum: modAdd,
      modId: modId,
      payload: tempHumData
    };
  },

  /**
   * Process noise payload
   * @param {string} hexString - The hex string to parse
   * @returns {Object} Processed payload
   */
  Noise(hexString) {
    const modAdd = HexUtils.readNum(hexString, 0, 2);
    const modId = MessageUtils.parseModuleId(hexString, 2);
    
    let noiseData = [];
    let offset = 10; // Start after modNum(1) + modId(4) = 5 bytes = 10 hex chars
    
    // Parse up to maxSensors noise level sets
    for (let i = 0; i < CONFIG.MESSAGE_FORMATS.Noise.maxSensors; i++) {
      if (offset + CONFIG.MESSAGE_FORMATS.Noise.sensorSize > hexString.length - 8) break; // Leave room for msgId (4 bytes = 8 hex chars)
      
      const nsAdd = HexUtils.readNum(hexString, offset, 2); // 1 byte for add
      const nsLevel = HexUtils.readNum(hexString, offset + 2, 8); // 4 bytes for noise
      
      noiseData.push({
        add: nsAdd,
        noise: nsLevel
      });
      
      offset += CONFIG.MESSAGE_FORMATS.Noise.sensorSize; // 10 hex chars = 5 bytes (1 add + 4 noise)
    }
    
    return {
      modNum: modAdd,
      modId: modId,
      payload: noiseData
    };
  },

  /**
   * Process door status payload
   * @param {string} hexString - The hex string to parse
   * @returns {Object} Processed payload
   */
  Door(hexString) {
    const modAdd = HexUtils.readNum(hexString, 2, 2);
    const modId = MessageUtils.parseModuleId(hexString, 4);
    const drStatus = HexUtils.formatHexWithPrefix(hexString, 12, 2);
    
    return {
      modNum: modAdd,
      modId: modId,
      payload: {
        status: drStatus
      }
    };
  },

  /**
   * Process device info payload
   * @param {string} hexString - The hex string to parse
   * @returns {Object} Processed payload
   */
  DeviceInfo(hexString) {
    const deviceType = HexUtils.readHex(hexString, 4, 4);
    const firmwareVerHex = HexUtils.readHex(hexString, 8, 8);
    const firmwareVer = parseInt(firmwareVerHex, 16).toString();
    
    const ip = HexUtils.parseIpAddress(hexString, 16);
    const mask = HexUtils.parseIpAddress(hexString, 24);
    const gateway = HexUtils.parseIpAddress(hexString, 32);
    const mac = HexUtils.parseMacAddress(hexString, 40);
    
    return {
      modNum: null,
      modId: null,
      payload: {
        fwVersion: firmwareVer,
        ip: ip,
        mask: mask,
        gateway: gateway,
        mac: mac
      }
    };
  },

  /**
   * Process module info payload
   * @param {string} hexString - The hex string to parse
   * @returns {Object} Processed payload
   */
  ModuleInfo(hexString) {
    let modules = [];
    let offset = 4;
    
    // Parse modules until we have less than 7 bytes left (for msgCode)
    while (offset + CONFIG.MESSAGE_FORMATS.ModuleInfo.moduleSize <= hexString.length - 4) {
      const modAdd = HexUtils.readNum(hexString, offset, 2);
      const modFirwareVerHex = HexUtils.readHex(hexString, offset + 2, 12);
      const modFirwareVer = parseInt(modFirwareVerHex, 16).toString();
      
      modules.push({
        add: modAdd,
        fwVersion: modFirwareVer
      });
      
      offset += CONFIG.MESSAGE_FORMATS.ModuleInfo.moduleSize;
    }
    
    return {
      modNum: null,
      modId: null,
      payload: modules
    };
  },

  /**
   * Process color request response payload
   * @param {string} hexString - The hex string to parse
   * @returns {Object} Processed payload
   */
  ColorReq(hexString) {
    // Format: [AA][deviceId(4B)][cmdResult][E4][modNum]([color] x n) [msgId(4B)]
    
    // Skip AA header (1 byte)
    // Extract device ID (4 bytes)
    const deviceId = HexUtils.readHex(hexString, 2, 8);
    
    // Extract cmdResult (1 byte)
    const cmdResult = HexUtils.readNum(hexString, 10, 2);
    
    // Verify E4 header (1 byte)
    const e4Header = HexUtils.readHex(hexString, 12, 2);
    if (e4Header !== "E4") {
      throw new Error(`Invalid E4 header: ${e4Header}`);
    }
    
    // Extract modNum (1 byte)
    const modNum = HexUtils.readNum(hexString, 14, 2);
    
    // Calculate the number of color entries
    // Total length - 24 bytes (AA + deviceId + cmdResult + E4 + modNum + msgId) = color data length
    const colorDataLength = hexString.length - 24;
    const colorCount = colorDataLength / 2; // Each color is 1 byte (2 hex chars)
    
    let colorData = [];
    let offset = 16; // Start after AA, deviceId, cmdResult, E4, and modNum
    
    // Parse each color entry
    for (let i = 0; i < colorCount; i++) {
      if (offset + 2 > hexString.length - 8) break; // Leave room for msgId (4 bytes)
      
      const colorCode = HexUtils.readNum(hexString, offset, 2).toString();
      const colorName = CONFIG.COLOR_NAME_MAP[colorCode] || "unknown";
      
      colorData.push({
        num: i + 1,
        color: colorName
      });
      
      offset += 2;
    }
    
    // Determine result based on cmdResult
    const resultStatus = cmdResult === 0xA1 ? "success" : "failure";
    
    return {
      modNum: null,
      modId: null,
      payload: colorData,
      meta: {
        result: resultStatus
      }
    };
  },

  /**
   * Process clean RFID tamper alarm response payload
   * @param {string} hexString - The hex string to parse
   * @returns {Object} Processed payload
   */
  ClrTamperAlarmResponse(hexString) {
    // Format: [AA][deviceId(4B)][cmdResult][cmdString(nB)][msgId(4B)]
    // cmdString - [E2][modNum]([num]...)
    
    // Skip AA header (1 byte)
    // Extract device ID (4 bytes)
    const deviceId = HexUtils.readHex(hexString, 2, 8);
    
    // Extract cmdResult (1 byte)
    const cmdResult = HexUtils.readNum(hexString, 10, 2);
    
    // Verify E2 header in cmdString (1 byte)
    const e2Header = HexUtils.readHex(hexString, 12, 2);
    if (e2Header !== "E2") {
      throw new Error(`Invalid E2 header: ${e2Header}`);
    }
    
    // Extract modNum (1 byte)
    const modNum = HexUtils.readNum(hexString, 14, 2);
    
    // Calculate the number of num entries
    // Total length - 20 bytes (AA + deviceId + cmdResult + E2 + modNum + msgId) = num data length
    const numDataLength = hexString.length - 20;
    const numCount = numDataLength / 2; // Each num is 1 byte (2 hex chars)
    
    let numData = [];
    let offset = 16; // Start after AA, deviceId, cmdResult, E2, and modNum
    
    // Parse each num entry
    for (let i = 0; i < numCount; i++) {
      if (offset + 2 > hexString.length - 8) break; // Leave room for msgId (4 bytes)
      
      const num = HexUtils.readNum(hexString, offset, 2);
      numData.push(num);
      
      offset += 2;
    }
    
    // Determine result based on cmdResult
    const resultStatus = cmdResult === 0xA1 ? "success" : "failure";
    
    return {
      modNum: null,
      modId: null,
      payload: {
        modNum: modNum,
        num: numData
      },
      meta: {
        result: resultStatus
      }
    };
  },

  /**
   * Process color set response payload
   * @param {string} hexString - The hex string to parse
   * @returns {Object} Processed payload
   */
  ColorSetResponse(hexString) {
    // Format: [AA][deviceId(4B)][cmdResult][cmdString(nB)][msgId(4B)]
    // cmdString - [E1][modNum](([num][colorCode]) x n)
    
    // Skip AA header (1 byte)
    // Extract device ID (4 bytes)
    const deviceId = HexUtils.readHex(hexString, 2, 8);
    
    // Extract cmdResult (1 byte)
    const cmdResult = HexUtils.readNum(hexString, 10, 2);
    
    // Verify E1 header in cmdString (1 byte)
    const e1Header = HexUtils.readHex(hexString, 12, 2);
    if (e1Header !== "E1") {
      throw new Error(`Invalid E1 header: ${e1Header}`);
    }
    
    // Extract modNum (1 byte)
    const modNum = HexUtils.readNum(hexString, 14, 2);
    
    // Calculate the number of color entries
    // Total length - 20 bytes (AA + deviceId + cmdResult + E1 + modNum + msgId) = color data length
    // Each entry has 2 bytes: num (1 byte) + colorCode (1 byte)
    const colorDataLength = hexString.length - 20;
    const entryCount = Math.floor(colorDataLength / 4); // Each entry is 4 hex chars (2 bytes)
    
    let colorData = [];
    let offset = 16; // Start after AA, deviceId, cmdResult, E1, and modNum
    
    // Parse each entry (num + colorCode)
    for (let i = 0; i < entryCount; i++) {
      if (offset + 4 > hexString.length - 8) break; // Leave room for msgId (4 bytes)
      
      const num = HexUtils.readNum(hexString, offset, 2);
      const colorCode = HexUtils.readNum(hexString, offset + 2, 2);
      const colorName = CONFIG.COLOR_NAME_MAP[colorCode.toString()] || "unknown";
      
      colorData.push({
        num: num,
        color: colorName
      });
      
      offset += 4;
    }
    
    // Determine result based on cmdResult
    const resultStatus = cmdResult === 0xA1 ? "success" : "failure";
    
    return {
      modNum: null,
      modId: null,
      payload: colorData,
      meta: {
        result: resultStatus
      }
    };
  }
};

/**
 * Message factory for creating normalized messages
 */
const MessageFactory = {
  /**
   * Create normalized message from parsed data
   * @param {Object} deviceInfo - Device information from topic
   * @param {string} msgType - Message type
   * @param {Object} parsedData - Parsed message data
   * @param {string} rawHexString - Original hex string
   * @param {string} topic - Original topic
   * @param {Object} meta - Additional metadata
   * @returns {Object} Normalized message
   */
  createNormalizedMessage(deviceInfo, msgType, parsedData, rawHexString, topic, meta = {}) {
    return {
      deviceId: deviceInfo.deviceId,
      deviceType: CONFIG.DEVICE_TYPE,
      sensorType: deviceInfo.sensorType,
      msgType: msgType,
      modNum: parsedData.modNum,
      modId: parsedData.modId,
      ts: new Date().toISOString(),
      payload: parsedData.payload,
      meta: {
        rawTopic: topic,
        rawHexString: rawHexString,
        ...meta,
      },
    };
  }
};

// Create unified normalizer instance
const unifiedNormalizer = new UnifiedNormalizer({
  devices: {
    V5008: {
      enabled: true,
      stateManagement: {
        rfid: true,
        temphum: true,
        noise: true,
        color: true,
        door: true
      }
    }
  }
});

/**
 * Main parser function for V5008 messages
 * @param {string} topic - MQTT topic
 * @param {Buffer} message - Raw message buffer
 * @param {Object} meta - Additional metadata
 * @returns {Object|null} Normalized message or null on error
 */
function parse(topic, message, meta = {}) {
  try {
    // Check if this is a recursive call from unified normalizer
    if (meta && meta.fromUnifiedNormalizer) {
      // If called from unified normalizer, just use the original parser
      return parseWithV5008Parser(topic, message, meta);
    }
    
    // First parse with existing V5008 parser
    const parsedMessage = parseWithV5008Parser(topic, message, meta);
    
    if (!parsedMessage) {
      return null;
    }
    
    // Then apply unified normalization
    const unifiedMessage = unifiedNormalizer.processMessage(parsedMessage, "V5008", topic, {
      ...meta,
      originalMessage: parsedMessage
    });
    
    return unifiedMessage;
  } catch (error) {
    logger.error(`V5008 unified parsing failed: ${error.message}`);
    return null;
  }
}

/**
 * Original V5008 parser function
 * @param {string} topic - MQTT topic
 * @param {Buffer} message - Raw message buffer
 * @param {Object} meta - Additional metadata
 * @returns {Object|null} Parsed message or null on error
 */
function parseWithV5008Parser(topic, message, meta = {}) {
  try {
    // Extract device information from topic
    const deviceInfo = MessageUtils.extractDeviceInfo(topic);
    
    // Debug logging
    logger.debug(`[V5008 PARSER] Buffer length: ${message.length}`);
    logger.debug(`[V5008 PARSER] Buffer content (hex): ${message.toString("hex")}`);
    
    // Convert buffer to hex string
    const rawHexString = message.toString("hex").toUpperCase();
    const header = rawHexString.substring(0, 2);
    const subHeader = rawHexString.substring(2, 4);
    
    // Determine message type
    let msgType = MessageUtils.determineMessageType(deviceInfo.sensorType, header, subHeader);
    
    // Special handling for OpeAck messages with command headers at position 6
    if (msgType === "Unknown" && deviceInfo.sensorType === "OpeAck" && rawHexString.length >= 14) {
      const cmdHeader = rawHexString.substring(12, 14);
      if (cmdHeader === "E4") {
        msgType = "ColorReq";
      } else if (cmdHeader === "E2") {
        msgType = "ClrTamperAlarmResponse";
      } else if (cmdHeader === "E1") {
        msgType = "ColorSetResponse";
      }
    }
    
    logger.debug(`[V5008 PARSER] Message Type: ${msgType}`);
    
    if (msgType === "Unknown") {
      logger.error(`[V5008 PARSER] Unknown message type for header: ${header}${subHeader}`);
      return null;
    }
    
    // Process the message using the appropriate payload processor
    const parsedData = PayloadProcessors[msgType](rawHexString);
    
    if (!parsedData) {
      logger.error(`[V5008 PARSER] Failed to parse message: ${rawHexString}`);
      return null;
    }
    
    // Extract msgId from the end of the hex string (last 8 characters = 4 bytes)
    const msgIdHex = rawHexString.slice(-8);
    const msgId = parseInt(msgIdHex, 16);
    
    // Create normalized message
    const normalizedMessage = MessageFactory.createNormalizedMessage(
      deviceInfo,
      msgType,
      parsedData,
      rawHexString,
      topic,
      {
        ...meta,
        msgId: msgId,
        ...(parsedData.meta || {}) // Include any meta from payload processor
      }
    );
    
    logger.debug('[v5008parser] Normalized Message:\n', colorJson(normalizedMessage));
    return normalizedMessage;
    
  } catch (error) {
    logger.error(`V5008 parsing failed: ${error.message}`);
    return null;
  }
}

module.exports = { parse };
