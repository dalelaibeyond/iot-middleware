const MQTTHandler = require('./mqttHandler');
const logger = require('../utils/logger');

// This module serves as a singleton factory for the MQTT handler
let mqttHandler = null;

function createMQTTClient(options = {}) {
    if (!mqttHandler) {
        mqttHandler = new MQTTHandler(options);
        mqttHandler.connect();
    }
    return mqttHandler;
}

module.exports = createMQTTClient;
