const fetch = require('node-fetch');
const logger = require('../utils/logger');

class CallbackManager {
    constructor() {
        const config = require('../config/config.json');
        
        this.callbacks = new Map();
        this.retryLimit = config.callbacks.retryLimit;
        this.retryDelay = config.callbacks.retryDelay;
    }

    registerCallback(url, config = {}) {
        const id = Math.random().toString(36).substring(7);
        this.callbacks.set(id, {
            url,
            config: {
                retryLimit: config.retryLimit || this.retryLimit,
                retryDelay: config.retryDelay || this.retryDelay
            }
        });
        logger.info(`Registered callback ${id} for URL: ${url}`);
        return id;
    }

    unregisterCallback(id) {
        const removed = this.callbacks.delete(id);
        if (removed) {
            logger.info(`Unregistered callback ${id}`);
        }
        return removed;
    }

    async notify(data) {
        const promises = Array.from(this.callbacks.entries()).map(([id, { url, config }]) => 
            this.sendWithRetry(id, url, data, config)
        );

        try {
            await Promise.allSettled(promises);
        } catch (error) {
            logger.error('Error in callback notification:', error);
        }
    }

    async sendWithRetry(id, url, data, config, attempt = 1) {
        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(data)
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            logger.debug(`Successfully notified callback ${id}`);
        } catch (error) {
            logger.error(`Failed to notify callback ${id} (attempt ${attempt}):`, error);

            if (attempt < config.retryLimit) {
                const delay = config.retryDelay * Math.pow(2, attempt - 1);
                await new Promise(resolve => setTimeout(resolve, delay));
                return this.sendWithRetry(id, url, data, config, attempt + 1);
            } else {
                logger.error(`Callback ${id} failed after ${attempt} attempts`);
            }
        }
    }

    getRegisteredCallbacks() {
        return Array.from(this.callbacks.entries()).map(([id, { url }]) => ({
            id,
            url
        }));
    }
}

module.exports = new CallbackManager();
