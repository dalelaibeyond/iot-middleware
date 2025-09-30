const BaseComponent = require('../core/BaseComponent');
const eventBus = require('../core/eventBus');

class MqttHandler extends BaseComponent {
    constructor(options = {}) {
        super(options);
        this.topicHandlers = new Map();
    }

    initialize() {
        // Subscribe to MQTT messages
        eventBus.on('mqtt.message', this.handleMessage.bind(this));
        
        // Register default handlers from config
        if (this.config.mqtt && this.config.mqtt.handlers) {
            Object.entries(this.config.mqtt.handlers).forEach(([topic, handler]) => {
                this.registerHandler(topic, handler);
            });
        }

        this.logger.info('MQTT handler initialized');
    }

    registerHandler(topic, handler) {
        if (typeof handler !== 'function') {
            throw new Error('Handler must be a function');
        }

        const handlers = this.topicHandlers.get(topic) || [];
        handlers.push(handler);
        this.topicHandlers.set(topic, handlers);
        
        this.logger.info(`Registered handler for topic: ${topic}`);
        return () => this.unregisterHandler(topic, handler);
    }

    unregisterHandler(topic, handler) {
        const handlers = this.topicHandlers.get(topic);
        if (!handlers) return false;

        const index = handlers.indexOf(handler);
        if (index === -1) return false;

        handlers.splice(index, 1);
        if (handlers.length === 0) {
            this.topicHandlers.delete(topic);
        } else {
            this.topicHandlers.set(topic, handlers);
        }

        this.logger.info(`Unregistered handler for topic: ${topic}`);
        return true;
    }

    async handleMessage({ topic, payload }) {
        const matchingHandlers = this.findMatchingHandlers(topic);
        
        if (matchingHandlers.length === 0) {
            this.logger.debug(`No handlers found for topic: ${topic}`);
            return;
        }

        const promises = matchingHandlers.map(async handler => {
            try {
                await handler(payload, topic);
            } catch (error) {
                this.logger.error(`Handler error for topic ${topic}:`, error);
                eventBus.emit('mqtt.handler.error', { topic, error: error.message });
            }
        });

        await Promise.all(promises);
    }

    findMatchingHandlers(topic) {
        const handlers = [];
        
        for (const [pattern, patternHandlers] of this.topicHandlers) {
            if (this.topicMatches(topic, pattern)) {
                handlers.push(...patternHandlers);
            }
        }

        return handlers;
    }

    topicMatches(topic, pattern) {
        // Convert MQTT wildcards to regex
        const regexPattern = pattern
            .replace(/\+/g, '[^/]+')    // Single-level wildcard
            .replace(/#$/, '.*');       // Multi-level wildcard
        
        const regex = new RegExp(`^${regexPattern}$`);
        return regex.test(topic);
    }

    getRegisteredTopics() {
        return Array.from(this.topicHandlers.keys());
    }

    getHandlerCount(topic) {
        const handlers = this.topicHandlers.get(topic);
        return handlers ? handlers.length : 0;
    }

    shutdown() {
        this.topicHandlers.clear();
        super.shutdown();
    }
}

module.exports = MqttHandler;