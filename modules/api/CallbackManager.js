const BaseComponent = require("../core/BaseComponent");
const eventBus = require("../core/eventBus");
const fetch = require("node-fetch");

class CallbackManager extends BaseComponent {
  constructor(options = {}) {
    super(options);
    this.callbacks = new Map();
  }

  async initialize() {
    try {
      // Subscribe to processed messages
      eventBus.on("message.processed", this.handleMessage.bind(this));
      this.logger.info("Callback manager initialized");
    } catch (error) {
      this.logger.error("Failed to initialize Callback manager:", error);
      throw error;
    }
  }

  registerCallback(url, options = {}) {
    const callbackId = this.generateCallbackId();
    this.callbacks.set(callbackId, {
      url,
      retryLimit: options.retryLimit || this.options.retryLimit || 3,
      retryDelay: options.retryDelay || this.options.retryDelay || 1000,
    });
    return callbackId;
  }

  unregisterCallback(callbackId) {
    return this.callbacks.delete(callbackId);
  }

  async handleMessage(message) {
    const promises = [];
    for (const [callbackId, callback] of this.callbacks) {
      promises.push(this.sendCallback(callbackId, callback, message));
    }
    await Promise.allSettled(promises);
  }

  async sendCallback(callbackId, callback, message, retryCount = 0) {
    try {
      const response = await fetch(callback.url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Callback-ID": callbackId,
        },
        body: JSON.stringify(message),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
    } catch (error) {
      this.logger.error(`Callback error for ${callback.url}:`, error);

      if (retryCount < callback.retryLimit) {
        const delay = callback.retryDelay * Math.pow(2, retryCount);
        await new Promise((resolve) => setTimeout(resolve, delay));
        return this.sendCallback(callbackId, callback, message, retryCount + 1);
      }
    }
  }

  generateCallbackId() {
    return `cb_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  getRegisteredCallbacks() {
    return Array.from(this.callbacks.entries()).map(([id, callback]) => ({
      id,
      url: callback.url,
      retryLimit: callback.retryLimit,
      retryDelay: callback.retryDelay,
    }));
  }

  async shutdown() {
    try {
      this.callbacks.clear();
      super.shutdown();
    } catch (error) {
      this.logger.error("Error during Callback manager shutdown:", error);
      throw error;
    }
  }
}

module.exports = CallbackManager;
