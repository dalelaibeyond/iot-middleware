const BaseStateManager = require("./BaseStateManager");
const logger = require("../../../utils/logger");

/**
 * Device/Module Info State Manager that tracks device and module information
 */
class DeviceInfoStateManager extends BaseStateManager {
  constructor() {
    super();
    this.type = "DeviceInfo";
  }

  /**
   * Update state with new Device/Module info message
   * @param {string} deviceId - Device ID
   * @param {number} modNum - Module number
   * @param {Object} message - Normalized Device/Module info message
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
      
      logger.debug(`Device/Module info state updated for device ${deviceId}, module ${modNum}`, {
        infoType: currentState.infoType,
        changesCount: changes.length
      });
      
    } catch (error) {
      logger.error(`Failed to update Device/Module info state for ${deviceId}-${modNum}:`, error);
    }
  }

  /**
   * Create current state structure from message
   * @param {Object} message - Normalized message
   * @returns {Object} Current state object
   */
  createCurrentState(message) {
    const state = {
      infoType: message.msgType,
      data: message.payload || {},
      lastUpdated: new Date().toISOString()
    };
    
    // Handle different message types
    switch (message.msgType) {
      case "Heartbeat":
        state.heartbeatData = this.processHeartbeatData(message.payload);
        break;
      case "DeviceInfo":
        state.deviceInfo = this.processDeviceInfoData(message.payload);
        break;
      case "ModuleInfo":
        state.moduleInfo = this.processModuleInfoData(message.payload);
        break;
      case "DevModInfo":
        state.deviceModuleInfo = this.processDeviceModuleInfoData(message.payload);
        break;
      default:
        state.genericData = message.payload;
    }
    
    return state;
  }

