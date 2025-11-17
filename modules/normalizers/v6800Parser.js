const logger = require("../../utils/logger");
const { colorJson } = require("../../utils/colorJson");

/**
 * Configuration constants for V6800 parser
 */
const CONFIG = {
  DEVICE_TYPE: "V6800",
  DEFAULT_SENSOR_TYPE: "OpeAck",
  
  // Message type mapping from raw to normalized
  MSG_TYPE_MAP: {
    "heart_beat_req": "Heartbeat",
    "u_state_changed_notify_req": "Rfid",
    "u_state_resp": "RfidReq",
    "temper_humidity_exception_nofity_req": "TempHum",
    "temper_humidity_resp": "TemHumReq",
    "noise_exception_nofity_req": "Noise",
    "door_state_changed_notify_req": "Door",
    "door_state_resp": "DoorReq",
    "devies_init_req": "DevModInfo",
    "u_color": "ColorReq",
    "set_module_property_result_req": "SetColor",
    "clear_u_warning": "CleanRfidTamperAlarm"
  },
  
  // Sensor type mapping for each message type
  SENSOR_TYPE_MAP: {
    "Heartbeat": "OpeAck",
    "Rfid": "LabelState",
    "RfidReq": "LabelState",
    "TempHum": "TemHum",
    "TemHumReq": "TemHum",
    "Noise": "Noise",
    "Door": "OpeAck",
    "DoorReq": "OpeAck",
    "DevModInfo": "OpeAck",
    "ColorReq": "OpeAck",
    "SetColor": "OpeAck",
    "CleanRfidTamperAlarm": "OpeAck"
  },
  
  // RFID state mapping
  RFID_STATE_MAP: {
    1: "attached",
    0: "detached"
  }
};

/**
 * Utility functions for data transformation
 */
const Utils = {
  /**
   * Extract device ID from MQTT topic
   * @param {Object} rawMessage - Raw message object (not used, kept for consistency)
   * @param {string} topic - MQTT topic
   * @returns {string} Device ID
   */
  getDeviceId(rawMessage, topic) {
    // Extract from topic path: V6800Upload/2123456789/Door
    if (topic) {
      const topicParts = topic.split('/');
      if (topicParts.length >= 2 && topicParts[1]) {
        return topicParts[1];
      }
    }
    
    return "unknown";
  },

  /**
   * Convert RFID new_state to action string
   * @param {number} newState - New state value
   * @returns {string} Action string
   */
  getRfidAction(newState) {
    return CONFIG.RFID_STATE_MAP[newState] || "unknown";
  },

  /**
   * Convert door state to hex string
   * @param {number} newState - Door state value
   * @returns {string} Hex string representation
   */
  formatDoorStatus(newState) {
    return `0x${newState.toString(16).padStart(2, '0').toUpperCase()}`;
  },

  /**
   * Create base message structure
   * @param {Object} rawMessage - Raw message
   * @param {string} topic - MQTT topic
   * @param {string} msgType - Normalized message type
   * @param {Object} meta - Additional metadata
   * @returns {Object} Base message structure
   */
  createBaseMessage(rawMessage, topic, msgType, meta = {}) {
    const deviceId = Utils.getDeviceId(rawMessage, topic);
    const sensorType = CONFIG.SENSOR_TYPE_MAP[msgType] || CONFIG.DEFAULT_SENSOR_TYPE;
    
    return {
      deviceId,
      deviceType: CONFIG.DEVICE_TYPE,
      sensorType,
      msgType,
      modNum: null,
      modId: null,
      ts: new Date().toISOString(),
      meta: {
        rawTopic: topic,
        msgId: rawMessage.uuid_number,
        msgType: rawMessage.msg_type,
        ...meta
      }
    };
  },

  /**
   * Parse message based on its type (Buffer, string, or object)
   * @param {string|Object|Buffer} message - Raw message
   * @returns {Object} Parsed message object
   */
  parseMessage(message) {
    if (Buffer.isBuffer(message)) {
      return JSON.parse(message.toString());
    } else if (typeof message === "string") {
      return JSON.parse(message);
    } else {
      return message;
    }
  }
};

