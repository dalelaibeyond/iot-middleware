const v6800Parser = require("../modules/normalizers/v6800Parser");
const logger = require("../utils/logger");

/**
 * Test V6800 parser with sample messages
 */

// Test messages
const testMessages = {
  heartbeat: {
    topic: "V6800Upload/2123456789/OpeAck",
    message: {
      msg_type: "heart_beat_req",
      module_type: "mt_gw",
      module_sn: "2123456789",
      bus_V: "23.92",
      bus_I: "6.50",
      main_power: 0,
      backup_power: 1,
      uuid_number: 2140003913,
      data: [
        { module_index: 2, module_sn: "2349402517", module_m_num: 1, module_u_num: 6 }
      ]
    }
  },
  
  rfid: {
    topic: "V6800Upload/2123456789/LabelState",
    message: {
      msg_type: "u_state_changed_notify_req",
      gateway_sn: "2123456789",
      uuid_number: 1747983279,
      data: [
        {
          host_gateway_port_index: 2,
          extend_module_sn: "2349402517",
          u_data: [
            { u_index: 1, new_state: 1, old_state: 0, tag_code: "DD3CE9C4", warning: 0 }
          ]
        }
      ]
    }
  },
  
  tempHum: {
    topic: "V6800Upload/2123456789/TemHum",
    message: {
      msg_type: "temper_humidity_exception_nofity_req",
      gateway_sn: "2123456789",
      uuid_number: 975528252,
      data: [
        {
          host_gateway_port_index: 2,
          extend_module_sn: "2349402517",
          th_data: [
            { temper_position: 10, hygrometer_position: 10, temper_swot: 25.41, hygrometer_swot: 62.90 },
            { temper_position: 11, hygrometer_position: 11, temper_swot: 27.10, hygrometer_swot: 68.80 },
            { temper_position: 12, hygrometer_position: 12, temper_swot: 25.60, hygrometer_swot: 59.51 },
            { temper_position: 13, hygrometer_position: 13, temper_swot: 0, hygrometer_swot: 0 },
            { temper_position: 14, hygrometer_position: 14, temper_swot: 0, hygrometer_swot: 0 },
            { temper_position: 15, hygrometer_position: 15, temper_swot: 0, hygrometer_swot: 0 }
          ]
        }
      ]
    }
  },
  
  noise: {
    topic: "V6800Upload/2123456789/Noise",
    message: {
      msg_type: "noise_exception_nofity_req",
      gateway_sn: "2123456789",
      uuid_number: 975528253,
      data: [
        {
          host_gateway_port_index: 2,
          extend_module_sn: "2349402517",
          noise_data: [
            { noise_position: 16, noise_swot: 29.90 },
            { noise_position: 17, noise_swot: 41.80 },
            { noise_position: 18, noise_swot: 52.92 }
          ]
        }
      ]
    }
  },
  
  door: {
    topic: "V6800Upload/2123456789/OpeAck",
    message: {
      msg_type: "door_state_changed_notify_req",
      gateway_sn: "2123456789",
      uuid_number: 1216019422,
      data: [
        { 
          extend_module_sn: "2349402517", 
          host_gateway_port_index: 2, 
          new_state: 1 
        }
      ]
    }
  },
  
  devModInfo: {
    topic: "V6800Upload/2123456789/OpeAck",
    message: {
      msg_type: "devies_init_req",
      gateway_sn: "2123456789",
      gateway_ip: "192.168.100.139",
      gateway_mac: "08:80:7E:91:61:15",
      uuid_number: 408744622,
      data: [
        { 
          module_type: "mt_ul", 
          module_index: 2, 
          module_sn: "2349402517", 
          module_m_num: 1, 
          module_u_num: 6, 
          module_sw_version: "2307101644", 
          module_supplier: "Digitalor", 
          module_brand: "Digitalor", 
          module_model: "Digitalor" 
        }
      ]
    }
  }
};

/**
 * Test a single message type
 * @param {string} testName - Test name
 * @param {Object} testData - Test data with topic and message
 */
