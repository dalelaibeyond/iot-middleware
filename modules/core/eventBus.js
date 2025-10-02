const EventEmitter = require("events");
const logger = require("../../utils/logger");

class EventBus extends EventEmitter {
  constructor() {
    super();
    this.setMaxListeners(0); // Unlimited listeners
  }

  /**
   * Publish an event
   * @param {string} event - Event name
   * @param {any} data - Event data
   */
  publish(event, data) {
    try {
      logger.debug(`Publishing event: ${event}`);
      this.emit(event, data);
    } catch (error) {
      logger.error(`Error publishing event ${event}:`, error);
      throw error;
    }
  }

  // Alias for publish to maintain consistency
  emit(event, data) {
    return super.emit(event, data);
  }

  /**
   * Subscribe to an event
   * @param {string} event - Event name
   * @param {Function} handler - Event handler
   */
  subscribe(event, handler) {
    logger.debug(`Subscribing to event: ${event}`);
    this.on(event, handler);
  }

  /**
   * Subscribe to an event once
   * @param {string} event - Event name
   * @param {Function} handler - Event handler
   */
  subscribeOnce(event, handler) {
    this.once(event, handler);
  }

  /**
   * Unsubscribe from an event
   * @param {string} event - Event name
   * @param {Function} handler - Event handler
   */
  unsubscribe(event, handler) {
    this.removeListener(event, handler);
  }
}

// Singleton instance
const eventBus = new EventBus();

module.exports = eventBus;