/**
 * Payload processors for different message types
 */
const PayloadProcessors = {
  /**
   * Process heartbeat payload
   * @param {Array} data - Raw data array
   * @returns {Object} Processed payload
   */
  Heartbeat(data) {
    return data.map(module => ({
      modNum: module.module_index,
      modId: module.module_sn,
      uCount: module.module_u_num
    }));
  },

  /**
   * Process RFID payload
   * @param {Object} portData - Port data object
   * @returns {Object} Processed payload
   */
  Rfid(portData) {
    return {
      rfidData: portData.u_data.map(u => ({
        num: u.u_index,
        alarm: u.warning,
        rfid: u.tag_code,
        action: Utils.getRfidAction(u.new_state)
      }))
    };
  },

  /**
   * Process RFID response payload
   * @param {Object} portData - Port data object
   * @returns {Object} Processed payload
   */
  RfidReq(portData) {
    // Filter u_data to only include entries where u_state = 1
    const activeRfidData = portData.u_data.filter(u => u.u_state === 1);
    
    return {
      uCount: portData.u_data.length,
      rfidCount: activeRfidData.length,
      rfidData: activeRfidData.map(u => ({
        num: u.u_index,
        alarm: u.warning,
        rfid: u.tag_code
      }))
    };
  },

  /**
   * Process temperature & humidity payload
   * @param {Object} portData - Port data object
   * @returns {Array} Processed payload array
   */
  TempHum(portData) {
    return portData.th_data.map(th => ({
      add: th.temper_position,
      temp: parseFloat(th.temper_swot).toFixed(2),
      hum: parseFloat(th.hygrometer_swot).toFixed(2)
    }));
  },

  /**
   * Process noise payload
   * @param {Object} portData - Port data object
   * @returns {Array} Processed payload array
   */
  Noise(portData) {
    return portData.noise_data.map(n => ({
      add: n.noise_position,
      noise: n.noise_swot
    }));
  },

  /**
   * Process door status payload
   * @param {Object} portData - Port data object
   * @returns {Object} Processed payload
   */
  Door(portData) {
    return {
      status: Utils.formatDoorStatus(portData.new_state)
    };
  },

  /**
   * Process door state response payload
   * @param {Object} rawMessage - Raw message object
   * @returns {Object} Processed payload
   */
  DoorReq(rawMessage) {
    return {
      drStatus: Utils.formatDoorStatus(rawMessage.new_state)
    };
  },

  /**
   * Process device & module info payload
   * @param {Object} rawMessage - Raw message
   * @returns {Object} Processed payload
   */
  DevModInfo(rawMessage) {
    return {
      fwVersion: null,
      ip: rawMessage.gateway_ip,
      mask: null,
      gateway: null,
      mac: rawMessage.gateway_mac,
      module: rawMessage.data.map(module => ({
        modNum: module.module_index,
        modId: module.module_sn,
        uCount: module.module_u_num,
        fwVersion: module.module_sw_version
      }))
    };
  },

  /**
   * Process color payload
   * @param {Object} portData - Port data object
   * @returns {Array} Processed payload array
   */
  Color(portData) {
    return portData.color_data.map(color => ({
      pos: color.index,
      color: color.color,
      code: color.code
    }));
  },

  /**
   * Process color set result payload
   * @param {Array} data - Raw data array
   * @returns {Array} Processed payload array
   */
  SetColor(data) {
    return data.map(module => ({
      modNum: module.host_gateway_port_index,
      modId: module.extend_module_sn,
      result: module.set_property_result === 0 ? "success" : "fail"
    }));
  },

  /**
   * Process clean RFID tamper alarm payload
   * @param {Array} data - Raw data array
   * @returns {Array} Processed payload array
   */
  CleanRfidTamperAlarm(data) {
    return data.map(module => ({
      modNum: module.index,
      modId: module.module_id,
      result: module.ctr_flag === true ? "success" : "fail"
    }));
  }
};

/**
 * Message factory for creating normalized messages
 */
