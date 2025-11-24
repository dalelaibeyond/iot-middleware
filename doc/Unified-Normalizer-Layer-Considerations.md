# Unified Normalizer Layer Considerations

## Overview

This document outlines considerations for creating a unified normalizer layer that handles all message types in the IoT middleware system, not just RFID messages. The goal is to provide a consistent, device-agnostic interface for upper applications while maintaining the unique capabilities of each device type.

## Goals

1. Create a single, consistent normalization approach for all device types and message types
2. Eliminate device-specific differences in the normalized output
3. Provide a truly unified message format for upper applications
4. Simplify integration and maintenance for consumers of the middleware
5. Enable state management across all message types
6. Provide consistent field naming and data structures

## Scope

- All device types (V5008, V6800, G6000, etc.)
- All message types (RFID, color, sensor data, system messages, etc.)
- State management across all message types
- Consistent field naming and data structures

## Current State Analysis

### Existing Architecture

The current system has:
1. Device-specific parsers (V5008, V6800, G6000)
2. A UnifiedRfidNormalizer that handles only RFID messages
3. A NormalizerRegistry that manages parsers and applies the unified RFID normalizer

### Issues Identified

1. **Inconsistent Message Structures**: Different devices use different field names for similar concepts
2. **Limited State Management**: Only RFID messages have unified state management
3. **Fragmented Normalization**: Each message type is handled differently across devices
4. **No Unified Event System**: Changes in state are not consistently exposed to applications
5. **Incomplete G6000 Support**: G6000 parser only provides raw hex data

## Proposed Unified Normalizer Architecture

### Core Components

1. **UnifiedNormalizer**: Main orchestrator that handles all message types
2. **StateManagers**: Device-agnostic state management for different message types
3. **FieldMapper**: Standardizes field names across devices
4. **EventEmitter**: Provides consistent events for state changes
5. **MessageEnhancer**: Adds unified metadata and context

### Unified Message Schema

All normalized messages will follow this structure:

```javascript
{
  // Core identification fields (consistent across all devices)
  deviceId: "string",           // Device identifier
  deviceType: "string",         // V5008, V6800, G6000, etc.
  sensorType: "string",         // LabelState, TemHum, Noise, etc.
  msgType: "string",            // Rfid, TempHum, Noise, Door, etc.
  modNum: number,               // Module number (normalized)
  modId: "string",              // Module identifier (normalized)
  
  // Timestamps
  ts: "ISO8601 string",         // Message timestamp
  stateTs: "ISO8601 string",     // State change timestamp (if applicable)
  
  // Payload (unified structure based on msgType)
  payload: {
    // Structure varies by msgType but with consistent field names
  },
  
  // Metadata
  meta: {
    rawTopic: "string",         // Original MQTT topic
    rawMessage: any,            // Original message (optional)
    normalizedAt: "ISO8601",    // When normalization occurred
    normalizerVersion: "string", // Version of the normalizer
    deviceSpecific: object       // Device-specific data preserved
  }
}
```

### Unified Payload Schemas

#### RFID Payload
```javascript
{
  uCount: number,                // Total U-sensor count
  rfidCount: number,            // Number of RFID tags present
  rfidData: [{
    position: number,           // Sensor position (unified field name)
    rfid: "string",             // RFID tag value
    state: "attached"|"detached", // Current state
    lastChanged: "ISO8601",     // When last state change occurred
    alarm: number                // Alarm status
  }]
}
```

#### Temperature/Humidity Payload
```javascript
{
  sensorCount: number,           // Number of sensors
  sensorData: [{
    position: number,           // Sensor position (unified)
    temperature: number,        // Temperature value
    humidity: number,           // Humidity value
    lastChanged: "ISO8601"      // When last reading was taken
  }]
}
```

#### Noise Payload
```javascript
{
  sensorCount: number,           // Number of sensors
  sensorData: [{
    position: number,           // Sensor position (unified)
    noiseLevel: number,         // Noise level in dB
    lastChanged: "ISO8601"      // When last reading was taken
  }]
}
```

#### Color Payload
```javascript
{
  positionCount: number,        // Number of positions
  positionData: [{
    position: number,           // Position index (unified)
    color: "string",            // Color name
    code: number,               // Color code
    lastChanged: "ISO8601"      // When last color change occurred
  }]
}
```

#### Door Status Payload
```javascript
{
  status: "string",             // Door status (normalized hex string)
  lastChanged: "ISO8601"        // When last status change occurred
}
```

### Field Name Standardization

| Current V5008 | Current V6800 | Current G6000 | Unified Field | Description |
|---------------|---------------|---------------|---------------|-------------|
| num | num/pos | N/A | position | Sensor position index |
| modNum | module_index | N/A | modNum | Module number |
| modId | module_sn | N/A | modId | Module serial number |
| uCount | module_u_num | N/A | uCount | U-sensor count |
| rfid | tag_code | N/A | rfid | RFID tag value |
| alarm | warning | N/A | alarm | Alarm status |
| add | temper_position | N/A | position | Sensor position |
| temp | temper_swot | N/A | temperature | Temperature value |
| hum | hygrometer_swot | N/A | humidity | Humidity value |
| noise | noise_swot | N/A | noiseLevel | Noise level |

