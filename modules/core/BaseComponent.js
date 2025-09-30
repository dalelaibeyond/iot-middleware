const configManager = require('../../config/ConfigManager');
const logger = require('../../utils/logger');

class BaseComponent {
    constructor(options = {}) {
        this.config = configManager;
        this.logger = logger;
        this.options = options;
    }

    initialize() {
        throw new Error('initialize() must be implemented by subclass');
    }

    shutdown() {
        // Default implementation
        this.logger.debug(`Shutting down ${this.constructor.name}`);
    }

    validateOptions(requiredOptions) {
        for (const option of requiredOptions) {
            if (this.options[option] === undefined) {
                throw new Error(`Missing required option: ${option}`);
            }
        }
    }
}

module.exports = BaseComponent;