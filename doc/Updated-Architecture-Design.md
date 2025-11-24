# IoT Middleware Message Processing Flow

This document provides a complete and detailed explanation of how an MQTT raw message flows through the system from reception to database storage.

## Overview

The IoT Middleware v3 processes messages through a modular pipeline that transforms raw device data into a standardized format, applies state management, and stores results in a database. The flow is event-driven and highly configurable.

### Updated Architecture Design

The system follows a centralized normalization approach where:

1. **Universal Message Processing**: All messages flow through Unified Normalizer
2. **Message Output Capability**: The Unified Normalizer outputs messages based on processing logic
3. **Message Type Preservation**: Original message types from device parsers are preserved
4. **Event-Driven Output**: Messages are emitted as events

## 1. Message Reception (MQTT Layer)

### 1.1 MQTT Client Initialization
- **Module**: [`modules/mqtt/MQTTClient.js`](modules/mqtt/MQTTClient.js)
- **Function**: `initialize()`
- **Process**:
  - Connects to MQTT broker using URL from configuration
  - Sets up event handlers for connect, error, close, and message events
  - Maintains subscription patterns in a Map for efficient topic matching

### 1.2 Message Reception
- **Trigger**: MQTT message arrives on a subscribed topic
- **Function**: `client.on("message", (topic, message) => {...})`
- **Process**:
  1. Logs the received topic and message
  2. Finds all matching subscription patterns using `topicMatches()` function
  3. Calls each matching handler with the topic and message
  4. Emits `mqtt.message` event via the event bus

## 2. Centralized Message Normalization

### 2.1 Message Routing
- **Module**: [`modules/ModularApplication.js`](modules/ModularApplication.js)
- **Function**: `handleMqttMessage(data)`
- **Process**:
  1. Receives the `mqtt.message` event with topic and message
  2. Gets the normalizer component from the component registry
  3. Calls `normalizer.normalize(topic, message, {})`

### 2.2 Unified Normalizer (Central Processing Layer)
- **Module**: [`modules/normalizers/UnifiedNormalizer.js`](modules/normalizers/UnifiedNormalizer.js)
- **Function**: `normalize(topic, message, deviceType, meta)`
- **Process**:
  1. Determines the device type from the topic or parameter
  2. Calls the appropriate device-specific parser based on the device type
  3. Receives the raw parsed message from the device-specific parser
  4. Applies field mapping to standardize field names (e.g., `num` → `position`)
  5. Applies state management if enabled for the message type
  6. Maintains previous state in memory for change detection
  7. Enhances the message with unified metadata
  8. Emits state change events if applicable
  9. Returns normalized messages based on processing logic

### 2.3 Design Considerations for Unified Normalizer

The Unified Normalizer serves as the central architectural component that ensures consistency across all device types. Key design principles:

#### Single Responsibility Principle
- The Unified Normalizer orchestrates the entire normalization process
- Device-specific parsers only handle protocol parsing
- Field mapping, state management, and metadata enhancement are centralized

#### Message Type Preservation
- Original message types from device parsers are preserved
- No automatic transformation of message types
- Clear separation between parsing logic and output formatting

#### Multiple Message Output Capability
- For V5008 RFID messages, outputs "Rfid" messages with change information
- "Rfid" messages contain only the changes (with action fields)
- Decision logic determines which message(s) to output based on:
  - Whether there are actual changes detected
  - State management for tracking changes

#### Event-Driven Output
- Messages are emitted as events
- Allows downstream components to subscribe to specific messages
- Maintains clear separation of concerns in the architecture

#### State Management Integration
- Maintain previous state in memory for comparison
- Calculate changes efficiently using Map data structures
- Filter output to only include meaningful changes
- Add appropriate `action` fields based on change type

#### Error Handling
- Gracefully handle missing or invalid message types
- Provide meaningful error messages for debugging
- Never let parsing errors crash the entire pipeline
- Implement validation for all incoming data fields
- Handle state synchronization errors with fallback mechanisms

