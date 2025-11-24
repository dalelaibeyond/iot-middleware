# Unified RFID Message Format

## Overview

The IoT middleware now provides a unified RFID message format that normalizes messages from both V5008 and V6800 devices into a consistent structure. This unified format includes state management, change tracking, and consistent field naming across device types.

## Key Benefits

1. **Consistent Structure**: Upper applications see the same message format regardless of device type
2. **State Management**: Complete RFID state is maintained for both device types
3. **Change Tracking**: Delta changes are calculated and provided for each message
4. **Event-Driven**: Applications can react to specific RFID state changes
5. **Backward Compatible**: Existing applications can migrate gradually

## Message Structure

### Base Message Fields

All unified RFID messages include these base fields:

```javascript
{
  deviceId: "2437871205",        // Device identifier
  deviceType: "V5008",          // or "V6800"
  sensorType: "LabelState",      // Sensor type from topic
  msgType: "Rfid",               // Message type
  modNum: 2,                     // Module number
  modId: "2349402517",           // Module serial number
  ts: "2025-11-17T06:32:07.835Z", // Timestamp
  payload: { ... },              // Current RFID state
  previousState: { ... },        // Previous state (null for first message)
  changes: [ ... ],              // Array of changes (null for no changes)
  meta: { ... }                  // Additional metadata
}
```

### Payload Structure

The payload contains the current complete RFID state:

```javascript
payload: {
  uCount: 12,                    // Total U-sensor count
  rfidCount: 3,                  // Number of RFID tags currently present
  rfidData: [                    // Current complete state
    {
      position: 10,              // Sensor position (consistent field name)
      rfid: "DD344A44",          // RFID tag value
      state: "attached",         // Current state (always present)
      lastChanged: "2025-11-17T06:20:15.123Z", // When state last changed
      alarm: 0                   // Alarm status
    },
    // ... more entries
  ]
}
```

### Previous State Structure

The previousState field contains the complete state from the previous message:

```javascript
previousState: {
  uCount: 12,
  rfidCount: 2,
  rfidData: [
    {
      position: 10,
      rfid: "DD344A44",
      state: "attached",
      lastChanged: "2025-11-17T05:15:10.123Z",
      alarm: 0
    }
    // Note: Position 11 had no RFID in previous state
  ]
}
```

### Changes Structure

The changes field contains an array of delta changes between states:

```javascript
changes: [
  {
    position: 11,                // Sensor position that changed
    rfid: "DD2862B4",            // Current RFID value
    action: "attached",          // Type of change: "attached", "detached", or "changed"
    timestamp: "2025-11-17T06:32:07.835Z", // When the change occurred
    previousRfid: null,          // Previous RFID value (null for new attachments)
    currentRfid: "DD2862B4"      // Current RFID value (null for detachments)
  },
  // ... more changes
]
```

## Device-Specific Behavior

### V5008 Devices

V5008 devices provide complete state snapshots in each message. The unified normalizer:

1. Parses the complete state snapshot
2. Compares with the previous state
3. Calculates delta changes
4. Returns the unified format with both current state and changes

### V6800 Devices

V6800 devices provide event-based messages (only changed tags). The unified normalizer:

1. Processes the event-based changes
2. Updates the internal state management
3. Builds a complete state view
4. Returns the unified format with complete state and changes

## Field Name Mapping

The unified format normalizes field names across device types:

| V5008 Field | V6800 Field | Unified Field | Description |
|-------------|-------------|---------------|-------------|
| num | u_index | position | Sensor position index |
| modNum | host_gateway_port_index | modNum | Module number |
| modId | extend_module_sn | modId | Module serial number |
| uCount | module_u_num | uCount | U-sensor count |
| rfid | tag_code | rfid | RFID tag value |
| alarm | warning | alarm | Alarm status |

## Usage Examples

### Basic Message Processing

```javascript
const { normalize } = require('./modules/normalizers');

// Process any RFID message (V5008 or V6800)
const message = normalize(topic, rawMessage);

if (message && message.msgType === 'Rfid') {
  console.log(`Device ${message.deviceId} has ${message.payload.rfidCount} RFID tags`);
  
  // Process changes if any
  if (message.changes) {
    message.changes.forEach(change => {
      console.log(`Position ${change.position}: ${change.action} - ${change.rfid}`);
    });
  }
}
```

### State Query

```javascript
const { getRegistry } = require('./modules/normalizers');
const registry = getRegistry();
const rfidNormalizer = registry.getUnifiedRfidNormalizer();

// Query current state for a specific device module
const currentState = rfidNormalizer.getCurrentState("2437871205", 2);
if (currentState) {
  console.log(`Current state: ${currentState.rfidCount} tags attached`);
}
```

### Reacting to Specific Changes

```javascript
const { normalize } = require('./modules/normalizers');

function processRfidMessage(topic, rawMessage) {
  const message = normalize(topic, rawMessage);
  
  if (!message || message.msgType !== 'Rfid' || !message.changes) {
    return;
  }
  
  message.changes.forEach(change => {
    switch (change.action) {
      case 'attached':
        console.log(`New RFID attached at position ${change.position}: ${change.rfid}`);
        // Handle attachment logic
        break;
        
      case 'detached':
        console.log(`RFID detached from position ${change.position}: ${change.previousRfid}`);
        // Handle detachment logic
        break;
        
      case 'changed':
        console.log(`RFID changed at position ${change.position}: ${change.previousRfid} → ${change.currentRfid}`);
        // Handle change logic
        break;
    }
  });
}
```

## State Management

The unified normalizer maintains state for each device-module combination:

```javascript
const { getRegistry } = require('./modules/normalizers');
const registry = getRegistry();
const rfidNormalizer = registry.getUnifiedRfidNormalizer();

// Get statistics
const stats = rfidNormalizer.getStats();
console.log(`Tracking ${stats.deviceCount} devices with ${stats.totalRfidCount} total RFID tags`);

// Clear state for a specific module
rfidNormalizer.clearState("2437871205", 2);

// Clear all state for a device
rfidNormalizer.clearState("2437871205");
```

## Migration Guide

### For Existing V5008 Applications

1. Update field names: `num` → `position`
2. Handle the new `changes` array for event-driven processing
3. Use `previousState` for comparison if needed
4. The base message structure remains compatible

### For Existing V6800 Applications

1. Access complete state via `payload.rfidData` instead of just the changes
2. Use the consistent `position` field name
3. The event-based `changes` array is still available
4. No need to maintain your own state tracking

### For New Applications

1. Use the unified format directly
2. Leverage the `changes` array for event-driven processing
3. Use `payload.rfidData` for complete state queries
4. Take advantage of consistent field naming across device types

## Implementation Notes

1. **State Persistence**: State is maintained in memory and resets on service restart
2. **Memory Management**: Consider clearing state for inactive devices to manage memory
3. **Error Handling**: Invalid messages are logged but don't crash the normalizer
4. **Performance**: State comparison is optimized for typical RFID tag counts
5. **Thread Safety**: The current implementation is not thread-safe for concurrent access

## Future Enhancements

1. **Persistent State**: Option to persist state to database
2. **State Expiration**: Automatic cleanup of inactive device states
3. **Batch Processing**: Support for processing multiple messages efficiently
4. **Custom Event Handlers**: Register callbacks for specific change types
5. **State Export/Import**: Ability to export and import device states