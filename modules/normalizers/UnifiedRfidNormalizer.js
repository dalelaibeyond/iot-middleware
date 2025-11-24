const logger = require("../../utils/logger");
const { colorJson } = require("../../utils/colorJson");

/**
 * Unified RFID Normalizer that provides consistent message format
 * and state management for both V5008 and V6800 devices
 */
class UnifiedRfidNormalizer {
  constructor() {
    // Device state storage: deviceId -> moduleStates Map
    this.deviceStates = new Map();
    // State history: deviceId-modNum -> previous state
    this.stateHistory = new Map();
    
    // Reference to existing parsers
    this.v5008Parser = require("./v5008Parser");
    this.v6800Parser = require("./v6800Parser");
  }

  /**
   * Extract device ID from MQTT topic
   * @param {string} topic - MQTT topic
   * @returns {string} Device ID
   */
  extractDeviceId(topic) {
    const parts = topic.split('/');
    return parts[1] || "unknown";
  }

  /**
   * Create module key for state tracking
   * @param {string} deviceId - Device ID
   * @param {number} modNum - Module number
   * @returns {string} Module key
   */
  extractModuleKey(deviceId, modNum) {
    return `${deviceId}-${modNum}`;
  }

  /**
   * Normalize RFID message based on device type
   * @param {string} topic - MQTT topic
   * @param {Buffer|string|Object} message - Raw message
   * @param {string} deviceType - Device type (V5008 or V6800)
   * @param {Object} meta - Additional metadata
   * @returns {Object|Array} Normalized message(s)
   */
  normalize(topic, message, deviceType, meta = {}) {
    switch (deviceType) {
      case "V5008":
        return this.normalizeV5008Rfid(topic, message, meta);
      case "V6800":
        return this.normalizeV6800Rfid(topic, message, meta);
      default:
        throw new Error(`Unsupported device type: ${deviceType}`);
    }
  }

  /**
   * Normalize V5008 RFID message to unified format
   * @param {string} topic - MQTT topic
   * @param {Buffer} message - Raw message buffer
   * @param {Object} meta - Additional metadata
   * @returns {Object} Normalized RFID message with events
   */
  normalizeV5008Rfid(topic, message, meta = {}) {
    // Parse using existing V5008 parser
    const normalized = this.v5008Parser.parse(topic, message, meta);
    
    if (!normalized || normalized.msgType !== "Rfid") {
      return normalized; // Return as-is if not an RFID message
    }

    const deviceId = normalized.deviceId;
    const modNum = normalized.modNum;

    // Get or create device module states
    if (!this.deviceStates.has(deviceId)) {
      this.deviceStates.set(deviceId, new Map());
    }
    const moduleStates = this.deviceStates.get(deviceId);

    // Get previous state for this module
    const moduleKey = this.extractModuleKey(deviceId, modNum);
    const previousState = this.stateHistory.get(moduleKey);

    // Create current state with consistent field names
    const currentState = {
      uCount: normalized.payload.uCount,
      rfidCount: normalized.payload.rfidCount,
      rfidData: normalized.payload.rfidData.map(tag => ({
        position: tag.num, // Normalize field name
        rfid: tag.rfid,
        state: "attached",
        lastChanged: new Date().toISOString(),
        alarm: tag.alarm
      }))
    };

    // Calculate changes by comparing with previous state
    const changes = this.calculateChanges(previousState, currentState);

    // Store current state for future comparison
    moduleStates.set(modNum, {
      uCount: currentState.uCount,
      rfidCount: currentState.rfidCount,
      rfidData: currentState.rfidData
    });
    this.stateHistory.set(moduleKey, {
      uCount: currentState.uCount,
      rfidCount: currentState.rfidCount,
      rfidData: currentState.rfidData
    });

    // Return unified format with changes
    return {
      ...normalized,
      payload: {
        uCount: currentState.uCount,
        rfidCount: currentState.rfidCount,
        rfidData: currentState.rfidData
      },
      previousState: previousState || null,
      changes: changes.length > 0 ? changes : null
    };
  }

  /**
   * Normalize V6800 RFID message to unified format with state management
   * @param {string} topic - MQTT topic
   * @param {string|Object|Buffer} message - Raw message
   * @param {Object} meta - Additional metadata
   * @returns {Object|Array} Normalized RFID message(s) with complete state
   */
  normalizeV6800Rfid(topic, message, meta = {}) {
    // Parse using existing V6800 parser
    const parsed = this.v6800Parser.parse(topic, message, meta);

    if (!parsed) {
      return parsed;
    }

    // Handle array of messages (multiple modules)
    if (Array.isArray(parsed)) {
      return parsed.map(msg => this.processV6800ModuleMessage(msg, topic, meta));
    } else {
      return this.processV6800ModuleMessage(parsed, topic, meta);
    }
  }