  /**
   * Process heartbeat data
   * @param {Object} payload - Heartbeat payload
   * @returns {Object} Processed heartbeat data
   */
  processHeartbeatData(payload) {
    if (!Array.isArray(payload)) {
      return { modules: [], timestamp: new Date().toISOString() };
    }
    
    return {
      modules: payload.map(module => ({
        modNum: module.modNum,
        modId: module.modId,
        uCount: module.uCount,
        status: "active"
      })),
      moduleCount: payload.length,
      totalUCapacity: payload.reduce((sum, module) => sum + (module.uCount || 0), 0),
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Process device info data
   * @param {Object} payload - Device info payload
   * @returns {Object} Processed device info
   */
  processDeviceInfoData(payload) {
    return {
      firmwareVersion: payload.fwVersion || "unknown",
      ipAddress: payload.ip || "unknown",
      subnetMask: payload.mask || "unknown",
      gateway: payload.gateway || "unknown",
      macAddress: payload.mac || "unknown",
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Process module info data
   * @param {Object} payload - Module info payload
   * @returns {Object} Processed module info
   */
  processModuleInfoData(payload) {
    if (!Array.isArray(payload)) {
      return { modules: [], timestamp: new Date().toISOString() };
    }
    
    return {
      modules: payload.map(module => ({
        modNum: module.add || module.modNum,
        modId: module.modId || "unknown",
        firmwareVersion: module.fwVersion || "unknown",
        status: "active"
      })),
      moduleCount: payload.length,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Process device and module info data
   * @param {Object} payload - Device/Module info payload
   * @returns {Object} Processed device/module info
   */
  processDeviceModuleInfoData(payload) {
    const result = {
      deviceInfo: {
        firmwareVersion: payload.fwVersion || "unknown",
        ipAddress: payload.ip || "unknown",
        subnetMask: null,
        gateway: null,
        macAddress: payload.gateway_mac || "unknown"
      },
      modules: [],
      timestamp: new Date().toISOString()
    };
    
    if (payload.module && Array.isArray(payload.module)) {
      result.modules = payload.module.map(module => ({
        modNum: module.module_index || module.modNum,
        modId: module.module_sn || module.modId,
        firmwareVersion: module.module_sw_version || "unknown",
        uCount: module.module_u_num || 0,
        status: "active"
      }));
    }
    
    return result;
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
      
      return {
        infoType: state.infoType,
        data: state.data,
        lastUpdated: state.lastUpdated,
        ...state.heartbeatData,
        ...state.deviceInfo,
        ...state.moduleInfo,
        ...state.deviceModuleInfo,
        ...state.genericData
      };
    } catch (error) {
      logger.error(`Failed to get Device/Module info current state for ${deviceId}-${modNum}:`, error);
      return null;
    }
  }

  /**
   * Calculate changes between previous and current Device/Module info state
   * @param {Object|null} previousState - Previous state
   * @param {Object} currentState - Current state
   * @returns {Array} Array of change objects
   */
  calculateChanges(previousState, currentState) {
    const changes = [];
    
    if (!previousState) {
      // No previous state, first info recorded
      changes.push({
        action: "initialized",
        infoType: currentState.infoType,
        timestamp: currentState.lastUpdated,
        previousData: null,
        currentData: currentState.data
      });
      
      return changes;
    }
    
    // Check for data changes
    if (JSON.stringify(previousState.data) !== JSON.stringify(currentState.data)) {
      changes.push({
        action: "updated",
        infoType: currentState.infoType,
        timestamp: currentState.lastUpdated,
        previousData: previousState.data,
        currentData: currentState.data
      });
    }
    
    return changes;
  }

  /**
   * Get device information
   * @param {string} deviceId - Device ID
   * @returns {Object|null} Device information or null if not found
   */
  getDeviceInfo(deviceId) {
    try {
      // Find device info in any module
      const moduleStates = this.deviceStates.get(deviceId);
      if (!moduleStates) return null;
      
      for (const [modNum, state] of moduleStates) {
        if (state.infoType === "DeviceInfo" || state.infoType === "DevModInfo") {
          const currentState = this.getCurrentState(deviceId, modNum);
          if (currentState && currentState.deviceInfo) {
            return currentState.deviceInfo;
          }
        }
      }
      
      return null;
    } catch (error) {
      logger.error(`Failed to get device info for ${deviceId}:`, error);
      return null;
    }
  }

  /**
   * Get all modules for a device
   * @param {string} deviceId - Device ID
   * @returns {Array} Array of module information
   */
  getAllModules(deviceId) {
    try {
      const modules = [];
      
      // Collect modules from different message types
      const moduleStates = this.deviceStates.get(deviceId);
      if (!moduleStates) return modules;
      
      for (const [modNum, state] of moduleStates) {
        let moduleInfo = null;
        
        if (state.infoType === "Heartbeat" && state.heartbeatData) {
          moduleInfo = state.heartbeatData.modules.find(m => m.modNum === modNum);
        } else if (state.infoType === "ModuleInfo" && state.moduleInfo) {
          moduleInfo = state.moduleInfo.modules.find(m => m.modNum === modNum);
        } else if (state.infoType === "DevModInfo" && state.deviceModuleInfo) {
          moduleInfo = state.deviceModuleInfo.modules.find(m => m.modNum === modNum);
        }
        
        if (moduleInfo) {
          modules.push(moduleInfo);
        }
      }
      
      // Remove duplicates and sort by modNum
      const uniqueModules = modules.filter((module, index, self) => 
        index === modules.findIndex(m => m.modNum === module.modNum)
      );
      
      return uniqueModules.sort((a, b) => a.modNum - b.modNum);
    } catch (error) {
      logger.error(`Failed to get all modules for ${deviceId}:`, error);
      return [];
    }
  }

  /**
   * Get module information by module number
   * @param {string} deviceId - Device ID
   * @param {number} modNum - Module number
   * @returns {Object|null} Module information or null if not found
   */
  getModuleInfo(deviceId, modNum) {
    try {
      const moduleStates = this.deviceStates.get(deviceId);
      if (!moduleStates) return null;
      
      const state = moduleStates.get(modNum);
      if (!state) return null;
      
      // Extract module info from different message types
      if (state.infoType === "Heartbeat" && state.heartbeatData) {
        return state.heartbeatData.modules.find(m => m.modNum === modNum) || null;
      } else if (state.infoType === "ModuleInfo" && state.moduleInfo) {
        return state.moduleInfo.modules.find(m => m.modNum === modNum) || null;
      } else if (state.infoType === "DevModInfo" && state.deviceModuleInfo) {
        return state.deviceModuleInfo.modules.find(m => m.modNum === modNum) || null;
      }
      
      return null;
    } catch (error) {
      logger.error(`Failed to get module info for ${deviceId}-${modNum}:`, error);
      return null;
    }
  }

  /**
   * Get statistics about Device/Module info for a device
   * @param {string} deviceId - Device ID
   * @returns {Object} Statistics object
   */
  getDeviceStats(deviceId) {
    try {
      const moduleStates = this.deviceStates.get(deviceId);
      if (!moduleStates) {
        return {
          moduleCount: 0,
          totalUCapacity: 0,
          lastUpdate: null,
          infoTypes: []
        };
      }
      
      let moduleCount = 0;
      let totalUCapacity = 0;
      let lastUpdate = null;
      const infoTypes = new Set();
      
      for (const [modNum, state] of moduleStates) {
        if (state.infoType === "Heartbeat" && state.heartbeatData) {
          moduleCount += state.heartbeatData.moduleCount;
          totalUCapacity += state.heartbeatData.totalUCapacity;
        } else if (state.infoType === "ModuleInfo" && state.moduleInfo) {
          moduleCount += state.moduleInfo.moduleCount;
        } else if (state.infoType === "DevModInfo" && state.deviceModuleInfo) {
          moduleCount += state.deviceModuleInfo.modules.length;
        }
        
        infoTypes.add(state.infoType);
        
        if (!lastUpdate || new Date(state.lastUpdated) > new Date(lastUpdate)) {
          lastUpdate = state.lastUpdated;
        }
      }
      
      return {
        moduleCount,
        totalUCapacity,
        lastUpdate,
        infoTypes: Array.from(infoTypes),
        deviceInfo: this.getDeviceInfo(deviceId)
      };
    } catch (error) {
      logger.error(`Failed to get device stats for ${deviceId}:`, error);
      return {
        moduleCount: 0,
        totalUCapacity: 0,
        lastUpdate: null,
        infoTypes: []
      };
    }
  }

  /**
   * Get history for a specific info type
   * @param {string} deviceId - Device ID
   * @param {number} modNum - Module number
   * @param {string} infoType - Info type to filter by
   * @param {Object} options - Options for filtering
   * @returns {Array} Array of history changes
   */
  getInfoTypeHistory(deviceId, modNum, infoType, options = {}) {
    const allHistory = this.getChangeHistory(deviceId, modNum, options);
    return allHistory.filter(change => change.infoType === infoType);
  }

  /**
   * Check if device has been seen recently
   * @param {string} deviceId - Device ID
   * @param {number} minutes - Minutes threshold
   * @returns {boolean} True if device seen within threshold
   */
  isDeviceActive(deviceId, minutes = 30) {
    const stats = this.getDeviceStats(deviceId);
    if (!stats.lastUpdate) return false;
    
    const lastUpdate = new Date(stats.lastUpdate);
    const threshold = new Date(Date.now() - minutes * 60 * 1000);
    
    return lastUpdate >= threshold;
  }
}

module.exports = DeviceInfoStateManager;