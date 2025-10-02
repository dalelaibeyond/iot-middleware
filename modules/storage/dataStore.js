const BaseComponent = require("../core/BaseComponent");
const eventBus = require("../core/eventBus");

class DataStore extends BaseComponent {
  constructor(options = {}) {
    super(options);
    this.data = new Map();
    this.expireTime = options.expireTime || 3600000; // Default 1 hour
    this.cleanupInterval = options.cleanupInterval || 300000; // Default 5 minutes
  }

  async initialize() {
    try {
      // Start cleanup timer
      this.cleanupTimer = setInterval(
        () => this.cleanup(),
        this.cleanupInterval
      );

      // Subscribe to processed messages
      eventBus.on("message.processed", this.handleMessage.bind(this));

      this.logger.info("Data store initialized");
    } catch (error) {
      this.logger.error("Failed to initialize data store:", error);
      throw error;
    }
  }

  handleMessage(message) {
    if (!message || !message.deviceId) {
      this.logger.warn("Received invalid message:", message);
      return;
    }

    const deviceData = this.data.get(message.deviceId) || [];
    deviceData.push({
      timestamp: Date.now(),
      data: message,
    });

    this.data.set(message.deviceId, deviceData);
    this.logger.debug(
      `Stored data for device ${message.deviceId}, total entries: ${deviceData.length}`
    );
    eventBus.emit("data.stored", { deviceId: message.deviceId, message });
  }

  getDeviceData(deviceId, options = {}) {
    const deviceData = this.data.get(deviceId) || [];

    if (options.startTime || options.endTime) {
      return deviceData.filter((entry) => {
        const timestamp = entry.timestamp;
        if (options.startTime && timestamp < options.startTime) return false;
        if (options.endTime && timestamp > options.endTime) return false;
        return true;
      });
    }

    return deviceData;
  }

  getAllDevices() {
    return Array.from(this.data.keys());
  }

  cleanup() {
    const now = Date.now();
    const expireThreshold = now - this.expireTime;

    for (const [deviceId, data] of this.data.entries()) {
      // Filter out expired entries
      const validData = data.filter(
        (entry) => entry.timestamp > expireThreshold
      );

      if (validData.length === 0) {
        this.data.delete(deviceId);
        eventBus.emit("data.expired", { deviceId });
      } else if (validData.length < data.length) {
        this.data.set(deviceId, validData);
      }
    }
  }

  clearDevice(deviceId) {
    const hadData = this.data.delete(deviceId);
    if (hadData) {
      eventBus.emit("data.cleared", { deviceId });
    }
    return hadData;
  }

  clearAll() {
    const devices = this.getAllDevices();
    this.data.clear();
    devices.forEach((deviceId) => {
      eventBus.emit("data.cleared", { deviceId });
    });
    return devices.length;
  }

  async shutdown() {
    try {
      if (this.cleanupTimer) {
        clearInterval(this.cleanupTimer);
      }
      this.data.clear();
      super.shutdown();
    } catch (error) {
      this.logger.error("Error during data store shutdown:", error);
      throw error;
    }
  }
}

// Singleton instance
const dataStore = new DataStore();

module.exports = dataStore;
