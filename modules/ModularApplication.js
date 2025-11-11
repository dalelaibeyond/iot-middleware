const BaseComponent = require("./core/BaseComponent");
const ModularConfigManager = require("../config/ModularConfigManager");
const ComponentRegistry = require("./core/ComponentRegistry");
const eventBus = require("./core/eventBus");
const logger = require("../utils/logger");

class ModularApplication extends BaseComponent {
  constructor(options = {}) {
    super(options);
    this.configManager = null;
    this.componentRegistry = null;
    this.isInitialized = false;
  }

  async initialize() {
    try {
      // Load configuration
      this.configManager = new ModularConfigManager();
      this.config = this.configManager.getConfig();

      // Initialize component registry
      this.componentRegistry = new ComponentRegistry(this.config, this.options);

      // Setup event listeners
      this.setupEventListeners();

      // Initialize all enabled components
      await this.componentRegistry.initializeComponents({
        server: this.options.server
      });

      this.isInitialized = true;
      logger.info("Modular application initialized successfully");
    } catch (error) {
      logger.error("Failed to initialize modular application:", error);
      throw error;
    }
  }

  setupEventListeners() {
    // Handle MQTT messages
    eventBus.on("mqtt.message", this.handleMqttMessage.bind(this));

    // Handle processed messages
    eventBus.on("message.processed", this.handleProcessedMessage.bind(this));

    // Handle message errors
    eventBus.on("message.error", this.handleMessageError.bind(this));

    // Handle relay messages
    eventBus.on("relay.message", this.handleRelayMessage.bind(this));
  }

  async handleMqttMessage(data) {
    try {
      const { topic, message } = data;
      logger.debug(`Received MQTT message on topic: ${topic}`);

      // Get required components
      const { normalizer, dataStore } = this.componentRegistry.getComponents([
        "normalizer", "dataStore"
      ]);

      // Normalize the message
      const normalized = normalizer.normalize(topic, message, {});
      
      if (!normalized) {
        logger.warn(`Message normalization failed for topic: ${topic}`);
        return;
      }

      // Handle array of messages (e.g., from V6800 multi-port devices)
      if (Array.isArray(normalized)) {
        // Process each message individually
        for (const msg of normalized) {
          // Store in data store
          if (dataStore && dataStore.handleMessage) {
            dataStore.handleMessage(msg);
          }

          // Emit processed message event for each message
          eventBus.emit("message.processed", msg);
        }
      } else {
        // Single message
        // Store in data store
        if (dataStore && dataStore.handleMessage) {
          dataStore.handleMessage(normalized);
        }

        // Emit processed message event
        eventBus.emit("message.processed", normalized);
      }
    } catch (error) {
      logger.error("Error handling MQTT message:", error);
      eventBus.emit("message.error", { error, data });
    }
  }

  async handleProcessedMessage(message) {
    try {
      // Get optional components
      const components = {};
      const componentNames = ["cache", "writeBuffer", "websocket", "messageRelay"];
      
      for (const name of componentNames) {
        const component = this.componentRegistry.getComponent(name);
        if (component) {
          components[name] = component;
        }
      }

      // Update cache if available
      if (components.cache) {
        components.cache.set(message.deviceId, message);
      }

      // Add to write buffer if database is enabled
      if (components.writeBuffer) {
        await components.writeBuffer.push(message);
      }

      // Broadcast to WebSocket clients if available
      if (components.websocket && components.websocket.broadcast) {
        components.websocket.broadcast(message);
      }

      // Message relay is handled by event subscription in messageRelay.js
      // No need to call directly here to avoid duplicate processing
    } catch (error) {
      logger.error("Error processing message:", error);
      eventBus.emit("message.error", { error, message });
    }
  }

  handleMessageError(data) {
    const { error, message, data: messageData } = data;
    logger.error("Message processing error:", error);
    
    // Here you could add error reporting or retry logic
  }

  async handleRelayMessage(relayData) {
    try {
      const mqtt = this.componentRegistry.getComponent("mqtt");
      if (mqtt) {
        await mqtt.publish(relayData.topic, relayData.payload);
        // Debug log is handled by messageRelay.js to avoid duplication
      }
    } catch (error) {
      logger.error("Error publishing relay message:", error);
    }
  }

  /**
   * Get a component by name
   * @param {string} name - Component name
   * @returns {Object|null} - Component instance or null
   */
  getComponent(name) {
    return this.componentRegistry ? this.componentRegistry.getComponent(name) : null;
  }

  /**
   * Get multiple components by names
   * @param {Array} names - Array of component names
   * @returns {Object} - Object with component names as keys
   */
  getComponents(names) {
    return this.componentRegistry ? this.componentRegistry.getComponents(names) : {};
  }

  /**
   * Get application configuration
   * @returns {Object} - Application configuration
   */
  getConfig() {
    return this.configManager ? this.configManager.getConfig() : {};
  }

  /**
   * Check if a module is enabled
   * @param {string} moduleName - Module name
   * @returns {boolean}
   */
  isModuleEnabled(moduleName) {
    return this.configManager ? this.configManager.isModuleEnabled(moduleName) : false;
  }

  /**
   * Check if a component is enabled
   * @param {string} moduleName - Module name
   * @param {string} componentName - Component name
   * @returns {boolean}
   */
  isComponentEnabled(moduleName, componentName) {
    return this.configManager ? this.configManager.isComponentEnabled(moduleName, componentName) : false;
  }

  /**
   * Get application statistics
   * @returns {Object} - Statistics object
   */
  getStats() {
    if (!this.isInitialized) {
      return { status: "not_initialized" };
    }

    const stats = {
      status: "running",
      modules: {},
      components: {}
    };

    // Get module statistics
    for (const moduleName of this.configManager.getEnabledModules()) {
      stats.modules[moduleName] = {
        enabled: true,
        components: this.configManager.getEnabledComponents(moduleName)
      };
    }

    // Get component statistics
    const normalizerRegistry = this.componentRegistry.getComponent("normalizer");
    if (normalizerRegistry && normalizerRegistry.getRegistry) {
      const registry = normalizerRegistry.getRegistry();
      stats.components.normalizers = registry.getStats();
    }

    return stats;
  }

  async shutdown() {
    logger.info("Shutting down modular application...");
    
    if (this.componentRegistry) {
      await this.componentRegistry.shutdown();
    }
    
    this.isInitialized = false;
    super.shutdown();
  }
}

module.exports = ModularApplication;