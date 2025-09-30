const BaseComponent = require('../core/BaseComponent');

class CacheManager extends BaseComponent {
    constructor(options = {}) {
        super(options);
        this.cache = new Map();
        this.stats = {
            hits: 0,
            misses: 0,
            evictions: 0
        };
    }

    initialize() {
        const config = this.config.cache || {};
        this.maxSize = config.maxSize || 10000;
        this.ttl = config.ttl || 3600000; // 1 hour default
        
        // Start cleanup interval
        this.cleanupInterval = setInterval(() => this.cleanup(), 60000);
    }

    set(key, value, ttl = this.ttl) {
        // Evict if cache is full
        if (this.cache.size >= this.maxSize) {
            this.evictOldest();
        }

        this.cache.set(key, {
            value,
            expires: Date.now() + ttl
        });
    }

    get(key) {
        const entry = this.cache.get(key);
        
        if (!entry) {
            this.stats.misses++;
            return null;
        }

        if (entry.expires < Date.now()) {
            this.cache.delete(key);
            this.stats.evictions++;
            return null;
        }

        this.stats.hits++;
        return entry.value;
    }

    evictOldest() {
        let oldest = Infinity;
        let oldestKey = null;

        for (const [key, entry] of this.cache.entries()) {
            if (entry.expires < oldest) {
                oldest = entry.expires;
                oldestKey = key;
            }
        }

        if (oldestKey) {
            this.cache.delete(oldestKey);
            this.stats.evictions++;
        }
    }

    cleanup() {
        const now = Date.now();
        for (const [key, entry] of this.cache.entries()) {
            if (entry.expires < now) {
                this.cache.delete(key);
                this.stats.evictions++;
            }
        }
    }

    getStats() {
        return {
            ...this.stats,
            size: this.cache.size,
            maxSize: this.maxSize
        };
    }

    clear() {
        this.cache.clear();
        this.stats = {
            hits: 0,
            misses: 0,
            evictions: 0
        };
    }

    shutdown() {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
        }
        this.cache.clear();
        super.shutdown();
    }
}

module.exports = CacheManager;