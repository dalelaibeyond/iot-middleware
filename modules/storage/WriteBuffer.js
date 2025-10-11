const BaseComponent = require("../core/BaseComponent");

class WriteBuffer extends BaseComponent {
  constructor(options = {}) {
    super(options);
    this.buffer = [];
    this.isFlushing = false;
  }

  async initialize() {
    try {
      // Configuration is now passed directly in options
      this.maxSize = this.options.maxSize || 1000;
      this.flushInterval = this.options.flushInterval || 5000;
      this.maxRetries = this.options.maxRetries || 3;

      // Start periodic flush
      this.timer = setInterval(() => this.flush(), this.flushInterval);
      this.logger.debug("WriteBuffer initialized");
    } catch (error) {
      this.logger.error("Failed to initialize WriteBuffer:", error);
      throw error;
    }
  }

  async push(data) {
    if (!this.options.dbStore || !this.options.dbStore.isEnabled) {
      this.logger.debug("Database not available, skipping write buffer push");
      return;
    }
    
    this.buffer.push(data);
    this.logger.debug(
      `Added to write buffer. Current size: ${this.buffer.length}`
    );

    if (this.buffer.length >= this.maxSize) {
      await this.flush();
    }
  }

  async flush() {
    if (this.isFlushing || this.buffer.length === 0) return;
    
    if (!this.options.dbStore || !this.options.dbStore.isEnabled) {
      this.logger.debug("Database not available, skipping write buffer flush");
      return;
    }

    this.isFlushing = true;
    const batchToFlush = [...this.buffer];
    this.buffer = [];

    try {
      await this._saveBatch(batchToFlush);
    } catch (error) {
      this.logger.error("Flush failed:", error);
      // Put items back in buffer if save failed
      this.buffer.unshift(...batchToFlush);
    } finally {
      this.isFlushing = false;
    }
  }

  async _saveBatch(batch, retryCount = 0) {
    try {
      await this.options.dbStore.saveBatch(batch);
    } catch (error) {
      if (retryCount < this.maxRetries) {
        this.logger.warn(
          `Batch save failed, retrying... (${retryCount + 1}/${
            this.maxRetries
          })`
        );
        await new Promise((resolve) =>
          setTimeout(resolve, 1000 * (retryCount + 1))
        );
        return this._saveBatch(batch, retryCount + 1);
      }

      // Fall back to individual saves
      this.logger.warn("Batch save failed, falling back to individual saves");
      for (const item of batch) {
        try {
          await this.options.dbStore.saveHistory(item);
        } catch (singleError) {
          this.logger.error("Failed to save individual record:", singleError);
        }
      }
    }
  }

  getStats() {
    return {
      currentSize: this.buffer.length,
      maxSize: this.maxSize,
      isFlushing: this.isFlushing,
    };
  }

  getBufferSize() {
    return this.buffer.length;
  }

  async shutdown() {
    try {
      if (this.timer) {
        clearInterval(this.timer);
      }
      if (this.buffer.length > 0) {
        await this.flush();
      }
      super.shutdown();
    } catch (error) {
      this.logger.error("Error during WriteBuffer shutdown:", error);
      throw error;
    }
  }
}

module.exports = WriteBuffer;
