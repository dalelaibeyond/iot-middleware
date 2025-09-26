/**
 * Example plugin for message enrichment
 */
class MessageEnrichmentPlugin {
    constructor(eventBus) {
        this.eventBus = eventBus;
    }

    /**
     * Initialize the plugin
     * @param {EventBus} eventBus - Event bus instance
     */
    static async initialize(eventBus) {
        const plugin = new MessageEnrichmentPlugin(eventBus);
        plugin.setup();
        return plugin;
    }

    /**
     * Set up event listeners
     */
    setup() {
        this.eventBus.subscribe('message.received', async (message) => {
            const enriched = await this.enrichMessage(message);
            this.eventBus.publish('message.enriched', enriched);
        });
    }

    /**
     * Enrich a message with additional data
     * @param {Object} message - Original message
     * @returns {Object} Enriched message
     */
    async enrichMessage(message) {
        // Add timestamp if not present
        if (!message.ts) {
            message.ts = new Date().toISOString();
        }

        // Add system metadata
        message.meta = {
            ...message.meta,
            processedAt: new Date().toISOString(),
            nodeVersion: process.version,
            hostname: require('os').hostname()
        };

        return message;
    }
}

module.exports = MessageEnrichmentPlugin;
