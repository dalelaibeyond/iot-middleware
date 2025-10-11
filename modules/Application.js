const BaseComponent = require("./core/BaseComponent");
const configManager = require("../config/ConfigManager");
const MQTTClient = require("./mqtt/MQTTClient");
const TopicManager = require("./mqtt/TopicManager");
const MessageProcessor = require("./core/messageProcessor");
const DatabaseManager = require("./database/DatabaseManager");
const WriteBuffer = require("./storage/WriteBuffer");
const CacheManager = require("./storage/CacheManager");
const MessageRelay = require("./mqtt/messageRelay");
const WebSocketServer = require("./api/WebSocketServer");
const CallbackManager = require("./api/CallbackManager");
const dataStore = require("./storage/dataStore");
const eventBus = require("./core/eventBus");
const { normalize } = require("./normalizers");

class Application extends BaseComponent {
  constructor(options = {}) {
    super(options);
    this.components = new Map();
  }

  async initialize() {
    try {
      // Initialize core components
      await this.initializeComponents();

      // Setup event listeners
      this.setupEventListeners();

      this.logger.info("Application initialized successfully");
    } catch (error) {
      this.logger.error("Failed to initialize application:", error);
      throw error;
    }
  }

  async initializeComponents() {
    const initOrder = [
      { name: "database", factory: () => new DatabaseManager() },
      { name: "cache", factory: () => new CacheManager() },
      { name: "dataStore", factory: () => dataStore, instance: true },
      {
        name: "writeBuffer",
        factory: (deps) => new WriteBuffer({ dbStore: deps.database }),
        dependencies: ["database"],
      },
      { name: "topicManager", factory: () => new TopicManager() },
      { name: "messageProcessor", factory: () => new MessageProcessor() },
      {
        name: "mqtt",
        factory: () =>
          new MQTTClient({
            url: process.env.MQTT_URL || "mqtt://localhost:1883",
          }),
      },
      {
        name: "messageRelay",
        factory: () => new MessageRelay(),
        conditional: () => this.config.messageRelay.enabled,
      },
      {
        name: "wsServer",
        factory: () => new WebSocketServer({ server: this.options.server }),
      },
      {
        name: "callbackManager",
        factory: () => new CallbackManager(),
        conditional: () =>
          this.config.callbacks && this.config.callbacks.enabled,
      },
    ];

    for (const component of initOrder) {
      try {
        if (component.conditional && !component.conditional()) {
          this.logger.info(`Skipping ${component.name} (disabled in config)`);
          continue;
        }

        this.logger.info(`Initializing ${component.name}...`);

        let instance;
        if (component.instance) {
          // Use existing instance (like dataStore singleton)
          instance = component.factory();
          await instance.initialize();
        } else {
          // Create new instance
          if (component.dependencies) {
            const deps = {};
            for (const dep of component.dependencies) {
              deps[dep] = this.components.get(dep);
              if (!deps[dep]) {
                throw new Error(
                  `Dependency ${dep} not found for ${component.name}`
                );
              }
            }
            instance = component.factory(deps);
          } else {
            instance = component.factory();
          }
          await instance.initialize();
        }

        this.components.set(component.name, instance);
        this.logger.info(`${component.name} initialized successfully`);

        // Special handling for message processor middleware
        if (component.name === "messageProcessor") {
          instance.use(async (message, context, next) => {
            // Extract device info from topic for logging (works for all device types)
            const topicParts = context.topic.split("/");
            const deviceType = topicParts[0].slice(0, 5);
            const gatewayId = topicParts[1] || "unknown";

            this.logger.debug("Applying message normalizer", {
              deviceType: deviceType,
              gatewayId: gatewayId,
            });

            const normalized = normalize(context.topic, message, context);

            if (normalized) {
              Object.assign(message, normalized); // Merge normalized into message
              this.logger.debug("Message normalized", {
                deviceId: message.deviceId,
                deviceType: message.deviceType,
                sensorType: message.sensorType,
                sensorId: message.sensorId,
              });
            } else {
              this.logger.warn(
                "Message normalization failed, using original message"
              );
            }
            await next();
          });
        }

        // Special handling for MQTT topic subscription
        if (component.name === "mqtt") {
          const topics = this.config.mqtt.topics;
          for (const topic of topics) {
            await instance.subscribe(topic, this.handleMessage.bind(this));
            this.logger.info(`Subscribed to MQTT topic: ${topic}`);
          }

          // Also subscribe to dig/# topics to handle relayed messages for external consumers
          await instance.subscribe("dig/#", this.handleDigMessage.bind(this));
          this.logger.info(`Subscribed to MQTT topic: dig/#`);
        }
      } catch (error) {
        this.logger.error(`Failed to initialize ${component.name}:`, error);
        throw new Error(
          `Component initialization failed: ${component.name} - ${error.message}`
        );
      }
    }
  }

