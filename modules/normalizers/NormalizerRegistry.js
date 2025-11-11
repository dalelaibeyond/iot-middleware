const logger = require("../../utils/logger");
const eventBus = require("../core/eventBus");

class NormalizerRegistry {
  constructor() {
    this.parsers = new Map();
    this.defaultParser = null;
    this.loadDefaultParsers();
  }

  /**
   * Load default parsers
   */
  loadDefaultParsers() {
    // Register default parsers
    this.registerParser("V5008", require("./v5008Parser"));
    this.registerParser("V6800", require("./v6800Parser"));
    this.registerParser("G6000", require("./g6000Parser"));
  }

  /**
   * Register a parser for a device type
   * @param {string} deviceType - Device type (e.g., "V5008", "V6800")
   * @param {Object} parser - Parser object with parse function
   * @param {Object} options - Parser options
   */
  registerParser(deviceType, parser, options = {}) {
    if (!parser || typeof parser.parse !== "function") {
      throw new Error(`Parser for ${deviceType} must have a parse function`);
    }

    this.parsers.set(deviceType, {
      parser,
      version: options.version || "1.0.0",
      description: options.description || `Parser for ${deviceType} devices`,
      enabled: options.enabled !== false
    });

    logger.info(`Registered parser for device type: ${deviceType}`);
  }

  /**
   * Unregister a parser
   * @param {string} deviceType - Device type
   */
  unregisterParser(deviceType) {
    const removed = this.parsers.delete(deviceType);
    if (removed) {
      logger.info(`Unregistered parser for device type: ${deviceType}`);
    }
    return removed;
  }

  /**
   * Get parser for a device type
   * @param {string} deviceType - Device type
   * @returns {Object|null} - Parser object or null if not found
   */
  getParser(deviceType) {
    const parserInfo = this.parsers.get(deviceType);
    return parserInfo && parserInfo.enabled ? parserInfo.parser : null;
  }

  /**
   * Get all registered parsers
   * @returns {Array} - Array of parser info objects
   */
  getAllParsers() {
    return Array.from(this.parsers.entries()).map(([deviceType, info]) => ({
      deviceType,
      version: info.version,
      description: info.description,
      enabled: info.enabled
    }));
  }

  /**
   * Enable or disable a parser
   * @param {string} deviceType - Device type
   * @param {boolean} enabled - Enable or disable
   */
  setParserEnabled(deviceType, enabled) {
    const parserInfo = this.parsers.get(deviceType);
    if (parserInfo) {
      parserInfo.enabled = enabled;
      logger.info(`${enabled ? "Enabled" : "Disabled"} parser for device type: ${deviceType}`);
      return true;
    }
    return false;
  }

  /**
   * Set default parser for unknown device types
   * @param {Object} parser - Default parser object
   */
  setDefaultParser(parser) {
    if (parser && typeof parser.parse === "function") {
      this.defaultParser = parser;
      logger.info("Set default parser for unknown device types");
    } else {
      throw new Error("Default parser must have a parse function");
    }
  }

  /**
   * Normalize a message
   * @param {string} topic - MQTT topic
   * @param {string|Buffer} message - Message payload
   * @param {Object} meta - Additional metadata
   * @returns {Object|null} - Normalized message or null if parsing failed
   */
  normalize(topic, message, meta = {}) {
    try {
      // Extract device type from topic
      const topicParts = topic.split("/");
      const deviceType = topicParts[0].slice(0, 5); // V5008, V6800, G6000 (remove "Upload")

      // Get appropriate parser
      const parser = this.getParser(deviceType);
      
      if (!parser) {
        logger.warn(`No parser found for device type: ${deviceType}`);
        
        // Use default parser if available
        if (this.defaultParser) {
          return this.defaultParser.parse(topic, message, meta);
        }
        
        // Return basic normalized message for unknown device types
        const basicMessage = this.createBasicNormalizedMessage(topic, message, deviceType, meta);
        if (!basicMessage) {
          logger.warn(`Failed to create basic normalized message for topic: ${topic}`);
          return null;
        }
        return basicMessage;
      }

      // Parse message with device-specific parser
      const normalizedMessage = parser.parse(topic, message, meta);
      
      if (normalizedMessage) {
        // Handle array of messages (e.g., from V6800 multi-port devices)
        if (Array.isArray(normalizedMessage)) {
          // Add metadata to each message in the array
          const messagesWithMeta = normalizedMessage.map(msg => ({
            ...msg,
            meta: {
              ...msg.meta,
              //normalizedBy: deviceType,
              //normalizedAt: new Date().toISOString(),
              //parserVersion: this.parsers.get(deviceType).version
            }
          }));
          
          // Log info about the first message for debugging
          if (messagesWithMeta.length > 0) {
            logger.debug(`Message normalized for device type: ${deviceType}`, {
              deviceId: messagesWithMeta[0].deviceId,
              sensorType: messagesWithMeta[0].sensorType,
              messageCount: messagesWithMeta.length
            });
          }
          
          return messagesWithMeta;
        } else {
          // Single message
          normalizedMessage.meta = {
            ...normalizedMessage.meta,
            //normalizedBy: deviceType,
            //normalizedAt: new Date().toISOString(),
            //parserVersion: this.parsers.get(deviceType).version
          };
          
          logger.debug(`Message normalized for device type: ${deviceType}`, {
            deviceId: normalizedMessage.deviceId,
            sensorType: normalizedMessage.sensorType
          });
          
          return normalizedMessage;
        }
      }

      logger.warn(`Parser for device type ${deviceType} returned null`);
      return null;
    } catch (error) {
      logger.error(`Normalization failed for topic ${topic}:`, error);
      return null;
    }
  }

  /**
   * Create a basic normalized message for unknown device types
   * @param {string} topic - MQTT topic
   * @param {string|Buffer} message - Message payload
   * @param {string} deviceType - Device type
   * @param {Object} meta - Additional metadata
   * @returns {Object} - Basic normalized message
   */
  createBasicNormalizedMessage(topic, message, deviceType, meta) {
    const topicParts = topic.split("/");
    const gatewayId = topicParts[1];
    const sensorType = topicParts[2];

    // If we can't extract a valid gateway ID from the topic, don't create a message
    if (!gatewayId || gatewayId === "unknown" || gatewayId === "") {
      logger.warn(`Cannot extract valid device ID from topic: ${topic}`);
      return null;
    }

    return {
      deviceId: gatewayId,
      deviceType: deviceType,
      sensorType: sensorType || "unknown",
      sensorId: `${gatewayId}-${sensorType || "unknown"}`,
      ts: new Date().toISOString(),
      payload: typeof message === "string" ? message : message.toString(),
      meta: {
        rawTopic: topic,
        deviceType: deviceType,
        normalizedBy: "default",
        normalizedAt: new Date().toISOString(),
        ...meta
      }
    };
  }

  /**
   * Get statistics about the registry
   * @returns {Object} - Statistics object
   */
  getStats() {
    const total = this.parsers.size;
    const enabled = Array.from(this.parsers.values()).filter(p => p.enabled).length;
    
    return {
      totalParsers: total,
      enabledParsers: enabled,
      disabledParsers: total - enabled,
      hasDefaultParser: !!this.defaultParser
    };
  }
}

// Create and export singleton instance
const normalizerRegistry = new NormalizerRegistry();

module.exports = normalizerRegistry;