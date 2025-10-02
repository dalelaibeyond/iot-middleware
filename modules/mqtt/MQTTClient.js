const mqtt = require("mqtt");
const BaseComponent = require("../core/BaseComponent");

class MQTTClient extends BaseComponent {
  constructor(options = {}) {
    super(options);
    this.client = null;
    this.isConnected = false;
    this.subscriptions = new Map();
  }

  async initialize() {
    this.validateOptions(["url"]);

    return new Promise((resolve, reject) => {
      try {
        this.client = mqtt.connect(this.options.url, this.config.mqtt.options);
        this.setupEventHandlers(resolve, reject);

        // Set a timeout for connection
        const timeout = setTimeout(() => {
          if (!this.isConnected) {
            this.logger.warn(
              "MQTT connection timeout - continuing without MQTT"
            );
            resolve(); // Don't reject, allow server to start without MQTT
          }
        }, 5000);

        // Clear timeout on successful connection
        this.client.on("connect", () => {
          clearTimeout(timeout);
        });
      } catch (error) {
        this.logger.warn(
          "MQTT initialization failed, continuing without MQTT:",
          error.message
        );
        resolve(); // Don't reject, allow server to start without MQTT
      }
    });
  }

  setupEventHandlers(resolve, reject) {
    this.client.on("connect", () => {
      this.isConnected = true;
      this.logger.info(`Connected to MQTT broker at ${this.options.url}`);
      resolve();
    });

    this.client.on("error", (error) => {
      this.logger.error("MQTT client error:", error);
      if (!this.isConnected) {
        reject(error);
      }
    });

    this.client.on("close", () => {
      this.isConnected = false;
      this.logger.info("MQTT connection closed");
    });

    this.client.on("message", (topic, message) => {
      this.logger.debug(`MQTT message received on topic: ${topic}`);
      // Find all matching subscription patterns
      const matchingHandlers = [];
      for (const [pattern, handlers] of this.subscriptions.entries()) {
        if (this.topicMatches(topic, pattern)) {
          matchingHandlers.push(...handlers);
        }
      }

      if (matchingHandlers.length === 0) {
        this.logger.warn(`No handlers found for topic ${topic}`);
        return;
      }

      this.logger.debug(
        `Found ${matchingHandlers.length} handler(s) for topic ${topic}`
      );
      matchingHandlers.forEach((handler) => {
        try {
          handler(topic, message);
        } catch (error) {
          this.logger.error(
            `Error in MQTT message handler for topic ${topic}:`,
            error
          );
        }
      });
    });
  }

  /**
   * Check if a topic matches a subscription pattern (supports MQTT wildcards + and #)
   */
  topicMatches(topic, pattern) {
    // Exact match
    if (topic === pattern) {
      return true;
    }

    const topicParts = topic.split("/");
    const patternParts = pattern.split("/");

    for (let i = 0; i < patternParts.length; i++) {
      // # matches everything remaining
      if (patternParts[i] === "#") {
        return true;
      }

      // No more topic parts but pattern continues
      if (i >= topicParts.length) {
        return false;
      }

      // + matches exactly one level
      if (patternParts[i] === "+") {
        continue;
      }

      // Exact match required
      if (patternParts[i] !== topicParts[i]) {
        return false;
      }
    }

    // Pattern must match all topic parts (unless ended with #)
    return patternParts.length === topicParts.length;
  }

  subscribe(topic, handler, options = {}) {
    if (!this.isConnected) {
      this.logger.warn(`MQTT not connected, skipping subscription to ${topic}`);
      return Promise.resolve(); // Don't reject, allow server to continue
    }

    return new Promise((resolve, reject) => {
      this.client.subscribe(topic, options, (err) => {
        if (err) {
          this.logger.error(`Failed to subscribe to ${topic}:`, err);
          reject(err);
          return;
        }

        if (!this.subscriptions.has(topic)) {
          this.subscriptions.set(topic, []);
        }
        this.subscriptions.get(topic).push(handler);
        this.logger.info(`Subscribed to ${topic}`);
        resolve();
      });
    });
  }

  publish(topic, message, options = {}) {
    if (!this.isConnected) {
      throw new Error("MQTT client not connected");
    }

    return new Promise((resolve, reject) => {
      this.client.publish(
        topic,
        typeof message === "string" ? message : JSON.stringify(message),
        { qos: 1, ...options },
        (err) => {
          if (err) {
            reject(err);
          } else {
            resolve();
          }
        }
      );
    });
  }

  unsubscribe(topic, handler) {
    if (!this.isConnected) {
      throw new Error("MQTT client not connected");
    }

    const handlers = this.subscriptions.get(topic);
    if (handlers) {
      const index = handlers.indexOf(handler);
      if (index !== -1) {
        handlers.splice(index, 1);
      }

      if (handlers.length === 0) {
        this.subscriptions.delete(topic);
        this.client.unsubscribe(topic);
      }
    }
  }

  async shutdown() {
    if (this.client) {
      await new Promise((resolve) => this.client.end(false, {}, resolve));
    }
    super.shutdown();
  }
}

module.exports = MQTTClient;
