const logger = require("../../utils/logger");

class BaseComponent {
  constructor(options = {}) {
    this.config = options.config || {};
    this.logger = logger;
    this.options = options;
  }

  async initialize() {
    throw new Error("initialize() must be implemented by subclass");
  }

  async shutdown() {
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
