const eventBus = require('./eventBus');
const logger = require('../../utils/logger');

class MessageProcessor {
    constructor() {
        this.middlewares = [];
    }

    async initialize() {
        // No initialization needed for message processor
    }

    async shutdown() {
        // No shutdown needed for message processor
    }

    /**
     * Add middleware to the processing pipeline
     * @param {Function} middleware - Middleware function
     */
    use(middleware) {
        this.middlewares.push(middleware);
        return this;
    }

    /**
     * Process a message through the middleware pipeline
     * @param {Object} message - Message to process
     * @param {Object} context - Processing context
     */
    async process(message, context = {}) {
        logger.debug('MessageProcessor processing message', { deviceId: message.devId || message.deviceId });
        let index = 0;
        const stack = [...this.middlewares];

        const next = async (err) => {
            if (err) {
                logger.error('Error in message processing:', err);
                eventBus.publish('message.error', { error: err, message, context });
                return;
            }

            const middleware = stack[index++];
            if (!middleware) {
                logger.debug('All middlewares completed, emitting message.processed');
                eventBus.publish('message.processed', message);
                return;
            }

            try {
                await middleware(message, context, next);
            } catch (error) {
                next(error);
            }
        };

        await next();
    }
}

module.exports = MessageProcessor;
