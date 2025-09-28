const logger = require('../utils/logger');

class WriteBuffer {
    constructor(dbStore, options = {}) {
        const config = require('../config/config.json');
        
        this.dbStore = dbStore;
        this.buffer = [];
        this.maxSize = options.maxSize || config.writeBuffer.maxSize;
        this.flushInterval = options.flushInterval || config.writeBuffer.flushInterval;
        this.maxRetries = options.maxRetries || config.writeBuffer.maxRetries;
        this.isFlushing = false;

        // Start periodic flush
        this.timer = setInterval(() => this.flush(), this.flushInterval);
    }

    async push(data) {
        this.buffer.push(data);
        logger.debug(`Added to write buffer. Current size: ${this.buffer.length}`);

        if (this.buffer.length >= this.maxSize) {
            await this.flush();
        }
    }

    async flush() {
        if (this.isFlushing || this.buffer.length === 0) return;

        this.isFlushing = true;
        const batchToFlush = [...this.buffer];
        this.buffer = [];

        try {
            logger.debug(`Flushing ${batchToFlush.length} records to database`);
            
            // Try to save in batch first
            try {
                await this.dbStore.saveBatch(batchToFlush);
                logger.debug('Successfully flushed write buffer using batch operation');
            } catch (batchError) {
                logger.warn('Batch save failed, falling back to individual saves:', batchError.message);
                
                // Fall back to individual saves if batch fails
                for (const item of batchToFlush) {
                    try {
                        await this.dbStore.saveHistory(item);
                    } catch (singleError) {
                        logger.error('Failed to save individual record:', singleError.message);
                        // Add failed item back to buffer
                        this.buffer.push(item);
                    }
                }
            }

            // Check for buffer overflow
            if (this.buffer.length > this.maxSize) {
                logger.warn(`Write buffer overflow, current size: ${this.buffer.length}`);
                this.buffer = this.buffer.slice(-this.maxSize);
                logger.info(`Truncated buffer to ${this.buffer.length} items`);
            }
        } catch (error) {
            logger.error('Critical error in flush operation:', error);
            // Put all items back in buffer on critical error
            this.buffer = [...batchToFlush, ...this.buffer];
        } finally {
            this.isFlushing = false;
        }
    }

    async shutdown() {
        clearInterval(this.timer);
        await this.flush();
    }

    getBufferSize() {
        return this.buffer.length;
    }
}

module.exports = WriteBuffer;
