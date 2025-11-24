const BaseStateManager = require("./BaseStateManager");
const logger = require("../../../utils/logger");

/**
 * RFID State Manager that tracks RFID tag states across devices
 */
class RfidStateManager extends BaseStateManager {
  constructor() {
    super();
    this.type = "Rfid";
  }

  /**
   * Update state with new RFID message
   * @param {string} deviceId - Device ID
   * @param {number} modNum - Module number
   * @param {Object} message - Normalized RFID message
   */
  updateState(deviceId, modNum, message) {
    try {
      // Get or create device module states
      const moduleStates = this.getOrCreateDeviceStates(deviceId);
      
      // Get previous state for this module
      const moduleKey = this.createModuleKey(deviceId, modNum);
      const previousState = this.getPreviousState(deviceId, modNum);
      
      // Create current state with consistent structure
      const currentState = this.createCurrentState(message);
      
      // Calculate changes by comparing with previous state
      const changes = this.calculateChanges(previousState, currentState);
      
      // Store current state for future comparison
      moduleStates.set(modNum, currentState);
      this.storePreviousState(deviceId, modNum, currentState);
      
      // Add changes to history
      changes.forEach(change => {
        this.addChangeToHistory(deviceId, modNum, change);
      });
      
      logger.debug(`RFID state updated for device ${deviceId}, module ${modNum}`, {
        uCount: currentState.uCount,
        rfidCount: currentState.rfidCount,
        changesCount: changes.length
      });
      
    } catch (error) {
      logger.error(`Failed to update RFID state for ${deviceId}-${modNum}:`, error);
    }
  }

  /**
   * Create current state structure from message
   * @param {Object} message - Normalized message
   * @returns {Object} Current state object
   */
  createCurrentState(message) {
    const state = {
      uCount: message.payload.uCount || 0,
      rfidCount: message.payload.rfidCount || 0,
      rfidMap: new Map(), // position -> rfid data
      lastUpdated: new Date().toISOString()
    };
    
    // Convert rfidData array to Map for efficient lookup
    if (message.payload.rfidData && Array.isArray(message.payload.rfidData)) {
      message.payload.rfidData.forEach(tag => {
        state.rfidMap.set(tag.position, {
          position: tag.position,
          rfid: tag.rfid,
          state: tag.state || "attached",
          lastChanged: tag.lastChanged || new Date().toISOString(),
          alarm: tag.alarm || 0
        });
      });
    }
    
    return state;
  }

  /**
   * Get current state for a specific device module
   * @param {string} deviceId - Device ID
   * @param {number} modNum - Module number
   * @returns {Object|null} Current state or null if not found
   */
  getCurrentState(deviceId, modNum) {
    try {
      const moduleStates = this.deviceStates.get(deviceId);
      if (!moduleStates) return null;
      
      const state = moduleStates.get(modNum);
      if (!state) return null;
      
      // Convert Map to array for consistent format
      return {
        uCount: state.uCount,
        rfidCount: state.rfidCount,
        rfidData: Array.from(state.rfidMap.values()),
        lastUpdated: state.lastUpdated
      };
    } catch (error) {
      logger.error(`Failed to get RFID current state for ${deviceId}-${modNum}:`, error);
      return null;
    }
  }

  /**
   * Calculate changes between previous and current RFID state
   * @param {Object|null} previousState - Previous state
   * @param {Object} currentState - Current state
   * @returns {Array} Array of change objects
   */
  calculateChanges(previousState, currentState) {
    const changes = [];
    
    if (!previousState) {
      // No previous state, all current tags are new
      currentState.rfidMap.forEach((tag, position) => {
        changes.push({
          position,
          rfid: tag.rfid,
          action: "attached",
          timestamp: new Date().toISOString(),
          previousRfid: null,
          currentRfid: tag.rfid
        });
      });
      
      return changes;
    }
    
    const previousRfidMap = previousState.rfidMap || new Map();
    
    // Check for new or changed tags
    currentState.rfidMap.forEach((currentTag, position) => {
      const previousTag = previousRfidMap.get(position);
      
      if (!previousTag) {
        // New tag attached
        changes.push({
          position,
          rfid: currentTag.rfid,
          action: "attached",
          timestamp: new Date().toISOString(),
          previousRfid: null,
          currentRfid: currentTag.rfid
        });
      } else if (previousTag.rfid !== currentTag.rfid) {
        // Tag changed
        changes.push({
          position,
          rfid: currentTag.rfid,
          action: "changed",
          timestamp: new Date().toISOString(),
          previousRfid: previousTag.rfid,
          currentRfid: currentTag.rfid
        });
      } else if (previousTag.alarm !== currentTag.alarm) {
        // Alarm status changed
        changes.push({
          position,
          rfid: currentTag.rfid,
          action: "alarm_changed",
          timestamp: new Date().toISOString(),
          previousAlarm: previousTag.alarm,
          currentAlarm: currentTag.alarm
        });
      }
    });
    
    // Check for detached tags
    previousRfidMap.forEach((previousTag, position) => {
      const stillAttached = currentState.rfidMap.has(position);
      
      if (!stillAttached) {
        changes.push({
          position,
          rfid: previousTag.rfid,
          action: "detached",
          timestamp: new Date().toISOString(),
          previousRfid: previousTag.rfid,
          currentRfid: null
        });
      }
    });
    
    return changes;
  }

