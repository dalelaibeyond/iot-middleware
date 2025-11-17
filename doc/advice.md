# Normalization Improvement Advice for V5008 and V6800 Devices

## Executive Summary

After analyzing both V5008 and V6800 parsers, I've identified significant inconsistencies in how RFID messages are normalized and structured. The middleware's goal is to provide a unified and friendly message format to upper applications, but the current implementation maintains device-specific differences that create unnecessary complexity for consumers.

## Key Issues Identified

### 1. Inconsistent RFID Message Semantics

**V5008**: RFID payload represents a complete state snapshot
```javascript
// V5008 RFID payload structure
{
  uCount: 12,           // Total U-sensor count
  rfidCount: 3,         // Number of RFID tags present
  rfidData: [           // All currently attached tags
    { num: 10, alarm: 0, rfid: "DD344A44" },
    { num: 11, alarm: 0, rfid: "DD2862B4" },
    { num: 12, alarm: 0, rfid: "DD3CE9C4" }
  ]
}
```

**V6800**: RFID payload represents discrete events
```javascript
// V6800 RFID payload structure
{
  rfidData: [           // Only changed tags
    { num: 3, alarm: 0, rfid: "DD23B0B4", action: "attached" },
    { num: 1, alarm: 0, rfid: "DD395064", action: "attached" }
  ]
}
```

### 2. Missing State Management in V6800

V6800 only provides events (attached/detached) but doesn't maintain a complete state view, requiring upper applications to track state themselves.

### 3. Inconsistent Field Names

- V5008 uses `num` for sensor position
- V6800 uses `num` for sensor position but `pos` in color messages
- Different field names for similar concepts across devices

### 4. Inconsistent Response Handling

- V5008 uses binary hex responses with result codes
- V6800 uses structured JSON responses
- Error handling patterns are completely different

## Recommended Improvements

### 1. Unified RFID State Management

Implement a state management layer that provides consistent RFID state for both device types:

```javascript
// Proposed unified RFID structure
{
  deviceId: "2437871205",
  deviceType: "V5008", // or "V6800"
  sensorType: "LabelState",
  msgType: "Rfid",
  modNum: 2,
  modId: "2349402517",
  ts: "2025-11-17T06:32:07.835Z",
  payload: {
    uCount: 12,           // Total U-sensor count (consistent across both)
    rfidCount: 3,         // Number of RFID tags currently present
    rfidData: [           // Unified structure for both devices
      { 
        position: 10,        // Consistent field name
        rfid: "DD344A44", 
        state: "attached",   // Always present state
        lastChanged: "2025-11-17T06:20:15.123Z", // Track when state changed
        alarm: 0 
      },
      // ... more entries
    ],
    changes: [              // V6800-specific event tracking
      {
        position: 3,
        rfid: "DD23B0B4",
        action: "attached",
        timestamp: "2025-11-17T06:32:07.835Z"
      }
      // ... recent changes
    ]
  }
}
```

### 2. Create a Unified Normalization Layer

```javascript
class UnifiedRfidNormalizer {
  constructor() {
    this.deviceStates = new Map(); // Track state for V6800 devices
  }
  
  normalize(topic, message, deviceType) {
    switch (deviceType) {
      case "V5008":
        return this.normalizeV5008Rfid(topic, message);
      case "V6800":
        return this.normalizeV6800Rfid(topic, message);
      default:
        throw new Error(`Unsupported device type: ${deviceType}`);
    }
  }
  
  normalizeV5008Rfid(topic, message) {
    // V5008 already provides complete state
    const normalized = v5008Parser.parse(topic, message);
    
    // Add unified fields
    normalized.payload.rfidData = normalized.payload.rfidData.map(tag => ({
      position: tag.num,
      rfid: tag.rfid,
      state: "attached", // V5008 only shows attached tags
      alarm: tag.alarm
    }));
    
    return normalized;
  }
  
  normalizeV6800Rfid(topic, message) {
    const deviceKey = this.extractDeviceKey(topic);
    const currentState = this.deviceStates.get(deviceKey) || this.createEmptyState();
    
    // Parse V6800 message
    const parsed = v6800Parser.parse(topic, message);
    
    // Update state based on events
    if (Array.isArray(parsed)) {
      // Handle multiple port messages
      return parsed.map(msg => this.updateRfidState(deviceKey, msg));
    } else {
      // Handle single message
      return this.updateRfidState(deviceKey, parsed);
    }
  }
  
  updateRfidState(deviceKey, message) {
    const currentState = this.deviceStates.get(deviceKey) || this.createEmptyState();
    
    // Process RFID changes
    if (message.payload && message.payload.rfidData) {
      message.payload.rfidData.forEach(change => {
        const position = change.num;
        
        if (change.action === "attached") {
          // Add or update tag
          currentState.rfidMap.set(position, {
            position,
            rfid: change.rfid,
            state: "attached",
            lastChanged: new Date().toISOString(),
            alarm: change.alarm
          });
        } else if (change.action === "detached") {
          // Remove tag
          currentState.rfidMap.delete(position);
        }
      });
    }
    
    // Create unified message
    const unifiedMessage = {
      ...message,
      payload: {
        uCount: currentState.uCount,
        rfidCount: currentState.rfidMap.size,
        rfidData: Array.from(currentState.rfidMap.values()),
        changes: message.payload.rfidData || []
      }
    };
    
    // Store updated state
    this.deviceStates.set(deviceKey, currentState);
    
    return unifiedMessage;
  }
  
  createEmptyState() {
    return {
      uCount: 0,
      rfidMap: new Map() // position -> rfid data
    };
  }
  
  extractDeviceKey(topic) {
    // Extract unique device identifier from topic
    const parts = topic.split('/');
    return `${parts[1]}-${parts[2]}`; // deviceId-sensorType
  }
}
```

