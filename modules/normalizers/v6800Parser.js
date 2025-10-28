const logger = require("../../utils/logger");

/**
 * Parser for V6800Upload devices
 * Handles JSON format messages from V6800 IoT gateway
 */

// Message type mapping
const MSG_TYPE_MAP = {
  "heart_beat_req": "Heartbeat",
  "u_state_changed_notify_req": "Rfid",
  "temper_humidity_exception_nofity_req": "TempHum",
  "noise_exception_nofity_req": "Noise",
  "door_state_changed_notify_req": "Door",
  "devies_init_req": "DevModInfo"
};

/**
 * Extract device ID from raw message
 * @param {Object} rawMessage - Raw message object
 * @returns {string} Device ID
 */
const getDeviceId = (rawMessage) => {
  return rawMessage.gateway_sn || rawMessage.module_sn || "unknown";
};

/**
 * Convert RFID new_state to action string
 * @param {number} newState - New state value
 * @returns {string} Action string
 */
const getRfidAction = (newState) => {
  return newState === 1 ? "attached" : "detached";
};

/**
 * Convert door state to hex string
 * @param {number} newState - Door state value
 * @returns {string} Hex string representation
 */
const formatDoorStatus = (newState) => {
  return `0x${newState.toString(16).padStart(2, '0').toUpperCase()}`;
};

/**
 * Handle multiple ports by creating separate normalized messages
 * @param {Array} data - Raw data array
 * @param {Object} baseMessage - Base normalized message
 * @returns {Object|Array} Single message or array of messages
 */
const createPortSpecificMessages = (data, baseMessage) => {
  if (!data || data.length === 0) {
    return baseMessage;
  }
  
  if (data.length === 1) {
    // Single port - return single message
    const portData = data[0];
    return {
      ...baseMessage,
      modPort: portData.host_gateway_port_index || null,
      modId: portData.extend_module_sn || null,
      payload: processPortData(portData, baseMessage.msgType)
    };
  }
  
  // Multiple ports - return array of messages
  return data.map(portData => ({
    ...baseMessage,
    modPort: portData.host_gateway_port_index,
    modId: portData.extend_module_sn,
    payload: processPortData(portData, baseMessage.msgType)
  }));
};

/**
 * Process port-specific data based on message type
 * @param {Object} portData - Port data object
 * @param {string} msgType - Message type
 * @returns {Object} Processed payload
 */
const processPortData = (portData, msgType) => {
  switch (msgType) {
    case "Rfid":
      return {
        rfidData: portData.u_data.map(u => ({
          pos: u.u_index,
          alarm: u.warning,
          rfid: u.tag_code,
          action: getRfidAction(u.new_state)
        }))
      };
    
    case "TempHum":
      return portData.th_data.map(th => ({
        add: th.temper_position,
        temp: th.temper_swot,
        hum: th.hygrometer_swot
      }));
    
    case "Noise":
      return portData.noise_data.map(n => ({
        add: n.noise_position,
        noise: n.noise_swot
      }));
    
    case "Door":
      return {
        drStatus: formatDoorStatus(portData.new_state)
      };
    
    default:
      return {};
  }
};

/**
 * Parse heartbeat message
 * @param {Object} rawMessage - Raw message
 * @param {string} topic - MQTT topic
 * @param {Object} meta - Additional metadata
 * @returns {Object} Normalized message
 */
const parseHeartbeat = (rawMessage, topic, meta) => {
  const deviceId = getDeviceId(rawMessage);
  
  return {
    deviceId,
    deviceType: "V6800",
    msgType: "Heartbeat",
    sensorType: "OpeAck",
    modAdd: null,
    modPort: null,
    modId: null,
    ts: new Date().toISOString(),
    payload: rawMessage.data.map(module => ({
      modPort: module.module_index,
      modId: module.module_sn,
      uNum: module.module_u_num
    })),
    meta: {
      rawTopic: topic,
      msgId: rawMessage.uuid_number,
      ...meta
    }
  };
};

/**
 * Parse RFID tag update message
 * @param {Object} rawMessage - Raw message
 * @param {string} topic - MQTT topic
 * @param {Object} meta - Additional metadata
 * @returns {Object|Array} Normalized message(s)
 */
const parseRfid = (rawMessage, topic, meta) => {
  const deviceId = getDeviceId(rawMessage);
  const baseMessage = {
    deviceId,
    deviceType: "V6800",
    msgType: "Rfid",
    sensorType: "LabelState",
    modAdd: null,
    ts: new Date().toISOString(),
    meta: {
      rawTopic: topic,
      msgId: rawMessage.uuid_number,
      ...meta
    }
  };
  
  return createPortSpecificMessages(rawMessage.data, baseMessage);
};

