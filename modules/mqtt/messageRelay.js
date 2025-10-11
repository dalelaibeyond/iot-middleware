const BaseComponent = require("../core/BaseComponent");
const eventBus = require("../core/eventBus");

class MessageRelay extends BaseComponent {
  constructor(options = {}) {
    super(options);
    this.relayRules = new Map();
    this.relayCount = 0;
  }

  async initialize() {
    try {
      // Message relay is enabled by default, will be updated in setupRelayFromConfig
      // Subscribe to processed messages
      eventBus.on("message.processed", this.handleMessage.bind(this));

      // Auto-generate rules from messageRelay config
      if (this.options.patterns) {
        this.setupRelayFromConfig();
      }

      this.logger.info(
        `Message relay initialized with ${this.relayRules.size} rule(s)`
      );
    } catch (error) {
      this.logger.error("Failed to initialize Message relay:", error);
      throw error;
    }
  }

  setupRelayFromConfig() {
    const relayConfig = this.options;

    // Create relay rules for each pattern
    Object.entries(relayConfig.patterns).forEach(
      ([category, targetPattern]) => {
        // Source pattern matches original topics like "V5008Upload/gateway123/temperature"
        const sourcePattern = `^${category}/([^/]+)/(.*)$`;

        this.addRelayRule({
          sourcePattern: sourcePattern,
          category: category,
          targetPattern: targetPattern,
          transform: (message) => {
            // Extract gateway ID from the original topic
            if (message.meta && message.meta.rawTopic) {
              const parts = message.meta.rawTopic.split("/");
              if (parts.length >= 2) {
                const gatewayId = parts[1];
                // Replace ${gatewayId} placeholder with actual gateway ID
                const newTopic = targetPattern.replace(
                  "${gatewayId}",
                  gatewayId
                );
                // Create a clean normalized payload with only the necessary fields
                const normalizedPayload = {
                  deviceId: message.deviceId,
                  deviceType: message.deviceType,
                  sensorId: message.sensorId,
                  sensorType: message.sensorType,
                  ts: message.ts,
                  payload: message.payload,
                  meta: message.meta,
                };

                return { topic: newTopic, payload: normalizedPayload };
              }
            }
            return { topic: null, payload: message };
          },
        });

        this.logger.debug(
          `Added relay rule for category: ${category} with target pattern: ${targetPattern}`
        );
      }
    );
  }

  addRelayRule(rule) {
    if (!rule.sourcePattern) {
      throw new Error("Relay rule must have sourcePattern");
    }

    const ruleId = `rule_${Date.now()}_${Math.random()
      .toString(36)
      .substr(2, 9)}`;
    this.relayRules.set(ruleId, {
      ...rule,
      sourceRegex: new RegExp(rule.sourcePattern),
      transform:
        rule.transform ||
        ((msg) => ({ topic: rule.targetTopic, payload: msg })),
    });

    return ruleId;
  }

  removeRelayRule(ruleId) {
    return this.relayRules.delete(ruleId);
  }

  handleMessage(message) {
    if (!message) {
      return;
    }

    // Check if message has meta.rawTopic (from normalized messages)
    const topicToCheck = message.meta?.rawTopic || message.topic;

    if (!topicToCheck) {
      this.logger.debug("Message has no topic to relay");
      return;
    }

    for (const [ruleId, rule] of this.relayRules) {
      if (rule.sourceRegex.test(topicToCheck)) {
        this.relayMessage(message, rule, topicToCheck);
      }
    }
  }

  async relayMessage(message, rule, sourceTopic) {
    try {
      // Transform message if transformer function exists
      const transformed = rule.transform(message);

      if (!transformed.topic) {
        this.logger.warn("Transform did not produce a valid topic");
        return;
      }

      // Emit event for MQTT client to handle
      eventBus.emit("relay.message", {
        topic: transformed.topic,
        payload: transformed.payload,
      });

      this.relayCount++;
      this.logger.debug(
        `Relayed message from ${sourceTopic} to ${transformed.topic}`
      );

      eventBus.emit("relay.success", {
        sourceTopic: sourceTopic,
        targetTopic: transformed.topic,
      });
    } catch (error) {
      this.logger.error("Error relaying message:", error);
      eventBus.emit("relay.error", {
        error: error.message,
        sourceTopic: sourceTopic,
      });
    }
  }

  getRelayRules() {
    return Array.from(this.relayRules.entries()).map(([id, rule]) => ({
      id,
      sourcePattern: rule.sourcePattern,
      category: rule.category,
      targetPattern: rule.targetPattern,
      hasTransform: !!rule.transform,
    }));
  }

  getRelayCount() {
    return this.relayCount;
  }

  async shutdown() {
    try {
      this.relayRules.clear();
      super.shutdown();
    } catch (error) {
      this.logger.error("Error during Message relay shutdown:", error);
      throw error;
    }
  }
}

module.exports = MessageRelay;
