# V6800 MQTT Message Format and Normalization

Last updated: 2025-11-17 | Device Type: V6800 | Northbound Protocol: v2.4.1

**Related Documentation:**
- [Event System Guide](event.md) - Event flow and handling for V6800 messages
- [Modular Architecture Guide](MODULAR_ARCHITECTURE.md) - System architecture overview
- [V5008 Message Format Guide](V5008-MQTT-Message-Format-and-Normalization-Guide.md) - V5008 device comparison

## Table of Contents

1. [V6800 vs V5008 Comparison](#v6800-vs-v5008-comparison)
2. [Message Validation Rules](#message-validation-rules)
3. [Error Response Handling](#error-response-handling)
4. [Real-World Scenarios](#real-world-scenarios)
5. [Event Messages](#event-messages)
6. [Query Command and Response](#query-command-and-response)
7. [Set Command and Response](#set-command-and-response)
8. [Implementation Best Practices](#implementation-best-practices)
9. [Troubleshooting](#troubleshooting)

## V6800 vs V5008 Comparison

### Key Differences

| Feature | V6800 | V5008 | Impact |
|---------|-------|-------|--------|
| **Message Format** | JSON | Binary (Hex) | V6800 is more human-readable, V5008 is more compact |
| **Protocol Version** | v2.4.1 | v1.8.0 | V6800 has more advanced features |
| **Module Support** | Up to 24 modules | Up to 5 modules | V6800 supports larger installations |
| **U-Sensor Count** | Up to 24 per module | Up to 24 per module | Same capacity per module |
| **Discovery** | Automatic device/module info | Manual queries | V6800 provides better auto-discovery |
| **Error Handling** | Structured JSON responses | Hex error codes | V6800 provides clearer error information |
| **Command Structure** | JSON with msg_type | Hex commands | V6800 is more extensible |

### Message Format Comparison

#### V6800 (JSON)
```json
{
  "msg_type": "heart_beat_req",
  "gateway_sn": "2123456789",
  "bus_V": "23.89",
  "bus_I": "5.70",
  "data": [
    { "module_index": 2, "module_sn": "3963041727", "module_u_num": 6 }
  ]
}
```

#### V5008 (Binary)
```
CC01EC3737BF06028C0909950C0300000000000400000000000500000000000600000000000700000000000800000000000900000000000A0000000000F200168F
```

### Migration Considerations

When migrating from V5008 to V6800:

1. **Message Parsing**: Update parsers to handle JSON instead of binary
2. **Error Handling**: Implement structured error response handling
3. **Device Discovery**: Leverage V6800's automatic discovery features
4. **Command Format**: Convert hex commands to JSON format
5. **Performance**: V6800 messages are larger but more readable

## Message Validation Rules

### 1. Common Validation Rules

All V6800 messages must comply with these validation rules:

```javascript
// Validation schema for V6800 messages
const V6800ValidationRules = {
  // Message type validation
  msg_type: {
    required: true,
    enum: [
      'devies_init_req', 'heart_beat_req', 'u_state_changed_notify_req',
      'temper_humidity_exception_nofity_req', 'door_state_changed_notify_req',
      'get_devies_init_req', 'u_state_req', 'temper_humidity_req',
      'door_state_req', 'get_u_color', 'set_module_property_req',
      'clear_u_warning'
    ]
  },
  
  // Gateway serial number validation
  gateway_sn: {
    required: true,
    type: "string",
    pattern: /^[0-9]{10}$/,
    description: "Gateway serial number must be a 10-digit number"
  },
  
  // UUID validation
  uuid_number: {
    type: "number",
    min: 0,
    max: 4294967295, // 2^32 - 1
    description: "UUID must be a 32-bit unsigned integer"
  },
  
  // Module index validation
  module_index: {
    type: "number",
    min: 1,
    max: 24,
    description: "Module index must be between 1 and 24"
  }
};
```

### 2. Message-Specific Validation

#### Heartbeat Messages

```javascript
const HeartbeatValidation = {
  // Power metrics validation
  bus_V: {
    type: "string",
    pattern: /^[0-9]{1,3}\.[0-9]{2}$/,
    description: "Bus voltage must be in format XX.XX"
  },
  
  bus_I: {
    type: "string",
    pattern: /^[0-9]{1,3}\.[0-9]{2}$/,
    description: "Bus current must be in format XX.XX"
  },
  
  // Power status validation
  main_power: {
    type: "number",
    enum: [0, 1],
    description: "Main power must be 0 (off) or 1 (on)"
  },
  
  backup_power: {
    type: "number",
    enum: [0, 1],
    description: "Backup power must be 0 (off) or 1 (on)"
  }
};
```

#### Temperature & Humidity Messages

```javascript
const TempHumValidation = {
  // Temperature validation
  temper_swot: {
    type: "number",
    min: -40,
    max: 85,
    description: "Temperature must be between -40°C and 85°C"
  },
  
  // Humidity validation
  hygrometer_swot: {
    type: "number",
    min: 0,
    max: 100,
    description: "Humidity must be between 0% and 100%"
  },
  
  // Position validation
  temper_position: {
    type: "number",
    min: 1,
    max: 24,
    description: "Temperature position must be between 1 and 24"
  }
};
```

### 3. Validation Implementation Example

```javascript
class V6800MessageValidator {
  constructor() {
    this.rules = { ...V6800ValidationRules };
  }
  
  validate(message) {
    const errors = [];
    
    // Validate required fields
    this.validateRequiredFields(message, errors);
    
    // Validate message type
    if (message.msg_type && !this.rules.msg_type.enum.includes(message.msg_type)) {
      errors.push(`Invalid message type: ${message.msg_type}`);
    }
    
    // Validate based on message type
    const validationErrors = this.validateMessageType(message);
    errors.push(...validationErrors);
    
    return {
      valid: errors.length === 0,
      errors
    };
  }
  
  validateRequiredFields(message, errors) {
    const requiredFields = ['msg_type', 'gateway_sn'];
    
    requiredFields.forEach(field => {
      if (!message[field]) {
        errors.push(`Missing required field: ${field}`);
      }
    });
  }
  
  validateMessageType(message) {
    const errors = [];
    
    switch (message.msg_type) {
      case 'heart_beat_req':
        errors.push(...this.validateHeartbeat(message));
        break;
      case 'u_state_changed_notify_req':
        errors.push(...this.validateRFID(message));
        break;
      case 'temper_humidity_exception_nofity_req':
        errors.push(...this.validateTempHum(message));
        break;
      // ... other message types
    }
    
    return errors;
  }
  
  validateHeartbeat(message) {
    const errors = [];
    
    if (message.bus_V && !HeartbeatValidation.bus_V.pattern.test(message.bus_V)) {
      errors.push(`Invalid bus voltage format: ${message.bus_V}`);
    }
    
    if (message.bus_I && !HeartbeatValidation.bus_I.pattern.test(message.bus_I)) {
      errors.push(`Invalid bus current format: ${message.bus_I}`);
    }
    
    return errors;
  }
}
```

## Error Response Handling

### 1. Command Error Responses

#### Common Error Codes

| Code | Description | Handling Strategy |
|------|-------------|------------------|
| 200 | Success | Continue normal flow |
| 400 | Bad Request | Validate and retry |
| 401 | Unauthorized | Check authentication |
| 404 | Not Found | Verify device/module exists |
| 500 | Internal Server Error | Retry with backoff |
| 503 | Service Unavailable | Queue for later retry |

#### Error Response Examples

```javascript
// Error response handling implementation
class V6800ErrorHandler {
  constructor(eventBus) {
    this.eventBus = eventBus;
    this.retryQueue = new Map();
  }
  
  handleCommandResponse(response, originalCommand) {
    const { code, msg_type } = response;
    
    switch (code) {
      case 200: // Success
        this.handleSuccess(response, originalCommand);
        break;
        
      case 400: // Bad Request
        this.handleBadRequest(response, originalCommand);
        break;
        
      case 404: // Not Found
        this.handleNotFound(response, originalCommand);
        break;
        
      case 500: // Internal Server Error
        this.handleServerError(response, originalCommand);
        break;
        
      default:
        this.handleUnknownError(response, originalCommand);
    }
  }
  
  handleBadRequest(response, originalCommand) {
    // Log the error details
    console.error('Bad Request Error:', {
      command: originalCommand,
      response,
      timestamp: new Date().toISOString()
    });
    
    // Emit error event
    this.eventBus.emit('command.bad_request', {
      command: originalCommand,
      response,
      reason: 'Invalid command format or parameters'
    });
  }
  
  handleServerError(response, originalCommand) {
    const retryCount = this.retryQueue.get(originalCommand.uuid) || 0;
    
    if (retryCount < 3) {
      // Retry with exponential backoff
      const delay = Math.pow(2, retryCount) * 1000;
      setTimeout(() => {
        this.retryCommand(originalCommand, retryCount + 1);
      }, delay);
    } else {
      // Max retries exceeded
      this.eventBus.emit('command.failed', {
        command: originalCommand,
        response,
        reason: 'Max retries exceeded'
      });
    }
  }
}
```

### 2. Message Processing Errors

#### Error Categories

1. **Validation Errors**: Invalid JSON structure or field values
2. **Parsing Errors**: Cannot parse message content
3. **Business Logic Errors**: Invalid data combinations
4. **System Errors**: Database, network, or resource issues

#### Error Handling Strategy

```javascript
class V6800ErrorProcessor {
  constructor(logger, eventBus) {
    this.logger = logger;
    this.eventBus = eventBus;
    this.errorCounts = new Map();
  }
  
  processError(error, context) {
    const errorType = this.classifyError(error);
    const errorKey = `${errorType}:${error.code || 'UNKNOWN'}`;
    
    // Increment error count
    this.errorCounts.set(errorKey, (this.errorCounts.get(errorKey) || 0) + 1);
    
    // Log error with context
    this.logger.error(`V6800 Error [${errorType}]: ${error.message}`, {
      errorType,
      errorCode: error.code,
      context,
      timestamp: new Date().toISOString(),
      count: this.errorCounts.get(errorKey)
    });
    
    // Handle based on error type
    switch (errorType) {
      case 'VALIDATION':
        this.handleValidationError(error, context);
        break;
      case 'PARSING':
        this.handleParsingError(error, context);
        break;
      case 'BUSINESS_LOGIC':
        this.handleBusinessLogicError(error, context);
        break;
      case 'SYSTEM':
        this.handleSystemError(error, context);
        break;
    }
    
    // Emit error event for monitoring
    this.eventBus.emit('v6800.error', {
      type: errorType,
      error: error.message,
      context,
      timestamp: new Date().toISOString()
    });
  }
}
```

## Real-World Scenarios

### 1. Large-Scale Deployment Management

**Scenario**: Managing 24 modules across multiple gateways in a smart building

**Configuration**:
```json
{
  "deployment": {
    "gateways": [
      {
        "gateway_sn": "2123456789",
        "location": "Building A - Floor 1",
        "modules": [
          {
            "module_index": 1,
            "module_sn": "3963041727",
            "type": "temperature_control",
            "location": "Room 101"
          },
          {
            "module_index": 2,
            "module_sn": "2349402517",
            "type": "access_control",
            "location": "Room 102"
          }
        ]
      }
    ],
    "monitoring": {
      "heartbeat_interval": 60,
      "alert_thresholds": {
        "temperature": { "min": 18, "max": 28 },
        "humidity": { "min": 40, "max": 60 }
      }
    }
  }
}
```

**Implementation**:
```javascript
class V6800DeploymentManager {
  constructor(eventBus, config) {
    this.eventBus = eventBus;
    this.config = config;
    this.gatewayStatus = new Map();
    this.setupEventHandlers();
  }
  
  setupEventHandlers() {
    this.eventBus.on('message.processed', this.handleGatewayMessage.bind(this));
    
    // Periodic health check
    setInterval(this.performHealthCheck.bind(this), 60000);
  }
  
  handleGatewayMessage(message) {
    if (message.deviceType !== 'V6800') return;
    
    const { deviceId, msgType } = message;
    
    switch (msgType) {
      case 'Heartbeat':
        this.updateGatewayStatus(deviceId, message);
        break;
      case 'DevModInfo':
        this.updateModuleInfo(deviceId, message);
        break;
      case 'TempHum':
        this.checkEnvironmentalAlerts(deviceId, message);
        break;
    }
  }
  
  updateGatewayStatus(deviceId, message) {
    const status = {
      lastSeen: new Date().toISOString(),
      busVoltage: message.payload.bus_V,
      busCurrent: message.payload.bus_I,
      mainPower: message.payload.main_power,
      backupPower: message.payload.backup_power,
      modules: message.payload
    };
    
    this.gatewayStatus.set(deviceId, status);
    
    // Check for power issues
    if (status.mainPower === 0 && status.backupPower === 0) {
      this.emitPowerAlert(deviceId, 'critical', 'No power source');
    } else if (status.mainPower === 0) {
      this.emitPowerAlert(deviceId, 'warning', 'On backup power');
    }
  }
  
  async performHealthCheck() {
    for (const gateway of this.config.deployment.gateways) {
      const lastSeen = this.gatewayStatus.get(gateway.gateway_sn);
      
      if (!lastSeen || this.isOffline(lastSeen.lastSeen)) {
        await this.queryGatewayStatus(gateway.gateway_sn);
      }
    }
  }
  
  async queryGatewayStatus(gatewayId) {
    const queryCommand = {
      msg_type: "get_devies_init_req",
      code: 200
    };
    
    this.eventBus.emit('mqtt.publish', {
      topic: `V6800Download/${gatewayId}`,
      message: JSON.stringify(queryCommand)
    });
  }
}
```

### 2. Advanced RFID Tracking System

**Scenario**: Real-time asset tracking with location and status monitoring

**Configuration**:
```json
{
  "assetTracking": {
    "zones": {
      "1": { "name": "Storage Area A", "type": "storage" },
      "2": { "name": "Production Line", "type": "production" },
      "3": { "name": "Quality Control", "type": "inspection" }
    },
    "assets": {
      "DD344A44": { "name": "Asset A", "type": "equipment", "status": "active" },
      "DD2862B4": { "name": "Asset B", "type": "tool", "status": "active" }
    },
    "alerts": {
      "unauthorized_movement": true,
      "missing_assets": true,
      "zone_violations": true
    }
  }
}
```

**Implementation**:
```javascript
class V6800AssetTracker {
  constructor(eventBus, config) {
    this.eventBus = eventBus;
    this.config = config;
    this.assetLocations = new Map();
    this.setupEventHandlers();
  }
  
  setupEventHandlers() {
    this.eventBus.on('message.processed', this.handleRFIDUpdate.bind(this));
  }
  
  handleRFIDUpdate(message) {
    if (message.msgType !== 'Rfid') return;
    
    const { deviceId, modNum, payload } = message;
    
    payload.rfidData.forEach(tag => {
      this.processTagUpdate(deviceId, modNum, tag);
    });
  }
  
  processTagUpdate(deviceId, modNum, tag) {
    const { num, rfid, action } = tag;
    const asset = this.config.assetTracking.assets[rfid];
    
    if (!asset) {
      this.handleUnknownTag(deviceId, modNum, tag);
      return;
    }
    
    const zone = this.getZoneForModule(deviceId, modNum, num);
    const previousLocation = this.assetLocations.get(rfid);
    
    // Update asset location
    this.assetLocations.set(rfid, {
      deviceId,
      modNum,
      sensorNum: num,
      zone,
      timestamp: new Date().toISOString(),
      action
    });
    
    // Check for unauthorized movement
    if (this.isUnauthorizedMovement(asset, previousLocation, zone)) {
      this.emitUnauthorizedMovementAlert(asset, previousLocation, zone);
    }
    
    // Check zone violations
    if (this.isZoneViolation(asset, zone)) {
      this.emitZoneViolationAlert(asset, zone);
    }
  }
  
  isUnauthorizedMovement(asset, previousLocation, newZone) {
    if (!previousLocation) return false;
    
    // Check if asset type is allowed in new zone
    const assetType = asset.type;
    const zoneConfig = this.config.assetTracking.zones[newZone];
    
    if (zoneConfig && zoneConfig.allowedTypes &&
        !zoneConfig.allowedTypes.includes(assetType)) {
      return true;
    }
    
    return false;
  }
  
  emitUnauthorizedMovementAlert(asset, from, to) {
    this.eventBus.emit('alert.unauthorized_movement', {
      asset: asset.name,
      assetType: asset.type,
      from: from.zone,
      to: to.zone,
      timestamp: new Date().toISOString(),
      severity: 'high'
    });
  }
}
```

### 3. Environmental Control System

**Scenario**: Multi-zone environmental monitoring with automated control

**Configuration**:
```json
{
  "environmentalControl": {
    "zones": [
      {
        "id": "server_room",
        "modules": [
          { "gateway_sn": "2123456789", "module_index": 2, "sensors": [10, 11, 12] }
        ],
        "setpoints": {
          "temperature": { "min": 20, "max": 24, "target": 22 },
          "humidity": { "min": 45, "max": 55, "target": 50 }
        },
        "control": {
          "hvac_device": "hvac_001",
          "humidifier_device": "humid_001"
        }
      }
    ],
    "control_strategies": {
      "temperature": "pid",
      "humidity": "hysteresis",
      "update_interval": 30
    }
  }
}
```

**Implementation**:
```javascript
class V6800EnvironmentalController {
  constructor(eventBus, config) {
    this.eventBus = eventBus;
    this.config = config;
    this.zoneStates = new Map();
    this.setupEventHandlers();
  }
  
  setupEventHandlers() {
    this.eventBus.on('message.processed', this.handleEnvironmentalData.bind(this));
    
    // Periodic control updates
    setInterval(this.updateControlSystems.bind(this),
                this.config.environmentalControl.control_strategies.update_interval * 1000);
  }
  
  handleEnvironmentalData(message) {
    if (message.msgType !== 'TempHum') return;
    
    const { deviceId, modNum, payload } = message;
    
    // Update zone states
    this.updateZoneStates(deviceId, modNum, payload);
    
    // Check for immediate alerts
    this.checkEnvironmentalAlerts(deviceId, modNum, payload);
  }
  
  updateZoneStates(deviceId, modNum, sensorData) {
    sensorData.forEach(sensor => {
      const zone = this.findZoneForSensor(deviceId, modNum, sensor.add);
      
      if (!zone) return;
      
      if (!this.zoneStates.has(zone.id)) {
        this.zoneStates.set(zone.id, {
          sensors: new Map(),
          averageTemp: 0,
          averageHum: 0,
          lastUpdate: null
        });
      }
      
      const zoneState = this.zoneStates.get(zone.id);
      zoneState.sensors.set(sensor.add, {
        temp: parseFloat(sensor.temp),
        hum: parseFloat(sensor.hum),
        timestamp: new Date().toISOString()
      });
      
      // Calculate averages
      this.calculateZoneAverages(zone.id);
    });
  }
  
  calculateZoneAverages(zoneId) {
    const zoneState = this.zoneStates.get(zoneId);
    const sensors = Array.from(zoneState.sensors.values());
    
    if (sensors.length === 0) return;
    
    const avgTemp = sensors.reduce((sum, s) => sum + s.temp, 0) / sensors.length;
    const avgHum = sensors.reduce((sum, s) => sum + s.hum, 0) / sensors.length;
    
    zoneState.averageTemp = avgTemp;
    zoneState.averageHum = avgHum;
    zoneState.lastUpdate = new Date().toISOString();
  }
  
  updateControlSystems() {
    for (const [zoneId, zoneConfig] of this.config.environmentalControl.zones) {
      const zoneState = this.zoneStates.get(zoneId);
      
      if (!zoneState || !zoneState.lastUpdate) continue;
      
      this.updateZoneControl(zoneId, zoneConfig, zoneState);
    }
  }
  
  updateZoneControl(zoneId, zoneConfig, zoneState) {
    const { setpoints, control } = zoneConfig;
    
    // Temperature control
    const tempError = setpoints.temperature.target - zoneState.averageTemp;
    if (Math.abs(tempError) > 1.0) {
      this.adjustHVAC(control.hvac_device, tempError);
    }
    
    // Humidity control
    const humError = setpoints.humidity.target - zoneState.averageHum;
    if (Math.abs(humError) > 5.0) {
      this.adjustHumidifier(control.humidifier_device, humError);
    }
  }
  
  adjustHVAC(deviceId, error) {
    const command = error > 0 ? 'cooling' : 'heating';
    const intensity = Math.min(Math.abs(error) * 10, 100); // Scale to 0-100%
    
    this.eventBus.emit('hvac.adjust', {
      deviceId,
      command,
      intensity,
      timestamp: new Date().toISOString()
    });
  }
}
```

# Event Message

## Device and Module Information

```json
//raw mqtt topic: V6800Upload/2123456789/Init
//raw message
{
  msg_type : 'devies_init_req',
  gateway_sn : '2123456789',
  gateway_ip : '192.168.0.212',
  gateway_mac : '08:80:7E:91:61:15',
  uuid_number : 1002770270,
  data : [
    { module_type:'mt_ul', module_index : 2, module_sn : '3963041727', module_m_num: 1, module_u_num: 6, module_sw_version: '2307101644', 
      module_supplier  : 'Digitalor', module_brand     : 'Digitalor', module_model     : 'Digitalor' },
    {module_type:'mt_ul', module_index : 4, module_sn : '2349402517', module_m_num: 2, module_u_num: 12, module_sw_version: '2307101644', 
      module_supplier  : 'Digitalor', module_brand     : 'Digitalor', module_model     : 'Digitalor' }
  ]
}

//normalized mqtt topic: Normalized/V6800/2123456789/Init
//normalized message
{
  deviceId: "2123456789",
  deviceType: "V6800",
  sensorType: "OpeAck",
  msgType: "DevModInfo",
  modNum: null,
  modId: null,
  ts: "2025-11-11T00:58:19.477Z",
  meta: {
    rawTopic: "V6800Upload/2123456789/Init",
    msgId: 1002770270,
    msgType: "devies_init_req"
  },
  payload: {
    fmVersion: null,
    ip: "192.168.0.212",
    mask: null,
    gateway: null,
    mac: "08:80:7E:91:61:15",
    module: [
      { modNum: 2, modId: "3963041727", uCount: 6  , fmVersion: "2307101644" },
      { modNum: 4, modId: "2349402517", uCount: 12 , fmVersion: "2307101644" }
    ]
  }
}
```

## Heartbeat

```json
//raw mqtt topic:V6800Upload/2123456789/HeartBeat
//raw message
{
  msg_type : 'heart_beat_req',
  module_type : 'mt_gw',
  module_sn : '2123456789',
  bus_V : '23.89',
  bus_I : '5.70',
  main_power : 1,
  backup_power : 0,
  uuid_number : 1534195387,
  data : [
    { module_index: 2, module_sn   : '3963041727', module_m_num: 1, module_u_num: 6 },
    { module_index: 4, module_sn   : '2349402517', module_m_num: 2, module_u_num: 12 }
  ]
}

//normalized mqtt topic: Normalized/V6800/2123456789/HeartBeat
//normalized message
{
  deviceId: "2123456789",
  deviceType: "V6800",
  sensorType: "OpeAck",
  msgType: "Heartbeat",
  modNum: null,
  modId: null,
  ts: "2025-11-11T01:04:14.268Z",
  meta: {
    rawTopic: "V6800Upload/2123456789/HeartBeat",
    msgId: 1534195387,
    msgType: "heart_beat_req"
  },
  payload: [
    { modNum: 2 , modId: "3963041727", uCount: 6      },
    { modNum: 4 , modId: "2349402517", uCount: 12     }
  ]
}
```

## RFID Update

```json
//raw mqtt topic:V6800Upload/2123456789/LabelState
//raw message 
{
  msg_type : 'u_state_changed_notify_req',
  gateway_sn : '2123456789',
  uuid_number : 727046823,
  data : [
{
      host_gateway_port_index : 2,
      extend_module_sn : '3963041727',
      u_data : [
        { u_index  : 3, new_state: 1, old_state: 0, tag_code : 'DD23B0B4', warning  : 0 },
        { u_index  : 1, new_state: 1, old_state: 0, tag_code : 'DD395064', warning  : 0 }
      ]
    }
  ]
}

//normalized topic: Normalized/V6800/2123456789/LabelState
//normalized message
{
  deviceId: "2123456789",
  deviceType: "V6800",
  sensorType: "LabelState",
  msgType: "Rfid",
  modNum: 2,
  modId: "3963041727",
  ts: "2025-11-11T01:45:12.870Z",
  meta: {
    rawTopic: "V6800Upload/2123456789/LabelState",
    msgId: 727046823,
    msgType: "u_state_changed_notify_req"
  },
  payload: {
    rfidData: [
      { num: 3, alarm: 0, rfid: "DD23B0B4", action: "attached" },
      { num: 1, alarm: 0, rfid: "DD395064", action: "attached" }
    ]
  }
}
```

## Temperature and Humidify

```json
//raw mqtt topic: V6800Upload/2123456789/TemHum
//raw message
 {
  msg_type : 'temper_humidity_exception_nofity_req',
  gateway_sn : '2123456789',
  uuid_number : 685205293,
  data : [
    {
      host_gateway_port_index : 2,
      extend_module_sn : '3963041727',
      th_data : [
        { temper_position    : 10, hygrometer_position: 10, temper_swot        : 28.799999237060547, hygrometer_swot    : 53.79999923706055 },
        { temper_position    : 11, hygrometer_position: 11, temper_swot        : 28.899999618530273, hygrometer_swot    : 52.5999984741211 },
        { temper_position    : 12, hygrometer_position: 12, temper_swot        : 0, hygrometer_swot    : 0 },
        { temper_position    : 13, hygrometer_position: 13, temper_swot        : 0, hygrometer_swot    : 0 },
        { temper_position    : 14, hygrometer_position: 14, temper_swot        : 0, hygrometer_swot    : 0 },
        { temper_position    : 15, hygrometer_position: 15, temper_swot        : 0, hygrometer_swot    : 0 }
      ]
    }
  ]
}
 
 //normalized mqtt topic: Normalized/V6800/2123456789/TemHum
 //normalized message
 {
  deviceId: "2123456789",
  deviceType: "V6800",
  sensorType: "TemHum",
  msgType: "TempHum",
  modNum: 2,
  modId: "3963041727",
  ts: "2025-11-11T01:45:12.923Z",
  meta: {
    rawTopic: "V6800Upload/2123456789/TemHum",
    msgId: 685205293,
    msgType: "temper_humidity_exception_nofity_req"
  },
  payload: [
    { add: 10 , temp: "28.80", hum: "53.80" },
    { add: 11 , temp: "28.90", hum: "52.60" },
    { add: 12 , temp: "0.00" , hum: "0.00"  },
    { add: 13 , temp: "0.00" , hum: "0.00"  },
    { add: 14 , temp: "0.00" , hum: "0.00"  },
    { add: 15 , temp: "0.00" , hum: "0.00"  }
  ]
}
```

## Door Open/Close Status

```json
//raw mqtt topic: V6800Upload/2123456789/Door
//raw message
{
  msg_type : 'door_state_changed_notify_req',
  gateway_sn : '2123456789',
  uuid_number : 333321551,
  data : [
    { extend_module_sn: '3963041727', host_gateway_port_index: 2, new_state: 1}
  ]
}

//normalized mqtt topic: Normalized/V6800/2123456789/Door
//normalized message
{
  deviceId: "2123456789",
  deviceType: "V6800",
  sensorType: "OpeAck",
  msgType: "Door",
  modNum: 2,
  modId: "3963041727",
  ts: "2025-11-11T01:45:12.975Z",
  meta: {
    rawTopic: "V6800Upload/2123456789/Door",
    msgId: 333321551,
    msgType: "door_state_changed_notify_req"
  },
  payload: {
    status: "0x01"
  }
}

```

# Query Command and Response

## Query Device and Module Information

```jsx
//raw query mqtt topic: V6800Download/2123456789
//raw query message
{
  "msg_type":"get_devies_init_req",
  "code":200
}

//raw query response topic: V6800Upload/2123456789/Init
//raw query response message
{
  msg_type : 'devies_init_req',
  gateway_sn : '2123456789',
  gateway_ip : '192.168.0.212',
  gateway_mac : '08:80:7E:91:61:15',
  uuid_number : 797991388,
  data : [
    { module_type:'mt_ul', module_index: 2, module_sn: '3963041727', module_m_num: 1, module_u_num: 6, module_sw_version: '2307101644', 
      module_supplier: 'Digitalor', module_brand: 'Digitalor', module_model: 'Digitalor'},
    { module_type:'mt_ul', module_index: 4, module_sn: '2349402517', module_m_num: 2, module_u_num: 12, module_sw_version: '2307101644', 
      module_supplier: 'Digitalor', module_brand: 'Digitalor', module_model: 'Digitalor'}
  ]
}

//normalized response message
 {
  deviceId: "2123456789",
  deviceType: "V6800",
  sensorType: "OpeAck",
  msgType: "DevModInfo",
  modNum: null,
  modId: null,
  ts: "2025-11-12T08:07:55.731Z",
  meta: {
    rawTopic: "V6800Upload/2123456789/Init",
    msgId: 797991388,
    msgType: "devies_init_req"
  },
  payload: {
    fmVersion: null,
    ip: "192.168.0.212",
    mask: null,
    gateway: null,
    mac: "08:80:7E:91:61:15",
    module: [
      { modNum: 2     , modId: "3963041727", uCount: 6     , fmVersion: "2307101644" },
      { modNum: 4     , modId: "2349402517", uCount: 12    , fmVersion: "2307101644" }
    ]
  }
}
```

## Additional Resources

- [V5008 Comparison](V5008-MQTT-Message-Format-and-Normalization-Guide.md) - V5008 device implementation details
- [Event Handling Patterns](event.md#error-handling-patterns) - Advanced error handling techniques
- [Testing Strategies](MODULAR_ARCHITECTURE.md#testing-strategies) - How to test V6800 message processing
- [Migration Guide](#migration-considerations) - Tips for migrating from V5008 to V6800

## Query Rfid

```json
//raw query topic: V6800Download/2123456789
//raw query message
{
  "msg_type": "u_state_req",
  "gateway_sn": "2123456789",
  "data": [{
      "extend_module_sn":"2349402517", //suggest fill "" or <modNum>, null will list all ports
      "host_gateway_port_index":4, //the system use this value and ignore "extend_module_sn" only the case of null
      "u_index_list": null //suggest keep null
    }
  ]
}

note, one query one port (modNum).

//raw response topic: V6800Upload/2123456789/LabelState
//raw response message
{
  msg_type : 'u_state_resp',
  code : 200,
  gateway_sn : '2123456789',
  uuid_number : 423018504,
  data : [{
      host_gateway_port_index : 4,
      extend_module_sn : '2349402517',
      u_data : [
        { u_index : 12, u_state : 0, tag_code: null, warning : 0 },
        { u_index : 11, u_state : 0, tag_code: null, warning : 0 },
        { u_index : 10, u_state : 0, tag_code: null, warning : 0 },
        { u_index : 9, u_state : 0, tag_code: null, warning : 0 },
        { u_index : 8, u_state : 0, tag_code: null, warning : 0 },
        { u_index : 7, u_state : 0, tag_code: null, warning : 0 },
        { u_index : 6, u_state : 0, tag_code: null, warning : 0 },
        { u_index : 5, u_state : 0, tag_code: null, warning : 0 },
        { u_index : 4, u_state : 0, tag_code: null, warning : 0 },
        { u_index : 3, u_state : 1, tag_code: 'DD344A44', warning : 0 },
        { u_index : 2, u_state : 1, tag_code: 'DD3CE9C4', warning : 0 },
        { u_index : 1, u_state : 1, tag_code: 'DD2862B4', warning : 0 }
       ]}
  ]}

//normalized response message
 {
  deviceId: "2123456789",
  deviceType: "V6800",
  sensorType: "LabelState",
  msgType: "RfidReq",
  modNum: 4,
  modId: "2349402517",
  ts: "2025-11-12T08:21:53.922Z",
  meta: {
    rawTopic: "V6800Upload/2123456789/LabelState",
    msgId: 423018504,
    msgType: "u_state_resp"
  },
  payload: {
    uCount: 12,
    rfidCount: 3,
    rfidData: [
      { num: 3  , alarm: 0    , rfid: "DD344A44" },
      { num: 2  , alarm: 0    , rfid: "DD3CE9C4" },
      { num: 1  , alarm: 0    , rfid: "DD2862B4" }
    ]
  }
}
```

## Query Temperature and Humidity

```jsx
//raw query topic: V6800Download/2123456789
//raw query message
{
  "msg_type":"temper_humidity_req",
  "gateway_sn":"2123456789",
  "extend_module_sn":null,
  "data":[2,4]
}

//raw response topic: V6800Upload/2123456789/TemHum
//raw response message
{
  msg_type : 'temper_humidity_resp',
  code : 200,
  gateway_sn : '2123456789',
  uuid_number : 279945585,
  data : [
{
      host_gateway_port_index : 2,
      extend_module_sn : '3963041727',
      th_data : [
        { temper_position    : 10, hygrometer_position: 10, temper_swot        : 27.799999237060547, hygrometer_swot    : 52.0999984741211 },
        { temper_position    : 11, hygrometer_position: 11, temper_swot        : 28, hygrometer_swot    : 50.9000015258789 }
      ]
    },
{
      host_gateway_port_index : 4,
      extend_module_sn : '2349402517',
      th_data : [
        { temper_position    : 12, hygrometer_position: 12, temper_swot        : 27.899999618530273, hygrometer_swot    : 48.20000076293945 }
      ]
    }
  ]
}

//normalized response message （will be normalized to multiple messages if mutiple host_gateway_port_index )
//Message 1:
{
  deviceId: "2123456789",
  deviceType: "V6800",
  sensorType: "TemHum",
  msgType: "TemHumReq",
  modNum: 2,
  modId: "3963041727",
  ts: "2025-11-12T08:35:32.457Z",
  meta: {
    rawTopic: "V6800Upload/2123456789/TemHum",
    msgId: 279945585,
    msgType: "temper_humidity_resp"
  },
  payload: [
    { add: 10 , temp: "27.80", hum: "52.10" },
    { add: 11 , temp: "28.00", hum: "50.90" }
  ]
}
//Message 2:
 {
  deviceId: "2123456789",
  deviceType: "V6800",
  sensorType: "TemHum",
  msgType: "TemHumReq",
  modNum: 4,
  modId: "2349402517",
  ts: "2025-11-12T08:35:32.457Z",
  meta: {
    rawTopic: "V6800Upload/2123456789/TemHum",
    msgId: 279945585,
    msgType: "temper_humidity_resp"
  },
  payload: [
    { add: 12 , temp: "27.90", hum: "48.20" }
  ]
}
```

## Query Door Status

```jsx
//raw query topic: V6800Download/2123456789
//raw query message
{
  "msg_type":"door_state_req",
  "gateway_sn":"2123456789",
  "extend_module_sn":"3963041727",
  "host_gateway_port_index":2
}

//raw response topic: V6800Upload/2123456789/Door
//raw response message
{
  msg_type : 'door_state_resp',
  code : 200,
  host_gateway_port_index : 2,
  extend_module_sn : '3963041727',
  new_state : 1,
  uuid_number : 1632631954
}

//normalized response message
{
  deviceId: "2123456789",
  deviceType: "V6800",
  sensorType: "OpeAck",
  msgType: "DoorReq",
  modNum: 2,
  modId: "3963041727",
  ts: "2025-11-12T08:47:41.979Z",
  meta: {
    rawTopic: "V6800Upload/2123456789/Door",
    msgId: 1632631954,
    msgType: "door_state_resp"
  },
  payload: {
    drStatus: "0x01"
  }
}
```

## Query U Sensor Colour

```jsx
//raw query topic: V6800Download/2123456789
//raw query message
{
    "msg_type":"get_u_color",
    "code":1346589,
    "data":[2,4]
}

//raw response topic: V6800Upload/2123456789/OpeAck
//raw response message
{
  msg_type : 'u_color',
  gateway_id : '2123456789',
  count : 2,
  uuid_number : 82941514,
  code : 1346589,
  data : [
{
      index : 2,
      module_id : '3963041727',
      u_num : 6,
      color_data : [
        { index: 1, color: 'blue_f', code : 13 },
        { index: 2, color: 'none', code : 0 },
        { index: 3, color: 'blue_f', code : 13 },
        { index: 4, color: 'none', code : 0 },
        { index: 5, color: 'none', code : 0 },
        { index: 6, color: 'none', code : 0 }
      ]
    },
{
      index : 4,
      module_id : '2349402517',
      u_num : 12,
      color_data : [
        { index: 1, color: 'blue_f', code : 13 },
        { index: 2, color: 'blue_f', code : 13 },
        { index: 3, color: 'blue_f', code : 13 },
        { index: 4, color: 'none', code : 0 },
        { index: 5, color: 'none', code : 0 },
        { index: 6, color: 'none', code : 0 },
        { index: 7, color: 'none', code : 0 },
        { index: 8, color: 'none', code : 0 },
        { index: 9, color: 'none', code : 0 },
        { index: 10, color: 'none', code : 0 },
        { index: 11, color: 'none', code : 0 },
        { index: 12, color: 'none', code : 0 }
      ]
    }
  ]
}

//normalized response message
//Message 1:
 {
  deviceId: "2123456789",
  deviceType: "V6800",
  sensorType: "OpeAck",
  msgType: "ColorReq",
  modNum: 2,
  modId: "3963041727",
  ts: "2025-11-12T08:55:05.331Z",
  meta: {
    rawTopic: "V6800Upload/2123456789/OpeAck",
    msgId: 82941514,
    msgType: "u_color"
  },
  payload: [
    { pos: 1  , color: "blue_f", code: 13   },
    { pos: 2  , color: "none"  , code: 0    },
    { pos: 3  , color: "blue_f", code: 13   },
    { pos: 4  , color: "none"  , code: 0    },
    { pos: 5  , color: "none"  , code: 0    },
    { pos: 6  , color: "none"  , code: 0    }
  ]
}

//Message 2:
 {
  deviceId: "2123456789",
  deviceType: "V6800",
  sensorType: "OpeAck",
  msgType: "ColorReq",
  modNum: 4,
  modId: "2349402517",
  ts: "2025-11-12T08:55:05.331Z",
  meta: {
    rawTopic: "V6800Upload/2123456789/OpeAck",
    msgId: 82941514,
    msgType: "u_color"
  },
  payload: [
    { pos: 1  , color: "blue_f", code: 13   },
    { pos: 2  , color: "blue_f", code: 13   },
    { pos: 3  , color: "blue_f", code: 13   },
    { pos: 4  , color: "none"  , code: 0    },
    { pos: 5  , color: "none"  , code: 0    },
    { pos: 6  , color: "none"  , code: 0    },
    { pos: 7  , color: "none"  , code: 0    },
    { pos: 8  , color: "none"  , code: 0    },
    { pos: 9  , color: "none"  , code: 0    },
    { pos: 10 , color: "none"  , code: 0    },
    { pos: 11 , color: "none"  , code: 0    },
    { pos: 12 , color: "none"  , code: 0    }
  ]
}

```

# Set Command and Response

## Set U Senor Color

```jsx
//raw set topic: V6800Download/2123456789
//raw set message
{
  "msg_type":"set_module_property_req",
  "set_property_type":8001,
  "gateway_sn":"2123456789",
  "data":
  [
   { 
      "extend_module_sn":"3963041727",
      "host_gateway_port_index":2,
      "module_type": "reserved",
      "u_color_data": [{ "u_index":1, "color_code":5}, { "u_index":2,  "color_code":6}] 
   },
   { 
      "extend_module_sn":"2349402517",
      "host_gateway_port_index":4,
      "module_type": "reserved",
      "u_color_data": [{ "u_index":1, "color_code":3}, { "u_index":2,  "color_code":4}] 
   }   
  ]
}

//raw response topic: V6800Upload/2123456789/OpeAck
//raw response message
{
  msg_type : 'set_module_property_result_req',
  gateway_sn : '2123456789',
  set_property_type : 8001,
  uuid_number : 245761302,
  data : [
    { host_gateway_port_index: 2, extend_module_sn: '3963041727', module_type: 'mt_ul', set_property_result: 0 },
    { host_gateway_port_index: 4, extend_module_sn: '2349402517', module_type: 'mt_ul', set_property_result: 0 }
  ]
}

//normalized response message
 {
  deviceId: "2123456789",
  deviceType: "V6800",
  sensorType: "OpeAck",
  msgType: "SetColor",
  modNum: null,
  modId: null,
  ts: "2025-11-13T02:05:50.245Z",
  meta: {
    rawTopic: "V6800Upload/2123456789/OpeAck",
    msgId: 245761302,
    msgType: "set_module_property_result_req"
  },
  payload: [
    { modNum: 2, modId: "3963041727", result: "success" },
    { modNum: 4, modId: "2349402517", result: "success" }
  ]
}

note, set_property_result: 0-success, 1-fail
```

## Clean U Sensor Anti-tamper Alarm

```jsx
//raw set topic: V6800Download/2123456789
//raw set message
{
    "msg_type":"clear_u_warning",
    "code":1346589,
    "data":
    [ 
       { "index":2, "warning_data":[1,2,3]},
       { "index":4, "warning_data":[3,4,5]}
    ]
}

//raw response topic: V6800Upload/2123456789/OpeAck
//raw response message
{
  msg_type : 'clear_u_warning',
  gateway_id : '2123456789',
  count : 2,
  uuid_number : 775199553,
  code : 1346589,
  data : [
  {   index : 2,
      module_id : '3963041727',
      u_num : 6,
      ctr_flag : true
  },
  {
      index : 4,
      module_id : '2349402517',
      u_num : 12,
      ctr_flag : true
    }
  ]
}

//normalized response message
 {
  deviceId: "2123456789",
  deviceType: "V6800",
  sensorType: "OpeAck",
  msgType: "CleanRfidTamperAlarm",
  modNum: null,
  modId: null,
  ts: "2025-11-13T02:01:35.995Z",
  meta: {
    rawTopic: "V6800Upload/2123456789/OpeAck",
    msgId: 775199553,
    msgType: "clear_u_warning"
  },
  payload: [
    { modNum: 2, modId: "3963041727", result: "success" },
    { modNum: 4, modId: "2349402517", result: "success" }
  ]
}

note, ctr_flag: true-success, false - fail;

## Implementation Best Practices

### 1. Message Processing Pipeline

```javascript
class V6800MessageProcessor {
  constructor() {
    this.validator = new V6800MessageValidator();
    this.normalizer = new V6800MessageNormalizer();
    this.errorHandler = new V6800ErrorProcessor();
    this.messageCache = new Map();
  }
  
  async processMessage(topic, rawMessage) {
    const context = { topic, message: rawMessage };
    
    try {
      // Step 1: Parse JSON
      let parsedMessage;
      try {
        parsedMessage = JSON.parse(rawMessage.toString());
      } catch (error) {
        throw new ParsingError('Invalid JSON format');
      }
      
      // Step 2: Validation
      const validation = this.validator.validate(parsedMessage);
      if (!validation.valid) {
        throw new ValidationError(validation.errors.join(', '));
      }
      
      // Step 3: Check for duplicates
      if (this.isDuplicateMessage(parsedMessage)) {
        console.warn('Duplicate message detected:', parsedMessage.uuid_number);
        return null;
      }
      
      // Step 4: Normalization
      const normalized = await this.normalizer.normalize(topic, parsedMessage);
      
      // Step 5: Business logic validation
      await this.validateBusinessRules(normalized);
      
      // Step 6: Cache message
      this.cacheMessage(parsedMessage);
      
      // Step 7: Emit processed message
      this.eventBus.emit('message.processed', normalized);
      
      return normalized;
    } catch (error) {
      this.errorHandler.processError(error, context);
      throw error;
    }
  }
  
  isDuplicateMessage(message) {
    const key = `${message.gateway_sn}-${message.msg_type}-${message.uuid_number}`;
    return this.messageCache.has(key);
  }
  
  cacheMessage(message) {
    const key = `${message.gateway_sn}-${message.msg_type}-${message.uuid_number}`;
    this.messageCache.set(key, {
      timestamp: Date.now(),
      message
    });
    
    // Clean old messages (older than 5 minutes)
    this.cleanupCache();
  }
  
  cleanupCache() {
    const now = Date.now();
    const maxAge = 5 * 60 * 1000; // 5 minutes
    
    for (const [key, value] of this.messageCache.entries()) {
      if (now - value.timestamp > maxAge) {
        this.messageCache.delete(key);
      }
    }
  }
}
```

### 2. Performance Optimization

```javascript
class V6800PerformanceOptimizer {
  constructor() {
    this.batchProcessor = new BatchProcessor(50, 2000); // 50 messages or 2 seconds
    this.compressionEnabled = true;
    this.messageQueue = [];
  }
  
  async optimizeProcessing(message) {
    // Compress large messages
    if (this.compressionEnabled && this.isLargeMessage(message)) {
      message = await this.compressMessage(message);
    }
    
    // Batch process similar messages
    if (this.canBatchProcess(message)) {
      return this.batchProcessor.add(message);
    }
    
    // Process immediately
    return this.processImmediately(message);
  }
  
  isLargeMessage(message) {
    const messageSize = JSON.stringify(message).length;
    return messageSize > 1024; // Larger than 1KB
  }
  
  async compressMessage(message) {
    // Implement message compression for large payloads
    const compressed = await this.compress(JSON.stringify(message));
    
    return {
      ...message,
      _compressed: true,
      _originalSize: JSON.stringify(message).length,
      _compressedSize: compressed.length,
      payload: compressed
    };
  }
  
  canBatchProcess(message) {
    // Temperature, humidity, and RFID updates can be batched
    const batchableTypes = [
      'temper_humidity_exception_nofity_req',
      'u_state_changed_notify_req'
    ];
    
    return batchableTypes.includes(message.msg_type);
  }
}
```

### 3. Device Discovery and Management

```javascript
class V6800DeviceManager {
  constructor(eventBus) {
    this.eventBus = eventBus;
    this.devices = new Map();
    this.modules = new Map();
    this.setupEventHandlers();
  }
  
  setupEventHandlers() {
    this.eventBus.on('message.processed', this.handleDeviceMessage.bind(this));
    
    // Periodic device discovery
    setInterval(this.discoverDevices.bind(this), 300000); // Every 5 minutes
  }
  
  handleDeviceMessage(message) {
    if (message.deviceType !== 'V6800') return;
    
    const { deviceId, msgType } = message;
    
    switch (msgType) {
      case 'DevModInfo':
        this.updateDeviceInfo(deviceId, message);
        break;
      case 'Heartbeat':
        this.updateDeviceStatus(deviceId, message);
        break;
    }
  }
  
  updateDeviceInfo(deviceId, message) {
    const deviceInfo = {
      deviceId,
      ip: message.payload.ip,
      mac: message.payload.mac,
      modules: message.payload.module,
      lastSeen: new Date().toISOString()
    };
    
    this.devices.set(deviceId, deviceInfo);
    
    // Update module information
    message.payload.module.forEach(module => {
      this.modules.set(module.modId, {
        ...module,
        deviceId,
        lastSeen: new Date().toISOString()
      });
    });
    
    this.eventBus.emit('device.discovered', deviceInfo);
  }
  
  async discoverDevices() {
    // Query all known devices for status
    for (const [deviceId, device] of this.devices) {
      await this.queryDeviceStatus(deviceId);
    }
  }
  
  async queryDeviceStatus(deviceId) {
    const queryCommand = {
      msg_type: "get_devies_init_req",
      code: 200
    };
    
    this.eventBus.emit('mqtt.publish', {
      topic: `V6800Download/${deviceId}`,
      message: JSON.stringify(queryCommand)
    });
  }
  
  getDeviceModules(deviceId) {
    const modules = [];
    
    for (const [modId, module] of this.modules) {
      if (module.deviceId === deviceId) {
        modules.push(module);
      }
    }
    
    return modules;
  }
}
```

## Troubleshooting

### Common Issues and Solutions

#### 1. JSON Parsing Errors

**Symptoms**: Messages failing to parse from JSON

**Debugging Steps**:
```javascript
// Enable detailed JSON parsing logging
class DebugJSONParser {
  parse(rawMessage) {
    try {
      const messageString = rawMessage.toString();
      console.log('Parsing JSON message:', {
        length: messageString.length,
        preview: messageString.substring(0, 100)
      });
      
      const parsed = JSON.parse(messageString);
      console.log('JSON parsed successfully:', {
        msg_type: parsed.msg_type,
        gateway_sn: parsed.gateway_sn,
        uuid_number: parsed.uuid_number
      });
      
      return parsed;
    } catch (error) {
      console.error('JSON parsing failed:', {
        error: error.message,
        rawMessage: rawMessage.toString(),
        position: error.message.match(/position (\d+)/)?.[1]
      });
      
      throw new ParsingError(`JSON parsing failed: ${error.message}`);
    }
  }
}
```

#### 2. Module Communication Issues

**Symptoms**: Commands to specific modules not working

**Debugging Steps**:
```javascript
// Debug module communication
const debugModuleCommunication = async (gatewayId, moduleIndex) => {
  console.log(`Testing communication with gateway ${gatewayId}, module ${moduleIndex}`);
  
  // Query module status
  const statusQuery = {
    msg_type: "u_state_req",
    gateway_sn: gatewayId,
    data: [{
      host_gateway_port_index: moduleIndex,
      extend_module_sn: "",
      u_index_list: null
    }]
  };
  
  try {
    const response = await sendCommandAndWaitForResponse(statusQuery, 10000);
    console.log('Module status response:', response);
  } catch (error) {
    console.error('Module communication failed:', error.message);
  }
};
```

#### 3. Performance Issues with Large Deployments

**Symptoms**: Slow response times with many devices

**Solutions**:
```javascript
// Performance optimization for large deployments
class LargeScaleOptimizer {
  constructor() {
    this.deviceGroups = new Map();
    this.processingQueues = new Map();
  }
  
  optimizeForScale() {
    // Group devices by location or type
    this.groupDevices();
    
    // Create separate processing queues for each group
    this.createProcessingQueues();
    
    // Implement load balancing
    this.implementLoadBalancing();
  }
  
  groupDevices() {
    for (const [deviceId, device] of this.devices) {
      const group = this.getDeviceGroup(device);
      
      if (!this.deviceGroups.has(group)) {
        this.deviceGroups.set(group, []);
      }
      
      this.deviceGroups.get(group).push(deviceId);
    }
  }
  
  createProcessingQueues() {
    for (const [group, deviceIds] of this.deviceGroups) {
      this.processingQueues.set(group, new ProcessingQueue({
        concurrency: 5, // Process 5 devices concurrently
        delay: 100 // 100ms between batches
      }));
    }
  }
  
  async processMessage(message) {
    const group = this.getDeviceGroup({ deviceId: message.deviceId });
    const queue = this.processingQueues.get(group);
    
    if (queue) {
      return queue.add(() => this.processMessageInternal(message));
    } else {
      return this.processMessageInternal(message);
    }
  }
}
```

### Performance Monitoring

```javascript
// Monitor V6800 specific metrics
class V6800Monitor {
  constructor() {
    this.metrics = {
      messagesProcessed: 0,
      jsonParseErrors: 0,
      validationErrors: 0,
      deviceActivity: new Map(),
      moduleActivity: new Map(),
      averageProcessingTime: 0
    };
    
    this.startMonitoring();
  }
  
  startMonitoring() {
    // Track message processing
    eventBus.on('message.processed', (message) => {
      if (message.deviceType === 'V6800') {
        this.metrics.messagesProcessed++;
        this.updateDeviceActivity(message.deviceId);
        this.updateModuleActivity(message.deviceId, message.modNum);
      }
    });
    
    // Track JSON parsing errors
    eventBus.on('json.parse.error', () => {
      this.metrics.jsonParseErrors++;
    });
    
    // Report metrics every minute
    setInterval(() => {
      this.reportMetrics();
    }, 60000);
  }
  
  updateDeviceActivity(deviceId) {
    const activity = this.metrics.deviceActivity.get(deviceId) || {
      lastSeen: Date.now(),
      messageCount: 0
    };
    
    activity.lastSeen = Date.now();
    activity.messageCount++;
    
    this.metrics.deviceActivity.set(deviceId, activity);
  }
  
  reportMetrics() {
    console.log('V6800 Metrics:', {
      messagesProcessed: this.metrics.messagesProcessed,
      jsonParseErrors: this.metrics.jsonParseErrors,
      validationErrors: this.metrics.validationErrors,
      activeDevices: this.metrics.deviceActivity.size,
      activeModules: this.metrics.moduleActivity.size,
      averageProcessingTime: this.metrics.averageProcessingTime.toFixed(2)
    });
  }
}
```
```