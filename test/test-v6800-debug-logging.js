// Enable debug logging by setting the DEBUG environment variable
process.env.DEBUG = '1';

const logger = require("../utils/logger");
const v6800Parser = require("../modules/normalizers/v6800Parser");

// Test data based on the error logs
const testTopic = "V6800Upload/2123456789/TemHum";
const testMessage = {
  uuid_number: 442507197,
  msg_type: "temper_humidity_resp",
  data: [
    {
      host_gateway_port_index: 2,
      extend_module_sn: "3963041727",
      th_data: [
        {
          temper_position: 1,
          temper_swot: "25.5",
          hygrometer_swot: "60.2"
        },
        {
          temper_position: 2,
          temper_swot: "26.1",
          hygrometer_swot: "59.8"
        }
      ]
    },
    {
      host_gateway_port_index: 4,
      extend_module_sn: "2349402517",
      th_data: [
        {
          temper_position: 1,
          temper_swot: "24.9",
          hygrometer_swot: "61.5"
        }
      ]
    }
  ]
};

// Test single port message
const singlePortMessage = {
  uuid_number: 442507198,
  msg_type: "temper_humidity_resp",
  data: [
    {
      host_gateway_port_index: 2,
      extend_module_sn: "3963041727",
      th_data: [
        {
          temper_position: 1,
          temper_swot: "25.5",
          hygrometer_swot: "60.2"
        }
      ]
    }
  ]
};

async function testDebugLogging() {
  console.log("Testing V6800 parser debug logging for array and single messages...\n");
  
  try {
    // Test 1: Multi-port message (should return array)
    console.log("1. Testing multi-port message (should return array):");
    console.log("===========================================");
    const multiPortResult = v6800Parser.parse(testTopic, testMessage);
    console.log("\n");
    
    // Test 2: Single port message (should return single object)
    console.log("2. Testing single-port message (should return single object):");
    console.log("=====================================================");
    const singlePortResult = v6800Parser.parse(testTopic, singlePortMessage);
    console.log("\n");
    
    // Test 3: Verify results
    console.log("3. Verification:");
    console.log("===============");
    console.log("Multi-port result is array:", Array.isArray(multiPortResult));
    console.log("Multi-port array length:", Array.isArray(multiPortResult) ? multiPortResult.length : "N/A");
    console.log("Single-port result is array:", Array.isArray(singlePortResult));
    
    console.log("\n✅ Debug logging test completed!");
    
  } catch (error) {
    console.error("❌ Test failed:", error);
  }
}

// Run the test
testDebugLogging();