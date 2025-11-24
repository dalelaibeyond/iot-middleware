const logger = require("../../utils/logger");
const eventBus = require("../core/eventBus");

/**
 * Unified Normalizer that provides consistent message format
 * and state management for all device types and message types
 */
class UnifiedNormalizer {
  constructor(config = {}) {
    // Configuration
    this.config = {
      version: "1.0.0",
      enableStatePersistence: true,
      stateRetentionDays: 30,
      events: {
        enabled: true,
        emitStateChanges: true,
        emitQueries: true,
        bufferSize: 1000
      },
      ...config
    };
    
    // State managers for different message types
    this.stateManagers = new Map();
    
    // Field mapper for standardizing field names
    this.fieldMapper = null;
    
    // Message enhancer for adding metadata
    this.messageEnhancer = null;
    
    // Initialize components
    this.initializeComponents();
  }

  /**
   * Initialize core components
   */
  initializeComponents() {
    // Import and initialize components dynamically to avoid circular dependencies
    try {
      const StateManagerFactory = require("./stateManagers/StateManagerFactory");
      this.stateManagerFactory = new StateManagerFactory();
      
      const FieldMapper = require("./utils/FieldMapper");
      this.fieldMapper = new FieldMapper();
      
      const MessageEnhancer = require("./utils/MessageEnhancer");
      this.messageEnhancer = new MessageEnhancer(this.config);
      
      logger.info("Unified normalizer components initialized successfully");
    } catch (error) {
      logger.error("Failed to initialize unified normalizer components:", error);
    }
  }

  /**
   * Normalize a message based on device type and message type
   * @param {string} topic - MQTT topic
   * @param {string|Buffer|Object} message - Raw message
   * @param {string} deviceType - Device type (V5008, V6800, G6000)
   * @param {Object} meta - Additional metadata
   * @returns {Object|Array} Normalized message(s)
   */
  normalize(topic, message, deviceType, meta = {}) {
    try {
      let parsedMessage;
      
      // Check if we already have a parsed message (to avoid circular dependency)
      if (meta && meta.originalMessage) {
        parsedMessage = meta.originalMessage;
      } else {
        // Parse the message using device-specific parser
        parsedMessage = this.parseWithDeviceParser(topic, message, deviceType, meta);
      }
      
      if (!parsedMessage) {
        logger.warn(`Failed to parse message with device parser for ${deviceType}`);
        return null;
      }
      
      // Handle array of messages (e.g., from V6800 multi-port devices)
      if (Array.isArray(parsedMessage)) {
        return parsedMessage.map(msg => this.processMessage(msg, deviceType, topic, meta));
      } else {
        return this.processMessage(parsedMessage, deviceType, topic, meta);
      }
    } catch (error) {
      logger.error(`Normalization failed for ${deviceType}:`, error);
      return null;
    }
  }

  /**
   * Process a single message through the unified normalization pipeline
   * @param {Object} parsedMessage - Parsed message from device parser
   * @param {string} deviceType - Device type
   * @param {string} topic - Original MQTT topic
   * @param {Object} meta - Additional metadata
   * @returns {Object} Unified normalized message
   */
  processMessage(parsedMessage, deviceType, topic, meta) {
    // Extract message type
    const msgType = parsedMessage.msgType;
    
    if (!msgType) {
      logger.warn("Message missing msgType field");
      return parsedMessage;
    }
    
    // Apply field mapping to standardize field names
    const mappedMessage = this.fieldMapper ? 
      this.fieldMapper.mapFields(parsedMessage, deviceType, msgType) : 
      parsedMessage;
    
    // Apply state management if enabled for this message type
    const stateManagedMessage = this.applyStateManagement(mappedMessage, deviceType, msgType);
    
    // Enhance message with unified metadata
    const enhancedMessage = this.messageEnhancer ? 
      this.messageEnhancer.enhance(stateManagedMessage, deviceType, topic, meta) : 
      stateManagedMessage;
    
    // Emit events if enabled
    if (this.config.events.enabled && this.config.events.emitStateChanges) {
      this.emitStateChangeEvent(enhancedMessage, deviceType);
    }
    
    return enhancedMessage;
  }

