const path = require('path');
const logger = require('../utils/logger');

class ConfigManager {
    constructor() {
        if (!ConfigManager.instance) {
            this.loadConfig();
            ConfigManager.instance = this;
        }
        return ConfigManager.instance;
    }

    loadConfig() {
        try {
            this.config = require('./config.json');
            this.validateConfig();
        } catch (error) {
            logger.error('Failed to load configuration:', error);
            process.exit(1);
        }
    }

    validateConfig() {
        // Add validation logic here
        const requiredSections = ['mqtt', 'database', 'messageRelay', 'writeBuffer'];
        for (const section of requiredSections) {
            if (!this.config[section]) {
                throw new Error(`Missing required config section: ${section}`);
            }
        }
    }

    get mqtt() {
        return this.config.mqtt;
    }

    get database() {
        return this.config.database;
    }

    get messageRelay() {
        return this.config.messageRelay;
    }

    get writeBuffer() {
        return this.config.writeBuffer;
    }

    get server() {
        return this.config.server;
    }

    get callbacks() {
        return this.config.callbacks;
    }
}

// Create singleton instance
const configManager = new ConfigManager();
Object.freeze(configManager);

module.exports = configManager;