  setupEventListeners() {
    eventBus.on("message.processed", async (message) => {
      const { writeBuffer, cache } = this.getComponents([
        "writeBuffer",
        "cache",
      ]);

      // Update cache
      cache.set(message.deviceId, message);

      // Add to write buffer
      await writeBuffer.push(message);
    });

    eventBus.on("message.error", async (error) => {
      this.logger.error("Message processing error:", error);
    });

    // Handle relay messages
    eventBus.on("relay.message", async (relayData) => {
      try {
        const mqttClient = this.components.get("mqtt");
        if (mqttClient) {
          await mqttClient.publish(relayData.topic, relayData.payload);
          this.logger.debug(`Relayed message to topic: ${relayData.topic}`);
        }
      } catch (error) {
        this.logger.error("Error publishing relay message:", error);
      }
    });
  }

  async handleMessage(topic, message) {
    try {
      this.logger.debug(`Received MQTT message on topic: ${topic}`);
      const { topicManager, messageProcessor } = this.getComponents([
        "topicManager",
        "messageProcessor",
      ]);

      // Skip relayed messages to prevent processing loops
      // Skip messages from dig/sensors/ topics as these are relayed messages for upper applications
      if (topic.startsWith("dig/sensors/")) {
        this.logger.debug(`Skipping relayed message on topic: ${topic}`);
        return;
      }

      // Validate topic
      if (!topicManager.validateTopic(topic)) {
        this.logger.warn(`Invalid topic format: ${topic}`);
        return;
      }

      // Extract device info from topic for logging
      const topicParts = topic.split("/");
      const deviceType = topicParts[0].slice(0, 5);
      const gatewayId = topicParts[1] || "unknown";

      // Parse message based on device type
      let payload;
      if (deviceType === "V6800") {
        // V6800 sends JSON format
        payload = JSON.parse(message.toString());
        this.logger.debug(`Parsed JSON payload for V6800`, {
          deviceId: payload.devId || payload.deviceId || gatewayId,
        });
      } else {
        // V5008 and G6000 send byte code format - keep as Buffer for the parser to handle
        payload = message;
        this.logger.debug(`Received byte code payload for ${deviceType}`, {
          gatewayId: gatewayId,
        });
      }

      // Extract topic components
      const topicComponents = topicManager.parseTopicComponents(topic);

      // Process message
      await messageProcessor.process(payload, { topic, ...topicComponents });
      this.logger.debug(`Message processed successfully for topic: ${topic}`);
    } catch (error) {
      this.logger.error(`Error handling message on topic ${topic}:`, error);
    }
  }

  async handleDigMessage(topic, message) {
    try {
      this.logger.debug(`Received dig message on topic: ${topic}`);

      // Parse the JSON string back to an object
      let parsedMessage;
      try {
        const messageStr = message.toString();
        // Check if it's already a JSON string
        if (messageStr.startsWith("{")) {
          parsedMessage = JSON.parse(messageStr);
          console.log(
            `[DIG MESSAGE] Received normalized JSON data:`,
            parsedMessage
          );
        } else {
          // Handle case where message might be a buffer or other format
          console.log(`[DIG MESSAGE] Received non-JSON message:`, messageStr);
        }
      } catch (error) {
        this.logger.error(
          `Failed to parse JSON message on topic ${topic}:`,
          error
        );
        console.log(`[DIG MESSAGE] Raw message:`, message.toString());
        return;
      }

      // Don't process relayed messages through the normal pipeline to avoid loops
      // This is just for external consumers who subscribe to dig/#
    } catch (error) {
      this.logger.error(`Error handling dig message on topic ${topic}:`, error);
    }
  }

  getComponents(names) {
    const components = {};
    for (const name of names) {
      const component = this.components.get(name);
      if (!component) {
        throw new Error(`Component not found: ${name}`);
      }
      components[name] = component;
    }
    return components;
  }

  async shutdown() {
    this.logger.info("Shutting down application...");

    // Shutdown all components in reverse initialization order
    const componentNames = Array.from(this.components.keys()).reverse();

    for (const name of componentNames) {
      const component = this.components.get(name);
      try {
        await component.shutdown();
        this.logger.debug(`Component ${name} shut down successfully`);
      } catch (error) {
        this.logger.error(`Error shutting down ${name}:`, error);
      }
    }

    this.components.clear();
    super.shutdown();
  }
}

module.exports = Application;
