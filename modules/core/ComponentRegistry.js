const BaseComponent = require("./BaseComponent");
const logger = require("../../utils/logger");
const eventBus = require("./eventBus");

class ComponentRegistry {
  constructor(config, options = {}) {
    this.config = config;
    this.options = options;
    this.components = new Map();
    this.componentFactories = new Map();
    this.initializationOrder = [];
    this.registerDefaultFactories();
  }

  /**
   * Register default component factories
   */
  registerDefaultFactories() {
    // Core components
    this.registerFactory("mqtt", () => require("../mqtt/MQTTClient"));
    this.registerFactory("normalizer", () => require("../normalizers"));
    this.registerFactory("dataStore", () => require("../storage/dataStore"));
    
    // Storage components
    this.registerFactory("database", () => require("../database/DatabaseManager"));
    this.registerFactory("cache", () => require("../storage/CacheManager"));
    this.registerFactory("writeBuffer", () => require("../storage/WriteBuffer"));
    
    // API components
    this.registerFactory("rest", () => require("../api/RestAPIManager"));
    this.registerFactory("websocket", () => require("../api/WebSocketServer"));
    this.registerFactory("webhook", () => require("../api/CallbackManager"));
    
    // Relay components
    this.registerFactory("messageRelay", () => require("../mqtt/messageRelay"));
  }

  /**
   * Register a component factory
   * @param {string} name - Component name
   * @param {Function} factory - Factory function that returns the component class
   */
  registerFactory(name, factory) {
    this.componentFactories.set(name, factory);
  }

  /**
   * Check if a component is enabled in configuration
   * @param {string} moduleGroup - Module group name
   * @param {string} componentName - Component name
   * @returns {boolean}
   */
  isComponentEnabled(moduleGroup, componentName) {
    const moduleConfig = this.config.modules[moduleGroup];
    if (!moduleConfig || !moduleConfig.enabled) {
      return false;
    }
    
    const componentConfig = moduleConfig.components[componentName];
    return componentConfig && componentConfig.enabled;
  }

  /**
   * Get component configuration
   * @param {string} moduleGroup - Module group name
   * @param {string} componentName - Component name
   * @returns {Object}
   */
  getComponentConfig(moduleGroup, componentName) {
    const moduleConfig = this.config.modules[moduleGroup];
    if (!moduleConfig) {
      return {};
    }
    
    const componentConfig = moduleConfig.components[componentName];
    return componentConfig ? componentConfig.config || {} : {};
  }

  /**
   * Initialize all enabled components
   */
  async initializeComponents(options = {}) {
    // Process modules in dependency order
    const moduleOrder = ["core", "storage", "api", "relay"];
    
    for (const moduleGroup of moduleOrder) {
      if (!this.config.modules[moduleGroup] || !this.config.modules[moduleGroup].enabled) {
        logger.info(`Module group ${moduleGroup} is disabled, skipping`);
        continue;
      }
      
      const moduleConfig = this.config.modules[moduleGroup];
      logger.info(`Initializing module group: ${moduleGroup}`);
      
      // Initialize components sequentially to handle dependencies
      for (const [componentName, componentConfig] of Object.entries(moduleConfig.components)) {
        if (!componentConfig.enabled) {
          logger.info(`Component ${componentName} is disabled, skipping`);
          continue;
        }
        
        // Special handling: ensure database is initialized before writeBuffer
        if (componentName === "writeBuffer") {
          // Make sure database is initialized first
          const databaseKey = "storage.database";
          if (!this.components.has(databaseKey) && moduleConfig.components.database && moduleConfig.components.database.enabled) {
            await this.initializeComponent("storage", "database", options);
          }
        }
        
        await this.initializeComponent(moduleGroup, componentName, options);
      }
    }
    
    logger.info("All components initialized successfully");
  }