  /**
   * Parse message using device-specific parser
   * @param {string} topic - MQTT topic
   * @param {string|Buffer|Object} message - Raw message
   * @param {string} deviceType - Device type
   * @param {Object} meta - Additional metadata
   * @returns {Object|Array} Parsed message(s)
   */
  parseWithDeviceParser(topic, message, deviceType, meta) {
    try {
      let parser;
      
      switch (deviceType) {
        case "V5008":
          parser = require("./v5008Parser");
          break;
        case "V6800":
          parser = require("./v6800Parser");
          break;
        case "G6000":
          parser = require("./g6000Parser");
          break;
        default:
          logger.warn(`Unknown device type: ${deviceType}`);
          return null;
      }
      
      return parser.parse(topic, message, meta);
    } catch (error) {
      logger.error(`Device parser failed for ${deviceType}:`, error);
      return null;
    }
  }

  /**
   * Apply state management to a message
   * @param {Object} message - Message to process
   * @param {string} deviceType - Device type
   * @param {string} msgType - Message type
   * @returns {Object} Message with state management applied
   */
  applyStateManagement(message, deviceType, msgType) {
    if (!this.stateManagerFactory) {
      return message;
    }
    
    try {
      const stateManager = this.stateManagerFactory.getManager(msgType);
      
      if (!stateManager) {
        return message;
      }
      
      // Check if state management is enabled for this device and message type
      const deviceConfig = this.config.devices && this.config.devices[deviceType];
      if (deviceConfig && deviceConfig.stateManagement &&
          deviceConfig.stateManagement[msgType.toLowerCase()] === false) {
        return message;
      }
      
      // Special handling for RFID messages to filter output to only show changes
      if (msgType.toLowerCase() === 'rfid') {
        return this.applyRfidStateManagement(message, stateManager);
      }
      
      // Update state with the new message
      stateManager.updateState(message.deviceId, message.modNum, message);
      
      return message;
    } catch (error) {
      logger.error(`State management failed for ${msgType}:`, error);
      return message;
    }
  }

  /**
   * Apply RFID-specific state management to filter output to only show changes
   * @param {Object} message - RFID message to process
   * @param {Object} stateManager - RFID state manager
   * @returns {Object} Filtered message with only changes
   */
  applyRfidStateManagement(message, stateManager) {
    try {
      // Get previous state for this device/module
      const previousState = stateManager.getPreviousState(message.deviceId, message.modNum);
      
      // Update state with the new message
      stateManager.updateState(message.deviceId, message.modNum, message);
      
      // Create a filtered message with only the changes
      const filteredMessage = { ...message };
      
      // Calculate changes by comparing with previous state
      const changes = this.calculateRfidChanges(previousState, message.payload);
      
      // Filter the rfidData to only include changed items
      if (changes.length > 0) {
        filteredMessage.payload = {
          ...message.payload,
          rfidData: changes.map(change => ({
            num: change.position,
            alarm: change.alarm || 0,
            rfid: change.rfid,
            action: change.action
          }))
        };
        
        // Add change information to metadata
        filteredMessage.meta = {
          ...message.meta,
          changes: changes,
          hasChanges: true
        };
      } else {
        // No changes, return minimal message
        filteredMessage.payload = {
          uCount: message.payload.uCount,
          rfidCount: message.payload.rfidCount,
          rfidData: []
        };
        
        filteredMessage.meta = {
          ...message.meta,
          changes: [],
          hasChanges: false
        };
      }
      
      return filteredMessage;
    } catch (error) {
      logger.error(`RFID state management failed:`, error);
      return message;
    }
  }