  /**
   * Process individual V6800 module message
   * @param {Object} message - Parsed V6800 message
   * @param {string} topic - Original MQTT topic
   * @param {Object} meta - Additional metadata
   * @returns {Object} Enhanced message with complete state
   */
  processV6800ModuleMessage(message, topic, meta = {}) {
    // Only process RFID messages
    if (message.msgType !== "Rfid") {
      return message;
    }

    const deviceId = message.deviceId;
    const modNum = message.modNum;

    // Get or create device module states
    if (!this.deviceStates.has(deviceId)) {
      this.deviceStates.set(deviceId, new Map());
    }
    const moduleStates = this.deviceStates.get(deviceId);

    // Get previous state for this module
    const moduleKey = this.extractModuleKey(deviceId, modNum);
    const previousState = this.stateHistory.get(moduleKey);

    // Initialize or get current state
    const currentState = moduleStates.get(modNum) || this.createEmptyState();

    // Process RFID changes from V6800 event-based message
    if (message.payload && message.payload.rfidData) {
      message.payload.rfidData.forEach(change => {
        const position = change.num;

        if (change.action === "attached") {
          // Add or update RFID tag
          currentState.rfidMap.set(position, {
            position,
            rfid: change.rfid,
            state: "attached",
            lastChanged: new Date().toISOString(),
            alarm: change.alarm
          });
        } else if (change.action === "detached") {
          // Remove RFID tag
          currentState.rfidMap.delete(position);
        }
      });
    }

    // Update module counts
    currentState.uCount = message.payload.uCount || currentState.uCount;
    currentState.rfidCount = currentState.rfidMap.size;

    // Convert Map to array for consistent format
    const rfidDataArray = Array.from(currentState.rfidMap.values());

    // Calculate changes for this update
    const changes = this.calculateChanges(previousState, {
      uCount: currentState.uCount,
      rfidCount: currentState.rfidCount,
      rfidData: rfidDataArray
    });

    // Store updated state
    moduleStates.set(modNum, currentState);
    this.stateHistory.set(moduleKey, currentState);

    // Return enhanced message with complete state
    return {
      ...message,
      payload: {
        uCount: currentState.uCount,
        rfidCount: currentState.rfidCount,
        rfidData: rfidDataArray
      },
      previousState: previousState || null,
      changes: changes.length > 0 ? changes : null
    };
  }

  /**
   * Calculate changes between previous and current RFID state
   * @param {Object|null} previousState - Previous state
   * @param {Object} currentState - Current state
   * @returns {Array} Array of change objects
   */
  calculateChanges(previousState, currentState) {
    if (!previousState) {
      // No previous state, all current tags are new
      return currentState.rfidData.map(tag => ({
        position: tag.position,
        rfid: tag.rfid,
        action: "attached",
        timestamp: new Date().toISOString(),
        previousRfid: null,
        currentRfid: tag.rfid
      }));
    }

    const previousRfidMap = new Map(
      previousState.rfidData.map(tag => [tag.position, tag.rfid])
    );

    const changes = [];

    // Check for new or changed tags
    currentState.rfidData.forEach(currentTag => {
      const previousRfid = previousRfidMap.get(currentTag.position);

      if (!previousRfid) {
        // New tag attached
        changes.push({
          position: currentTag.position,
          rfid: currentTag.rfid,
          action: "attached",
          timestamp: new Date().toISOString(),
          previousRfid: null,
          currentRfid: currentTag.rfid
        });
      } else if (previousRfid !== currentTag.rfid) {
        // Tag changed
        changes.push({
          position: currentTag.position,
          rfid: currentTag.rfid,
          action: "changed",
          timestamp: new Date().toISOString(),
          previousRfid: previousRfid,
          currentRfid: currentTag.rfid
        });
      }
    });

    // Check for detached tags
    previousRfidMap.forEach((previousRfid, position) => {
      const stillAttached = currentState.rfidData.some(tag => tag.position === position);

      if (!stillAttached) {
        changes.push({
          position: position,
          rfid: previousRfid,
          action: "detached",
          timestamp: new Date().toISOString(),
          previousRfid: previousRfid,
          currentRfid: null
        });
      }
    });

    return changes;
  }

  /**
   * Create empty state structure for a new module
   * @returns {Object} Empty state object
   */
  createEmptyState() {
    return {
      uCount: 0,
      rfidCount: 0,
      rfidMap: new Map() // position -> rfid data
    };
  }

  /**
   * Get current state for a specific device module
   * @param {string} deviceId - Device ID
   * @param {number} modNum - Module number
   * @returns {Object|null} Current state or null if not found
   */
  getCurrentState(deviceId, modNum) {
    const moduleStates = this.deviceStates.get(deviceId);
    if (!moduleStates) return null;

    const state = moduleStates.get(modNum);
    if (!state) return null;

    // Convert Map to array for consistent format
    return {
      uCount: state.uCount,
      rfidCount: state.rfidCount,
      rfidData: state.rfidMap ? Array.from(state.rfidMap.values()) : []
    };
  }

  /**
   * Clear state for a specific device or module
   * @param {string} deviceId - Device ID
   * @param {number|null} modNum - Module number (null for all modules)
   */
  clearState(deviceId, modNum = null) {
    if (modNum === null) {
      // Clear all modules for this device
      this.deviceStates.delete(deviceId);
      
      // Clear state history for all modules of this device
      for (const key of this.stateHistory.keys()) {
        if (key.startsWith(`${deviceId}-`)) {
          this.stateHistory.delete(key);
        }
      }
    } else {
      // Clear specific module
      const moduleStates = this.deviceStates.get(deviceId);
      if (moduleStates) {
        moduleStates.delete(modNum);
      }
      
      const moduleKey = this.extractModuleKey(deviceId, modNum);
      this.stateHistory.delete(moduleKey);
    }
  }

  /**
   * Get statistics about the normalizer state
   * @returns {Object} Statistics object
   */
  getStats() {
    const deviceCount = this.deviceStates.size;
    let moduleCount = 0;
    let totalRfidCount = 0;

    for (const [deviceId, moduleStates] of this.deviceStates) {
      moduleCount += moduleStates.size;
      for (const [modNum, state] of moduleStates) {
        // Handle both V5008 and V6800 state formats
        if (state.rfidMap) {
          // V6800 format with Map
          totalRfidCount += state.rfidMap.size;
        } else {
          // V5008 format with array
          totalRfidCount += state.rfidCount || 0;
        }
      }
    }

    return {
      deviceCount,
      moduleCount,
      totalRfidCount,
      stateHistorySize: this.stateHistory.size
    };
  }
}

module.exports = UnifiedRfidNormalizer;