const logger = require("../../utils/logger");
const { colorJson } = require("../../utils/colorJson");

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
    "EF02": "ModuleInfo"
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
      sensorSize: 14
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
      
      // Only include valid module addresses
      if (modAdd >= format.validModRange.min && modAdd <= format.validModRange.max) {
        modules.push({
          num: modAdd,
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
    let offset = 10;
    
    // Parse up to maxSensors noise level sets
    for (let i = 0; i < CONFIG.MESSAGE_FORMATS.Noise.maxSensors; i++) {
      if (offset + CONFIG.MESSAGE_FORMATS.Noise.sensorSize > hexString.length - 4) break;
      
      const nsAdd = HexUtils.readNum(hexString, offset, 2);
      const nsLevel = HexUtils.readNum(hexString, offset + 2, 8);
      
      noiseData.push({
        add: nsAdd,
        noise: nsLevel
      });
      
      offset += CONFIG.MESSAGE_FORMATS.Noise.sensorSize;
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
        fmVersion: firmwareVer,
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
        fmVersion: modFirwareVer
      });
      
      offset += CONFIG.MESSAGE_FORMATS.ModuleInfo.moduleSize;
    }
    
    return {
      modNum: null,
      modId: null,
      payload: modules
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

/**
 * Main parser function for V5008 messages
 * @param {string} topic - MQTT topic
 * @param {Buffer} message - Raw message buffer
 * @param {Object} meta - Additional metadata
 * @returns {Object|null} Normalized message or null on error
 */
function parse(topic, message, meta = {}) {
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
    const msgType = MessageUtils.determineMessageType(deviceInfo.sensorType, header, subHeader);
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
    
    // Extract msgCode from the end of the hex string (last 8 characters = 4 bytes)
    const msgCodeHex = rawHexString.slice(-8);
    const msgId = parseInt(msgCodeHex, 16);
    
    // Create normalized message
    const normalizedMessage = MessageFactory.createNormalizedMessage(
      deviceInfo,
      msgType,
      parsedData,
      rawHexString,
      topic,
      {
        ...meta,
        msgId: msgId
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
