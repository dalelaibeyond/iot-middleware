const logger = require("../../../utils/logger");

/**
 * Field Mapper that standardizes field names across different devices
 */
class FieldMapper {
  constructor() {
    // Field mappings for each device type and message type
    this.fieldMappings = {
      V5008: {
        Rfid: {
          num: "position",
          rfid: "rfid",
          alarm: "alarm",
          uCount: "uCount",
          rfidCount: "rfidCount"
        },
        TempHum: {
          add: "position",
          temp: "temperature",
          hum: "humidity"
        },
        Noise: {
          add: "position",
          noise: "noiseLevel"
        },
        ColorReq: {
          num: "position",
          color: "color"
        },
        ColorSetResponse: {
          num: "position",
          color: "color"
        },
        Door: {
          drStatus: "status"
        }
      },
      V6800: {
        Rfid: {
          num: "position",
          tag_code: "rfid",
          warning: "alarm",
          module_u_num: "uCount",
          uCount: "rfidCount"
        },
        TempHum: {
          temper_position: "position",
          temper_swot: "temperature",
          hygrometer_swot: "humidity"
        },
        TemHumReq: {
          temper_position: "position",
          temper_swot: "temperature",
          hygrometer_swot: "humidity"
        },
        Noise: {
          noise_position: "position",
          noise_swot: "noiseLevel"
        },
        ColorReq: {
          pos: "position",
          color: "color",
          code: "code"
        },
        Door: {
          new_state: "status"
        },
        DoorReq: {
          new_state: "status"
        }
      },
      G6000: {
        // To be implemented as G6000 parser is completed
      }
    };
    
    // Common field mappings that apply to all devices
    this.commonMappings = {
      module_index: "modNum",
      module_sn: "modId",
      host_gateway_port_index: "modNum",
      extend_module_sn: "modId",
      index: "position",
      module_id: "modId"
    };
  }

  /**
   * Map fields in a message according to device type and message type
   * @param {Object} message - Message to map
   * @param {string} deviceType - Device type (V5008, V6800, G6000)
   * @param {string} msgType - Message type
   * @returns {Object} Message with mapped field names
   */
  mapFields(message, deviceType, msgType) {
    try {
      // Create a deep copy of the message to avoid modifying the original
      const mappedMessage = JSON.parse(JSON.stringify(message));
      
      // Apply common mappings first
      this.applyFieldMappings(mappedMessage, this.commonMappings);
      
      // Apply device-specific mappings
      const deviceMappings = this.fieldMappings[deviceType];
      if (deviceMappings) {
        const msgTypeMappings = deviceMappings[msgType];
        if (msgTypeMappings) {
          this.applyFieldMappings(mappedMessage, msgTypeMappings);
        }
      }
      
      // Map fields in payload if it exists
      if (mappedMessage.payload) {
        this.mapPayloadFields(mappedMessage.payload, deviceType, msgType);
      }
      
      return mappedMessage;
    } catch (error) {
      logger.error(`Field mapping failed for ${deviceType}/${msgType}:`, error);
      return message; // Return original message if mapping fails
    }
  }

  /**
   * Apply field mappings to an object
   * @param {Object} obj - Object to map
   * @param {Object} mappings - Field mappings
   */
  applyFieldMappings(obj, mappings) {
    for (const [oldField, newField] of Object.entries(mappings)) {
      if (obj.hasOwnProperty(oldField)) {
        obj[newField] = obj[oldField];
        
        // Only remove the old field if it's different from the new field
        if (oldField !== newField) {
          delete obj[oldField];
        }
      }
    }
  }

  /**
   * Map fields in payload based on message type
   * @param {Object} payload - Payload to map
   * @param {string} deviceType - Device type
   * @param {string} msgType - Message type
   */
  mapPayloadFields(payload, deviceType, msgType) {
    // Handle different payload structures based on message type
    switch (msgType) {
      case "Rfid":
        this.mapRfidPayload(payload, deviceType);
        break;
      case "TempHum":
      case "TemHumReq":
        this.mapTempHumPayload(payload, deviceType);
        break;
      case "Noise":
        this.mapNoisePayload(payload, deviceType);
        break;
      case "ColorReq":
        this.mapColorPayload(payload, deviceType);
        break;
      case "Door":
      case "DoorReq":
        this.mapDoorPayload(payload, deviceType);
        break;
    }
  }