const MessageFactory = {
  /**
   * Handle multiple ports by creating separate normalized messages
   * @param {Array} data - Raw data array
   * @param {Object} baseMessage - Base normalized message
   * @param {string} msgType - Message type
   * @returns {Object|Array} Single message or array of messages
   */
  createPortSpecificMessages(data, baseMessage, msgType) {
    if (!data || data.length === 0) {
      return baseMessage;
    }
    
    // Use TempHum processor for TemHumReq since they have the same data structure
    const processor = msgType === "TemHumReq" ? "TempHum" : msgType;
    
    if (data.length === 1) {
      // Single port - return single message
      const portData = data[0];
      return {
        ...baseMessage,
        modNum: portData.host_gateway_port_index || portData.index || null,
        modId: portData.extend_module_sn || portData.module_id || null,
        payload: PayloadProcessors[processor](portData)
      };
    }
    
    // Multiple ports - return array of messages
    return data.map(portData => ({
      ...baseMessage,
      modNum: portData.host_gateway_port_index || portData.index,
      modId: portData.extend_module_sn || portData.module_id,
      payload: PayloadProcessors[processor](portData)
    }));
  },

  /**
   * Create message for heartbeat type
   * @param {Object} rawMessage - Raw message
   * @param {string} topic - MQTT topic
   * @param {Object} meta - Additional metadata
   * @returns {Object} Normalized message
   */
  createHeartbeatMessage(rawMessage, topic, meta) {
    const baseMessage = Utils.createBaseMessage(rawMessage, topic, "Heartbeat", meta);
    return {
      ...baseMessage,
      payload: PayloadProcessors.Heartbeat(rawMessage.data)
    };
  },

  /**
   * Create message for device/module info type
   * @param {Object} rawMessage - Raw message
   * @param {string} topic - MQTT topic
   * @param {Object} meta - Additional metadata
   * @returns {Object} Normalized message
   */
  createDevModInfoMessage(rawMessage, topic, meta) {
    const baseMessage = Utils.createBaseMessage(rawMessage, topic, "DevModInfo", meta);
    return {
      ...baseMessage,
      payload: PayloadProcessors.DevModInfo(rawMessage)
    };
  },

  /**
   * Create message for port-based types (RFID, TempHum, Noise, Door)
   * @param {Object} rawMessage - Raw message
   * @param {string} topic - MQTT topic
   * @param {string} msgType - Message type
   * @param {Object} meta - Additional metadata
   * @returns {Object|Array} Normalized message(s)
   */
  createPortBasedMessage(rawMessage, topic, msgType, meta) {
    const baseMessage = Utils.createBaseMessage(rawMessage, topic, msgType, meta);
    return MessageFactory.createPortSpecificMessages(rawMessage.data, baseMessage, msgType);
  },

  /**
   * Create message for door state response type
   * @param {Object} rawMessage - Raw message
   * @param {string} topic - MQTT topic
   * @param {Object} meta - Additional metadata
   * @returns {Object} Normalized message
   */
  createDoorReqMessage(rawMessage, topic, meta) {
    const baseMessage = Utils.createBaseMessage(rawMessage, topic, "DoorReq", meta);
    return {
      ...baseMessage,
      modNum: rawMessage.host_gateway_port_index || null,
      modId: rawMessage.extend_module_sn || null,
      payload: PayloadProcessors.DoorReq(rawMessage)
    };
  },

  /**
   * Create message for color request type
   * @param {Object} rawMessage - Raw message
   * @param {string} topic - MQTT topic
   * @param {Object} meta - Additional metadata
   * @returns {Object|Array} Normalized message(s)
   */
  createColorMessage(rawMessage, topic, meta) {
    const baseMessage = Utils.createBaseMessage(rawMessage, topic, "ColorReq", meta);
    
    if (!rawMessage.data || rawMessage.data.length === 0) {
      return baseMessage;
    }
    
    if (rawMessage.data.length === 1) {
      // Single module - return single message
      const moduleData = rawMessage.data[0];
      return {
        ...baseMessage,
        modNum: moduleData.index,
        modId: moduleData.module_id,
        payload: PayloadProcessors.Color(moduleData)
      };
    }
    
    // Multiple modules - return array of messages
    return rawMessage.data.map(moduleData => ({
      ...baseMessage,
      modNum: moduleData.index,
      modId: moduleData.module_id,
      payload: PayloadProcessors.Color(moduleData)
    }));
  },

  /**
   * Create message for color set result type
   * @param {Object} rawMessage - Raw message
   * @param {string} topic - MQTT topic
   * @param {Object} meta - Additional metadata
   * @returns {Object} Normalized message
   */
  createSetColorMessage(rawMessage, topic, meta) {
    const baseMessage = Utils.createBaseMessage(rawMessage, topic, "SetColor", meta);
    return {
      ...baseMessage,
      payload: PayloadProcessors.SetColor(rawMessage.data)
    };
  },

  /**
   * Create message for clean RFID tamper alarm type
   * @param {Object} rawMessage - Raw message
   * @param {string} topic - MQTT topic
   * @param {Object} meta - Additional metadata
   * @returns {Object} Normalized message
   */
  createCleanRfidTamperAlarmMessage(rawMessage, topic, meta) {
    const baseMessage = Utils.createBaseMessage(rawMessage, topic, "CleanRfidTamperAlarm", meta);
    return {
      ...baseMessage,
      payload: PayloadProcessors.CleanRfidTamperAlarm(rawMessage.data)
    };
  }
};

