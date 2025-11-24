const logger = require("../../../utils/logger");

/**
 * Factory for creating and managing state managers for different message types
 */
class StateManagerFactory {
  constructor() {
    this.managers = new Map();
    this.initializeManagers();
  }

  /**
   * Initialize state managers for all supported message types
   */
  initializeManagers() {
    try {
      // Import and create state managers for each message type
      this.managers.set("Rfid", new (require("./RfidStateManager"))());
      this.managers.set("TempHum", new (require("./TempHumStateManager"))());
      this.managers.set("Noise", new (require("./NoiseStateManager"))());
      this.managers.set("Color", new (require("./ColorStateManager"))());
      this.managers.set("Door", new (require("./DoorStateManager"))());
      this.managers.set("DeviceInfo", new (require("./DeviceInfoStateManager"))());
      this.managers.set("ModuleInfo", new (require("./DeviceInfoStateManager"))());
      this.managers.set("DevModInfo", new (require("./DeviceInfoStateManager"))());
      
      logger.info("All state managers initialized successfully");
    } catch (error) {
      logger.error("Failed to initialize state managers:", error);
    }
  }

  /**
   * Get state manager for a specific message type
   * @param {string} msgType - Message type
   * @returns {StateManager|null} State manager instance or null if not found
   */
  getManager(msgType) {
    return this.managers.get(msgType) || null;
  }

  /**
   * Register a new state manager
   * @param {string} msgType - Message type
   * @param {StateManager} manager - State manager instance
   */
  registerManager(msgType, manager) {
    this.managers.set(msgType, manager);
    logger.info(`Registered state manager for message type: ${msgType}`);
  }

  /**
   * Unregister a state manager
   * @param {string} msgType - Message type
   * @returns {boolean} True if manager was removed, false if not found
   */
  unregisterManager(msgType) {
    const removed = this.managers.delete(msgType);
    if (removed) {
      logger.info(`Unregistered state manager for message type: ${msgType}`);
    }
    return removed;
  }

  /**
   * Get all registered state managers
   * @returns {Array} Array of manager info objects
   */
  getAllManagers() {
    return Array.from(this.managers.entries()).map(([msgType, manager]) => ({
      msgType,
      className: manager.constructor.name,
      stats: manager.getStats ? manager.getStats() : null
    }));
  }

  /**
   * Get statistics for all state managers
   * @returns {Object} Statistics object
   */
  getStats() {
    const stats = {
      totalManagers: this.managers.size,
      managers: {}
    };

    for (const [msgType, manager] of this.managers) {
      stats.managers[msgType] = manager.getStats ? manager.getStats() : {};
    }

    return stats;
  }

  /**
   * Clear all state across all managers
   */
  clearAllState() {
    for (const [msgType, manager] of this.managers) {
      try {
        if (manager.clearAllState) {
          manager.clearAllState();
        }
      } catch (error) {
        logger.error(`Failed to clear state for ${msgType} manager:`, error);
      }
    }
    logger.info("All state cleared across all managers");
  }
}

module.exports = StateManagerFactory;