const logger = require("../../../utils/logger");

/**
 * Message Enhancer that adds unified metadata and context to messages
 */
class MessageEnhancer {
  constructor(config = {}) {
    this.config = {
      version: "1.0.0",
      includeRawMessage: true,
      includeDeviceSpecific: true,
      ...config
    };
  }

  /**
   * Enhance a message with unified metadata
   * @param {Object} message - Message to enhance
   * @param {string} deviceType - Device type
   * @param {string} topic - Original MQTT topic
   * @param {Object} meta - Additional metadata
   * @returns {Object} Enhanced message
   */
  enhance(message, deviceType, topic, meta = {}) {
    try {
      // Create a deep copy to avoid modifying the original
      const enhancedMessage = JSON.parse(JSON.stringify(message));
      
      // Initialize meta object if it doesn't exist
      if (!enhancedMessage.meta) {
        enhancedMessage.meta = {};
      }
      
      // Add standard metadata
      enhancedMessage.meta.rawTopic = topic;
      enhancedMessage.meta.normalizedAt = new Date().toISOString();
      enhancedMessage.meta.normalizerVersion = this.config.version;
      
      // Include raw message if enabled
      if (this.config.includeRawMessage) {
        enhancedMessage.meta.rawMessage = meta.rawMessage || null;
      }
      
      // Add device-specific metadata
      if (this.config.includeDeviceSpecific) {
        enhancedMessage.meta.deviceSpecific = this.extractDeviceSpecificData(
          enhancedMessage, 
          deviceType, 
          meta
        );
      }
      
      // Add processing metadata
      enhancedMessage.meta.processing = {
        deviceType,
        msgType: enhancedMessage.msgType,
        processingTime: meta.processingTime || null,
        parserVersion: this.getParserVersion(deviceType)
      };
      
      // Add correlation IDs if available
      if (meta.correlationId) {
        enhancedMessage.meta.correlationId = meta.correlationId;
      }
      
      // Add session ID if available
      if (meta.sessionId) {
        enhancedMessage.meta.sessionId = meta.sessionId;
      }
      
      // Add quality metrics
      enhancedMessage.meta.quality = this.calculateQualityMetrics(enhancedMessage);
      
      return enhancedMessage;
    } catch (error) {
      logger.error("Message enhancement failed:", error);
      return message; // Return original message if enhancement fails
    }
  }

  /**
   * Extract device-specific data from message
   * @param {Object} message - Enhanced message
   * @param {string} deviceType - Device type
   * @param {Object} meta - Additional metadata
   * @returns {Object} Device-specific data
   */
  extractDeviceSpecificData(message, deviceType, meta) {
    const deviceSpecific = {
      originalFields: {},
      deviceCapabilities: this.getDeviceCapabilities(deviceType),
      protocolInfo: this.getProtocolInfo(deviceType, meta)
    };
    
    // Store original field names for reference
    const originalMessage = meta.originalMessage || message;
    this.extractOriginalFieldNames(originalMessage, deviceSpecific.originalFields);
    
    return deviceSpecific;
  }

  /**
   * Extract original field names before mapping
   * @param {Object} message - Original message
   * @param {Object} originalFields - Object to store field names
   */
  extractOriginalFieldNames(message, originalFields) {
    if (!message) return;
    
    // Extract field names from top level
    for (const field of Object.keys(message)) {
      if (field !== 'meta') {
        originalFields[field] = true;
      }
    }
    
    // Extract field names from payload if it exists
    if (message.payload && typeof message.payload === 'object') {
      originalFields.payloadFields = {};
      this.extractPayloadFieldNames(message.payload, originalFields.payloadFields);
    }
  }

  /**
   * Extract field names from payload
   * @param {Object} payload - Payload object
   * @param {Object} fields - Object to store field names
   */
  extractPayloadFieldNames(payload, fields) {
    if (Array.isArray(payload)) {
      // Handle array of objects
      if (payload.length > 0 && typeof payload[0] === 'object') {
        for (const field of Object.keys(payload[0])) {
          fields[field] = true;
        }
      }
    } else {
      // Handle single object
      for (const field of Object.keys(payload)) {
        if (Array.isArray(payload[field]) && payload[field].length > 0 && 
            typeof payload[field][0] === 'object') {
          fields[field] = {};
          this.extractPayloadFieldNames(payload[field], fields[field]);
        } else {
          fields[field] = true;
        }
      }
    }
  }

