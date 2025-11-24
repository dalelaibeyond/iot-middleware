const BaseStateManager = require("./BaseStateManager");
const logger = require("../../../utils/logger");

/**
 * Color State Manager that tracks color states across devices
 */
class ColorStateManager extends BaseStateManager {
  constructor() {
    super();
    this.type = "Color";
  }

  /**
   * Update state with new Color message
   * @param {string} deviceId - Device ID
   * @param {number} modNum - Module number
   * @param {Object} message - Normalized Color message
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
      
      logger.debug(`Color state updated for device ${deviceId}, module ${modNum}`, {
        positionCount: currentState.positionCount,
        changesCount: changes.length
      });
      
    } catch (error) {
      logger.error(`Failed to update Color state for ${deviceId}-${modNum}:`, error);
    }
  }

  /**
   * Create current state structure from message
   * @param {Object} message - Normalized message
   * @returns {Object} Current state object
   */
  createCurrentState(message) {
    const state = {
      positionCount: message.payload.positionCount || 0,
      positionMap: new Map(), // position -> color data
      lastUpdated: new Date().toISOString()
    };
    
    // Convert positionData array to Map for efficient lookup
    if (message.payload.positionData && Array.isArray(message.payload.positionData)) {
      message.payload.positionData.forEach(position => {
        state.positionMap.set(position.position, {
          position: position.position,
          color: position.color,
          code: position.code,
          lastChanged: position.lastChanged || new Date().toISOString()
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
        positionCount: state.positionCount,
        positionData: Array.from(state.positionMap.values()),
        lastUpdated: state.lastUpdated
      };
    } catch (error) {
      logger.error(`Failed to get Color current state for ${deviceId}-${modNum}:`, error);
      return null;
    }
  }

  /**
   * Calculate changes between previous and current Color state
   * @param {Object|null} previousState - Previous state
   * @param {Object} currentState - Current state
   * @returns {Array} Array of change objects
   */
  calculateChanges(previousState, currentState) {
    const changes = [];
    
    if (!previousState) {
      // No previous state, all current positions are new
      currentState.positionMap.forEach((position, pos) => {
        changes.push({
          position: pos,
          color: position.color,
          code: position.code,
          action: "set",
          timestamp: new Date().toISOString(),
          previousColor: null,
          currentColor: position.color
        });
      });
      
      return changes;
    }
    
    const previousPositionMap = previousState.positionMap || new Map();
    
    // Check for new or changed colors
    currentState.positionMap.forEach((currentPosition, pos) => {
      const previousPosition = previousPositionMap.get(pos);
      
      if (!previousPosition) {
        // New position
        changes.push({
          position: pos,
          color: currentPosition.color,
          code: currentPosition.code,
          action: "set",
          timestamp: new Date().toISOString(),
          previousColor: null,
          currentColor: currentPosition.color
        });
      } else if (previousPosition.color !== currentPosition.color || 
                 previousPosition.code !== currentPosition.code) {
        // Color changed
        changes.push({
          position: pos,
          color: currentPosition.color,
          code: currentPosition.code,
          action: "changed",
          timestamp: new Date().toISOString(),
          previousColor: previousPosition.color,
          previousCode: previousPosition.code,
          currentColor: currentPosition.color,
          currentCode: currentPosition.code
        });
      }
    });
    
    return changes;
  }

  /**
   * Get color history for a specific position
   * @param {string} deviceId - Device ID
   * @param {number} modNum - Module number
   * @param {number} position - Position number
   * @param {Object} options - Options for filtering
   * @returns {Array} Array of position-specific changes
   */
  getPositionHistory(deviceId, modNum, position, options = {}) {
    const history = this.getChangeHistory(deviceId, modNum, options);
    return history.filter(change => change.position === position);
  }

  /**
   * Get current color for a specific position
   * @param {string} deviceId - Device ID
   * @param {number} modNum - Module number
   * @param {number} position - Position number
   * @returns {Object|null} Color information or null if not found
   */
  getCurrentColor(deviceId, modNum, position) {
    const currentState = this.getCurrentState(deviceId, modNum);
    if (!currentState || !currentState.positionData) return null;
    
    const positionData = currentState.positionData.find(p => p.position === position);
    return positionData ? {
      position: positionData.position,
      color: positionData.color,
      code: positionData.code,
      lastChanged: positionData.lastChanged
    } : null;
  }

  /**
   * Get statistics about Color state for a device module
   * @param {string} deviceId - Device ID
   * @param {number} modNum - Module number
   * @returns {Object} Statistics object
   */
  getModuleStats(deviceId, modNum) {
    const currentState = this.getCurrentState(deviceId, modNum);
    const history = this.getChangeHistory(deviceId, modNum);
    
    if (!currentState) {
      return {
        positionCount: 0,
        totalChanges: 0,
        lastActivity: null,
        colorStats: null
      };
    }
    
    // Calculate color statistics
    const colorStats = this.calculateColorStats(history, currentState.positionData);
    
    return {
      positionCount: currentState.positionCount,
      totalChanges: history.length,
      lastActivity: history.length > 0 ? history[history.length - 1].timestamp : null,
      colorStats
    };
  }

  /**
   * Calculate statistics for color changes
   * @param {Array} changes - Array of changes
   * @param {Array} positionData - Current position data
   * @returns {Object} Statistics object
   */
  calculateColorStats(changes, positionData) {
    if (!positionData || positionData.length === 0) {
      return {
        colorDistribution: {},
        mostUsedColor: null,
        leastUsedColor: null,
        totalChanges: 0,
        averageChangesPerPosition: 0
      };
    }
    
    // Count color usage
    const colorCounts = {};
    positionData.forEach(pos => {
      colorCounts[pos.color] = (colorCounts[pos.color] || 0) + 1;
    });
    
    // Find most and least used colors
    const colors = Object.keys(colorCounts);
    const mostUsedColor = colors.reduce((a, b) => 
      colorCounts[a] > colorCounts[b] ? a : b
    );
    const leastUsedColor = colors.reduce((a, b) => 
      colorCounts[a] < colorCounts[b] ? a : b
    );
    
    return {
      colorDistribution: colorCounts,
      mostUsedColor,
      leastUsedColor,
      totalChanges: changes.length,
      averageChangesPerPosition: Math.round((changes.length / positionData.length) * 10) / 10
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
    if (!currentState || !currentState.positionData) return [];
    
    return currentState.positionData.map(position => position.position);
  }

  /**
   * Get positions with specific color
   * @param {string} deviceId - Device ID
   * @param {number} modNum - Module number
   * @param {string} color - Color to filter by
   * @returns {Array} Array of position numbers with specified color
   */
  getPositionsByColor(deviceId, modNum, color) {
    const currentState = this.getCurrentState(deviceId, modNum);
    if (!currentState || !currentState.positionData) return [];
    
    return currentState.positionData
      .filter(position => position.color === color)
      .map(position => position.position);
  }

  /**
   * Get positions with specific color code
   * @param {string} deviceId - Device ID
   * @param {number} modNum - Module number
   * @param {number} code - Color code to filter by
   * @returns {Array} Array of position numbers with specified color code
   */
  getPositionsByColorCode(deviceId, modNum, code) {
    const currentState = this.getCurrentState(deviceId, modNum);
    if (!currentState || !currentState.positionData) return [];
    
    return currentState.positionData
      .filter(position => position.code === code)
      .map(position => position.position);
  }

  /**
   * Get color pattern analysis for a device module
   * @param {string} deviceId - Device ID
   * @param {number} modNum - Module number
   * @returns {Object} Pattern analysis
   */
  getColorPatternAnalysis(deviceId, modNum) {
    const currentState = this.getCurrentState(deviceId, modNum);
    if (!currentState || !currentState.positionData) {
      return {
        patterns: [],
        complexity: 0,
        diversity: 0
      };
    }
    
    const colors = currentState.positionData.map(p => p.color);
    const uniqueColors = [...new Set(colors)];
    
    // Analyze patterns (simple implementation)
    const patterns = [];
    
    // Check for alternating patterns
    if (colors.length >= 4) {
      const isAlternating = colors.every((color, index) => {
        if (index === 0) return true;
        return color !== colors[index - 1];
      });
      
      if (isAlternating) {
        patterns.push({
          type: "alternating",
          description: "Colors alternate between positions",
          confidence: 0.8
        });
      }
    }
    
    // Check for grouping patterns
    const colorGroups = this.findColorGroups(colors);
    if (colorGroups.length > 1) {
      patterns.push({
        type: "grouped",
        description: "Same colors appear in groups",
        groups: colorGroups,
        confidence: 0.7
      });
    }
    
    return {
      patterns,
      complexity: Math.min(uniqueColors.length / currentState.positionCount, 1.0),
      diversity: uniqueColors.length,
      totalPositions: currentState.positionCount
    };
  }

  /**
   * Find groups of same colors in sequence
   * @param {Array} colors - Array of colors
   * @returns {Array} Array of color groups
   */
  findColorGroups(colors) {
    if (!colors || colors.length === 0) return [];
    
    const groups = [];
    let currentGroup = { color: colors[0], positions: [0] };
    
    for (let i = 1; i < colors.length; i++) {
      if (colors[i] === currentGroup.color) {
        currentGroup.positions.push(i);
      } else {
        groups.push({
          color: currentGroup.color,
          positions: [...currentGroup.positions],
          count: currentGroup.positions.length
        });
        currentGroup = { color: colors[i], positions: [i] };
      }
    }
    
    // Add the last group
    groups.push({
      color: currentGroup.color,
      positions: currentGroup.positions,
      count: currentGroup.positions.length
    });
    
    return groups;
  }
}

module.exports = ColorStateManager;