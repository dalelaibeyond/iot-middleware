# RFID Unified Normalizer Implementation Analysis

## Current Issue

The V5008 device sent a message with RFID tag "DD344A44" attached to sensor position 6, but the output is still showing all RFID tags instead of only the new one.

## Expected Behavior

According to the Unified-Normalizer-Layer-Considerations.md document, when a new RFID tag is attached, the unified normalizer should:

1. Compare with previous state to identify new/changed tags
2. Only include the new tag in the output
3. Include proper state information (attached/detached)

Expected output should be:
```javascript
{
  rfidData: [
    { num: 6, alarm: 0, rfid: "DD344A44", action: "attached" }
  ]
}
```

## Key Implementation Points

### 1. State Management
- Need to maintain previous RFID state for each device/module
- Compare current message with previous state
- Identify which tags are new, changed, or removed

### 2. Integration Points
- The UnifiedNormalizer.js class exists but needs proper RFID state management
- The v6800Parser.js creates a UnifiedNormalizer instance but V5008 parser doesn't
- The NormalizerRegistry.js has a unifiedNormalizer instance but may not be properly applying it

### 3. Current Architecture Issues
- V5008 parser directly returns the raw parsed message without unified normalization
- V6800 parser has unified normalization but may have issues with state management
- The unified normalizer is not consistently applied across all device types

### 4. Implementation Strategy
- Ensure V5008 parser uses the unified normalizer like V6800 parser does
- Implement proper RFID state management in UnifiedNormalizer
- Add logic to filter output to only show changes (new/removed tags)
- Ensure consistent field naming (num vs position)

### 5. Technical Challenges
- State persistence across message processing
- Handling multiple modules per device
- Managing initial state when no previous state exists
- Ensuring proper event emission for state changes

## Next Steps

1. Modify V5008 parser to use unified normalizer
2. Implement proper RFID state management in UnifiedNormalizer
3. Add logic to filter output to only show changes
4. Test with the provided RFID message example