/**
 * Main parser function for V6800 messages
 * @param {string} topic - MQTT topic
 * @param {string|Object|Buffer} message - Raw message
 * @param {Object} meta - Additional metadata
 * @returns {Object|Array|null} Normalized message(s) or null on error
 */
function parse(topic, message, meta = {}) {
  try {
    // Parse the raw message
    const rawMessage = Utils.parseMessage(message);
    
    // Get normalized message type
    const msgType = rawMessage.msg_type;
    const normalizedMsgType = CONFIG.MSG_TYPE_MAP[msgType];
    
    if (!normalizedMsgType) {
      logger.warn(`[v6800parser] Unknown V6800 message type: ${msgType}`);
      return null;
    }
    
    // Route to appropriate message factory based on message type
    let normalizedMessage;
    
    switch (normalizedMsgType) {
      case "Heartbeat":
        normalizedMessage = MessageFactory.createHeartbeatMessage(rawMessage, topic, meta);
        break;
      
      case "DevModInfo":
        normalizedMessage = MessageFactory.createDevModInfoMessage(rawMessage, topic, meta);
        break;
      
      case "Rfid":
      case "RfidReq":
      case "TempHum":
      case "TemHumReq":
      case "Noise":
      case "Door":
        normalizedMessage = MessageFactory.createPortBasedMessage(rawMessage, topic, normalizedMsgType, meta);
        break;
      
      case "ColorReq":
        normalizedMessage = MessageFactory.createColorMessage(rawMessage, topic, meta);
        break;
      
      case "SetColor":
        normalizedMessage = MessageFactory.createSetColorMessage(rawMessage, topic, meta);
        break;
      
      case "CleanRfidTamperAlarm":
        normalizedMessage = MessageFactory.createCleanRfidTamperAlarmMessage(rawMessage, topic, meta);
        break;
      
      case "DoorReq":
        normalizedMessage = MessageFactory.createDoorReqMessage(rawMessage, topic, meta);
        break;
      
      default:
        normalizedMessage = null;
        logger.warn(`[v6800parser] Unhandled V6800 message type: ${normalizedMsgType}`);
    }
    
    // Handle array messages for debug logging
    if (Array.isArray(normalizedMessage)) {
      logger.debug('[v6800parser] Normalized Messages (array):');
      normalizedMessage.forEach((msg, index) => {
        logger.debug(`[v6800parser] Message ${index + 1}:\n`, colorJson(msg));
      });
    } else {
      logger.debug('[v6800parser] Normalized Message:\n', colorJson(normalizedMessage));
    }
    
    return normalizedMessage;
    
  } catch (error) {
    logger.error(`[v6800parser] V6800 parsing failed: ${error.message}`);
    return null;
  }
}

module.exports = { parse };
