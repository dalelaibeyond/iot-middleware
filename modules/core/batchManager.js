const logger = require('../../utils/logger');
const eventBus = require('./eventBus');

class BatchManager {
    constructor(options = {}) {
        this.batchSize = options.batchSize || 1000;
        this.flushInterval = options.flushInterval || 1000; // 1 second
        this.maxBatchSize = options.maxBatchSize || 10000;
        this.batches = new Map();
        
        // Start periodic flush
        this.timer = setInterval(() => this.flushAll(), this.flushInterval);
    }

    async add(key, data) {
        if (!this.batches.has(key)) {
            this.batches.set(key, []);
        }

        const batch = this.batches.get(key);
        batch.push(data);

        // Check if batch should be flushed
        if (batch.length >= this.batchSize) {
            await this.flush(key);
        }

        // Emergency flush if batch gets too large
        if (batch.length > this.maxBatchSize) {
            logger.warn(`Batch size exceeded for ${key}, emergency flush`);
            await this.flush(key);
        }
    }

    async flush(key) {
        const batch = this.batches.get(key);
        if (!batch || batch.length === 0) return;

        try {
            // Publish batch for processing
            eventBus.publish('batch.ready', {
                key,
                data: batch.slice() // Create copy of batch
            });

            // Clear the batch
            this.batches.set(key, []);
        } catch (error) {
            logger.error(`Error flushing batch for ${key}:`, error);
            eventBus.publish('batch.error', { key, error });
        }
    }

    async flushAll() {
        const keys = Array.from(this.batches.keys());
        await Promise.all(keys.map(key => this.flush(key)));
    }

    shutdown() {
        clearInterval(this.timer);
        return this.flushAll();
    }

    getStatus() {
        const status = {};
        this.batches.forEach((batch, key) => {
            status[key] = {
                size: batch.length,
                memoryUsage: process.memoryUsage().heapUsed
            };
        });
        return status;
    }
}

module.exports = BatchManager;
