const mqtt = require("mqtt");
const { normalize } = require("./normalizers");
const logger = require("../utils/logger");
const eventBus = require("./core/eventBus");
const MessageProcessor = require("./core/messageProcessor");
const WorkerPool = require("./core/workerPool");
const { CircuitBreaker, RateLimiter } = require("./core/resilience");
const BatchManager = require("./core/batchManager");

class MQTTHandler {
    constructor(options = {}) {
        const config = require('../config/config.json');
        
        this.options = {
            url: process.env.MQTT_URL || "mqtt://localhost:1883",
            topics: config.mqtt.topics,
            mqttOptions: config.mqtt.options,
            ...options
        };

        // Initialize resilience components
        this.rateLimiter = new RateLimiter({
            windowMs: 1000,  // 1 second
            maxRequests: config.mqtt.rateLimit || 10000 // 10k messages per second
        });

        this.circuitBreaker = new CircuitBreaker({
            threshold: 0.5,     // 50% error rate
            windowSize: 10000,  // 10 seconds
            minRequests: 10,    // Minimum requests before tripping
            timeout: 30000     // 30 seconds breaker timeout
        });

        // Initialize batch manager
        this.batchManager = new BatchManager({
            batchSize: config.writeBuffer.batchSize || 1000,
            flushInterval: config.writeBuffer.flushInterval || 1000,
            maxBatchSize: config.writeBuffer.maxBatchSize || 10000
        });

        // Store dependencies
        this.dataStore = options.dataStore;
        this.writeBuffer = options.writeBuffer;
        this.wsServer = options.wsServer;
        this.callbackManager = options.callbackManager;

        // Initialize message processor
        this.messageProcessor = new MessageProcessor();
        this.initializeMessagePipeline();

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

    initializeMessagePipeline() {
        // Add middleware for storing latest data
        this.messageProcessor.use(async (message, context, next) => {
            if (this.dataStore) {
                this.dataStore.set(message.deviceId, message);
                logger.debug(`Updated latest data for device ${message.deviceId}`);
            }
            await next();
        });

        // Add middleware for WebSocket broadcasting
        this.messageProcessor.use(async (message, context, next) => {
            if (this.wsServer) {
                this.wsServer.broadcast(message);
                logger.debug(`Broadcasted to WebSocket clients`);
            }
            await next();
        });

        // Add middleware for callback notifications
        this.messageProcessor.use(async (message, context, next) => {
            if (this.callbackManager) {
                await this.callbackManager.notify(message);
                logger.debug(`Notified registered callbacks`);
            }
            await next();
        });

        // Add middleware for database operations
        this.messageProcessor.use(async (message, context, next) => {
            if (this.writeBuffer) {
                await this.writeBuffer.push(message);
                logger.debug(`Pushed to write buffer`);
            }
            await next();
        });

        // Subscribe to relevant events
        eventBus.subscribe('message.error', (error) => {
            logger.error('Error in message processing:', error);
        });
    }

    async processNormalizedMessage(normalized) {
        logger.debug(`Processing normalized message for device ${normalized.deviceId}`);
        try {
            await this.messageProcessor.process(normalized, {
                topic: this.options.topics,
                timestamp: new Date()
            });
        } catch (error) {
            logger.error(`Error in message processing pipeline:`, error);
            eventBus.publish('message.error', error);
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