  /**
   * Get device capabilities based on device type
   * @param {string} deviceType - Device type
   * @returns {Object} Device capabilities
   */
  getDeviceCapabilities(deviceType) {
    const capabilities = {
      V5008: {
        supportedMessageTypes: [
          "Rfid", "TempHum", "Noise", "Door", 
          "Heartbeat", "DeviceInfo", "ModuleInfo",
          "ColorReq", "ColorSetResponse", "ClrTamperAlarmResponse"
        ],
        maxModules: 5,
        supportsStateManagement: true,
        protocol: "Binary"
      },
      V6800: {
        supportedMessageTypes: [
          "Rfid", "TempHum", "Noise", "Door",
          "Heartbeat", "DevModInfo", "ColorReq", 
          "SetColor", "CleanRfidTamperAlarm"
        ],
        maxModules: 16,
        supportsStateManagement: true,
        protocol: "JSON"
      },
      G6000: {
        supportedMessageTypes: ["Unknown"], // To be implemented
        maxModules: 0, // To be implemented
        supportsStateManagement: false, // To be implemented
        protocol: "Hex"
      }
    };
    
    return capabilities[deviceType] || {};
  }

  /**
   * Get protocol information
   * @param {string} deviceType - Device type
   * @param {Object} meta - Additional metadata
   * @returns {Object} Protocol information
   */
  getProtocolInfo(deviceType, meta) {
    const protocolInfo = {
      deviceType,
      messageFormat: null,
      encoding: null,
      version: null
    };
    
    switch (deviceType) {
      case "V5008":
        protocolInfo.messageFormat = "Binary";
        protocolInfo.encoding = "Hex";
        protocolInfo.version = "1.0";
        break;
      case "V6800":
        protocolInfo.messageFormat = "JSON";
        protocolInfo.encoding = "UTF-8";
        protocolInfo.version = "2.0";
        break;
      case "G6000":
        protocolInfo.messageFormat = "Hex";
        protocolInfo.encoding = "Hex";
        protocolInfo.version = "Unknown";
        break;
    }
    
    return protocolInfo;
  }

  /**
   * Get parser version for device type
   * @param {string} deviceType - Device type
   * @returns {string} Parser version
   */
  getParserVersion(deviceType) {
    const versions = {
      V5008: "1.0.0",
      V6800: "1.0.0",
      G6000: "0.1.0" // Development version
    };
    
    return versions[deviceType] || "Unknown";
  }

  /**
   * Calculate quality metrics for the message
   * @param {Object} message - Enhanced message
   * @returns {Object} Quality metrics
   */
  calculateQualityMetrics(message) {
    const quality = {
      completeness: this.calculateCompleteness(message),
      consistency: this.calculateConsistency(message),
      timestamp: this.calculateTimestampQuality(message),
      payload: this.calculatePayloadQuality(message)
    };
    
    // Calculate overall quality score (0-100)
    quality.overall = Math.round(
      (quality.completeness + quality.consistency + 
       quality.timestamp + quality.payload) / 4
    );
    
    return quality;
  }

  /**
   * Calculate message completeness
   * @param {Object} message - Message to check
   * @returns {number} Completeness score (0-100)
   */
  calculateCompleteness(message) {
    const requiredFields = ["deviceId", "deviceType", "sensorType", "msgType", "ts"];
    let presentFields = 0;
    
    for (const field of requiredFields) {
      if (message[field] !== undefined && message[field] !== null) {
        presentFields++;
      }
    }
    
    return Math.round((presentFields / requiredFields.length) * 100);
  }

  /**
   * Calculate message consistency
   * @param {Object} message - Message to check
   * @returns {number} Consistency score (0-100)
   */
  calculateConsistency(message) {
    let score = 100;
    
    // Check for consistent data types
    if (typeof message.deviceId !== "string") score -= 20;
    if (typeof message.deviceType !== "string") score -= 20;
    if (typeof message.msgType !== "string") score -= 20;
    
    // Check timestamp format
    if (message.ts && !this.isValidTimestamp(message.ts)) {
      score -= 40;
    }
    
    return Math.max(0, score);
  }

