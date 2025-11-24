const BaseStateManager = require("./BaseStateManager");
const logger = require("../../../utils/logger");

/**
 * Door State Manager that tracks door status across devices
 */
class DoorStateManager extends BaseStateManager {
  constructor() {
    super();
    this.type = "Door";
  }

  /**
   * Update state with new Door message
   * @param {string} deviceId - Device ID
   * @param {number} modNum - Module number
   * @param {Object} message - Normalized Door message
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
      
      logger.debug(`Door state updated for device ${deviceId}, module ${modNum}`, {
        status: currentState.status,
        changesCount: changes.length
      });
      
    } catch (error) {
      logger.error(`Failed to update Door state for ${deviceId}-${modNum}:`, error);
    }
  }

  /**
   * Create current state structure from message
   * @param {Object} message - Normalized message
   * @returns {Object} Current state object
   */
  createCurrentState(message) {
    return {
      status: message.payload.status || "unknown",
      lastChanged: message.payload.lastChanged || new Date().toISOString(),
      lastUpdated: new Date().toISOString()
    };
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
        status: state.status,
        lastChanged: state.lastChanged,
        lastUpdated: state.lastUpdated
      };
    } catch (error) {
      logger.error(`Failed to get Door current state for ${deviceId}-${modNum}:`, error);
      return null;
    }
  }

  /**
   * Calculate changes between previous and current Door state
   * @param {Object|null} previousState - Previous state
   * @param {Object} currentState - Current state
   * @returns {Array} Array of change objects
   */
  calculateChanges(previousState, currentState) {
    const changes = [];
    
    if (!previousState) {
      // No previous state, first status recorded
      changes.push({
        action: "initialized",
        status: currentState.status,
        timestamp: currentState.lastChanged,
        previousStatus: null,
        currentStatus: currentState.status
      });
      
      return changes;
    }
    
    // Check for status change
    if (previousState.status !== currentState.status) {
      changes.push({
        action: "changed",
        status: currentState.status,
        timestamp: currentState.lastChanged,
        previousStatus: previousState.status,
        currentStatus: currentState.status,
        duration: this.calculateDuration(previousState.lastChanged, currentState.lastChanged)
      });
    }
    
    return changes;
  }

  /**
   * Calculate duration between two timestamps
   * @param {string} startTime - Start timestamp
   * @param {string} endTime - End timestamp
   * @returns {number|null} Duration in seconds or null if invalid
   */
  calculateDuration(startTime, endTime) {
    try {
      const start = new Date(startTime);
      const end = new Date(endTime);
      
      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        return null;
      }
      
      return Math.round((end - start) / 1000); // Convert to seconds
    } catch (error) {
      return null;
    }
  }

  /**
   * Get door status history for a device module
   * @param {string} deviceId - Device ID
   * @param {number} modNum - Module number
   * @param {Object} options - Options for filtering
   * @returns {Array} Array of status changes
   */
  getStatusHistory(deviceId, modNum, options = {}) {
    return this.getChangeHistory(deviceId, modNum, options);
  }

  /**
   * Get current door status for a device module
   * @param {string} deviceId - Device ID
   * @param {number} modNum - Module number
   * @returns {string|null} Current status or null if not found
   */
  getCurrentStatus(deviceId, modNum) {
    const currentState = this.getCurrentState(deviceId, modNum);
    return currentState ? currentState.status : null;
  }

  /**
   * Check if door is currently open
   * @param {string} deviceId - Device ID
   * @param {number} modNum - Module number
   * @returns {boolean} True if door is open
   */
  isDoorOpen(deviceId, modNum) {
    const status = this.getCurrentStatus(deviceId, modNum);
    return status === "0x01" || status === "open" || status === "1";
  }

  /**
   * Check if door is currently closed
   * @param {string} deviceId - Device ID
   * @param {number} modNum - Module number
   * @returns {boolean} True if door is closed
   */
  isDoorClosed(deviceId, modNum) {
    const status = this.getCurrentStatus(deviceId, modNum);
    return status === "0x00" || status === "closed" || status === "0";
  }

  /**
   * Get statistics about Door state for a device module
   * @param {string} deviceId - Device ID
   * @param {number} modNum - Module number
   * @returns {Object} Statistics object
   */
  getModuleStats(deviceId, modNum) {
    const currentState = this.getCurrentState(deviceId, modNum);
    const history = this.getChangeHistory(deviceId, modNum);
    
    if (!currentState) {
      return {
        currentStatus: "unknown",
        totalChanges: 0,
        lastActivity: null,
        openCount: 0,
        closeCount: 0,
        averageOpenTime: 0,
        totalOpenTime: 0
      };
    }
    
    // Calculate statistics from history
    const openEvents = history.filter(change => 
      change.action === "changed" && change.currentStatus !== "0x00" && change.currentStatus !== "closed" && change.currentStatus !== "0"
    );
    
    const closeEvents = history.filter(change => 
      change.action === "changed" && (change.currentStatus === "0x00" || change.currentStatus === "closed" || change.currentStatus === "0")
    );
    
    // Calculate total and average open time
    let totalOpenTime = 0;
    let validDurations = 0;
    
    openEvents.forEach(openEvent => {
      if (openEvent.duration && openEvent.duration > 0) {
        totalOpenTime += openEvent.duration;
        validDurations++;
      }
    });
    
    const averageOpenTime = validDurations > 0 ? Math.round(totalOpenTime / validDurations) : 0;
    
    return {
      currentStatus: currentState.status,
      totalChanges: history.length,
      lastActivity: history.length > 0 ? history[history.length - 1].timestamp : null,
      openCount: openEvents.length,
      closeCount: closeEvents.length,
      averageOpenTime,
      totalOpenTime,
      isOpen: this.isDoorOpen(deviceId, modNum),
      isClosed: this.isDoorClosed(deviceId, modNum)
    };
  }

  /**
   * Get door open time statistics for a time period
   * @param {string} deviceId - Device ID
   * @param {number} modNum - Module number
   * @param {string} startTime - Start time (ISO8601)
   * @param {string} endTime - End time (ISO8601)
   * @returns {Object} Open time statistics
   */
  getOpenTimeStats(deviceId, modNum, startTime, endTime) {
    const history = this.getChangeHistory(deviceId, modNum, {
      startTime,
      endTime
    });
    
    if (history.length === 0) {
      return {
        totalOpenTime: 0,
        openCount: 0,
        closeCount: 0,
        averageOpenDuration: 0,
        longestOpenDuration: 0,
        shortestOpenDuration: 0
      };
    }
    
    // Find open/close pairs
    const pairs = this.findOpenClosePairs(history);
    let totalOpenTime = 0;
    let openDurations = [];
    
    pairs.forEach(pair => {
      if (pair.openEvent && pair.closeEvent && pair.duration) {
        totalOpenTime += pair.duration;
        openDurations.push(pair.duration);
      }
    });
    
    const averageOpenDuration = openDurations.length > 0 ? 
      Math.round(totalOpenTime / openDurations.length) : 0;
    const longestOpenDuration = openDurations.length > 0 ? Math.max(...openDurations) : 0;
    const shortestOpenDuration = openDurations.length > 0 ? Math.min(...openDurations) : 0;
    
    return {
      totalOpenTime,
      openCount: pairs.length,
      closeCount: pairs.length,
      averageOpenDuration,
      longestOpenDuration,
      shortestOpenDuration,
      period: {
        startTime,
        endTime,
        duration: this.calculateDuration(startTime, endTime)
      }
    };
  }

  /**
   * Find open/close event pairs from history
   * @param {Array} history - Array of change events
   * @returns {Array} Array of open/close pairs
   */
  findOpenClosePairs(history) {
    const pairs = [];
    let openEvent = null;
    
    history.forEach(change => {
      if (change.action === "changed") {
        const isOpen = change.currentStatus !== "0x00" && 
                     change.currentStatus !== "closed" && 
                     change.currentStatus !== "0";
        
        if (isOpen && !openEvent) {
          // Door opened
          openEvent = change;
        } else if (!isOpen && openEvent) {
          // Door closed, we have a pair
          pairs.push({
            openEvent,
            closeEvent: change,
            duration: change.duration || this.calculateDuration(openEvent.timestamp, change.timestamp)
          });
          openEvent = null;
        }
      }
    });
    
    return pairs;
  }

  /**
   * Get door access pattern analysis
   * @param {string} deviceId - Device ID
   * @param {number} modNum - Module number
   * @param {Object} options - Analysis options
   * @returns {Object} Pattern analysis
   */
  getAccessPatternAnalysis(deviceId, modNum, options = {}) {
    const history = this.getChangeHistory(deviceId, modNum, options);
    
    if (history.length < 2) {
      return {
        pattern: "insufficient_data",
        confidence: 0,
        dataPoints: history.length
      };
    }
    
    // Analyze by time of day
    const hourlyAccess = this.analyzeHourlyAccess(history);
    
    // Analyze by day of week
    const dailyAccess = this.analyzeDailyAccess(history);
    
    // Calculate access frequency
    const totalDays = this.calculateUniqueDays(history);
    const avgAccessPerDay = history.length / totalDays;
    
    return {
      pattern: "analyzed",
      confidence: Math.min(100, history.length * 5), // Simple confidence calculation
      dataPoints: history.length,
      hourlyAccess,
      dailyAccess,
      averageAccessPerDay: Math.round(avgAccessPerDay * 10) / 10,
      totalDays,
      analysisPeriod: {
        startTime: options.startTime || history[0]?.timestamp,
        endTime: options.endTime || history[history.length - 1]?.timestamp
      }
    };
  }

  /**
   * Analyze access patterns by hour
   * @param {Array} history - Array of change events
   * @returns {Object} Hourly access distribution
   */
  analyzeHourlyAccess(history) {
    const hourlyCount = {};
    
    // Initialize all hours to 0
    for (let i = 0; i < 24; i++) {
      hourlyCount[i] = 0;
    }
    
    // Count accesses by hour
    history.forEach(change => {
      if (change.action === "changed") {
        const date = new Date(change.timestamp);
        const hour = date.getHours();
        const isOpen = change.currentStatus !== "0x00" && 
                       change.currentStatus !== "closed" && 
                       change.currentStatus !== "0";
        
        if (isOpen) { // Count door openings
          hourlyCount[hour]++;
        }
      }
    });
    
    // Find peak hours
    const maxCount = Math.max(...Object.values(hourlyCount));
    const peakHours = Object.keys(hourlyCount)
      .filter(hour => hourlyCount[hour] === maxCount)
      .map(hour => parseInt(hour));
    
    return {
      distribution: hourlyCount,
      peakHours,
      peakCount: maxCount,
      quietHours: Object.keys(hourlyCount)
        .filter(hour => hourlyCount[hour] === 0)
        .map(hour => parseInt(hour))
    };
  }

  /**
   * Analyze access patterns by day of week
   * @param {Array} history - Array of change events
   * @returns {Object} Daily access distribution
   */
  analyzeDailyAccess(history) {
    const dailyCount = {};
    
    // Initialize all days to 0
    const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    days.forEach(day => {
      dailyCount[day] = 0;
    });
    
    // Count accesses by day of week
    history.forEach(change => {
      if (change.action === "changed") {
        const date = new Date(change.timestamp);
        const dayName = days[date.getDay()];
        const isOpen = change.currentStatus !== "0x00" && 
                       change.currentStatus !== "closed" && 
                       change.currentStatus !== "0";
        
        if (isOpen) { // Count door openings
          dailyCount[dayName]++;
        }
      }
    });
    
    // Find most and least active days
    const maxCount = Math.max(...Object.values(dailyCount));
    const minCount = Math.min(...Object.values(dailyCount));
    const mostActiveDays = Object.keys(dailyCount)
      .filter(day => dailyCount[day] === maxCount);
    const leastActiveDays = Object.keys(dailyCount)
      .filter(day => dailyCount[day] === minCount);
    
    return {
      distribution: dailyCount,
      mostActiveDays,
      leastActiveDays,
      maxCount,
      minCount
    };
  }

  /**
   * Calculate number of unique days in history
   * @param {Array} history - Array of change events
   * @returns {number} Number of unique days
   */
  calculateUniqueDays(history) {
    const uniqueDays = new Set();
    
    history.forEach(change => {
      if (change.timestamp) {
        const date = new Date(change.timestamp).toDateString();
        uniqueDays.add(date);
      }
    });
    
    return uniqueDays.size;
  }
}

module.exports = DoorStateManager;