/**
 * Parse temperature & humidity message
 * @param {Object} rawMessage - Raw message
 * @param {string} topic - MQTT topic
 * @param {Object} meta - Additional metadata
 * @returns {Object|Array} Normalized message(s)
 */
const parseTempHum = (rawMessage, topic, meta) => {
  const deviceId = getDeviceId(rawMessage);
  const baseMessage = {
    deviceId,
    deviceType: "V6800",
    msgType: "TempHum",
    sensorType: "TemHum",
    modAdd: null,
    ts: new Date().toISOString(),
    meta: {
      rawTopic: topic,
      msgId: rawMessage.uuid_number,
      ...meta
    }
  };
  
  return createPortSpecificMessages(rawMessage.data, baseMessage);
};

/**
 * Parse noise level message
 * @param {Object} rawMessage - Raw message
 * @param {string} topic - MQTT topic
 * @param {Object} meta - Additional metadata
 * @returns {Object|Array} Normalized message(s)
 */
const parseNoise = (rawMessage, topic, meta) => {
  const deviceId = getDeviceId(rawMessage);
  const baseMessage = {
    deviceId,
    deviceType: "V6800",
    msgType: "Noise",
    sensorType: "Noise",
    modAdd: null,
    ts: new Date().toISOString(),
    meta: {
      rawTopic: topic,
      msgId: rawMessage.uuid_number,
      ...meta
    }
  };
  
  return createPortSpecificMessages(rawMessage.data, baseMessage);
};

/**
 * Parse door status message
 * @param {Object} rawMessage - Raw message
 * @param {string} topic - MQTT topic
 * @param {Object} meta - Additional metadata
 * @returns {Object|Array} Normalized message(s)
 */
const parseDoor = (rawMessage, topic, meta) => {
  const deviceId = getDeviceId(rawMessage);
  const baseMessage = {
    deviceId,
    deviceType: "V6800",
    msgType: "Door",
    sensorType: "OpeAck",
    modAdd: null,
    ts: new Date().toISOString(),
    meta: {
      rawTopic: topic,
      msgId: rawMessage.uuid_number,
      ...meta
    }
  };
  
  return createPortSpecificMessages(rawMessage.data, baseMessage);
};

/**
 * Parse device & module info message
 * @param {Object} rawMessage - Raw message
 * @param {string} topic - MQTT topic
 * @param {Object} meta - Additional metadata
 * @returns {Object} Normalized message
 */
const parseDevModInfo = (rawMessage, topic, meta) => {
  const deviceId = getDeviceId(rawMessage);
  
  return {
    deviceId,
    deviceType: "V6800",
    msgType: "DevModInfo",
    sensorType: "OpeAck",
    modAdd: null,
    modPort: null,
    modId: null,
    ts: new Date().toISOString(),
    payload: {
      firmwareVer: null,
      ip: rawMessage.gateway_ip,
      mask: null,
      gateway: null,
      mac: rawMessage.gateway_mac,
      module: rawMessage.data.map(module => ({
        modPort: module.module_index,
        modId: module.module_sn,
        uNum: module.module_u_num,
        modFirwareVer: module.module_sw_version
      }))
    },
    meta: {
      rawTopic: topic,
      msgId: rawMessage.uuid_number,
      ...meta
    }
  };
};

/**
 * Main parser function for V6800 messages
 * @param {string} topic - MQTT topic
 * @param {string|Object} message - Raw message (string or object)
 * @param {Object} meta - Additional metadata
 * @returns {Object|Array|null} Normalized message(s) or null on error
 */
function parse(topic, message, meta = {}) {
  try {
    // Parse JSON message if it's a string
    const rawMessage = typeof message === "string" ? JSON.parse(message) : message;
    
    // Get message type from raw message
    const msgType = rawMessage.msg_type;
    const normalizedMsgType = MSG_TYPE_MAP[msgType];
    
    if (!normalizedMsgType) {
      logger.warn(`Unknown V6800 message type: ${msgType}`);
      return null;
    }
    
    // Route to appropriate parser based on message type
    switch (normalizedMsgType) {
      case "Heartbeat":
        return parseHeartbeat(rawMessage, topic, meta);
      
      case "Rfid":
        return parseRfid(rawMessage, topic, meta);
      
      case "TempHum":
        return parseTempHum(rawMessage, topic, meta);
      
      case "Noise":
        return parseNoise(rawMessage, topic, meta);
      
      case "Door":
        return parseDoor(rawMessage, topic, meta);
      
      case "DevModInfo":
        return parseDevModInfo(rawMessage, topic, meta);
      
      default:
        logger.warn(`Unhandled V6800 message type: ${normalizedMsgType}`);
        return null;
    }
  } catch (error) {
    logger.error(`V6800 parsing failed: ${error.message}`);
    return null;
  }
}

module.exports = { parse };
