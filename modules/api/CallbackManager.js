const BaseComponent = require('../core/BaseComponent');
const eventBus = require('../core/eventBus');

class CallbackManager extends BaseComponent {
    constructor(options = {}) {
        super(options);
        this.callbacks = new Map();
    }

    initialize() {
        // Subscribe to processed messages
        eventBus.on('message.processed', this.handleMessage.bind(this));
        this.logger.info('Callback manager initialized');
    }

    registerCallback(url, options = {}) {
        const callbackId = this.generateCallbackId();
        this.callbacks.set(callbackId, {
            url,
            retryLimit: options.retryLimit || this.config.callbacks.retryLimit,
            retryDelay: options.retryDelay || this.config.callbacks.retryDelay
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
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Callback-ID': callbackId
                },
                body: JSON.stringify(message)
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

        } catch (error) {
            this.logger.error(`Callback error for ${callback.url}:`, error);

            if (retryCount < callback.retryLimit) {
                const delay = callback.retryDelay * Math.pow(2, retryCount);
                await new Promise(resolve => setTimeout(resolve, delay));
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
            retryDelay: callback.retryDelay
        }));
    }

    shutdown() {
        this.callbacks.clear();
        super.shutdown();
    }
}

module.exports = CallbackManager;