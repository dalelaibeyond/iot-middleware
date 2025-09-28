const eventBus = require('./eventBus');
const logger = require('../../utils/logger');

class MessageProcessor {
    constructor() {
        this.middlewares = [];
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
                eventBus.publish('message.processed', { message, context });
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
