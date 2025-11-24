const logger = require("../../../utils/logger");

/**
 * Base State Manager that provides common functionality
 * for all message type state managers
 */
class BaseStateManager {
  constructor() {
    // State storage: deviceId -> moduleStates Map
    this.deviceStates = new Map();
    // State history: deviceId-modNum -> previous state
    this.stateHistory = new Map();
    // State change history: deviceId-modNum -> array of changes
    this.changeHistory = new Map();
  }

  /**
   * Create module key for state tracking
   * @param {string} deviceId - Device ID
   * @param {number} modNum - Module number
   * @returns {string} Module key
   */
  createModuleKey(deviceId, modNum) {
    return `${deviceId}-${modNum}`;
  }

  /**
   * Get or create device module states
   * @param {string} deviceId - Device ID
   * @returns {Map} Module states map
   */
  getOrCreateDeviceStates(deviceId) {
    if (!this.deviceStates.has(deviceId)) {
      this.deviceStates.set(deviceId, new Map());
    }
    return this.deviceStates.get(deviceId);
  }

  /**
   * Get previous state for a module
   * @param {string} deviceId - Device ID
   * @param {number} modNum - Module number
   * @returns {Object|null} Previous state or null if not found
   */
  getPreviousState(deviceId, modNum) {
    const moduleKey = this.createModuleKey(deviceId, modNum);
    const previousState = this.stateHistory.get(moduleKey);
    
    if (!previousState) {
      return null;
    }
    
    // Handle different state manager formats
    if (previousState.rfidMap) {
      // RfidStateManager format with Map
      return {
        uCount: previousState.uCount,
        rfidCount: previousState.rfidCount,
        rfidData: Array.from(previousState.rfidMap.values())
      };
    }
    
    // Default format
    return previousState;
  }

  /**
   * Store current state as previous state for next comparison
   * @param {string} deviceId - Device ID
   * @param {number} modNum - Module number
   * @param {Object} currentState - Current state to store
   */
  storePreviousState(deviceId, modNum, currentState) {
    const moduleKey = this.createModuleKey(deviceId, modNum);
    this.stateHistory.set(moduleKey, currentState);
  }

  /**
   * Add change to history
   * @param {string} deviceId - Device ID
   * @param {number} modNum - Module number
   * @param {Object} change - Change object
   */
  addChangeToHistory(deviceId, modNum, change) {
    const moduleKey = this.createModuleKey(deviceId, modNum);
    
    if (!this.changeHistory.has(moduleKey)) {
      this.changeHistory.set(moduleKey, []);
    }
    
    const history = this.changeHistory.get(moduleKey);
    history.push({
      ...change,
      timestamp: change.timestamp || new Date().toISOString()
    });
    
    // Limit history size to prevent memory issues
    const maxHistorySize = 100;
    if (history.length > maxHistorySize) {
      history.splice(0, history.length - maxHistorySize);
    }
  }

  /**
   * Get state change history for a module
   * @param {string} deviceId - Device ID
   * @param {number} modNum - Module number
   * @param {Object} options - Options for filtering history
   * @returns {Array} Array of change objects
   */
  getChangeHistory(deviceId, modNum, options = {}) {
    const moduleKey = this.createModuleKey(deviceId, modNum);
    const history = this.changeHistory.get(moduleKey) || [];
    
    let filteredHistory = history;
    
    // Filter by time range if specified
    if (options.startTime) {
      const startTime = new Date(options.startTime);
      filteredHistory = filteredHistory.filter(
        change => new Date(change.timestamp) >= startTime
      );
    }
    
    if (options.endTime) {
      const endTime = new Date(options.endTime);
      filteredHistory = filteredHistory.filter(
        change => new Date(change.timestamp) <= endTime
      );
    }
    
    // Limit number of results if specified
    if (options.limit && options.limit > 0) {
      filteredHistory = filteredHistory.slice(-options.limit);
    }
    
    return filteredHistory;
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
      
      // Clear change history for all modules of this device
      for (const key of this.changeHistory.keys()) {
        if (key.startsWith(`${deviceId}-`)) {
          this.changeHistory.delete(key);
        }
      }
    } else {
      // Clear specific module
      const moduleStates = this.deviceStates.get(deviceId);
      if (moduleStates) {
        moduleStates.delete(modNum);
      }
      
      const moduleKey = this.createModuleKey(deviceId, modNum);
      this.stateHistory.delete(moduleKey);
      this.changeHistory.delete(moduleKey);
    }
  }

  /**
   * Clear all state across all devices
   */
  clearAllState() {
    this.deviceStates.clear();
    this.stateHistory.clear();
    this.changeHistory.clear();
  }

  /**
   * Get statistics about the state manager
   * @returns {Object} Statistics object
   */
  getStats() {
    const deviceCount = this.deviceStates.size;
    let moduleCount = 0;
    let totalHistoryEntries = 0;

    for (const [deviceId, moduleStates] of this.deviceStates) {
      moduleCount += moduleStates.size;
    }

    for (const [key, history] of this.changeHistory) {
      totalHistoryEntries += history.length;
    }

    return {
      deviceCount,
      moduleCount,
      totalHistoryEntries,
      stateHistorySize: this.stateHistory.size,
      changeHistorySize: this.changeHistory.size
    };
  }

  /**
   * Abstract method to be implemented by subclasses
   * Update state with new message
   * @param {string} deviceId - Device ID
   * @param {number} modNum - Module number
   * @param {Object} message - Normalized message
   */
  updateState(deviceId, modNum, message) {
    throw new Error("updateState method must be implemented by subclass");
  }

  /**
   * Abstract method to be implemented by subclasses
   * Get current state for a specific device module
   * @param {string} deviceId - Device ID
   * @param {number} modNum - Module number
   * @returns {Object|null} Current state or null if not found
   */
  getCurrentState(deviceId, modNum) {
    throw new Error("getCurrentState method must be implemented by subclass");
  }
}

module.exports = BaseStateManager;