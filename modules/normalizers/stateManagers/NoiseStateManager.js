const BaseStateManager = require("./BaseStateManager");
const logger = require("../../../utils/logger");

/**
 * Noise State Manager that tracks noise level readings across devices
 */
class NoiseStateManager extends BaseStateManager {
  constructor() {
    super();
    this.type = "Noise";
  }

  /**
   * Update state with new Noise message
   * @param {string} deviceId - Device ID
   * @param {number} modNum - Module number
   * @param {Object} message - Normalized Noise message
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
      
      logger.debug(`Noise state updated for device ${deviceId}, module ${modNum}`, {
        sensorCount: currentState.sensorCount,
        changesCount: changes.length
      });
      
    } catch (error) {
      logger.error(`Failed to update Noise state for ${deviceId}-${modNum}:`, error);
    }
  }

  /**
   * Create current state structure from message
   * @param {Object} message - Normalized message
   * @returns {Object} Current state object
   */
  createCurrentState(message) {
    const state = {
      sensorCount: message.payload.sensorCount || 0,
      sensorMap: new Map(), // position -> sensor data
      lastUpdated: new Date().toISOString()
    };
    
    // Convert sensorData array to Map for efficient lookup
    if (message.payload.sensorData && Array.isArray(message.payload.sensorData)) {
      message.payload.sensorData.forEach(sensor => {
        state.sensorMap.set(sensor.position, {
          position: sensor.position,
          noiseLevel: sensor.noiseLevel,
          lastChanged: sensor.lastChanged || new Date().toISOString()
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
        sensorCount: state.sensorCount,
        sensorData: Array.from(state.sensorMap.values()),
        lastUpdated: state.lastUpdated
      };
    } catch (error) {
      logger.error(`Failed to get Noise current state for ${deviceId}-${modNum}:`, error);
      return null;
    }
  }

  /**
   * Calculate changes between previous and current Noise state
   * @param {Object|null} previousState - Previous state
   * @param {Object} currentState - Current state
   * @returns {Array} Array of change objects
   */
  calculateChanges(previousState, currentState) {
    const changes = [];
    
    if (!previousState) {
      // No previous state, all current sensors are new
      currentState.sensorMap.forEach((sensor, position) => {
        changes.push({
          position,
          previousValue: null,
          currentValue: sensor.noiseLevel,
          timestamp: new Date().toISOString()
        });
      });
      
      return changes;
    }
    
    const previousSensorMap = previousState.sensorMap || new Map();
    
    // Check for noise level changes
    currentState.sensorMap.forEach((currentSensor, position) => {
      const previousSensor = previousSensorMap.get(position);
      
      if (!previousSensor) {
        // New sensor
        changes.push({
          position,
          previousValue: null,
          currentValue: currentSensor.noiseLevel,
          timestamp: new Date().toISOString()
        });
      } else {
        // Check for noise level change (using threshold to avoid noise from minor fluctuations)
        const threshold = 1.0; // 1 dB threshold
        if (Math.abs(previousSensor.noiseLevel - currentSensor.noiseLevel) >= threshold) {
          changes.push({
            position,
            previousValue: previousSensor.noiseLevel,
            currentValue: currentSensor.noiseLevel,
            timestamp: new Date().toISOString()
          });
        }
      }
    });
    
    return changes;
  }

  /**
   * Get sensor reading history for a specific position
   * @param {string} deviceId - Device ID
   * @param {number} modNum - Module number
   * @param {number} position - Sensor position
   * @param {Object} options - Options for filtering
   * @returns {Array} Array of position-specific changes
   */
  getSensorHistory(deviceId, modNum, position, options = {}) {
    const history = this.getChangeHistory(deviceId, modNum, options);
    return history.filter(change => change.position === position);
  }

  /**
   * Get current noise level for a specific position
   * @param {string} deviceId - Device ID
   * @param {number} modNum - Module number
   * @param {number} position - Sensor position
   * @returns {number|null} Noise level in dB or null if not found
   */
  getCurrentNoiseLevel(deviceId, modNum, position) {
    const currentState = this.getCurrentState(deviceId, modNum);
    if (!currentState || !currentState.sensorData) return null;
    
    const sensor = currentState.sensorData.find(s => s.position === position);
    return sensor ? sensor.noiseLevel : null;
  }

  /**
   * Get statistics about Noise state for a device module
   * @param {string} deviceId - Device ID
   * @param {number} modNum - Module number
   * @returns {Object} Statistics object
   */
  getModuleStats(deviceId, modNum) {
    const currentState = this.getCurrentState(deviceId, modNum);
    const history = this.getChangeHistory(deviceId, modNum);
    
    if (!currentState) {
      return {
        sensorCount: 0,
        totalChanges: 0,
        lastActivity: null,
        noiseStats: null
      };
    }
    
    // Calculate noise statistics
    const noiseStats = this.calculateNoiseStats(history, currentState.sensorData);
    
    return {
      sensorCount: currentState.sensorCount,
      totalChanges: history.length,
      lastActivity: history.length > 0 ? history[history.length - 1].timestamp : null,
      noiseStats
    };
  }

  /**
   * Calculate statistics for noise readings
   * @param {Array} changes - Array of changes
   * @param {Array} sensorData - Current sensor data
   * @returns {Object} Statistics object
   */
  calculateNoiseStats(changes, sensorData) {
    if (!sensorData || sensorData.length === 0) {
      return {
        average: null,
        min: null,
        max: null,
        peakCount: 0,
        quietCount: 0,
        totalChanges: 0,
        lastValue: null
      };
    }
    
    const values = sensorData.map(sensor => sensor.noiseLevel);
    const average = values.reduce((sum, val) => sum + val, 0) / values.length;
    const min = Math.min(...values);
    const max = Math.max(...values);
    const lastValue = values[values.length - 1];
    
    // Count peaks (above threshold) and quiet periods (below threshold)
    const peakThreshold = 80; // dB
    const quietThreshold = 40; // dB
    const peakCount = values.filter(val => val > peakThreshold).length;
    const quietCount = values.filter(val => val < quietThreshold).length;
    
    return {
      average: Math.round(average * 10) / 10, // Round to 1 decimal place
      min,
      max,
      peakCount,
      quietCount,
      totalChanges: changes.length,
      lastValue
    };
  }

  /**
   * Get all sensor positions for a device module
   * @param {string} deviceId - Device ID
   * @param {number} modNum - Module number
   * @returns {Array} Array of position numbers
   */
  getAllPositions(deviceId, modNum) {
    const currentState = this.getCurrentState(deviceId, modNum);
    if (!currentState || !currentState.sensorData) return [];
    
    return currentState.sensorData.map(sensor => sensor.position);
  }

  /**
   * Get sensors with noise levels above threshold
   * @param {string} deviceId - Device ID
   * @param {number} modNum - Module number
   * @param {number} threshold - Noise threshold in dB
   * @returns {Array} Array of sensors with high noise levels
   */
  getHighNoiseSensors(deviceId, modNum, threshold = 80) {
    const currentState = this.getCurrentState(deviceId, modNum);
    if (!currentState || !currentState.sensorData) return [];
    
    return currentState.sensorData.filter(sensor => sensor.noiseLevel > threshold);
  }

  /**
   * Get sensors with noise levels below threshold
   * @param {string} deviceId - Device ID
   * @param {number} modNum - Module number
   * @param {number} threshold - Noise threshold in dB
   * @returns {Array} Array of sensors with low noise levels
   */
  getLowNoiseSensors(deviceId, modNum, threshold = 40) {
    const currentState = this.getCurrentState(deviceId, modNum);
    if (!currentState || !currentState.sensorData) return [];
    
    return currentState.sensorData.filter(sensor => sensor.noiseLevel < threshold);
  }

  /**
   * Get noise trend analysis for a sensor position
   * @param {string} deviceId - Device ID
   * @param {number} modNum - Module number
   * @param {number} position - Sensor position
   * @param {Object} options - Options for analysis
   * @returns {Object} Trend analysis
   */
  getNoiseTrend(deviceId, modNum, position, options = {}) {
    const history = this.getSensorHistory(deviceId, modNum, position, options);
    
    if (history.length < 2) {
      return {
        trend: "insufficient_data",
        slope: 0,
        confidence: 0,
        dataPoints: history.length
      };
    }
    
    // Simple linear regression to calculate trend
    const n = history.length;
    let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
    
    history.forEach((change, index) => {
      sumX += index;
      sumY += change.currentValue;
      sumXY += index * change.currentValue;
      sumX2 += index * index;
    });
    
    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;
    
    // Calculate correlation coefficient for confidence
    const meanX = sumX / n;
    const meanY = sumY / n;
    let numerator = 0, denomX = 0, denomY = 0;
    
    history.forEach((change, index) => {
      const xDiff = index - meanX;
      const yDiff = change.currentValue - meanY;
      numerator += xDiff * yDiff;
      denomX += xDiff * xDiff;
      denomY += yDiff * yDiff;
    });
    
    const correlation = numerator / Math.sqrt(denomX * denomY);
    const confidence = Math.abs(correlation);
    
    let trend = "stable";
    if (slope > 0.5) trend = "increasing";
    else if (slope < -0.5) trend = "decreasing";
    
    return {
      trend,
      slope: Math.round(slope * 10) / 10,
      confidence: Math.round(confidence * 100),
      dataPoints: n,
      intercept: Math.round(intercept * 10) / 10
    };
  }
}

module.exports = NoiseStateManager;