### 2.4 Device-Specific Parsing (Lower Layer)
- **Module**: [`modules/normalizers/v5008Parser.js`](modules/normalizers/v5008Parser.js)
- **Function**: `parse(topic, message, meta)`
- **Process**:
  1. Extracts device information from the topic (deviceType, deviceId, sensorType)
  2. Converts the message buffer to a hex string for binary protocol parsing
  3. Determines the message type based on the topic and message headers
  4. Calls the appropriate payload processor based on the message type
  5. For RFID messages:
     - Parses the module address, module ID, unit count, and RFID count
     - Extracts each RFID tag with position, alarm status, and RFID value
     - Creates a device-specific parsed message structure
  6. Returns the parsed message to the Unified Normalizer for further processing

## 3. State Management (RFID-Specific)

### 3.1 RFID State Management
- **Module**: [`modules/normalizers/UnifiedNormalizer.js`](modules/normalizers/UnifiedNormalizer.js)
- **Function**: `applyRfidStateManagement(message, stateManager)`
- **Process**:
  1. Gets the previous state for the device/module from the RfidStateManager
  2. Updates the state with the new message
  3. Calculates changes by comparing the previous and current states
  4. Determines which messages to output based on state and context
  5. For "Rfid" messages: Filters the output to only include changed tags
  6. Adds the `action` field to indicate the state change:
     - `"attached"` - New tag detected
     - `"detached"` - Tag removed
     - `"changed"` - Tag replaced at the same position
     - `"alarm_changed"` - Alarm status changed

### 3.2 State Manager Implementation
- **Module**: [`modules/normalizers/stateManagers/RfidStateManager.js`](modules/normalizers/stateManagers/RfidStateManager.js)
- **Functions**: `updateState()`, `calculateChanges()`
- **Process**:
  1. Maintains the current state for each device/module
  2. Stores the previous state for comparison
  3. Tracks the change history for each position
  4. Provides methods to query current tags and history

### 3.3 RFID State Change Examples

#### Example 1: Tag Attachment
- **Previous State**:
  ```json
  {
    "position": 1, "alarm": 0, "rfid": "DD354B74"
  }
  ```
- **Current State**:
  ```json
  {
    "position": 1, "alarm": 0, "rfid": "DD354B74"
  },
  {
    "position": 6, "alarm": 0, "rfid": "DD344A44"
  }
  ```
- **Result**:
  ```json
  { "position": 6, "alarm": 0, "rfid": "DD344A44", "action": "attached" }
  ```

#### Example 2: Tag Detachment
- **Previous State**:
  ```json
  {
    "position": 1, "alarm": 0, "rfid": "DD354B74"
  },
  {
    "position": 6, "alarm": 0, "rfid": "DD344A44"
  }
  ```
- **Current State**:
  ```json
  {
    "position": 1, "alarm": 0, "rfid": "DD354B74"
  }
  ```
- **Result**:
  ```json
  { "position": 6, "alarm": 0, "rfid": "DD344A44", "action": "detached" }
  ```

#### Example 3: Tag Replacement
- **Previous State**:
  ```json
  {
    "position": 1, "alarm": 0, "rfid": "DD354B74"
  }
  ```
- **Current State**:
  ```json
  {
    "position": 1, "alarm": 0, "rfid": "DD111111"
  }
  ```
- **Result**:
  ```json
  { "position": 1, "alarm": 0, "rfid": "DD111111", "action": "changed" }
  ```

## 4. Message Distribution (Event Bus)

### 4.1 Processed Message Handling
- **Module**: [`modules/ModularApplication.js`](modules/ModularApplication.js)
- **Function**: `handleProcessedMessage(message)`
- **Process**:
  1. Receives the `message.processed` event with the normalized message
  2. Updates the cache if available
  3. Adds the message to the write buffer for database storage
  4. Broadcasts to WebSocket clients for real-time updates
  5. Message relay is handled separately by event subscription

## 5. Data Storage Layer

