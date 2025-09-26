const mqtt = require("mqtt");
const { normalize } = require("./normalizers");
const logger = require("../utils/logger");

class MQTTHandler {
    constructor(options = {}) {
        const config = require('../config/config.json');
        
        this.options = {
            url: process.env.MQTT_URL || "mqtt://localhost:1883",
            topics: config.mqtt.topics,
            mqttOptions: config.mqtt.options,
            ...options
        };

        this.dataStore = options.dataStore;
        this.writeBuffer = options.writeBuffer;
        this.wsServer = options.wsServer;
        this.callbackManager = options.callbackManager;

        this.client = null;
        this.isConnected = false;
    }

    connect() {
        logger.info("Initializing MQTT client...");
        this.client = mqtt.connect(this.options.url);
        this.setupEventHandlers();
        return this.client;
    }

    setupEventHandlers() {
        this.client.on("connect", () => this.handleConnect());
        this.client.on("message", (topic, message) => this.handleMessage(topic, message));
        this.client.on("error", (error) => this.handleError(error));
        this.client.on("close", () => this.handleClose());
    }

    handleConnect() {
        logger.info(`Connected to MQTT broker at ${this.options.url}`);
        this.isConnected = true;
        
        // Subscribe to multiple topics
        this.options.topics.forEach(topic => {
            this.client.subscribe(topic, this.options.mqttOptions, (err) => {
                if (err) {
                    logger.error(`Failed to subscribe to ${topic}:`, err.message);
                } else {
                    logger.info(`Subscribed to ${topic}`);
                }
            });
        });
    }

    async handleMessage(topic, message) {
        try {
            logger.debug(`Received message on topic ${topic}`);
            
            const meta = {
                gatewayId: topic.split("/")[1]
            };

            const normalized = normalize(topic, message, meta);
            if (normalized) {
                await this.processNormalizedMessage(normalized);
            } else {
                logger.error(`Failed to normalize message for topic ${topic}`);
            }
        } catch (error) {
            logger.error('Error processing MQTT message:', error);
        }
    }

    async processNormalizedMessage(normalized) {
        logger.debug(`Processing normalized message for device ${normalized.deviceId}`);

        try {
            // Store latest data in memory
            if (this.dataStore) {
                this.dataStore.set(normalized.deviceId, normalized);
                logger.debug(`Updated latest data for device ${normalized.deviceId}`);
            }

            // Broadcast to WebSocket clients
            if (this.wsServer) {
                this.wsServer.broadcast(normalized);
                logger.debug(`Broadcasted to WebSocket clients`);
            }

            // Send to registered callbacks
            if (this.callbackManager) {
                await this.callbackManager.notify(normalized);
                logger.debug(`Notified registered callbacks`);
            }

            // Use write buffer for database operations
            if (this.writeBuffer) {
                await this.writeBuffer.push(normalized);
                logger.debug(`Pushed to write buffer`);
            }
        } catch (error) {
            logger.error(`Error in message processing pipeline:`, error);
        }
    }

    handleError(error) {
        this.isConnected = false;
        logger.error('MQTT client error:', error);
    }

    handleClose() {
        this.isConnected = false;
        logger.info('MQTT client disconnected');
    }

    shutdown() {
        if (this.client) {
            this.client.end();
            logger.info('MQTT client shut down');
        }
    }

    getStatus() {
        return {
            connected: this.isConnected,
            url: this.options.url,
            topic: this.options.topic
        };
    }
}

module.exports = MQTTHandler;
