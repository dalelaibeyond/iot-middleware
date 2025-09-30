const BaseComponent = require('../core/BaseComponent');
const eventBus = require('../core/eventBus');
const { db } = require('../../config/db');

class DbStore extends BaseComponent {
    constructor(options = {}) {
        super(options);
        this.batchSize = options.batchSize || 100;
        this.batchTimeout = options.batchTimeout || 5000;
        this.pendingMessages = [];
        this.timer = null;
    }

    initialize() {
        // Subscribe to processed messages
        eventBus.on('message.processed', this.handleMessage.bind(this));
        
        // Start batch timer
        this.startBatchTimer();
        
        this.logger.info('Database store initialized');
    }

    handleMessage(message) {
        if (!message || !message.deviceId) {
            this.logger.warn('Received invalid message:', message);
            return;
        }

        this.pendingMessages.push({
            device_id: message.deviceId,
            timestamp: message.timestamp || Date.now(),
            data: JSON.stringify(message),
            created_at: new Date()
        });

        if (this.pendingMessages.length >= this.batchSize) {
            this.flushBatch();
        }
    }

    async flushBatch() {
        if (this.pendingMessages.length === 0) return;

        const messages = [...this.pendingMessages];
        this.pendingMessages = [];
        this.resetBatchTimer();

        try {
            await db.transaction(async trx => {
                const chunks = this.chunkArray(messages, 1000);
                for (const chunk of chunks) {
                    await trx('device_messages').insert(chunk);
                }
            });

            eventBus.emit('db.batch.stored', { count: messages.length });
            this.logger.info(`Stored ${messages.length} messages in database`);
        } catch (error) {
            this.logger.error('Error storing messages in database:', error);
            eventBus.emit('db.error', { error: error.message });
            
            // Put messages back in queue
            this.pendingMessages.unshift(...messages);
        }
    }

    startBatchTimer() {
        if (!this.timer) {
            this.timer = setInterval(() => this.flushBatch(), this.batchTimeout);
        }
    }

    resetBatchTimer() {
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
        this.startBatchTimer();
    }

    chunkArray(array, size) {
        const chunks = [];
        for (let i = 0; i < array.length; i += size) {
            chunks.push(array.slice(i, i + size));
        }
        return chunks;
    }

    async getDeviceMessages(deviceId, options = {}) {
        let query = db('device_messages').where('device_id', deviceId);

        if (options.startTime) {
            query = query.where('timestamp', '>=', options.startTime);
        }
        if (options.endTime) {
            query = query.where('timestamp', '<=', options.endTime);
        }
        if (options.limit) {
            query = query.limit(options.limit);
        }

        const messages = await query.orderBy('timestamp', 'desc');
        return messages.map(msg => ({
            ...msg,
            data: JSON.parse(msg.data)
        }));
    }

    shutdown() {
        if (this.timer) {
            clearInterval(this.timer);
        }
        return this.flushBatch();
    }
}

module.exports = DbStore;