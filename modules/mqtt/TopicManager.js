const BaseComponent = require('../core/BaseComponent');

class TopicManager extends BaseComponent {
    constructor(options = {}) {
        super(options);
        this.topicHandlers = new Map();
    }

    initialize() {
        // Load topic patterns from config
        this.patterns = this.config.mqtt.patterns || {};
    }

    registerTopicHandler(pattern, handler) {
        this.topicHandlers.set(pattern, handler);
    }

    matchTopic(topic) {
        for (const [pattern, handler] of this.topicHandlers) {
            if (this.topicMatchesPattern(topic, pattern)) {
                return handler;
            }
        }
        return null;
    }

    topicMatchesPattern(topic, pattern) {
        const topicParts = topic.split('/');
        const patternParts = pattern.split('/');

        if (patternParts.length > topicParts.length) {
            return false;
        }

        for (let i = 0; i < patternParts.length; i++) {
            if (patternParts[i] === '#') {
                return true;
            }
            if (patternParts[i] !== '+' && patternParts[i] !== topicParts[i]) {
                return false;
            }
        }

        return patternParts.length === topicParts.length;
    }

    parseTopicComponents(topic) {
        const parts = topic.split('/');
        return {
            category: parts[0],
            gatewayId: parts[1],
            type: parts[2],
            remaining: parts.slice(3).join('/')
        };
    }

    buildTopic(components) {
        const { category, gatewayId, type, remaining } = components;
        const parts = [category, gatewayId, type];
        if (remaining) {
            parts.push(remaining);
        }
        return parts.join('/');
    }

    validateTopic(topic) {
        const components = this.parseTopicComponents(topic);
        return (
            components.category &&
            components.gatewayId &&
            components.type &&
            ['sensors', 'devices'].includes(components.category)
        );
    }
}

module.exports = TopicManager;