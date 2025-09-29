const logger = require('../utils/logger');
const config = require('../config/config.json');
const mqtt = require('mqtt');

class MessageRelay {
    constructor(options = {}) {
        this.config = config.messageRelay;
        this.enabled = this.config.enabled;
        this.topicPrefix = this.config.topicPrefix;
        this.patterns = this.config.patterns;
        this.mqttClient = null;

        if (this.enabled) {
            this.connect(options.mqttUrl || process.env.MQTT_URL || "mqtt://localhost:1883");
        } else {
            logger.info("Message relay is disabled");
        }
    }

    connect(mqttUrl) {
        logger.info("Initializing message relay MQTT client...");
        this.mqttClient = mqtt.connect(mqttUrl);

        this.mqttClient.on('connect', () => {
            logger.info('Message relay MQTT client connected');
        });

        this.mqttClient.on('error', (error) => {
            logger.error('Message relay MQTT client error:', error);
        });
    }

    generateNewTopic(originalTopic) {
        // Skip if the topic already contains our prefix to prevent recursion
        if (originalTopic.includes(`/${this.topicPrefix}/`)) {
            return null;
        }

        // Split the topic into parts
        const parts = originalTopic.split('/');
        const category = parts[0]; // 'sensors' or 'devices'
        
        if (!this.patterns[category]) {
            logger.warn(`No relay pattern found for category: ${category}`);
            return null;
        }

        // Extract components
        const gatewayId = parts[1];
        const type = parts[2];

        if (!gatewayId || !type) {
            logger.warn(`Invalid topic structure: ${originalTopic}`);
            return null;
        }

        // Replace placeholders in the pattern
        const newTopic = this.patterns[category]
            .replace('${prefix}', this.topicPrefix)
            .replace('${gatewayId}', gatewayId)
            .replace('${type}', type);

        return newTopic;
    }

    publishNormalizedMessage(originalTopic, normalizedMessage) {
        if (!this.enabled || !this.mqttClient) {
            return;
        }

        try {
            const newTopic = this.generateNewTopic(originalTopic);
            if (!newTopic) {
                return;
            }

            // Publish the normalized message to the new topic
            this.mqttClient.publish(newTopic, JSON.stringify(normalizedMessage), { qos: 1 }, (err) => {
                if (err) {
                    logger.error('Failed to publish normalized message:', err);
                } else {
                    logger.debug(`Published normalized message to ${newTopic}`);
                }
            });
        } catch (error) {
            logger.error('Error in publishNormalizedMessage:', error);
        }
    }

    // Cleanup resources
    close() {
        if (this.mqttClient) {
            this.mqttClient.end();
        }
    }
}

module.exports = MessageRelay;