### 5.1 In-Memory Storage
- **Module**: [`modules/storage/dataStore.js`](modules/storage/dataStore.js)
- **Function**: `handleMessage(message)`
- **Process**:
  1. Stores the message in a memory Map keyed by deviceId
  2. Each device entry is an array of timestamped messages
  3. Emits the `data.stored` event
  4. Periodic cleanup removes expired entries based on the configured TTL

### 5.2 Write Buffering
- **Module**: [`modules/storage/WriteBuffer.js`](modules/storage/WriteBuffer.js)
- **Function**: `push(data)`
- **Process**:
  1. Buffers messages in a memory array
  2. Flushes to the database when:
     - Buffer reaches the maximum size (default: 1000 messages)
     - Periodic timer expires (default: 5000ms)
  3. Implements retry logic with exponential backoff
  4. Falls back to individual saves if batch save fails

### 5.3 Database Storage
- **Module**: [`modules/database/DatabaseManager.js`](modules/database/DatabaseManager.js)
- **Function**: `saveBatch(messages)`
- **Process**:
  1. Creates a batch INSERT statement for efficiency
  2. Maps message fields to database columns:
     - `deviceId` → `device_id`
     - `deviceType` → `device_type`
     - `modNum` → `mod_number`
     - `modId` → `mod_id`
     - `sensorType` → `sensor_type`
     - `msgType` → `msg_type`
     - `ts` → `timestamp`
     - `payload` → `payload` (JSON)
     - `meta` → `meta` (JSON)
  3. Converts ISO timestamps to MySQL datetime format
  4. Executes a transaction to ensure data integrity
  5. Logs errors and implements retry logic

## 6. Message Relay (Optional)

### 6.1 Message Transformation
- **Module**: [`modules/mqtt/messageRelay.js`](modules/mqtt/messageRelay.js)
- **Function**: `handleMessage(message)`
- **Process**:
  1. Subscribes to `message.processed` events
  2. Matches messages against configured relay rules
  3. Transforms messages if the rule includes a transform function
  4. Emits the `relay.message` event with the new topic and payload

### 6.2 Message Publishing
- **Module**: [`modules/ModularApplication.js`](modules/ModularApplication.js)
- **Function**: `handleRelayMessage(relayData)`
- **Process**:
  1. Receives the `relay.message` event
  2. Gets the MQTT client from the component registry
  3. Publishes the transformed message to the new topic
  4. Logs relay success/failure events

## 7. Real-Time Updates (WebSocket)

### 7.1 WebSocket Broadcasting
- **Module**: [`modules/api/WebSocketServer.js`](modules/api/WebSocketServer.js)
- **Function**: `broadcast(message)`
- **Process**:
  1. Receives processed messages via event subscription
  2. Serializes the message to JSON
  3. Sends to all connected WebSocket clients
  4. Handles connection lifecycle and error cases

## 8. Complete Flow Example (RFID Tag Attachment)

Here's a step-by-step example of what happens when an RFID tag "DD344A44" is attached:

1. **MQTT Reception**:
   - Raw message received on topic: `V5008Upload/2437871205/LabelState`
   - Hex payload: `bb01ec3737bf0006020100dd354b740600dd344a44aa002744`

2. **Device Parsing**:
   - Topic parsed: deviceType="V5008", deviceId="2437871205", sensorType="LabelState"
   - Message type determined: "Rfid"
   - Binary payload parsed:
     ```json
     {
       "modNum": 1,
       "modId": "3963041727",
       "msgType": "Rfid",
       "payload": {
         "uCount": 6,
         "rfidCount": 2,
         "rfidData": [
           { "num": 1, "alarm": 0, "rfid": "DD354B74" },
           { "num": 6, "alarm": 0, "rfid": "DD344A44" }
         ]
       }
     }
     ```

3. **Unified Normalization**:
   - Field mapping applied: `num` → `position`
   - State management applied:
     - Previous state loaded (shows DD354B74 at position 1)
     - Changes calculated:
       - Position 6: New tag "DD344A44" → action="attached"
       - Position 1: Existing tag "DD354B74" → filtered out
   - Message output generated:
     - "Rfid" message with only changes

