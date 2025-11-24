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

Implement a state management layer that provides consistent RFID state for both device types, including previous/last data comparison:

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
    rfidData: [           // Current complete state
      {
        position: 10,        // Consistent field name
        rfid: "DD344A44",
        state: "attached",
        lastChanged: "2025-11-17T06:20:15.123Z",
        alarm: 0
      },
      // ... more entries
    ],
    previousState: {          // Previous complete state for comparison
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
    },
    changes: [              // Delta changes between states
      {
        position: 11,
        rfid: "DD2862B4",
        action: "attached",
        timestamp: "2025-11-17T06:32:07.835Z",
        previousRfid: null,     // No RFID was here before
        currentRfid: "DD2862B4"
      }
      // ... more changes
    ]
  }
}
### Data Storage Implementation Details

#### How Maps Save Latest Data

**deviceStates Map Structure:**
```javascript
// Key: deviceId (e.g., "2437871205")
// Value: Map {
//   modNum1: { uCount: 12, rfidCount: 3, rfidMap: Map {...} },
//   modNum2: { uCount: 12, rfidCount: 2, rfidMap: Map {...} }
// }
```

**stateHistory Map Structure:**
```javascript
// Key: "2437871205-2" (deviceId-modNum)
// Value: { uCount: 12, rfidCount: 2, rfidData: [...] }
```

#### Data Update Process

1. **New Message Arrives**:
   - Parse message → Create currentState object
   - Get previousState from stateHistory
   - Calculate changes between states
   - Update deviceStates[modNum] = currentState
   - Update stateHistory[key] = currentState

2. **Data Persistence**:
   - deviceStates always contains the MOST RECENT state
   - stateHistory contains the PREVIOUS state (for comparison)
   - Both are updated simultaneously after each message

3. **Memory Management**:
   - Old states can be cleaned up when device goes offline
   - Maps automatically grow as new modules are detected
   - No manual cleanup needed for normal operation

#### Why This Works

This approach ensures that:
- Upper applications always have access to the latest complete state
- Previous state is available for comparison and change detection
- No data loss occurs during normal operation
- Memory usage is optimized by only storing necessary data
```

### 2. Create a Unified Normalization Layer

```javascript
class UnifiedRfidNormalizer {
  constructor() {
    this.deviceStates = new Map(); // Track current state for each device
    this.stateHistory = new Map(); // Track historical states for comparison
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
    const deviceKey = this.extractDeviceKey(topic);
    const normalized = v5008Parser.parse(topic, message);
    
    // Get previous state from history
    const previousState = this.stateHistory.get(deviceKey);
    
    // Create current state object
    const currentState = {
      uCount: normalized.payload.uCount,
      rfidCount: normalized.payload.rfidCount,
      rfidData: normalized.payload.rfidData.map(tag => ({
        position: tag.num,
        rfid: tag.rfid,
        state: "attached",
        lastChanged: new Date().toISOString(), // V5008 doesn't provide timestamps
        alarm: tag.alarm
      }))
    };
    
    // Create unified structure with state comparison
    const unifiedMessage = {
      ...normalized,
      payload: {
        ...normalized.payload,
        rfidData: currentState.rfidData
      },
      previousState: previousState || null,
      changes: this.calculateChanges(previousState, currentState)
    };
    
    // Store current state in history (not the whole message)
    this.deviceStates.set(deviceKey, currentState);
    this.stateHistory.set(deviceKey, currentState);
    
    return unifiedMessage;
  }
  
  normalizeV6800Rfid(topic, message) {
    const deviceKey = this.extractDeviceKey(topic);
    const currentState = this.deviceStates.get(deviceKey) || this.createEmptyState();
    const previousState = this.stateHistory.get(deviceKey);
    
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
    const previousState = this.stateHistory.get(deviceKey);
    
    // Store previous state before updating
    const previousStateCopy = previousState ? {
      uCount: previousState.uCount,
      rfidCount: previousState.rfidMap.size,
      rfidData: Array.from(previousState.rfidMap.values())
    } : null;
    
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
    
    // Create current state object
    const updatedState = {
      uCount: currentState.uCount,
      rfidCount: currentState.rfidMap.size,
      rfidData: Array.from(currentState.rfidMap.values())
    };
    
    // Create unified message with state comparison
    const unifiedMessage = {
      ...message,
      payload: {
        uCount: updatedState.uCount,
        rfidCount: updatedState.rfidCount,
        rfidData: updatedState.rfidData,
        changes: message.payload.rfidData || []
      },
      previousState: previousStateCopy
    };
    
    // Store updated state in both maps
    this.deviceStates.set(deviceKey, updatedState);
    this.stateHistory.set(deviceKey, updatedState);
    
    return unifiedMessage;
  }
  
  calculateChanges(previousState, currentState) {
    if (!previousState) {
      // No previous state, all current tags are new
      return currentState.rfidData.map(tag => ({
        position: tag.position,
        rfid: tag.rfid,
        action: "attached",
        timestamp: new Date().toISOString(),
        previousRfid: null,
        currentRfid: tag.rfid
      }));
    }
    
    const previousRfidMap = new Map(
      previousState.rfidData.map(tag => [tag.position, tag.rfid])
    );
    
    const changes = [];
    
    // Check for new or changed tags
    currentState.rfidData.forEach(currentTag => {
      const previousRfid = previousRfidMap.get(currentTag.position);
      
      if (!previousRfid) {
        // New tag attached
        changes.push({
          position: currentTag.position,
          rfid: currentTag.rfid,
          action: "attached",
          timestamp: new Date().toISOString(),
          previousRfid: null,
          currentRfid: currentTag.rfid
        });
      } else if (previousRfid !== currentTag.rfid) {
        // Tag changed
        changes.push({
          position: currentTag.position,
          rfid: currentTag.rfid,
          action: "changed",
          timestamp: new Date().toISOString(),
          previousRfid: previousRfid,
          currentRfid: currentTag.rfid
        });
      }
    });
    
    // Check for detached tags
    previousRfidMap.forEach((previousRfid, position) => {
      const stillAttached = currentState.rfidData.some(tag => tag.position === position);
      
      if (!stillAttached) {
        changes.push({
          position: position,
          rfid: previousRfid,
          action: "detached",
          timestamp: new Date().toISOString(),
          previousRfid: previousRfid,
          currentRfid: null
        });
      }
    });
    
    return changes;
  }
  
  getLastChanged(previousState, position, currentRfid) {
    if (!previousState || !previousState.payload || !previousState.payload.rfidData) {
      return new Date().toISOString(); // No previous state
    }
    
    const previousTag = previousState.payload.rfidData.find(tag => tag.position === position);
    
    if (previousTag && previousTag.rfid === currentRfid) {
      return previousTag.lastChanged; // Same tag, use previous timestamp
    }
    
    return new Date().toISOString(); // New or changed tag
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