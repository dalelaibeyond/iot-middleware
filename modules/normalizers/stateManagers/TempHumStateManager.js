const BaseStateManager = require("./BaseStateManager");
const logger = require("../../../utils/logger");

/**
 * Temperature/Humidity State Manager that tracks sensor readings across devices
 */
class TempHumStateManager extends BaseStateManager {
  constructor() {
    super();
    this.type = "TempHum";
  }

  /**
   * Update state with new Temperature/Humidity message
   * @param {string} deviceId - Device ID
   * @param {number} modNum - Module number
   * @param {Object} message - Normalized Temperature/Humidity message
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
      
      logger.debug(`Temperature/Humidity state updated for device ${deviceId}, module ${modNum}`, {
        sensorCount: currentState.sensorCount,
        changesCount: changes.length
      });
      
    } catch (error) {
      logger.error(`Failed to update Temperature/Humidity state for ${deviceId}-${modNum}:`, error);
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
          temperature: sensor.temperature,
          humidity: sensor.humidity,
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
      logger.error(`Failed to get Temperature/Humidity current state for ${deviceId}-${modNum}:`, error);
      return null;
    }
  }

  /**
   * Calculate changes between previous and current Temperature/Humidity state
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
          sensorType: "temperature",
          previousValue: null,
          currentValue: sensor.temperature,
          timestamp: new Date().toISOString()
        });
        
        changes.push({
          position,
          sensorType: "humidity",
          previousValue: null,
          currentValue: sensor.humidity,
          timestamp: new Date().toISOString()
        });
      });
      
      return changes;
    }
    
    const previousSensorMap = previousState.sensorMap || new Map();
    
    // Check for temperature and humidity changes
    currentState.sensorMap.forEach((currentSensor, position) => {
      const previousSensor = previousSensorMap.get(position);
      
      if (!previousSensor) {
        // New sensor
        changes.push({
          position,
          sensorType: "temperature",
          previousValue: null,
          currentValue: currentSensor.temperature,
          timestamp: new Date().toISOString()
        });
        
        changes.push({
          position,
          sensorType: "humidity",
          previousValue: null,
          currentValue: currentSensor.humidity,
          timestamp: new Date().toISOString()
        });
      } else {
        // Check for temperature change
        if (Math.abs(previousSensor.temperature - currentSensor.temperature) > 0.01) {
          changes.push({
            position,
            sensorType: "temperature",
            previousValue: previousSensor.temperature,
            currentValue: currentSensor.temperature,
            timestamp: new Date().toISOString()
          });
        }
        
        // Check for humidity change
        if (Math.abs(previousSensor.humidity - currentSensor.humidity) > 0.01) {
          changes.push({
            position,
            sensorType: "humidity",
            previousValue: previousSensor.humidity,
            currentValue: currentSensor.humidity,
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
   * @param {string} sensorType - Sensor type (temperature or humidity)
   * @param {Object} options - Options for filtering
   * @returns {Array} Array of position-specific changes
   */
  getSensorHistory(deviceId, modNum, position, sensorType, options = {}) {
    const history = this.getChangeHistory(deviceId, modNum, options);
    return history.filter(change => 
      change.position === position && change.sensorType === sensorType
    );
  }

  /**
   * Get current temperature reading for a specific position
   * @param {string} deviceId - Device ID
   * @param {number} modNum - Module number
   * @param {number} position - Sensor position
   * @returns {number|null} Temperature value or null if not found
   */
  getCurrentTemperature(deviceId, modNum, position) {
    const currentState = this.getCurrentState(deviceId, modNum);
    if (!currentState || !currentState.sensorData) return null;
    
    const sensor = currentState.sensorData.find(s => s.position === position);
    return sensor ? sensor.temperature : null;
  }

  /**
   * Get current humidity reading for a specific position
   * @param {string} deviceId - Device ID
   * @param {number} modNum - Module number
   * @param {number} position - Sensor position
   * @returns {number|null} Humidity value or null if not found
   */
  getCurrentHumidity(deviceId, modNum, position) {
    const currentState = this.getCurrentState(deviceId, modNum);
    if (!currentState || !currentState.sensorData) return null;
    
    const sensor = currentState.sensorData.find(s => s.position === position);
    return sensor ? sensor.humidity : null;
  }

  /**
   * Get statistics about Temperature/Humidity state for a device module
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
        temperatureStats: null,
        humidityStats: null
      };
    }
    
    // Calculate temperature statistics
    const temperatureChanges = history.filter(change => change.sensorType === "temperature");
    const temperatureStats = this.calculateSensorStats(temperatureChanges, currentState.sensorData, 'temperature');
    
    // Calculate humidity statistics
    const humidityChanges = history.filter(change => change.sensorType === "humidity");
    const humidityStats = this.calculateSensorStats(humidityChanges, currentState.sensorData, 'humidity');
    
    return {
      sensorCount: currentState.sensorCount,
      totalChanges: history.length,
      lastActivity: history.length > 0 ? history[history.length - 1].timestamp : null,
      temperatureStats,
      humidityStats
    };
  }

  /**
   * Calculate statistics for sensor readings
   * @param {Array} changes - Array of changes
   * @param {Array} sensorData - Current sensor data
   * @param {string} type - Sensor type (temperature or humidity)
   * @returns {Object} Statistics object
   */
  calculateSensorStats(changes, sensorData, type) {
    if (!sensorData || sensorData.length === 0) {
      return {
        average: null,
        min: null,
        max: null,
        totalChanges: 0,
        lastValue: null
      };
    }
    
    const values = sensorData.map(sensor => sensor[type]);
    const average = values.reduce((sum, val) => sum + val, 0) / values.length;
    const min = Math.min(...values);
    const max = Math.max(...values);
    const lastValue = values[values.length - 1];
    
    return {
      average: Math.round(average * 100) / 100, // Round to 2 decimal places
      min,
      max,
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
   * Get sensors with readings outside normal ranges
   * @param {string} deviceId - Device ID
   * @param {number} modNum - Module number
   * @param {Object} ranges - Normal ranges {temperature: {min, max}, humidity: {min, max}}
   * @returns {Array} Array of sensors with abnormal readings
   */
  getAbnormalSensors(deviceId, modNum, ranges = {temperature: {min: -10, max: 50}, humidity: {min: 0, max: 100}}) {
    const currentState = this.getCurrentState(deviceId, modNum);
    if (!currentState || !currentState.sensorData) return [];
    
    return currentState.sensorData.filter(sensor => {
      const tempAbnormal = sensor.temperature < ranges.temperature.min || 
                         sensor.temperature > ranges.temperature.max;
      const humAbnormal = sensor.humidity < ranges.humidity.min || 
                       sensor.humidity > ranges.humidity.max;
      
      return tempAbnormal || humAbnormal;
    });
  }
}

module.exports = TempHumStateManager;