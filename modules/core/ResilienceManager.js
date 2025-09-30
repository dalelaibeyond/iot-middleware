class ResilienceManager extends require('../core/BaseComponent') {
    constructor(options = {}) {
        super(options);
        this.rateLimiters = new Map();
        this.circuitBreakers = new Map();
    }

    createRateLimiter(name, options) {
        if (this.rateLimiters.has(name)) {
            return this.rateLimiters.get(name);
        }

        const rateLimiter = new RateLimiter({
            windowMs: options.windowMs || 1000,
            maxRequests: options.maxRequests || 1000
        });

        this.rateLimiters.set(name, rateLimiter);
        return rateLimiter;
    }

    createCircuitBreaker(name, options) {
        if (this.circuitBreakers.has(name)) {
            return this.circuitBreakers.get(name);
        }

        const circuitBreaker = new CircuitBreaker({
            threshold: options.threshold || 0.5,
            windowSize: options.windowSize || 10000,
            minRequests: options.minRequests || 10,
            timeout: options.timeout || 30000
        });

        this.circuitBreakers.set(name, circuitBreaker);
        return circuitBreaker;
    }

    shutdown() {
        this.rateLimiters.clear();
        this.circuitBreakers.clear();
        super.shutdown();
    }
}

class RateLimiter {
    constructor(options) {
        this.windowMs = options.windowMs;
        this.maxRequests = options.maxRequests;
        this.requests = new Map();
    }

    tryAcquire() {
        const now = Date.now();
        this.cleanup(now);
        
        if (this.requests.size >= this.maxRequests) {
            return false;
        }

        this.requests.set(now, true);
        return true;
    }

    cleanup(now) {
        const cutoff = now - this.windowMs;
        for (const [timestamp] of this.requests) {
            if (timestamp < cutoff) {
                this.requests.delete(timestamp);
            }
        }
    }
}

class CircuitBreaker {
    constructor(options) {
        this.threshold = options.threshold;
        this.windowSize = options.windowSize;
        this.minRequests = options.minRequests;
        this.timeout = options.timeout;
        this.failures = 0;
        this.total = 0;
        this.lastFailureTime = 0;
        this.state = 'CLOSED';
    }

    async execute(operation) {
        if (this.state === 'OPEN') {
            if (Date.now() - this.lastFailureTime >= this.timeout) {
                this.state = 'HALF_OPEN';
            } else {
                throw new Error('Circuit breaker is OPEN');
            }
        }

        try {
            const result = await operation();
            this.recordSuccess();
            return result;
        } catch (error) {
            this.recordFailure();
            throw error;
        }
    }

    recordSuccess() {
        this.total++;
        if (this.state === 'HALF_OPEN') {
            this.state = 'CLOSED';
            this.reset();
        }
    }

    recordFailure() {
        this.failures++;
        this.total++;
        this.lastFailureTime = Date.now();

        if (this.total >= this.minRequests && 
            (this.failures / this.total) >= this.threshold) {
            this.state = 'OPEN';
        }
    }

    reset() {
        this.failures = 0;
        this.total = 0;
    }
}

module.exports = { ResilienceManager, RateLimiter, CircuitBreaker };