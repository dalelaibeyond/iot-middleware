const UnifiedRfidNormalizer = require("../modules/normalizers/UnifiedRfidNormalizer");

// Test runner for UnifiedRfidNormalizer
function runTests() {
  console.log("=== Unified RFID Normalizer Test Suite ===\n");
  
  let normalizer = new UnifiedRfidNormalizer();
  let testCount = 0;
  let passCount = 0;
  
  function runTest(testName, testFn) {
    testCount++;
    console.log(`Test ${testCount}: ${testName}`);
    
    try {
      testFn();
      console.log("✅ PASSED\n");
      passCount++;
    } catch (error) {
      console.log(`❌ FAILED: ${error.message}\n`);
    }
  }
  
  function assertEqual(actual, expected, message) {
    if (actual !== expected) {
      throw new Error(message || `Expected ${expected}, got ${actual}`);
    }
  }
  
  function assertNotEqual(actual, expected, message) {
    if (actual === expected) {
      throw new Error(message || `Expected not ${expected}, got ${actual}`);
    }
  }
  
  function assertOk(value, message) {
    if (!value) {
      throw new Error(message || `Expected truthy value, got ${value}`);
    }
  }
  
  function assertArray(value, message) {
    if (!Array.isArray(value)) {
      throw new Error(message || `Expected array, got ${typeof value}`);
    }
  }
  
  // V5008 RFID Message Transformation Tests
  runTest("V5008 RFID state snapshot transformation", () => {
    const topic = "V5008Upload/2437871205/LabelState";
    
    // Real RFID message from test cases
    const message = Buffer.from(
      "BB028C0909950012030400DD3950641100DD23B0B41200DD27EE344C01EC3F",
      "hex"
    );
    
    const result = normalizer.normalize(topic, message, "V5008");
    
    // Verify basic structure
    assertEqual(result.msgType, "Rfid");
    assertEqual(result.deviceId, "2437871205");
    assertEqual(result.modNum, 2);
    assertEqual(result.modId, "2349402517");  // This is the actual modId from the hex data
    assertEqual(result.payload.uCount, 18);
    assertEqual(result.payload.rfidCount, 3);
    
    // Verify first message has no previous state
    assertEqual(result.previousState, null);
    assertOk(result.changes);
    assertEqual(result.changes.length, 3);
    
    // Verify changes are all "attached" for first message
    result.changes.forEach(change => {
      assertEqual(change.action, "attached");
      assertEqual(change.previousRfid, null);
      assertOk(change.currentRfid);
    });
    
    // Verify field naming is consistent
    result.payload.rfidData.forEach(tag => {
      assertOk(tag.position !== undefined);
      assertEqual(tag.num, undefined); // Original 'num' field should be replaced
    });
  });
  
  runTest("V5008 RFID state change tracking", () => {
    const topic = "V5008Upload/2437871205/LabelState";
    
    // First message
    const firstMessage = Buffer.from(
      "BB028C0909950012030400DD3950641100DD23B0B41200DD27EE344C01EC3F",
      "hex"
    );
    
    const firstResult = normalizer.normalize(topic, firstMessage, "V5008");
    
    // Second message with different state
    const secondMessage = Buffer.from(
      "BB028C0909950012030200DD3950641200DD23B0B41300DD27EE344C01EC3F",
      "hex"
    );
    
    const secondResult = normalizer.normalize(topic, secondMessage, "V5008");
    
    // Verify previous state is preserved
    assertOk(secondResult.previousState);
    assertEqual(secondResult.previousState.rfidCount, 3);
    
    // Verify changes are calculated
    assertOk(secondResult.changes);
    // Should have some changes (attached/detached/changed)
    const hasChange = secondResult.changes.some(c => 
      c.action === "attached" || c.action === "detached" || c.action === "changed"
    );
    assertOk(hasChange);
  });
  
  // V6800 RFID Message State Enhancement Tests
  runTest("V6800 RFID event enhancement with complete state", () => {
    const topic = "V6800Upload/2123456789/LabelState";
    
    // V6800 RFID event message
    const message = {
      msg_type: "u_state_changed_notify_req",
      uuid_number: "12345",
      data: [{
        host_gateway_port_index: 2,
        extend_module_sn: "2349402517",
        u_data: [{
          u_index: 3,
          tag_code: "DD23B0B4",
          new_state: 1,
          warning: 0
        }, {
          u_index: 1,
          tag_code: "DD395064",
          new_state: 1,
          warning: 0
        }]
      }]
    };
    
    const result = normalizer.normalize(topic, message, "V6800");
    const messageToCheck = Array.isArray(result) ? result[0] : result;
    
    // Verify message structure
    assertEqual(messageToCheck.msgType, "Rfid");
    assertEqual(messageToCheck.deviceId, "2123456789");
    assertEqual(messageToCheck.modNum, 2);
    assertOk(messageToCheck.payload.uCount !== undefined);
    assertOk(messageToCheck.payload.rfidData);
    
    // Verify complete state is maintained
    assertEqual(messageToCheck.payload.rfidData.length, 2);
    messageToCheck.payload.rfidData.forEach(tag => {
      assertEqual(tag.state, "attached");
      assertOk(tag.lastChanged);
      assertOk(tag.position !== undefined);
    });
  });
  
  runTest("V6800 RFID state change tracking", () => {
    const topic = "V6800Upload/2123456789/LabelState";
    
    // First message - attachment
    const firstMessage = {
      msg_type: "u_state_changed_notify_req",
      uuid_number: "12345",
      data: [{
        host_gateway_port_index: 2,
        extend_module_sn: "2349402517",
        u_data: [{
          u_index: 3,
          tag_code: "DD23B0B4",
          new_state: 1,
          warning: 0
        }]
      }]
    };
    
    const firstResult = normalizer.normalize(topic, firstMessage, "V6800");
    const firstMessageToCheck = Array.isArray(firstResult) ? firstResult[0] : firstResult;
    
    // Verify initial state
    assertEqual(firstMessageToCheck.payload.rfidCount, 1);
    assertOk(firstMessageToCheck.changes);
    assertEqual(firstMessageToCheck.changes.length, 1);
    assertEqual(firstMessageToCheck.changes[0].action, "attached");
    
    // Second message - detachment
    const secondMessage = {
      msg_type: "u_state_changed_notify_req",
      uuid_number: "12346",
      data: [{
        host_gateway_port_index: 2,
        extend_module_sn: "2349402517",
        u_data: [{
          u_index: 3,
          tag_code: "DD23B0B4",
          new_state: 0,
          warning: 0
        }]
      }]
    };
    
    const secondResult = normalizer.normalize(topic, secondMessage, "V6800");
    const secondMessageToCheck = Array.isArray(secondResult) ? secondResult[0] : secondResult;
    
    // Verify detachment is tracked
    assertEqual(secondMessageToCheck.payload.rfidCount, 0);
    assertOk(secondMessageToCheck.changes);
    assertEqual(secondMessageToCheck.changes.length, 1);
    assertEqual(secondMessageToCheck.changes[0].action, "detached");
  });
  
  // State Management Tests
  runTest("Separate state for different devices and modules", () => {
    const device1Topic = "V5008Upload/Device1/LabelState";
    const device2Topic = "V5008Upload/Device2/LabelState";
    
    const message = Buffer.from(
      "BB028C0909950012030400DD3950641100DD23B0B41200DD27EE344C01EC3F",
      "hex"
    );
    
    const result1 = normalizer.normalize(device1Topic, message, "V5008");
    const result2 = normalizer.normalize(device2Topic, message, "V5008");
    
    // Verify states are separate
    assertNotEqual(result1.deviceId, result2.deviceId);
    
    // Verify state tracking works independently
    const device1State = normalizer.getCurrentState("Device1", result1.modNum);
    const device2State = normalizer.getCurrentState("Device2", result2.modNum);
    
    assertOk(device1State);
    assertOk(device2State);
    assertNotEqual(device1State, device2State);
  });
  
  runTest("State clearing functionality", () => {
    const topic = "V5008Upload/TestDevice/LabelState";
    const message = Buffer.from(
      "BB028C0909950012030400DD3950641100DD23B0B41200DD27EE344C01EC3F",
      "hex"
    );
    
    const result = normalizer.normalize(topic, message, "V5008");
    
    // Verify state exists
    let state = normalizer.getCurrentState("TestDevice", result.modNum);
    assertOk(state);
    
    // Clear specific module state
    normalizer.clearState("TestDevice", result.modNum);
    state = normalizer.getCurrentState("TestDevice", result.modNum);
    assertEqual(state, null);
    
    // Add state again
    normalizer.normalize(topic, message, "V5008");
    state = normalizer.getCurrentState("TestDevice", result.modNum);
    assertOk(state);
    
    // Clear all device state
    normalizer.clearState("TestDevice");
    state = normalizer.getCurrentState("TestDevice", result.modNum);
    assertEqual(state, null);
  });
  
  runTest("Statistics reporting", () => {
    const topic1 = "V5008Upload/Device1/LabelState";
    const topic2 = "V5008Upload/Device2/LabelState";
    const message = Buffer.from(
      "BB028C0909950012030400DD3950641100DD23B0B41200DD27EE344C01EC3F",
      "hex"
    );
    
    // Add some state
    normalizer.normalize(topic1, message, "V5008");
    normalizer.normalize(topic2, message, "V5008");
    
    const stats = normalizer.getStats();
    
    assertEqual(stats.deviceCount, 2);
    assertEqual(stats.moduleCount, 2);
    assertOk(stats.totalRfidCount >= 0);
    assertOk(stats.stateHistorySize >= 0);
  });
  
  // Print summary
  console.log("=== Test Summary ===");
  console.log(`Total Tests: ${testCount}`);
  console.log(`Passed: ${passCount}`);
  console.log(`Failed: ${testCount - passCount}`);
  console.log(`Success Rate: ${((passCount / testCount) * 100).toFixed(1)}%`);
}

// Run tests
runTests();