## 9. Detailed Message Flow Examples

### 9.1 Example: Raw Message Processing
**Raw Message**: `bb01ec3737bf0006020100dd354b740600dd344a44aa002744`

#### Step 1 - Device Parsing:
```javascript
// v5008Parser.js output
{
  "modNum": 1,
  "modId": "3963041727",
  "msgType": "Rfid",
  "payload": {
    "uCount": 6,
    "rfidCount": 2,
    "rfidData": [
      { "position": 1, "alarm": 0, "rfid": "DD354B74" },
      { "position": 6, "alarm": 0, "rfid": "DD344A44" }
    ]
  }
}
```

#### Step 2 - Unified Normalization (With Previous State):
```javascript
// UnifiedNormalizer.js output - Rfid message (changes only)
{
  deviceId: "2437871205",
  deviceType: "V5008",
  sensorType: "LabelState",
  msgType: "Rfid",
  modNum: 1,
  modId: "3963041727",
  ts: "2025-11-20T06:00:27.237Z",
  payload: {
    rfidData: [
      { "position": 6, "alarm": 0, "rfid": "DD344A44", "action": "attached" }
    ]
  },
  meta: {
    rawTopic: "V5008Upload/2437871205/LabelState",
    rawHexString: "BB01EC3737BF0006020100DD354B740600DD344A44AA002744",
    msgId: 2852136772
  }
}
```

### 9.2 Message Type Handling Clarification

The Unified Normalizer follows these principles for message type handling:

1. **Message Type Preservation**: The `msgType` from device parsers is preserved in the "Rfid" messages
2. **Event-Driven Output**: Messages are emitted as events:
   - `message.processed` for all messages (with message type in the data)
   - Event listeners can filter by message.type or message.msgType
3. **Decision Logic**: The Unified Normalizer determines which messages to output based on:
   - Whether there are actual changes detected
   - State management for tracking changes

#### Message Type Transformation Flow

```
Device Parser Output (Raw Message)
    ↓
Unified Normalizer Processing
    ↓
┌─────────────────────────────────────┐
│  Decision Logic                    │
│  ├─ Changes detected?              │
│  └─ State management applied?      │
└─────────────────────────────────────┘
    ↓
┌─────────────────┐
│  Rfid Message   │
│  (Changes only) │
└─────────────────┘
```

#### Output Determination Rules

1. **Messages with Changes**:
   - Outputs Rfid (changes only)
2. **Messages with No Changes**:
   - No output (message filtered)

### 9.3 Message Distribution and Storage

Rfid messages follow the distribution path:

1. **Message Distribution**:
   - Stored in memory cache for quick access
   - Added to write buffer for database storage
   - Broadcast to WebSocket clients for real-time UI updates
   - Checked against message relay rules (if configured)

2. **Database Storage**:
   - Batched with other messages in write buffer
   - Transaction executed with INSERT statement:
     ```sql
     INSERT INTO sensor_data (
       device_id, device_type, mod_number, mod_id, sensor_type,
       msg_type, timestamp, payload, meta, created_at
     ) VALUES (
       '2437871205', 'V5008', 1, '3963041727', 'LabelState',
       'Rfid', '2025-11-20 06:00:27',
       '{"rfidData":[{"position":6,"rfid":"DD344A44","action":"attached","alarm":0}]}',
       '{"rawTopic":"V5008Upload/2437871205/LabelState","rawHexString":"BB01EC3737BF0006020100DD354B740600DD344A44AA002744","msgId":2852136772}',
       '2025-11-20 06:00:27'
     )
     ```

## 10. Key Action Points and Modules

