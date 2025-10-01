const BaseComponent = require('../core/BaseComponent');

class WriteBuffer extends BaseComponent {
    constructor(options = {}) {
        super(options);
        this.buffer = [];
        this.isFlushing = false;
    }

    initialize() {
        const config = this.config.writeBuffer;
        this.maxSize = config.maxSize || 1000;
        this.flushInterval = config.flushInterval || 5000;
        this.maxRetries = config.maxRetries || 3;
        
        // Start periodic flush
        this.timer = setInterval(() => this.flush(), this.flushInterval);
    }

    async push(data) {
        this.buffer.push(data);
        this.logger.debug(`Added to write buffer. Current size: ${this.buffer.length}`);

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
            await this._saveBatch(batchToFlush);
        } catch (error) {
            this.logger.error('Flush failed:', error);
            // Put items back in buffer if save failed
            this.buffer.unshift(...batchToFlush);
        } finally {
            this.isFlushing = false;
        }
    }

    async _saveBatch(batch, retryCount = 0) {
        try {
            await this.options.dbStore.saveBatch(batch);
            this.logger.debug(`Successfully flushed ${batch.length} records`);
        } catch (error) {
            if (retryCount < this.maxRetries) {
                this.logger.warn(`Batch save failed, retrying... (${retryCount + 1}/${this.maxRetries})`);
                await new Promise(resolve => setTimeout(resolve, 1000 * (retryCount + 1)));
                return this._saveBatch(batch, retryCount + 1);
            }

            // Fall back to individual saves
            this.logger.warn('Batch save failed, falling back to individual saves');
            for (const item of batch) {
                try {
                    await this.options.dbStore.saveHistory(item);
                } catch (singleError) {
                    this.logger.error('Failed to save individual record:', singleError);
                }
            }
        }
    }

    getStats() {
        return {
            currentSize: this.buffer.length,
            maxSize: this.maxSize,
            isFlushing: this.isFlushing
        };
    }

    getBufferSize() {
        return this.buffer.length;
    }

    shutdown() {
        if (this.timer) {
            clearInterval(this.timer);
        }
        if (this.buffer.length > 0) {
            return this.flush();
        }
        super.shutdown();
    }
}

module.exports = WriteBuffer;