## Implementation Strategy

### Phase 1: Core Infrastructure

1. Create the base UnifiedNormalizer class
2. Implement StateManager factory for different message types
3. Create FieldMapper utility
4. Implement EventEmitter for consistent events
5. Design MessageEnhancer for metadata

### Phase 2: Message Type Implementation

1. Implement unified RFID state management (extend existing UnifiedRfidNormalizer)
2. Create Temperature/Humidity state management
3. Create Noise state management
4. Create Color state management
5. Create Door state management
6. Implement Device/Module info handling

### Phase 3: Device Integration

1. Update V5008 parser to use unified normalizer
2. Update V6800 parser to use unified normalizer
3. Complete G6000 parser implementation
4. Implement device-specific field mappings
5. Add device-specific state preservation

### Phase 4: Advanced Features

1. Implement cross-device state correlation
2. Add state persistence and recovery
3. Implement state query API
4. Add state change subscriptions
5. Implement state analytics and reporting

### Phase 5: Testing and Migration

1. Create comprehensive test suite
2. Implement backward compatibility layer
3. Create migration guide for existing applications
4. Performance testing and optimization
5. Documentation and examples

## State Management Design

### StateManager Interface

```javascript
class StateManager {
  // Update state with new message
  updateState(deviceId, modNum, message) { /* ... */ }
  
  // Get current state
  getCurrentState(deviceId, modNum) { /* ... */ }
  
  // Calculate changes between states
  calculateChanges(previous, current) { /* ... */ }
  
  // Clear state
  clearState(deviceId, modNum) { /* ... */ }
  
  // Get state history
  getStateHistory(deviceId, modNum, options) { /* ... */ }
}
```

### State Persistence

1. In-memory state for fast access
2. Optional database persistence for recovery
3. Configurable retention policies
4. State compression for long-term storage

## Event System Design

### Standard Events

```javascript
// State change events
'unified.state.changed.rfid'
'unified.state.changed.temphum'
'unified.state.changed.noise'
'unified.state.changed.color'
'unified.state.changed.door'

// Query events
'unified.state.query'
'unified.state.query.response'

// System events
'unified.device.connected'
'unified.device.disconnected'
'unified.module.added'
'unified.module.removed'
```

### Event Payload Structure

```javascript
{
  deviceId: "string",
  deviceType: "string",
  modNum: number,
  msgType: "string",
  timestamp: "ISO8601",
  changes: [{
    position: number,
    previousValue: any,
    currentValue: any,
    changeType: "added"|"removed"|"modified"
  }],
  currentState: object,
  metadata: object
}
```

## Configuration

### Normalizer Configuration

```javascript
{
  // Global settings
  version: "1.0.0",
  enableStatePersistence: true,
  stateRetentionDays: 30,
  
  // Device-specific settings
  devices: {
    V5008: {
      enabled: true,
      stateManagement: {
        rfid: true,
        temphum: true,
        noise: true,
        color: true,
        door: true
      }
    },
    V6800: {
      enabled: true,
      stateManagement: {
        rfid: true,
        temphum: true,
        noise: true,
        color: true,
        door: true
      }
    },
    G6000: {
      enabled: true,
      stateManagement: {
        // To be implemented as parser is completed
      }
    }
  },
  
  // Event settings
  events: {
    enabled: true,
    emitStateChanges: true,
    emitQueries: true,
    bufferSize: 1000
  }
}
```

## Migration Path

### Backward Compatibility

1. Maintain existing parser interfaces
2. Add feature flags for gradual migration
3. Provide adapter pattern for legacy applications
4. Document deprecation timeline

### Migration Steps

1. Deploy unified normalizer alongside existing system
2. Enable unified normalizer for new devices
3. Gradually migrate existing devices
4. Update applications to use unified format
5. Remove legacy parsers after migration complete

## Benefits

1. **Consistency**: All devices provide the same message structure
2. **Simplified Integration**: Applications need only understand one format
3. **Enhanced State Management**: Complete state tracking for all message types
4. **Event-Driven Architecture**: Applications can react to specific changes
5. **Future-Proof**: Easy to add new device types and message types
6. **Maintainability**: Single point of normalization logic
7. **Debugging**: Consistent logging and error handling

## Challenges and Considerations

1. **Performance**: State management adds overhead
2. **Memory Usage**: Storing state for many devices
3. **Complexity**: Unified system is more complex than device-specific
4. **Migration Effort**: Significant work to migrate existing systems
5. **Testing**: Comprehensive testing required for all device combinations

## Conclusion

A unified normalizer layer will significantly simplify the IoT middleware system by providing a consistent interface for all device types and message types. While the implementation effort is substantial, the long-term benefits in terms of maintainability, extensibility, and ease of integration make it a worthwhile investment.

The key is to implement this incrementally, starting with the core infrastructure and gradually adding support for different message types and devices, while maintaining backward compatibility throughout the process.