const BaseComponent = require('./core/BaseComponent');
const configManager = require('../config/ConfigManager');
const MQTTClient = require('./mqtt/MQTTClient');
const TopicManager = require('./mqtt/TopicManager');
const MessageProcessor = require('./core/messageProcessor');
const DatabaseManager = require('./database/DatabaseManager');
const WriteBuffer = require('./storage/WriteBuffer');
const CacheManager = require('./storage/CacheManager');
const MessageRelay = require('./mqtt/messageRelay');
const WebSocketServer = require('./api/WebSocketServer');
const CallbackManager = require('./api/CallbackManager');
const dataStore = require('./storage/dataStore');
const eventBus = require('./core/eventBus');
const normalizeTemperature = require('./normalizers/temperatureNormalizer');

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
            
            this.logger.info('Application initialized successfully');
        } catch (error) {
            this.logger.error('Failed to initialize application:', error);
            throw error;
        }
    }

    async initializeComponents() {
        // Database
        const dbManager = new DatabaseManager();
        await dbManager.initialize();
        this.components.set('database', dbManager);

        // Cache
        const cacheManager = new CacheManager();
        await cacheManager.initialize();
        this.components.set('cache', cacheManager);

        // Data Store
        await dataStore.initialize();
        this.components.set('dataStore', dataStore);

        // Write Buffer
        const writeBuffer = new WriteBuffer({ dbStore: dbManager });
        await writeBuffer.initialize();
        this.components.set('writeBuffer', writeBuffer);

        // Topic Manager
        const topicManager = new TopicManager();
        await topicManager.initialize();
        this.components.set('topicManager', topicManager);

        // Message Processor
        const messageProcessor = new MessageProcessor();
        messageProcessor.use(async (message, context, next) => {
            this.logger.debug('Applying temperature normalizer', { deviceId: message.devId || message.deviceId });
            const normalized = normalizeTemperature(message, context.topic, context);
            Object.assign(message, normalized); // Merge normalized into message
            this.logger.debug('Message normalized', { deviceId: message.deviceId, sensorType: message.sensorType });
            await next();
        });
        await messageProcessor.initialize();
        this.components.set('messageProcessor', messageProcessor);

        // MQTT Client
        const mqttClient = new MQTTClient({
            url: process.env.MQTT_URL || 'mqtt://localhost:1883'
        });
        await mqttClient.initialize();
        this.components.set('mqtt', mqttClient);

        // Message Relay (if enabled)
        if (configManager.messageRelay.enabled) {
            const messageRelay = new MessageRelay();
            await messageRelay.initialize();
            this.components.set('messageRelay', messageRelay);
            this.logger.info('Message relay enabled');
        }

        // WebSocket Server
        const wsServer = new WebSocketServer({ server: this.options.server });
        await wsServer.initialize();
        this.components.set('wsServer', wsServer);
        this.logger.info('WebSocket server initialized');

        // Callback Manager (if enabled)
        if (configManager.callbacks && configManager.callbacks.enabled) {
            const callbackManager = new CallbackManager();
            await callbackManager.initialize();
            this.components.set('callbackManager', callbackManager);
            this.logger.info('Callback manager enabled');
        }

        // Subscribe to configured topics
        const topics = configManager.mqtt.topics;
        for (const topic of topics) {
            await mqttClient.subscribe(topic, this.handleMessage.bind(this));
        }
    }

    setupEventListeners() {
        eventBus.on('message.processed', async (message) => {
            const { writeBuffer, cache } = this.getComponents(['writeBuffer', 'cache']);
            
            // Update cache
            cache.set(message.deviceId, message);
            
            // Add to write buffer
            await writeBuffer.push(message);
        });

        eventBus.on('message.error', async (error) => {
            this.logger.error('Message processing error:', error);
        });

        // Handle relay messages
        eventBus.on('relay.message', async (relayData) => {
            try {
                const mqttClient = this.components.get('mqtt');
                if (mqttClient) {
                    await mqttClient.publish(relayData.topic, relayData.payload);
                    this.logger.debug(`Relayed message to topic: ${relayData.topic}`);
                }
            } catch (error) {
                this.logger.error('Error publishing relay message:', error);
            }
        });
    }

    async handleMessage(topic, message) {
        try {
            this.logger.debug(`Received MQTT message on topic: ${topic}`);
            const { topicManager, messageProcessor } = this.getComponents(['topicManager', 'messageProcessor']);

            // Skip relayed messages to prevent processing loops
            const relayPrefix = this.config.messageRelay?.topicPrefix || 'new';
            if (topic.includes(`/${relayPrefix}/`)) {
                this.logger.debug(`Skipping relayed message on topic: ${topic}`);
                return;
            }

            // Validate topic
            if (!topicManager.validateTopic(topic)) {
                this.logger.warn(`Invalid topic format: ${topic}`);
                return;
            }

            // Parse message
            const payload = JSON.parse(message.toString());
            this.logger.debug(`Parsed payload`, { deviceId: payload.devId || payload.deviceId });

            // Extract topic components
            const topicComponents = topicManager.parseTopicComponents(topic);

            // Process message
            await messageProcessor.process(payload, { topic, ...topicComponents });
            this.logger.debug(`Message processed successfully for topic: ${topic}`);

        } catch (error) {
            this.logger.error(`Error handling message on topic ${topic}:`, error);
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
        this.logger.info('Shutting down application...');
        
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