  /**
   * Initialize a specific component
   * @param {string} moduleGroup - Module group name
   * @param {string} componentName - Component name
   * @param {Object} options - Initialization options
   */
  async initializeComponent(moduleGroup, componentName, options = {}) {
    try {
      const fullName = `${moduleGroup}.${componentName}`;
      logger.debug(`Initializing component: ${fullName}`);
      
      // Get component configuration
      const componentConfig = this.getComponentConfig(moduleGroup, componentName);
      
      // Get component factory
      const factory = this.componentFactories.get(componentName);
      if (!factory) {
        throw new Error(`No factory registered for component: ${componentName}`);
      }
      
      // Create component instance
      const ComponentClass = factory();
      let instance;
      
      // Handle special cases
      if (componentName === "dataStore") {
        // dataStore is a singleton
        instance = ComponentClass;
      } else if (componentName === "normalizer") {
        // normalizer is an object with functions, not a class
        instance = ComponentClass;
      } else if (componentName === "writeBuffer") {
        // writeBuffer needs database dependency
        const database = this.getComponent("storage.database");
        
        if (!database || !database.isEnabled) {
          logger.warn("Database not available, writeBuffer will be initialized but disabled");
          // Initialize writeBuffer without database (it will handle the disabled state internally)
          instance = new ComponentClass({
            dbStore: null,
            enabled: false,
            ...componentConfig
          });
        } else {
          instance = new ComponentClass({
            dbStore: database,
            ...componentConfig
          });
        }
      } else if (componentName === "websocket") {
        // websocket needs server option
        instance = new ComponentClass({
          server: this.options.server,
          ...componentConfig
        });
      } else {
        // Regular component class
        const initOptions = {
          ...componentConfig,
          ...options[componentName],
          moduleGroup,
          componentName
        };
        instance = new ComponentClass(initOptions);
      }
      
      // Initialize the component
      if (instance.initialize && typeof instance.initialize === "function") {
        await instance.initialize();
      }
      
      // Store the component
      this.components.set(fullName, instance);
      
      // Setup special handling for specific components
      await this.setupComponentSpecialHandling(fullName, instance, componentConfig);
      
      logger.debug(`Component ${fullName} initialized successfully`);
    } catch (error) {
      logger.error(`Failed to initialize component ${moduleGroup}.${componentName}:`, error);
      throw error;
    }
  }

  /**
   * Setup special handling for specific components
   * @param {string} fullName - Full component name
   * @param {Object} instance - Component instance
   * @param {Object} config - Component configuration
   */
  async setupComponentSpecialHandling(fullName, instance, config) {
    const [moduleGroup, componentName] = fullName.split(".");
    
    switch (componentName) {
      case "mqtt":
        // Subscribe to topics
        const topics = config.topics || ["V5008Upload/#", "V6800Upload/#", "G6000Upload/#"];
        for (const topic of topics) {
          await instance.subscribe(topic, (topic, message) => {
            eventBus.emit("mqtt.message", { topic, message });
          });
          logger.info(`Subscribed to MQTT topic: ${topic}`);
        }
        break;
        
      case "websocket":
        // Setup WebSocket server
        if (this.options && this.options.server) {
          await instance.initialize({ server: this.options.server });
        }
        break;
        
      case "cache":
        // Subscribe to processed messages
        if (instance.set) {
          eventBus.on("message.processed", (message) => {
            instance.set(message.deviceId, message);
          });
        }
        break;
        
      // writeBuffer is handled in ModularApplication
        
      case "messageRelay":
        // Subscribe to processed messages
        if (instance.handleMessage) {
          eventBus.on("message.processed", instance.handleMessage.bind(instance));
        }
        break;
    }
  }

  /**
   * Get a component by name
   * @param {string} name - Component name (can be just componentName or moduleGroup.componentName)
   * @returns {Object}
   */
  getComponent(name) {
    if (name.includes(".")) {
      return this.components.get(name);
    }
    
    // Try to find component by name only
    for (const [fullName, component] of this.components.entries()) {
      if (fullName.endsWith(`.${name}`)) {
        return component;
      }
    }
    
    return null;
  }

  /**
   * Get multiple components by names
   * @param {Array} names - Array of component names
   * @returns {Object} - Object with component names as keys
   */
  getComponents(names) {
    const components = {};
    for (const name of names) {
      const component = this.getComponent(name);
      if (!component) {
        throw new Error(`Component not found: ${name}`);
      }
      components[name] = component;
    }
    return components;
  }

  /**
   * Shutdown all components
   */
  async shutdown() {
    logger.info("Shutting down all components...");
    
    // Shutdown in reverse order
    const componentNames = Array.from(this.components.keys()).reverse();
    
    for (const name of componentNames) {
      const component = this.components.get(name);
      try {
        if (component.shutdown && typeof component.shutdown === "function") {
          await component.shutdown();
        }
        logger.debug(`Component ${name} shut down successfully`);
      } catch (error) {
        logger.error(`Error shutting down ${name}:`, error);
      }
    }
    
    this.components.clear();
    logger.info("All components shut down");
  }
}

module.exports = ComponentRegistry;