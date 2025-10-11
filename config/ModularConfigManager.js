const fs = require("fs");
const path = require("path");
const logger = require("../utils/logger");

class ModularConfigManager {
  constructor(configPath = null) {
    this.configPath = configPath || path.join(__dirname, "modular-config.json");
    this.config = null;
    this.loadConfig();
  }

  /**
   * Load configuration from file
   */
  loadConfig() {
    try {
      const configData = fs.readFileSync(this.configPath, "utf8");
      this.config = JSON.parse(configData);
      this.resolveEnvironmentVariables();
      this.validateConfig();
      logger.info("Configuration loaded successfully");
    } catch (error) {
      logger.error("Failed to load configuration:", error);
      throw error;
    }
  }

  /**
   * Resolve environment variables in configuration
   */
  resolveEnvironmentVariables() {
    const resolveValue = (value) => {
      if (typeof value === "string" && value.includes("${")) {
        const envPattern = /\$\{([^:}]+):?([^}]*)\}/g;
        return value.replace(envPattern, (match, envVar, defaultValue) => {
          return process.env[envVar] || defaultValue;
        });
      }
      return value;
    };

    const resolveObject = (obj) => {
      if (Array.isArray(obj)) {
        return obj.map(resolveObject);
      } else if (obj && typeof obj === "object") {
        const resolved = {};
        for (const [key, value] of Object.entries(obj)) {
          resolved[key] = resolveObject(value);
        }
        return resolved;
      }
      return resolveValue(obj);
    };

    this.config = resolveObject(this.config);
  }

  /**
   * Validate configuration structure
   */
  validateConfig() {
    if (!this.config.modules) {
      throw new Error("Configuration must contain 'modules' section");
    }

    const requiredModules = ["core"];
    for (const module of requiredModules) {
      if (!this.config.modules[module]) {
        throw new Error(`Required module '${module}' is missing from configuration`);
      }
    }

    // Validate core module has required components
    const coreComponents = ["mqtt", "normalizer", "dataStore"];
    for (const component of coreComponents) {
      if (!this.config.modules.core.components[component]) {
        throw new Error(`Required core component '${component}' is missing from configuration`);
      }
    }
  }

  /**
   * Get the full configuration
   * @returns {Object}
   */
  getConfig() {
    return this.config;
  }

  /**
   * Get module configuration
   * @param {string} moduleName - Module name
   * @returns {Object}
   */
  getModule(moduleName) {
    return this.config.modules[moduleName] || null;
  }

  /**
   * Get component configuration
   * @param {string} moduleName - Module name
   * @param {string} componentName - Component name
   * @returns {Object}
   */
  getComponent(moduleName, componentName) {
    const module = this.getModule(moduleName);
    if (!module || !module.components) {
      return null;
    }
    return module.components[componentName] || null;
  }

  /**
   * Check if a module is enabled
   * @param {string} moduleName - Module name
   * @returns {boolean}
   */
  isModuleEnabled(moduleName) {
    const module = this.getModule(moduleName);
    return module && module.enabled === true;
  }

  /**
   * Check if a component is enabled
   * @param {string} moduleName - Module name
   * @param {string} componentName - Component name
   * @returns {boolean}
   */
  isComponentEnabled(moduleName, componentName) {
    const component = this.getComponent(moduleName, componentName);
    return component && component.enabled === true;
  }

  /**
   * Get enabled components for a module
   * @param {string} moduleName - Module name
   * @returns {Array} - Array of enabled component names
   */
  getEnabledComponents(moduleName) {
    const module = this.getModule(moduleName);
    if (!module || !module.enabled || !module.components) {
      return [];
    }

    return Object.entries(module.components)
      .filter(([name, config]) => config.enabled)
      .map(([name]) => name);
  }

  /**
   * Get all enabled modules
   * @returns {Array} - Array of enabled module names
   */
  getEnabledModules() {
    return Object.entries(this.config.modules)
      .filter(([name, config]) => config.enabled)
      .map(([name]) => name);
  }

  /**
   * Get server configuration
   * @returns {Object}
   */
  getServerConfig() {
    return this.config.server || {};
  }

  /**
   * Get logger configuration
   * @returns {Object}
   */
  getLoggerConfig() {
    return this.config.logger || {};
  }

  /**
   * Update configuration (runtime updates)
   * @param {string} path - Dot notation path to update
   * @param {*} value - New value
   */
  updateConfig(path, value) {
    const keys = path.split(".");
    let current = this.config;

    for (let i = 0; i < keys.length - 1; i++) {
      if (!current[keys[i]]) {
        current[keys[i]] = {};
      }
      current = current[keys[i]];
    }

    current[keys[keys.length - 1]] = value;
    logger.info(`Configuration updated: ${path} = ${JSON.stringify(value)}`);
  }

  /**
   * Save configuration to file
   */
  saveConfig() {
    try {
      const configData = JSON.stringify(this.config, null, 2);
      fs.writeFileSync(this.configPath, configData, "utf8");
      logger.info("Configuration saved successfully");
    } catch (error) {
      logger.error("Failed to save configuration:", error);
      throw error;
    }
  }

  /**
   * Reload configuration from file
   */
  reloadConfig() {
    this.loadConfig();
    logger.info("Configuration reloaded");
  }
}

module.exports = ModularConfigManager;