function testMessageType(testName, testData) {
  console.log(`\n=== Testing ${testName} ===`);
  
  try {
    const result = v6800Parser.parse(testData.topic, testData.message);
    
    if (!result) {
      console.error(`❌ Failed to parse ${testName}`);
      return false;
    }
    
    // Debug: Log the actual result structure
    console.log(`Debug - Result keys:`, Object.keys(result));
    console.log(`Debug - Result:`, JSON.stringify(result, null, 2));
    
    // Validate basic structure
    const requiredFields = ['deviceId', 'deviceType', 'msgType', 'sensorType', 'modAdd', 'modId', 'ts', 'payload', 'meta'];
    const missingFields = requiredFields.filter(field => !(field in result));
    
    if (missingFields.length > 0) {
      console.error(`❌ Missing required fields: ${missingFields.join(', ')}`);
      console.error(`Debug - Missing fields:`, missingFields);
      return false;
    }
    
    // Validate specific fields
    if (result.deviceType !== "V6800") {
      console.error(`❌ Incorrect deviceType: ${result.deviceType}`);
      return false;
    }
    
    if (result.meta.msgId !== testData.message.uuid_number) {
      console.error(`❌ Incorrect msgId: ${result.meta.msgId} !== ${testData.message.uuid_number}`);
      return false;
    }
    
    console.log(`✅ ${testName} parsed successfully`);
    console.log(`Device ID: ${result.deviceId}`);
    console.log(`Message Type: ${result.msgType}`);
    console.log(`Sensor Type: ${result.sensorType}`);
    console.log(`Module Port: ${result.modPort}`);
    console.log(`Module ID: ${result.modId}`);
    console.log(`Message ID: ${result.meta.msgId}`);
    console.log(`Payload:`, JSON.stringify(result.payload, null, 2));
    
    return true;
  } catch (error) {
    console.error(`❌ Error parsing ${testName}:`, error.message);
    return false;
  }
}

/**
 * Test multiple ports scenario
 */
function testMultiplePorts() {
  console.log("\n=== Testing Multiple Ports Scenario ===");
  
  const multiPortMessage = {
    topic: "V6800Upload/2123456789/TemHum",
    message: {
      msg_type: "temper_humidity_exception_nofity_req",
      gateway_sn: "2123456789",
      uuid_number: 975528254,
      data: [
        {
          host_gateway_port_index: 2,
          extend_module_sn: "2349402517",
          th_data: [
            { temper_position: 10, hygrometer_position: 10, temper_swot: 25.41, hygrometer_swot: 62.90 }
          ]
        },
        {
          host_gateway_port_index: 3,
          extend_module_sn: "3456789012",
          th_data: [
            { temper_position: 10, hygrometer_position: 10, temper_swot: 26.50, hygrometer_swot: 65.20 }
          ]
        }
      ]
    }
  };
  
  try {
    const result = v6800Parser.parse(multiPortMessage.topic, multiPortMessage.message);
    
    if (!result) {
      console.error("❌ Failed to parse multi-port message");
      return false;
    }
    
    if (Array.isArray(result)) {
      console.log(`✅ Multi-port message parsed successfully`);
      console.log(`Number of messages: ${result.length}`);
      result.forEach((msg, index) => {
        console.log(`\nMessage ${index + 1}:`);
        console.log(`  Module Port: ${msg.modPort}`);
        console.log(`  Module ID: ${msg.modId}`);
        console.log(`  Payload:`, JSON.stringify(msg.payload, null, 2));
      });
      return true;
    } else {
      console.error("❌ Expected array for multi-port message");
      return false;
    }
  } catch (error) {
    console.error("❌ Error parsing multi-port message:", error.message);
    return false;
  }
}

/**
 * Run all tests
 */
function runTests() {
  console.log("Starting V6800 Parser Tests...\n");
  
  let passedTests = 0;
  let totalTests = 0;
  
  // Test single message types
  for (const [testName, testData] of Object.entries(testMessages)) {
    totalTests++;
    if (testMessageType(testName, testData)) {
      passedTests++;
    }
  }
  
  // Test multiple ports scenario
  totalTests++;
  if (testMultiplePorts()) {
    passedTests++;
  }
  
  console.log(`\n=== Test Results ===`);
  console.log(`Passed: ${passedTests}/${totalTests}`);
  console.log(`Success Rate: ${((passedTests / totalTests) * 100).toFixed(1)}%`);
  
  if (passedTests === totalTests) {
    console.log("🎉 All tests passed!");
  } else {
    console.log("⚠️ Some tests failed. Check the output above for details.");
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  runTests();
}

module.exports = {
  testMessages,
  testMessageType,
  testMultiplePorts,
  runTests
};