# V5008 MQTT Message Format and Normalization

Last updated: 2025-11-17 | Device Type: V5008 | Northbound Protocol: v1.8.0

**Related Documentation:**
- [Event System Guide](event.md) - Event flow and handling for V5008 messages
- [Modular Architecture Guide](MODULAR_ARCHITECTURE.md) - System architecture overview
- [V6800 Message Format Guide](V6800-MQTT-Message-Format-and-Normalization-Guide.md) - V6800 device comparison

## Table of Contents

1. [Quick Reference](#quick-reference)
2. [Message Validation Rules](#message-validation-rules)
3. [Error Response Handling](#error-response-handling)
4. [Real-World Scenarios](#real-world-scenarios)
5. [Raw Message and Normalization](#raw-message-and-normalization)
6. [Implementation Best Practices](#implementation-best-practices)
7. [Troubleshooting](#troubleshooting)

# **Quick Reference**

Quick reference for V5008 IoT gateway message formats and topics.

## **Message Report**

| Message Type | Topic Pattern | Identifier | report condition |
| --- | --- | --- | --- |
| Heartbeat | `V5008Upload/{deviceId}/OpeAck` | `CB`/`CC` | auto report |
| RFID | `V5008Upload/{deviceId}/LabelState` | `BB` | status update or `[E901][modNum]` query |
| Temperature & Humidity | `V5008Upload/{deviceId}/TemHum` | - | status update or `[E902][modNum]` query |
| Noise | `V5008Upload/{deviceId}/Noise` | - | status update or `[E904][modNum]` query |
| Door | `V5008Upload/{deviceId}/OpeAck` | `BA` | status update or `[E903][modNum]` query |
| Device Info | `V5008Upload/{deviceId}/OpeAck` | `EF01` | `EF0100` query |
| Module Info | `V5008Upload/{deviceId}/OpeAck` | `EF02` | `EF0200` query |
| U sensor color | `V5008Upload/{deviceId}/OpeAck` | `AA` | `E4[modNum]` query |
| color-set-response | `V5008Upload/{deviceId}/OpeAck` |  | **`E1[modNum]([num][color]) x n)`**  |
| clean-alarm-response | `V5008Upload/{deviceId}/OpeAck` |  | **`E2[modNum][num] x n`**  |

## **Query Command and Response**

| Command | topic | Description | Response |
| --- | --- | --- | --- |
| **`E901[modNum]`** | `V5008Download/{deviceId}` | Query RFID tag status | RFID (BB) message |
| **`E902[modNum]`** | `V5008Download/{deviceId}` | Query temperature and humidity | Temperature & Humidity message |
| **`E903[modNum]`** | `V5008Download/{deviceId}` | Query door status | Door (BA) message |
| **`E904[modNum]`**  | `V5008Download/{deviceId}` | Query noise value | Noise message |
| **`EF0100`** | `V5008Download/{deviceId}` | Query gateway device information | Device Info (EF01) message |
| **`EF0200`** | `V5008Download/{deviceId}` | Query module information | Module Info (EF02) message |
| **`E4[modNum]`** | `V5008Download/{deviceId}` | Query u sensor color | `[AA][deviceID][Result][CmdMsg(nB)][colorCode(nB)][msgCode(4B)]` |

## Set Command and Response

| Command | topic | Description | Response |
| --- | --- | --- | --- |
| **`E1[modNum]([num][color]) x n)`**  | `V5008Download/{deviceId}` | Set u sensor color | `[AA][deviceID][Result][CmdMsg(nB)][msgCode(4B)]` |
| **`E2[modNum][num] x n`**  | `V5008Download/{deviceId}` | Clean u senor alarm | `[AA][deviceID][Result][CmdMsg(nB)][msgCode(4B)]` |

## Message Validation Rules

### 1. Common Validation Rules

All V5008 messages must comply with these validation rules:

```javascript
// Validation schema for V5008 messages
const V5008ValidationRules = {
  // Topic validation
  topic: {
    pattern: /^V5008Upload\/[0-9]+\/(OpeAck|LabelState|TemHum|Noise)$/,
    description: "Topic must follow pattern: V5008Upload/{deviceId}/{sensorType}"
  },
  
  // Device ID validation
  deviceId: {
    type: "string",
    pattern: /^[0-9]{10}$/,
    description: "Device ID must be a 10-digit number"
  },
  
  // Module number validation
  modNum: {
    type: "number",
    min: 1,
    max: 5,
    description: "Module number must be between 1 and 5"
  },
  
  // Message ID validation
  msgId: {
    type: "number",
    min: 0,
    max: 4294967295, // 2^32 - 1
    description: "Message ID must be a 32-bit unsigned integer"
  }
};
```

### 2. Message-Specific Validation

#### Heartbeat Messages (CB/CC)

```javascript
const HeartbeatValidation = {
  // Hex string validation
  hexString: {
    minLength: 24, // Minimum: CC + 10 modules * 6 bytes + 4 bytes msgId
    maxLength: 64, // Maximum with all modules
    pattern: /^[0-9A-F]+$/,
    description: "Must be valid hexadecimal string"
  },
  
  // Module count validation
  moduleCount: {
    max: 10,
    description: "Maximum 10 modules per gateway"
  },
  
  // Module data validation
  moduleData: {
    modNum: { min: 1, max: 10 },
    modId: { pattern: /^[0-9A-F]{8}$/ },
    uCount: { min: 0, max: 24 }
  }
};
```

#### RFID Messages (BB)

```javascript
const RFIDValidation = {
  // RFID count validation
  rfidCount: {
    max: 24,
    description: "Maximum 24 RFID tags per module"
  },
  
  // RFID data validation
  rfidData: {
    num: { min: 1, max: 24 },
    alarm: { min: 0, max: 1 },
    rfid: { pattern: /^[0-9A-F]{8}$/ }
  }
};
```

#### Temperature & Humidity Messages

```javascript
const TempHumValidation = {
  // Sensor data validation
  sensorData: {
    add: { min: 1, max: 15 },
    temp: { min: -40, max: 85 },
    hum: { min: 0, max: 100 }
  }
};
```

### 3. Validation Implementation Example

```javascript
class V5008MessageValidator {
  constructor() {
    this.rules = { ...V5008ValidationRules };
  }
  
  validate(topic, message) {
    const errors = [];
    
    // Validate topic
    if (!this.rules.topic.pattern.test(topic)) {
      errors.push(`Invalid topic format: ${topic}`);
    }
    
    // Extract device ID from topic
    const deviceId = this.extractDeviceId(topic);
    if (!this.rules.deviceId.pattern.test(deviceId)) {
      errors.push(`Invalid device ID: ${deviceId}`);
    }
    
    // Validate message based on type
    const messageType = this.getMessageType(topic, message);
    const validationErrors = this.validateMessage(messageType, message);
    errors.push(...validationErrors);
    
    return {
      valid: errors.length === 0,
      errors
    };
  }
  
  validateMessage(messageType, message) {
    const errors = [];
    
    switch (messageType) {
      case 'Heartbeat':
        errors.push(...this.validateHeartbeat(message));
        break;
      case 'Rfid':
        errors.push(...this.validateRFID(message));
        break;
      case 'TempHum':
        errors.push(...this.validateTempHum(message));
        break;
      // ... other message types
    }
    
    return errors;
  }
  
  validateHeartbeat(hexString) {
    const errors = [];
    
    if (hexString.length < HeartbeatValidation.hexString.minLength) {
      errors.push(`Heartbeat message too short: ${hexString.length} bytes`);
    }
    
    if (!HeartbeatValidation.hexString.pattern.test(hexString)) {
      errors.push('Invalid hexadecimal format in heartbeat message');
    }
    
    return errors;
  }
}
```

## Error Response Handling

### 1. Command Error Responses

#### Common Error Codes

| Error Code | Description | Handling Strategy |
|------------|-------------|------------------|
| `0xA0` | Command failed | Retry with exponential backoff |
| `0xA1` | Command succeeded | Continue normal flow |
| `0xFF` | Invalid command format | Log error and notify operator |
| `0xFE` | Device busy | Queue command for retry |
| `0xFD` | Module not found | Verify module configuration |

#### Error Response Examples

```javascript
// Error response handling implementation
class V5008ErrorHandler {
  constructor(eventBus) {
    this.eventBus = eventBus;
    this.retryQueue = new Map();
  }
  
  handleCommandResponse(response, originalCommand) {
    const { result, msgId } = response;
    
    switch (result) {
      case 0xA1: // Success
        this.handleSuccess(response, originalCommand);
        break;
        
      case 0xA0: // Failure
        this.handleFailure(response, originalCommand);
        break;
        
      default:
        this.handleUnknownError(response, originalCommand);
    }
  }
  
  handleFailure(response, originalCommand) {
    const { msgId } = response;
    const retryCount = this.retryQueue.get(msgId) || 0;
    
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
  
  retryCommand(command, retryCount) {
    this.retryQueue.set(command.msgId, retryCount);
    
    this.eventBus.emit('command.retry', {
      command,
      retryCount,
      timestamp: new Date().toISOString()
    });
    
    // Re-emit command
    this.eventBus.emit('mqtt.publish', {
      topic: `V5008Download/${command.deviceId}`,
      message: command.payload
    });
  }
}
```

### 2. Message Processing Errors

#### Error Categories

1. **Validation Errors**: Invalid message format
2. **Parsing Errors**: Cannot parse message content
3. **Business Logic Errors**: Invalid data values
4. **System Errors**: Database, network, or resource issues

#### Error Handling Strategy

```javascript
class V5008ErrorProcessor {
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
    this.logger.error(`V5008 Error [${errorType}]: ${error.message}`, {
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
    this.eventBus.emit('v5008.error', {
      type: errorType,
      error: error.message,
      context,
      timestamp: new Date().toISOString()
    });
  }
  
  classifyError(error) {
    if (error.name === 'ValidationError') return 'VALIDATION';
    if (error.name === 'ParsingError') return 'PARSING';
    if (error.name === 'BusinessLogicError') return 'BUSINESS_LOGIC';
    return 'SYSTEM';
  }
  
  handleValidationError(error, context) {
    // Store invalid message for analysis
    this.eventBus.emit('message.invalid', {
      topic: context.topic,
      message: context.message,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
}
```

## Real-World Scenarios

### 1. High-Density RFID Monitoring

**Scenario**: Monitoring 24 RFID tags across multiple modules in a warehouse

**Configuration**:
```json
{
  "deviceId": "2437871205",
  "modules": [
    {
      "modNum": 1,
      "modId": "3963041727",
      "uCount": 12,
      "rfidTags": [
        { "num": 1, "rfid": "DD344A44", "description": "Item A" },
        { "num": 2, "rfid": "DD2862B4", "description": "Item B" },
        // ... more tags
      ]
    }
  ],
  "monitoring": {
    "reportInterval": 30,
    "alertOnMissing": true,
    "alertOnTamper": true
  }
}
```

**Message Flow**:
```javascript
// RFID monitoring implementation
class RFIDMonitoringSystem {
  constructor(eventBus) {
    this.eventBus = eventBus;
    this.expectedTags = new Map();
    this.missingAlerts = new Map();
    this.setupEventHandlers();
  }
  
  setupEventHandlers() {
    this.eventBus.on('message.processed', this.handleRFIDUpdate.bind(this));
    
    // Periodic check for missing tags
    setInterval(this.checkMissingTags.bind(this), 30000);
  }
  
  handleRFIDUpdate(message) {
    if (message.msgType !== 'Rfid') return;
    
    const { deviceId, modNum, payload } = message;
    const key = `${deviceId}-${modNum}`;
    
    // Update current tag state
    this.expectedTags.set(key, payload.rfidData);
    
    // Check for tamper alerts
    payload.rfidData.forEach(tag => {
      if (tag.alarm === 1) {
        this.handleTamperAlert(deviceId, modNum, tag);
      }
    });
    
    // Clear missing alerts for detected tags
    this.clearMissingAlerts(key, payload.rfidData);
  }
  
  handleTamperAlert(deviceId, modNum, tag) {
    const alertKey = `${deviceId}-${modNum}-${tag.num}`;
    
    if (!this.missingAlerts.has(alertKey)) {
      this.eventBus.emit('alert.tamper', {
        deviceId,
        modNum,
        tagNum: tag.num,
        rfid: tag.rfid,
        timestamp: new Date().toISOString(),
        severity: 'high'
      });
      
      this.missingAlerts.set(alertKey, {
        type: 'tamper',
        timestamp: Date.now()
      });
    }
  }
  
  checkMissingTags() {
    // Implementation for checking expected vs actual tags
    // and generating missing tag alerts
  }
}
```

### 2. Temperature and Humidity Control

**Scenario**: Environmental monitoring in a data center with threshold-based alerts

**Configuration**:
```json
{
  "thresholds": {
    "temperature": {
      "min": 18,
      "max": 27,
      "critical": 30
    },
    "humidity": {
      "min": 40,
      "max": 60,
      "critical": 70
    }
  },
  "sensors": [
    {
      "modNum": 1,
      "modId": "3963041727",
      "locations": {
        "10": "Server Rack A1",
        "11": "Server Rack A2",
        "12": "Server Rack A3"
      }
    }
  ],
  "alerts": {
    "email": "admin@example.com",
    "sms": "+1234567890",
    "webhook": "https://api.example.com/alerts"
  }
}
```

**Implementation**:
```javascript
class EnvironmentalMonitor {
  constructor(eventBus, config) {
    this.eventBus = eventBus;
    this.config = config;
    this.alertHistory = new Map();
    this.setupEventHandlers();
  }
  
  setupEventHandlers() {
    this.eventBus.on('message.processed', this.handleTempHumUpdate.bind(this));
  }
  
  handleTempHumUpdate(message) {
    if (message.msgType !== 'TempHum') return;
    
    const { deviceId, modNum, payload } = message;
    
    payload.forEach(sensor => {
      this.checkThresholds(deviceId, modNum, sensor);
    });
  }
  
  checkThresholds(deviceId, modNum, sensor) {
    const { add, temp, hum } = sensor;
    const location = this.getLocation(modNum, add);
    
    // Temperature checks
    if (temp < this.config.thresholds.temperature.min) {
      this.generateAlert('temperature', 'low', deviceId, modNum, add, temp, location);
    } else if (temp > this.config.thresholds.temperature.max) {
      this.generateAlert('temperature', 'high', deviceId, modNum, add, temp, location);
    }
    
    // Humidity checks
    if (hum < this.config.thresholds.humidity.min) {
      this.generateAlert('humidity', 'low', deviceId, modNum, add, hum, location);
    } else if (hum > this.config.thresholds.humidity.max) {
      this.generateAlert('humidity', 'high', deviceId, modNum, add, hum, location);
    }
  }
  
  generateAlert(type, level, deviceId, modNum, sensorNum, value, location) {
    const alertKey = `${type}-${deviceId}-${modNum}-${sensorNum}`;
    const now = Date.now();
    
    // Prevent alert spam (only alert once per hour)
    if (this.alertHistory.has(alertKey)) {
      const lastAlert = this.alertHistory.get(alertKey);
      if (now - lastAlert < 3600000) return;
    }
    
    const alert = {
      type,
      level,
      deviceId,
      modNum,
      sensorNum,
      value,
      location,
      timestamp: new Date().toISOString(),
      severity: level === 'critical' ? 'critical' : 'warning'
    };
    
    this.eventBus.emit('alert.environmental', alert);
    this.alertHistory.set(alertKey, now);
  }
}
```

### 3. Color Control for Visual Indicators

**Scenario**: Using U-sensor colors to indicate operational status in a manufacturing line

**Configuration**:
```json
{
  "colorSchemes": {
    "operational": {
      "1": "green",   // Station 1: Running
      "2": "green",   // Station 2: Running
      "3": "blue",    // Station 3: Idle
      "4": "off",     // Station 4: Maintenance
      "5": "red",     // Station 5: Error
      "6": "cyan"     // Station 6: Setup
    },
    "maintenance": {
      "1": "yellow",
      "2": "yellow",
      "3": "yellow",
      "4": "yellow",
      "5": "yellow",
      "6": "yellow"
    }
  },
  "transitions": {
    "normal_to_error": ["red_f", "off", "red"],
    "error_to_normal": ["green_f", "green"],
    "maintenance": ["yellow_f", "yellow"]
  }
}
```

**Implementation**:
```javascript
class VisualIndicatorController {
  constructor(eventBus, config) {
    this.eventBus = eventBus;
    this.config = config;
    this.currentScheme = 'operational';
    this.setupEventHandlers();
  }
  
  setupEventHandlers() {
    this.eventBus.on('production.status.change', this.handleStatusChange.bind(this));
    this.eventBus.on('maintenance.mode.toggle', this.toggleMaintenanceMode.bind(this));
  }
  
  handleStatusChange(event) {
    const { deviceId, modNum, status, sensorNum } = event;
    
    let targetColor;
    switch (status) {
      case 'running':
        targetColor = 'green';
        break;
      case 'idle':
        targetColor = 'blue';
        break;
      case 'error':
        targetColor = 'red';
        break;
      case 'maintenance':
        targetColor = 'yellow';
        break;
      default:
        targetColor = 'off';
    }
    
    this.setSensorColor(deviceId, modNum, sensorNum, targetColor);
  }
  
  async setSensorColor(deviceId, modNum, sensorNum, color) {
    const command = this.buildColorCommand(deviceId, modNum, sensorNum, color);
    
    try {
      await this.sendCommand(command);
      
      // Wait for response
      const response = await this.waitForResponse(command.msgId, 5000);
      
      if (response.result === 'success') {
        this.eventBus.emit('color.set.success', {
          deviceId,
          modNum,
          sensorNum,
          color,
          timestamp: new Date().toISOString()
        });
      } else {
        throw new Error(`Color set failed: ${response.result}`);
      }
    } catch (error) {
      this.eventBus.emit('color.set.error', {
        deviceId,
        modNum,
        sensorNum,
        color,
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }
  
  buildColorCommand(deviceId, modNum, sensorNum, color) {
    const colorCode = this.getColorCode(color);
    const msgId = this.generateMessageId();
    
    return {
      deviceId,
      msgId,
      payload: `E1${modNum.toString().padStart(1, '0')}${sensorNum.toString().padStart(2, '0')}${colorCode.toString(16).padStart(2, '0').toUpperCase()}`
    };
  }
  
  async sendCommand(command) {
    this.eventBus.emit('mqtt.publish', {
      topic: `V5008Download/${command.deviceId}`,
      message: command.payload
    });
  }
  
  async waitForResponse(msgId, timeout) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.eventBus.off('color.response', handler);
        reject(new Error('Response timeout'));
      }, timeout);
      
      const handler = (response) => {
        if (response.msgId === msgId) {
          clearTimeout(timer);
          this.eventBus.off('color.response', handler);
          resolve(response);
        }
      };
      
      this.eventBus.on('color.response', handler);
    });
  }
}
```

# Raw Message and Normalization

## **Heartbeat (CB/CC)**

```json
//raw mqtt message format
[CB/CC] ([modNum + modId(4B) + uCount] x 10) [msgId(4B)]

//raw mqtt topic: V5008Upload/2437871205/OpeAck
//raw mqtt message: CC01EC3737BF06028C0909950C0300000000000400000000000500000000000600000000000700000000000800000000000900000000000A0000000000F200168F
//normalized message:
 {
  deviceId: "2437871205",
  deviceType: "V5008",
  sensorType: "OpeAck",
  msgType: "Heartbeat",
  modNum: null,
  modId: null,
  ts: "2025-11-13T06:55:41.683Z",
  payload: [
    { modNum: 1, modId: "3963041727", uCount: 6      },
    { modNum: 2, modId: "2349402517", uCount: 12     }
  ],
  meta: {
    rawTopic: "V5008Upload/2437871205/OpeAck",
    rawHexString: "CC01EC3737BF06028C0909950C0300000000000400000000000500000000000600000000000700000000000800000000000900000000000A0000000000F200168F",
    msgId: 4060092047
  }
}
```

## **RFID (BB)**

```json
//raw mqtt message format
[BB][modNum][modId(4B)][reserve][uCount][rfidCount] ([num + alarm + rfid(4B)] x rfidCount) [msgId(4B)]

//raw mqtt message topic: V5008Upload/2437871205/LabelState
//raw mqtt message: BB028C090995000C030A00DD344A440B00DD2862B40C00DD3CE9C4050007AD
//normalized message
 {
  deviceId: "2437871205",
  deviceType: "V5008",
  sensorType: "LabelState",
  msgType: "Rfid",
  modNum: 2,
  modId: "2349402517",
  ts: "2025-11-13T03:20:43.142Z",
  payload: {
    uCount: 12,
    rfidCount: 3,
    rfidData: [
      { num:10 , alarm:0 , rfid: "DD344A44" },
      { num:11 , alarm:0 , rfid: "DD2862B4" },
      { num:12 , alarm:0 , rfid: "DD3CE9C4" }
    ]
  },
  meta: {
    rawTopic: "V5008Upload/2437871205/LabelState",
    rawHexString: "BB028C090995000C030A00DD344A440B00DD2862B40C00DD3CE9C4050007AD",
    msgId: 83888045
  }
}
```

## Additional Resources

- [V6800 Comparison](V6800-MQTT-Message-Format-and-Normalization-Guide.md#v6800-vs-v5008-comparison) - Compare V5008 with V6800 features
- [Event Handling Patterns](event.md#error-handling-patterns) - Advanced error handling techniques
- [Testing Strategies](MODULAR_ARCHITECTURE.md#testing-strategies) - How to test V5008 message processing

## **Temperature & Humidity**

```json
//raw mqtt message format
[modNum][modId(4B)] ([add + temp(4B) + hum(4B)] x 6) [msgId(4B)]

//raw mqtt message topic: V5008Upload/2437871205/TemHum
//raw mqtt message: 01EC3737BF0A1C30331B0B1C08330B0C000000000D000000000E000000000F0000000001012CC3
//normalized message
 {
  deviceId: "2437871205",
  deviceType: "V5008",
  sensorType: "TemHum",
  msgType: "TempHum",
  modNum: 1,
  modId: "3963041727",
  ts: "2025-11-13T07:04:52.951Z",
  payload: [
    { add: 10 , temp: 28.48, hum: 51.27 },
    { add: 11 , temp: 28.08, hum: 51.11 },
    { add: 12 , temp: 0    , hum: 0     },
    { add: 13 , temp: 0    , hum: 0     },
    { add: 14 , temp: 0    , hum: 0     },
    { add: 15 , temp: 0    , hum: 0     }
  ],
  meta: {
    rawTopic: "V5008Upload/2437871205/TemHum",
    rawHexString: "01EC3737BF0A1C30331B0B1C08330B0C000000000D000000000E000000000F0000000001012CC3",
    msgId: 16854211
  }
}
```

## **Noise**

```json
//raw mqtt message format
[modNum][modId(4B)] ([add + noise(4B)] x 3) [msgId(4B)]

//raw mqtt message topic: V5008Upload/2437871205/Noise
//raw mqtt message: 01EC3737BF100000000011000000001200000000D500EBD7
//normalized message
 {
  deviceId: "2437871205",
  deviceType: "V5008",
  sensorType: "Noise",
  msgType: "Noise",
  modNum: 1,
  modId: "3963041727",
  ts: "2025-11-17T06:17:31.835Z",
  payload: [
    { add: 16 , noise: 0     },
    { add: 17 , noise: 0     },
    { add: 18 , noise: 0     }
  ],
  meta: {
    rawTopic: "V5008Upload/2437871205/Noise",
    rawHexString: "01EC3737BF100000000011000000001200000000D500EBD7",
    msgId: 3573607383
  }
}

```

## **Door Open/Close Status (BA)**

```json
//raw mqtt message format
[BA][modNum][modId(4B)][status] [msgId(4B)]

//raw mqtt message topic: V5008Upload/2437871205/OpeAck
//raw mqtt message: BA01EC3737BF010B01C7F8
//normalized message
 {
  deviceId: "2437871205",
  deviceType: "V5008",
  sensorType: "OpeAck",
  msgType: "Door",
  modNum: 1,
  modId: "3963041727",
  ts: "2025-11-13T07:08:26.795Z",
  payload: {
    status: "0x01"
  },
  meta: {
    rawTopic: "V5008Upload/2437871205/OpeAck",
    rawHexString: "BA01EC3737BF010B01C7F8",
    msgId: 184666104
  }
}
```

## **Device Info (EF01)**

```json
//raw mqtt message format
[EF][01][deviceType(2B)][fwVersion(4B)][ip(4B)][mask(4B)][gateway(4B)][mac(6B)][msgId(4B)]

//raw mqtt message topic: V5008Upload/2437871205/OpeAck
//raw mqtt message: EF011390958DD85FC0A800D3FFFF0000C0A800018082914EF665F2011CCB
//normalized message
 {
  deviceId: "2437871205",
  deviceType: "V5008",
  sensorType: "OpeAck",
  msgType: "DeviceInfo",
  modNum: null,
  modId: null,
  ts: "2025-11-14T09:51:29.748Z",
  payload: {
    fwVersion: "2509101151",
    ip: "192.168.0.211",
    mask: "255.255.0.0",
    gateway: "192.168.0.1",
    mac: "80:82:91:4E:F6:65"
  },
  meta: {
    rawTopic: "V5008Upload/2437871205/OpeAck",
    rawHexString: "EF011390958DD85FC0A800D3FFFF0000C0A800018082914EF665F2011CCB",
    msgId: 4060159179
  }
}
```

## **Module Info (EF02)**

```json
//raw mqtt message format
[EF][02] ([modNum + fwVersion(6B)] x N) [msgId(4B)]

//raw mqtt message topic: V5008Upload/2437871205/OpeAck
//raw mqtt message: EF02010000898393CC020000898393CCF4010166
//normalized message
 {
  deviceId: "2437871205",
  deviceType: "V5008",
  sensorType: "OpeAck",
  msgType: "ModuleInfo",
  modNum: null,
  modId: null,
  ts: "2025-11-14T09:52:14.315Z",
  payload: [
    { add: 1  , fwVersion: "2307101644" },
    { add: 2  , fwVersion: "2307101644" }
  ],
  meta: {
    rawTopic: "V5008Upload/2437871205/OpeAck",
    rawHexString: "EF02010000898393CC020000898393CCF4010166",
    msgId: 4093706598
  }
}

```

## U Sensor Color Query Response

```json
 
//raw mqtt message format (converted hex string)
[AA][deviceId(4B)][cmdResult][E4][modNum]([color] x n) [msgId(4B)] 

//raw mqtt message topic: V5008Upload/2437871205/OpeAck
//raw mqtt message: AA914EF665A1E4010000000D0D0825015D4C
//normalized message:
 {
  deviceId: "2437871205",
  deviceType: "V5008",
  sensorType: "OpeAck",
  msgType: "ColorReq",
  modNum: null,
  modId: null,
  ts: "2025-11-14T07:02:38.423Z",
  payload: [
    { num: 1  , color: "off"    },
    { num: 2  , color: "off"    },
    { num: 3  , color: "off"    },
    { num: 4  , color: "blue_f" },
    { num: 5  , color: "blue_f" },
    { num: 6  , color: "red_f"  }
  ],
  meta: {
    rawTopic: "V5008Upload/2437871205/OpeAck",
    rawHexString: "AA914EF665A1E4010000000D0D0825015D4C",
    msgId: 620846412,
    result: "success"
  }
}

notes:
1.num - integer from 1 to n, n = (Len(HexString) - 24)/2
2.color - color name, from color code to color name map as below:
COLOR_NAME_MAP: {
	"0":"off" ,  
	"1": "red",
	"2":"purple" ,  
	"3":"yellow" ,  
	"4":"green" ,  
	"5":"cyan" ,  
	"6":"blue" ,  
	"7":"white" ,  
	"8":"red_f" ,  
	"9":"purple_f" ,  
	"10":"yellow_f" , //"0x0a"
	"11":"green_f" ,  //"0x0b"
	"12":"cyan_f" ,   //"0x0c"
	"13":"blue_f" ,   //"0x0d"
	"14":"white_f"    //"0x0e"
  },
```

## U Sensor Color Set Response

```json
//raw mqtt message format (converted hex string)

[AA][deviceId(4B)][cmdResult][cmdString(nB)][msgId(4B)]
cmdString - [E1][modNum]([num][colorCode]...)

//raw mqtt message topic: V5008Upload/2437871205/OpeAck
//raw mqtt message: AA914EF665A1E101050206012B002316
//normalized message:
 {
  deviceId: "2437871205",
  deviceType: "V5008",
  sensorType: "OpeAck",
  msgType: "ColorSetResponse",
  modNum: null,
  modId: null,
  ts: "2025-11-17T03:56:10.776Z",
  payload: [
    { num: 5  , color: "purple" },
    { num: 6  , color: "red"    }
  ],
  meta: {
    rawTopic: "V5008Upload/2437871205/OpeAck",
    rawHexString: "AA914EF665A1E101050206012B002316",
    msgId: 721429270,
    result: "success"
  }
}
```

## Clean U Sensor Anti-tamper Alarm Response

```json
//raw mqtt message format (converted hex string)
[AA][deviceId(4B)][cmdResult][cmdString(nB)][msgId(4B)]
cmdString - [E2][modNum]([num]...)

//raw mqtt message topic: V5008Upload/2437871205/OpeAck
//raw mqtt message: AA914EF665A1E2010605AC009ECF
//normalized message:
 {
  deviceId: "2437871205",
  deviceType: "V5008",
  sensorType: "OpeAck",
  msgType: "ClrTamperAlarmResponse",
  modNum: null,
  modId: null,
  ts: "2025-11-17T05:50:43.078Z",
  payload: {
    modNum: 1,
    num: [
      6,
      5
    ]
  },
  meta: {
    rawTopic: "V5008Upload/2437871205/OpeAck",
    rawHexString: "AA914EF665A1E2010605AC009ECF",
    msgId: 2885721807,
    result: "success"
  }
}
```

# **Notes**

- All raw bytecode messages are converted to hex strings for description.

`const rawHexString = message.toString("hex").toUpperCase();`

- 1 byte = 2 hex characters
- Multi-byte values noted as (`nB`)
- Repeated groups are indicated by `xN`.
- Temperature/Humidity/Noise values: `integer.fraction` format
- Valid modNum: 1-5

### U sensor color code

| Code | Color | Flash Code |
| --- | --- | --- |
| 0 | Off |  |
| 1 | Red | 8 |
| 2 | Purple | 9 |
| 3 | Yellow | A |
| 4 | Green | B |
| 5 | Cyan | C |
| 6 | Blue | D |
| 7 | White | E (not recommended) |

### Command Result Code

`0xA0` - failure

`0xA1` - success

## Implementation Best Practices

### 1. Message Processing Pipeline

```javascript
class V5008MessageProcessor {
  constructor() {
    this.validator = new V5008MessageValidator();
    this.normalizer = new V5008MessageNormalizer();
    this.errorHandler = new V5008ErrorProcessor();
  }
  
  async processMessage(topic, rawMessage) {
    const context = { topic, message: rawMessage };
    
    try {
      // Step 1: Validation
      const validation = this.validator.validate(topic, rawMessage);
      if (!validation.valid) {
        throw new ValidationError(validation.errors.join(', '));
      }
      
      // Step 2: Normalization
      const normalized = await this.normalizer.normalize(topic, rawMessage);
      
      // Step 3: Business logic validation
      await this.validateBusinessRules(normalized);
      
      // Step 4: Emit processed message
      this.eventBus.emit('message.processed', normalized);
      
      return normalized;
    } catch (error) {
      this.errorHandler.processError(error, context);
      throw error;
    }
  }
  
  async validateBusinessRules(message) {
    // Check for duplicate messages
    if (await this.isDuplicateMessage(message)) {
      throw new BusinessLogicError('Duplicate message detected');
    }
    
    // Validate timestamp ranges
    if (this.isTimestampInvalid(message.ts)) {
      throw new BusinessLogicError('Invalid message timestamp');
    }
    
    // Check device status
    if (!(await this.isDeviceActive(message.deviceId))) {
      throw new BusinessLogicError('Device is not active');
    }
  }
}
```

### 2. Performance Optimization

```javascript
class V5008PerformanceOptimizer {
  constructor() {
    this.messageCache = new LRUCache({ max: 1000, ttl: 300000 }); // 5 minutes
    this.batchProcessor = new BatchProcessor(100, 1000); // 100 messages or 1 second
  }
  
  async optimizeProcessing(message) {
    // Check cache for recent duplicates
    const cacheKey = this.generateCacheKey(message);
    if (this.messageCache.has(cacheKey)) {
      return this.messageCache.get(cacheKey);
    }
    
    // Batch process similar messages
    if (this.canBatchProcess(message)) {
      return this.batchProcessor.add(message);
    }
    
    // Process immediately
    return this.processImmediately(message);
  }
  
  generateCacheKey(message) {
    return `${message.deviceId}-${message.msgType}-${message.meta.msgId}`;
  }
  
  canBatchProcess(message) {
    // RFID and temperature messages can be batched
    return ['Rfid', 'TempHum'].includes(message.msgType);
  }
}
```

## Troubleshooting

### Common Issues and Solutions

#### 1. Message Not Received

**Symptoms**: No messages from specific device

**Debugging Steps**:
```javascript
// Check device connectivity
const debugDeviceConnection = async (deviceId) => {
  // Send heartbeat query
  const queryCommand = {
    deviceId,
    payload: 'EF0100'
  };
  
  try {
    const response = await sendCommandAndWaitForResponse(queryCommand, 10000);
    console.log(`Device ${deviceId} is online:`, response);
  } catch (error) {
    console.error(`Device ${deviceId} is offline:`, error.message);
  }
};
```

#### 2. Invalid Message Format

**Symptoms**: Validation errors for incoming messages

**Debugging Steps**:
```javascript
// Enable detailed logging for message validation
class DebugValidator extends V5008MessageValidator {
  validate(topic, message) {
    console.log('Validating message:', {
      topic,
      messageLength: message.length,
      messageType: this.getMessageType(topic, message)
    });
    
    const result = super.validate(topic, message);
    
    if (!result.valid) {
      console.error('Validation failed:', result.errors);
      console.error('Raw message:', message.toString('hex'));
    }
    
    return result;
  }
}
```

#### 3. Color Command Not Working

**Symptoms**: Color set commands not affecting U-sensors

**Debugging Steps**:
```javascript
// Debug color command flow
const debugColorCommand = async (deviceId, modNum, sensorNum, color) => {
  console.log('Sending color command:', { deviceId, modNum, sensorNum, color });
  
  const command = buildColorCommand(deviceId, modNum, sensorNum, color);
  console.log('Command payload:', command.payload);
  
  // Monitor for response
  eventBus.on('mqtt.message', (data) => {
    if (data.topic.includes(deviceId) && data.message.includes('AA')) {
      console.log('Color response received:', data.message.toString('hex'));
    }
  });
  
  await sendCommand(command);
};
```

### Performance Monitoring

```javascript
// Monitor V5008 specific metrics
class V5008Monitor {
  constructor() {
    this.metrics = {
      messagesProcessed: 0,
      validationErrors: 0,
      processingTimes: [],
      deviceActivity: new Map()
    };
    
    this.startMonitoring();
  }
  
  startMonitoring() {
    // Track message processing
    eventBus.on('message.processed', (message) => {
      this.metrics.messagesProcessed++;
      this.updateDeviceActivity(message.deviceId);
    });
    
    // Track validation errors
    eventBus.on('message.invalid', (data) => {
      this.metrics.validationErrors++;
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
    console.log('V5008 Metrics:', {
      messagesProcessed: this.metrics.messagesProcessed,
      validationErrors: this.metrics.validationErrors,
      activeDevices: this.metrics.deviceActivity.size,
      averageProcessingTime: this.calculateAverageProcessingTime()
    });
  }
}
```