  /**
   * Calculate timestamp quality
   * @param {Object} message - Message to check
   * @returns {number} Timestamp quality score (0-100)
   */
  calculateTimestampQuality(message) {
    if (!message.ts) return 0;
    
    const timestamp = new Date(message.ts);
    const now = new Date();
    
    // Check if timestamp is valid
    if (isNaN(timestamp.getTime())) return 0;
    
    // Check if timestamp is too old or in the future
    const ageMs = now - timestamp;
    const maxAgeMs = 24 * 60 * 60 * 1000; // 24 hours
    
    if (ageMs < 0) return 50; // Future timestamp
    if (ageMs > maxAgeMs) return 50; // Too old
    
    return 100; // Good timestamp
  }

  /**
   * Calculate payload quality
   * @param {Object} message - Message to check
   * @returns {number} Payload quality score (0-100)
   */
  calculatePayloadQuality(message) {
    if (!message.payload) return 0;
    
    let score = 100;
    
    // Check payload structure based on message type
    switch (message.msgType) {
      case "Rfid":
        score = this.calculateRfidPayloadQuality(message.payload);
        break;
      case "TempHum":
      case "TemHumReq":
        score = this.calculateTempHumPayloadQuality(message.payload);
        break;
      case "Noise":
        score = this.calculateNoisePayloadQuality(message.payload);
        break;
      case "ColorReq":
        score = this.calculateColorPayloadQuality(message.payload);
        break;
      case "Door":
      case "DoorReq":
        score = this.calculateDoorPayloadQuality(message.payload);
        break;
      default:
        // Unknown message type, basic checks only
        if (typeof message.payload !== "object") score = 50;
    }
    
    return Math.max(0, score);
  }

  /**
   * Calculate RFID payload quality
   * @param {Object} payload - RFID payload
   * @returns {number} Quality score (0-100)
   */
  calculateRfidPayloadQuality(payload) {
    let score = 100;
    
    if (typeof payload.uCount !== "number") score -= 20;
    if (typeof payload.rfidCount !== "number") score -= 20;
    if (!Array.isArray(payload.rfidData)) score -= 30;
    
    return score;
  }

  /**
   * Calculate Temperature/Humidity payload quality
   * @param {Object} payload - Temperature/Humidity payload
   * @returns {number} Quality score (0-100)
   */
  calculateTempHumPayloadQuality(payload) {
    let score = 100;
    
    if (typeof payload.sensorCount !== "number") score -= 20;
    if (!Array.isArray(payload.sensorData)) score -= 30;
    
    return score;
  }

  /**
   * Calculate Noise payload quality
   * @param {Object} payload - Noise payload
   * @returns {number} Quality score (0-100)
   */
  calculateNoisePayloadQuality(payload) {
    let score = 100;
    
    if (typeof payload.sensorCount !== "number") score -= 20;
    if (!Array.isArray(payload.sensorData)) score -= 30;
    
    return score;
  }

  /**
   * Calculate Color payload quality
   * @param {Object} payload - Color payload
   * @returns {number} Quality score (0-100)
   */
  calculateColorPayloadQuality(payload) {
    let score = 100;
    
    if (typeof payload.positionCount !== "number") score -= 20;
    if (!Array.isArray(payload.positionData)) score -= 30;
    
    return score;
  }

  /**
   * Calculate Door payload quality
   * @param {Object} payload - Door payload
   * @returns {number} Quality score (0-100)
   */
  calculateDoorPayloadQuality(payload) {
    let score = 100;
    
    if (typeof payload.status !== "string") score -= 50;
    
    return score;
  }

  /**
   * Check if timestamp is valid
   * @param {string} timestamp - Timestamp string
   * @returns {boolean} True if valid
   */
  isValidTimestamp(timestamp) {
    const date = new Date(timestamp);
    return !isNaN(date.getTime());
  }

  /**
   * Update configuration
   * @param {Object} newConfig - New configuration
   */
  updateConfig(newConfig) {
    this.config = { ...this.config, ...newConfig };
    logger.info("Message enhancer configuration updated");
  }
}

module.exports = MessageEnhancer;