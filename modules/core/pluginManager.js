const path = require('path');
const fs = require('fs').promises;
const logger = require('../../utils/logger');
const eventBus = require('./eventBus');

class PluginManager {
    constructor() {
        this.plugins = new Map();
        this.pluginDir = path.join(__dirname, '../plugins');
    }

    /**
     * Load all plugins from the plugins directory
     */
    async loadPlugins() {
        try {
            await fs.mkdir(this.pluginDir, { recursive: true });
            const files = await fs.readdir(this.pluginDir);
            
            for (const file of files) {
                if (file.endsWith('.js')) {
                    await this.loadPlugin(file);
                }
            }
        } catch (error) {
            logger.error('Error loading plugins:', error);
        }
    }

    /**
     * Load a specific plugin
     * @param {string} filename - Plugin filename
     */
    async loadPlugin(filename) {
        try {
            const pluginPath = path.join(this.pluginDir, filename);
            const plugin = require(pluginPath);

            if (typeof plugin.initialize !== 'function') {
                throw new Error(`Plugin ${filename} must export an initialize function`);
            }

            const pluginName = filename.replace('.js', '');
            await plugin.initialize(eventBus);
            this.plugins.set(pluginName, plugin);
            logger.info(`Plugin loaded: ${pluginName}`);
        } catch (error) {
            logger.error(`Error loading plugin ${filename}:`, error);
        }
    }

    /**
     * Get a loaded plugin by name
     * @param {string} name - Plugin name
     */
    getPlugin(name) {
        return this.plugins.get(name);
    }

    /**
     * List all loaded plugins
     */
    listPlugins() {
        return Array.from(this.plugins.keys());
    }
}

// Singleton instance
const pluginManager = new PluginManager();

module.exports = pluginManager;