  /**
   * Calculate changes between previous and current RFID state
   * @param {Object} previousState - Previous RFID state
   * @param {Object} currentPayload - Current RFID payload
   * @returns {Array} Array of change objects
   */
  calculateRfidChanges(previousState, currentPayload) {
    const changes = [];
    
    if (!currentPayload || !currentPayload.rfidData) {
      return changes;
    }
    
    // Create maps for efficient comparison
    const previousRfidMap = new Map();
    if (previousState && previousState.rfidData) {
      previousState.rfidData.forEach(tag => {
        previousRfidMap.set(tag.num || tag.position, tag);
      });
    }
    
    const currentRfidMap = new Map();
    currentPayload.rfidData.forEach(tag => {
      currentRfidMap.set(tag.num || tag.position, tag);
    });
    
    // Check for new or changed tags
    currentRfidMap.forEach((currentTag, position) => {
      const previousTag = previousRfidMap.get(position);
      
      if (!previousTag) {
        // New tag attached
        changes.push({
          position: position,
          rfid: currentTag.rfid,
          action: "attached",
          alarm: currentTag.alarm || 0
        });
      } else if (previousTag.rfid !== currentTag.rfid) {
        // Tag changed
        changes.push({
          position: position,
          rfid: currentTag.rfid,
          action: "changed",
          alarm: currentTag.alarm || 0
        });
      } else if (previousTag.alarm !== currentTag.alarm) {
        // Alarm status changed
        changes.push({
          position: position,
          rfid: currentTag.rfid,
          action: "alarm_changed",
          alarm: currentTag.alarm || 0
        });
      }
    });
    
    // Check for detached tags
    previousRfidMap.forEach((previousTag, position) => {
      const stillAttached = currentRfidMap.has(position);
      
      if (!stillAttached) {
        changes.push({
          position: position,
          rfid: previousTag.rfid,
          action: "detached",
          alarm: previousTag.alarm || 0
        });
      }
    });
    
    return changes;
  }

  /**
   * Emit state change event
   * @param {Object} message - Processed message
   * @param {string} deviceType - Device type
   */
  emitStateChangeEvent(message, deviceType) {
    try {
      const eventName = `unified.state.changed.${message.msgType.toLowerCase()}`;
      
      eventBus.emit(eventName, {
        deviceId: message.deviceId,
        deviceType: deviceType,
        modNum: message.modNum,
        msgType: message.msgType,
        timestamp: message.ts,
        currentState: message.payload
      });
    } catch (error) {
      logger.error("Failed to emit state change event:", error);
    }
  }

  /**
   * Get current state for a specific device module and message type
   * @param {string} deviceId - Device ID
   * @param {number} modNum - Module number
   * @param {string} msgType - Message type
   * @returns {Object|null} Current state or null if not found
   */
  getCurrentState(deviceId, modNum, msgType) {
    if (!this.stateManagerFactory) {
      return null;
    }
    
    try {
      const stateManager = this.stateManagerFactory.getManager(msgType);
      return stateManager ? stateManager.getCurrentState(deviceId, modNum) : null;
    } catch (error) {
      logger.error(`Failed to get current state for ${msgType}:`, error);
      return null;
    }
  }

  /**
   * Clear state for a specific device module and message type
   * @param {string} deviceId - Device ID
   * @param {number} modNum - Module number
   * @param {string} msgType - Message type
   */
  clearState(deviceId, modNum, msgType) {
    if (!this.stateManagerFactory) {
      return;
    }
    
    try {
      const stateManager = this.stateManagerFactory.getManager(msgType);
      if (stateManager) {
        stateManager.clearState(deviceId, modNum);
      }
    } catch (error) {
      logger.error(`Failed to clear state for ${msgType}:`, error);
    }
  }

  /**
   * Get statistics about the normalizer
   * @returns {Object} Statistics object
   */
  getStats() {
    const stats = {
      version: this.config.version,
      stateManagers: {},
      eventStats: {}
    };
    
    // Get state manager statistics
    if (this.stateManagerFactory) {
      const managerStats = this.stateManagerFactory.getStats();
      stats.stateManagers = managerStats;
    }
    
    return stats;
  }

  /**
   * Update configuration
   * @param {Object} newConfig - New configuration
   */
  updateConfig(newConfig) {
    this.config = { ...this.config, ...newConfig };
    
    // Update component configurations
    if (this.messageEnhancer) {
      this.messageEnhancer.updateConfig(this.config);
    }
    
    logger.info("Unified normalizer configuration updated");
  }
}

module.exports = UnifiedNormalizer;