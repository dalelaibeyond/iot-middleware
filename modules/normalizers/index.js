const normalizerRegistry = require("./NormalizerRegistry");

/**
 * Main normalize function that dispatches messages to appropriate parsers
 * @param {string} topic - MQTT topic
 * @param {string|object} message - Message payload
 * @param {object} meta - Additional metadata
 * @returns {object|null} - Normalized message or null if parsing failed
 */
function normalize(topic, message, meta = {}) {
  return normalizerRegistry.normalize(topic, message, meta);
}

/**
 * Get the normalizer registry instance
 * @returns {NormalizerRegistry} - The normalizer registry
 */
function getRegistry() {
  return normalizerRegistry;
}

module.exports = {
  normalize,
  getRegistry
};
