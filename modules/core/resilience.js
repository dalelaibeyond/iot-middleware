const logger = require('../../utils/logger');
const eventBus = require('./eventBus');

class CircuitBreaker {
    constructor(options = {}) {
        this.threshold = options.threshold || 0.5; // 50% error rate threshold
        this.windowSize = options.windowSize || 10000; // 10 seconds
        this.minRequests = options.minRequests || 10; // Minimum requests before tripping
        this.timeout = options.timeout || 30000; // 30 seconds breaker timeout

        this.state = 'CLOSED'; // CLOSED, OPEN, HALF_OPEN
        this.lastError = null;
        this.windowStart = Date.now();
        this.requests = 0;
        this.failures = 0;
    }

    async execute(command) {
        this.checkWindow();

        if (this.state === 'OPEN') {
            if (Date.now() - this.lastError >= this.timeout) {
                this.state = 'HALF_OPEN';
            } else {
                throw new Error('Circuit breaker is OPEN');
            }
        }

        try {
            this.requests++;
            const result = await command();
            
            if (this.state === 'HALF_OPEN') {
                this.state = 'CLOSED';
                this.reset();
            }

            return result;
        } catch (error) {
            this.failures++;
            this.lastError = Date.now();

            if (this.shouldTrip()) {
                this.state = 'OPEN';
                eventBus.publish('circuitBreaker.open', {
                    errorRate: this.failures / this.requests,
                    totalRequests: this.requests
                });
            }

            throw error;
        }
    }

    shouldTrip() {
        return this.requests >= this.minRequests && 
               (this.failures / this.requests) >= this.threshold;
    }

    checkWindow() {
        const now = Date.now();
        if (now - this.windowStart >= this.windowSize) {
            this.reset();
            this.windowStart = now;
        }
    }

    reset() {
        this.requests = 0;
        this.failures = 0;
    }

    getStatus() {
        return {
            state: this.state,
            requests: this.requests,
            failures: this.failures,
            errorRate: this.requests ? (this.failures / this.requests) : 0
        };
    }
}

class RateLimiter {
    constructor(options = {}) {
        this.windowMs = options.windowMs || 1000; // 1 second window
        this.maxRequests = options.maxRequests || 1000; // max requests per window
        this.requests = new Map();
    }

    async checkLimit(key) {
        const now = Date.now();
        const windowStart = now - this.windowMs;

        // Clean old entries
        this.requests.forEach((timestamp, reqKey) => {
            if (timestamp < windowStart) {
                this.requests.delete(reqKey);
            }
        });

        // Count requests in current window
        const requestCount = Array.from(this.requests.values())
            .filter(timestamp => timestamp > windowStart)
            .length;

        if (requestCount >= this.maxRequests) {
            throw new Error('Rate limit exceeded');
        }

        this.requests.set(key, now);
        return true;
    }
}

module.exports = {
    CircuitBreaker,
    RateLimiter
};