### 3. Unified Response Handling

Create a consistent response format for both device types:

```javascript
class UnifiedResponseHandler {
  static normalizeResponse(deviceType, response) {
    switch (deviceType) {
      case "V5008":
        return this.normalizeV5008Response(response);
      case "V6800":
        return this.normalizeV6800Response(response);
      default:
        throw new Error(`Unsupported device type: ${deviceType}`);
    }
  }
  
  static normalizeV5008Response(response) {
    // Convert V5008 hex response to unified format
    const result = response.meta.result;
    
    return {
      success: result === "success",
      code: result === "success" ? 200 : 400,
      message: result,
      deviceType: "V5008",
      raw: response
    };
  }
  
  static normalizeV6800Response(response) {
    // Convert V6800 JSON response to unified format
    const code = response.code || response.set_property_result;
    
    return {
      success: code === 200 || code === 0,
      code: code,
      message: this.getV6800Message(code),
      deviceType: "V6800",
      raw: response
    };
  }
  
  static getV6800Message(code) {
    const messages = {
      200: "Success",
      0: "Success",
      400: "Bad Request",
      401: "Unauthorized",
      404: "Not Found",
      500: "Internal Server Error"
    };
    
    return messages[code] || "Unknown";
  }
}
```

### 4. Consistent Field Naming

Establish a unified field naming convention:

| Current V5008 | Current V6800 | Unified Field | Description |
|----------------|----------------|---------------|-------------|
| num | num/pos | position | Sensor position index |
| modNum | module_index | modNum | Module number |
| modId | module_sn | modId | Module serial number |
| uCount | module_u_num | uCount | U-sensor count |
| rfid | tag_code | rfid | RFID tag value |
| alarm | warning | alarm | Alarm status |

### 5. Enhanced Event-Driven Updates

Implement a state change event system for upper applications:

```javascript
// Emit events for state changes
eventBus.emit('rfid.state.changed', {
  deviceId: "2437871205",
  modNum: 2,
  position: 5,
  previousState: null,
  currentState: {
    position: 5,
    rfid: "DD344A44",
    state: "attached",
    alarm: 0
  },
  timestamp: "2025-11-17T06:32:07.835Z"
});

// Query current state
eventBus.emit('rfid.state.query', {
  deviceId: "2437871205",
  modNum: 2,
  callback: (state) => {
    // Handle current state
  }
});
```

## Implementation Strategy

### Phase 1: Create Unified Normalization Layer
1. Implement `UnifiedRfidNormalizer` class
2. Add state management for V6800 devices
3. Maintain backward compatibility with existing parsers

### Phase 2: Update Message Structure
1. Define unified message schema
2. Update both parsers to use unified structure
3. Add migration path for existing applications

### Phase 3: Enhanced Event System
1. Implement state change events
2. Add query capabilities
3. Update documentation

### Phase 4: Testing and Validation
1. Create comprehensive test suite
2. Test with both device types
3. Validate backward compatibility

## Benefits of This Approach

1. **Consistency**: Upper applications see the same structure regardless of device type
2. **State Management**: V6800 provides complete state like V5008
3. **Event-Driven**: Applications can react to specific changes
4. **Backward Compatible**: Existing applications can migrate gradually
5. **Extensible**: Easy to add new device types in the future

## Migration Considerations

1. **Versioning**: Add version field to normalized messages
2. **Feature Flags**: Allow gradual rollout of unified format
3. **Documentation**: Update all API documentation
4. **Testing**: Comprehensive regression testing

## Conclusion

The current normalization approach maintains device-specific differences that create unnecessary complexity for upper applications. By implementing a unified normalization layer with consistent state management, field naming, and event-driven updates, the middleware can truly provide a "united and friendly message format" as intended.

The key insight is that V6800's event-based approach needs to be enhanced with state management, while V5008's state snapshots need to be enhanced with event tracking. This hybrid approach provides the best of both worlds.