  /**
   * Map RFID payload fields
   * @param {Object} payload - RFID payload
   * @param {string} deviceType - Device type
   */
  mapRfidPayload(payload, deviceType) {
    const mappings = this.fieldMappings[deviceType]?.Rfid;
    if (!mappings) return;
    
    // Map fields in rfidData array
    if (payload.rfidData && Array.isArray(payload.rfidData)) {
      payload.rfidData.forEach(item => {
        this.applyFieldMappings(item, mappings);
      });
    }
  }

  /**
   * Map Temperature/Humidity payload fields
   * @param {Object} payload - Temperature/Humidity payload
   * @param {string} deviceType - Device type
   */
  mapTempHumPayload(payload, deviceType) {
    const mappings = this.fieldMappings[deviceType]?.TempHum || 
                   this.fieldMappings[deviceType]?.TemHumReq;
    if (!mappings) return;
    
    // Handle different payload structures
    if (payload.sensorData && Array.isArray(payload.sensorData)) {
      payload.sensorData.forEach(item => {
        this.applyFieldMappings(item, mappings);
      });
    }
    
    // Handle direct payload fields
    this.applyFieldMappings(payload, mappings);
  }

  /**
   * Map Noise payload fields
   * @param {Object} payload - Noise payload
   * @param {string} deviceType - Device type
   */
  mapNoisePayload(payload, deviceType) {
    const mappings = this.fieldMappings[deviceType]?.Noise;
    if (!mappings) return;
    
    // Handle different payload structures
    if (payload.sensorData && Array.isArray(payload.sensorData)) {
      payload.sensorData.forEach(item => {
        this.applyFieldMappings(item, mappings);
      });
    }
    
    // Handle direct payload fields
    this.applyFieldMappings(payload, mappings);
  }

  /**
   * Map Color payload fields
   * @param {Object} payload - Color payload
   * @param {string} deviceType - Device type
   */
  mapColorPayload(payload, deviceType) {
    const mappings = this.fieldMappings[deviceType]?.ColorReq;
    if (!mappings) return;
    
    // Handle different payload structures
    if (payload.positionData && Array.isArray(payload.positionData)) {
      payload.positionData.forEach(item => {
        this.applyFieldMappings(item, mappings);
      });
    }
    
    // Handle direct payload fields
    this.applyFieldMappings(payload, mappings);
  }

  /**
   * Map Door payload fields
   * @param {Object} payload - Door payload
   * @param {string} deviceType - Device type
   */
  mapDoorPayload(payload, deviceType) {
    const mappings = this.fieldMappings[deviceType]?.Door || 
                   this.fieldMappings[deviceType]?.DoorReq;
    if (!mappings) return;
    
    // Handle direct payload fields
    this.applyFieldMappings(payload, mappings);
  }

  /**
   * Add custom field mapping
   * @param {string} deviceType - Device type
   * @param {string} msgType - Message type
   * @param {string} oldField - Original field name
   * @param {string} newField - New field name
   */
  addFieldMapping(deviceType, msgType, oldField, newField) {
    if (!this.fieldMappings[deviceType]) {
      this.fieldMappings[deviceType] = {};
    }
    
    if (!this.fieldMappings[deviceType][msgType]) {
      this.fieldMappings[deviceType][msgType] = {};
    }
    
    this.fieldMappings[deviceType][msgType][oldField] = newField;
    logger.info(`Added field mapping for ${deviceType}/${msgType}: ${oldField} -> ${newField}`);
  }

  /**
   * Add common field mapping
   * @param {string} oldField - Original field name
   * @param {string} newField - New field name
   */
  addCommonMapping(oldField, newField) {
    this.commonMappings[oldField] = newField;
    logger.info(`Added common field mapping: ${oldField} -> ${newField}`);
  }

  /**
   * Get all field mappings for a device type
   * @param {string} deviceType - Device type
   * @returns {Object} All field mappings for the device
   */
  getDeviceMappings(deviceType) {
    return this.fieldMappings[deviceType] || {};
  }

  /**
   * Get field mappings for a specific device and message type
   * @param {string} deviceType - Device type
   * @param {string} msgType - Message type
   * @returns {Object} Field mappings for the device and message type
   */
  getMappings(deviceType, msgType) {
    return this.fieldMappings[deviceType]?.[msgType] || {};
  }
}

module.exports = FieldMapper;