| Action Point | Module | Key Function | Purpose |
|-------------|---------|--------------|---------|
| MQTT Connection | [`MQTTClient.js`](modules/mqtt/MQTTClient.js) | `initialize()` | Connect to broker and set up handlers |
| Message Reception | [`MQTTClient.js`](modules/mqtt/MQTTClient.js) | `client.on("message")` | Receive raw MQTT messages |
| Message Routing | [`ModularApplication.js`](modules/ModularApplication.js) | `handleMqttMessage()` | Route to normalizer |
| Unified Normalization | [`UnifiedNormalizer.js`](modules/normalizers/UnifiedNormalizer.js) | `normalize()` | Standardize format and apply state management |
| Device Parsing | [`v5008Parser.js`](modules/normalizers/v5008Parser.js) | `parse()` | Parse binary protocol |
| State Management | [`UnifiedNormalizer.js`](modules/normalizers/UnifiedNormalizer.js) | `applyRfidStateManagement()` | Track changes and add actions |
| Change Calculation | [`RfidStateManager.js`](modules/normalizers/stateManagers/RfidStateManager.js) | `calculateChanges()` | Compare states and identify changes |
| Memory Storage | [`dataStore.js`](modules/storage/dataStore.js) | `handleMessage()` | Store in memory for quick access |
| Write Buffering | [`WriteBuffer.js`](modules/storage/WriteBuffer.js) | `push()` | Batch messages for efficiency |
| Database Storage | [`DatabaseManager.js`](modules/database/DatabaseManager.js) | `saveBatch()` | Persist to database |
| Real-time Updates | [`WebSocketServer.js`](modules/api/WebSocketServer.js) | `broadcast()` | Push to connected clients |
| Message Relay | [`messageRelay.js`](modules/mqtt/messageRelay.js) | `handleMessage()` | Transform and republish |

## 11. Configuration Points

The system behavior can be configured at multiple points:

1. **MQTT Connection**: Broker URL, connection options
2. **Parser Selection**: Device-specific parsers based on topic patterns
3. **State Management**: Enabled/disabled per device type and message type
4. **Write Buffering**: Batch size, flush interval, retry count
5. **Database Connection**: Connection parameters, table structure
6. **Message Relay**: Source/target patterns, transformation functions
7. **WebSocket**: Port, authentication, message filtering
8. **Data Store**: TTL, cleanup interval, maximum entries

### 11.1 Configuration Validation

All configuration parameters are validated at startup:

1. **Required Parameters**: System will not start without essential parameters
2. **Type Validation**: Ensures parameters are of correct type (string, number, boolean)
3. **Range Validation**: Validates numeric parameters are within acceptable ranges
4. **Connection Testing**: Tests database and MQTT connections before accepting configuration
5. **Schema Validation**: JSON schema validation for complex configuration objects
6. **Environment Variable Overrides**: Configuration can be overridden by environment variables with proper validation

## 12. Error Handling and Resilience

1. **MQTT Disconnection**: Automatic reconnection with exponential backoff
2. **Parse Failures**: Error logging, message rejection
3. **Database Failures**: Retry logic, fallback to individual saves
4. **State Management**: Graceful degradation if state is corrupted
5. **Component Failures**: Isolation prevents cascade failures
6. **Memory Management**: Periodic cleanup prevents memory leaks
7. **State Synchronization Errors**: Automatic state reset and recovery mechanisms
8. **Message Validation**: Schema validation for all incoming messages
9. **Circuit Breaker Pattern**: Prevents cascade failures in downstream services

## 13. Security Considerations

1. **MQTT Security**:
   - TLS/SSL encryption for MQTT connections
   - Client certificate authentication
   - Username/password authentication with encrypted credentials
   - Topic-based access control

2. **Data Security**:
   - Encryption of sensitive data at rest in database
   - Payload encryption for sensitive message content
   - Data masking in logs for sensitive information

3. **API Security**:
   - JWT-based authentication for REST APIs
   - WebSocket authentication with token validation
   - Rate limiting to prevent abuse
   - CORS configuration for web interface

4. **System Security**:
   - Input validation and sanitization
   - SQL injection prevention
   - XSS protection for web interface
   - Secure configuration management

5. **Network Security**:
   - Firewall configuration recommendations
   - VPN requirements for remote access
   - Port security guidelines
   - Network segmentation recommendations

This modular architecture allows for easy extension, configuration, and maintenance of the IoT Middleware system.