  /**
   * Get RFID tag history for a specific position
   * @param {string} deviceId - Device ID
   * @param {number} modNum - Module number
   * @param {number} position - RFID position
   * @param {Object} options - Options for filtering
   * @returns {Array} Array of position-specific changes
   */
  getPositionHistory(deviceId, modNum, position, options = {}) {
    const history = this.getChangeHistory(deviceId, modNum, options);
    return history.filter(change => change.position === position);
  }

  /**
   * Get all RFID tags currently attached to a device module
   * @param {string} deviceId - Device ID
   * @param {number} modNum - Module number
   * @returns {Array} Array of RFID tags
   */
  getCurrentTags(deviceId, modNum) {
    const currentState = this.getCurrentState(deviceId, modNum);
    return currentState ? currentState.rfidData : [];
  }

  /**
   * Check if a specific RFID tag is currently attached
   * @param {string} deviceId - Device ID
   * @param {number} modNum - Module number
   * @param {string} rfid - RFID tag to check
   * @returns {Object|null} Tag information or null if not found
   */
  findTag(deviceId, modNum, rfid) {
    const currentState = this.getCurrentState(deviceId, modNum);
    if (!currentState || !currentState.rfidData) return null;
    
    return currentState.rfidData.find(tag => tag.rfid === rfid) || null;
  }

  /**
   * Get statistics about RFID state for a device module
   * @param {string} deviceId - Device ID
   * @param {number} modNum - Module number
   * @returns {Object} Statistics object
   */
  getModuleStats(deviceId, modNum) {
    const currentState = this.getCurrentState(deviceId, modNum);
    const history = this.getChangeHistory(deviceId, modNum);
    
    if (!currentState) {
      return {
        uCount: 0,
        rfidCount: 0,
        totalChanges: 0,
        lastActivity: null
      };
    }
    
    // Calculate activity statistics
    const attachments = history.filter(change => change.action === "attached").length;
    const detachments = history.filter(change => change.action === "detached").length;
    const changes = history.filter(change => change.action === "changed").length;
    
    return {
      uCount: currentState.uCount,
      rfidCount: currentState.rfidCount,
      totalChanges: history.length,
      attachments,
      detachments,
      changes,
      lastActivity: history.length > 0 ? history[history.length - 1].timestamp : null
    };
  }

  /**
   * Get all positions for a device module
   * @param {string} deviceId - Device ID
   * @param {number} modNum - Module number
   * @returns {Array} Array of position numbers
   */
  getAllPositions(deviceId, modNum) {
    const currentState = this.getCurrentState(deviceId, modNum);
    if (!currentState || !currentState.rfidData) return [];
    
    return currentState.rfidData.map(tag => tag.position);
  }

  /**
   * Get empty positions for a device module
   * @param {string} deviceId - Device ID
   * @param {number} modNum - Module number
   * @returns {Array} Array of empty position numbers
   */
  getEmptyPositions(deviceId, modNum) {
    const currentState = this.getCurrentState(deviceId, modNum);
    if (!currentState) return [];
    
    const allPositions = [];
    for (let i = 1; i <= currentState.uCount; i++) {
      allPositions.push(i);
    }
    
    const occupiedPositions = currentState.rfidData.map(tag => tag.position);
    
    return allPositions.filter(pos => !occupiedPositions.includes(pos));
  }
}

module.exports = RfidStateManager;