const logger = require("../utils/logger");
const v6800Parser = require("../modules/normalizers/v6800Parser");
const normalizerRegistry = require("../modules/normalizers/NormalizerRegistry");

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

async function testV6800Fix() {
  console.log("Testing V6800 parser fix...\n");
  
  try {
    // Test 1: Direct parser test
    console.log("1. Testing V6800 parser directly:");
    const parserResult = v6800Parser.parse(testTopic, testMessage);
    console.log("Parser result type:", Array.isArray(parserResult) ? "Array" : "Object");
    if (Array.isArray(parserResult)) {
      console.log("Number of messages:", parserResult.length);
      console.log("First message deviceId:", parserResult[0].deviceId);
      console.log("First message sensorType:", parserResult[0].sensorType);
      console.log("First message modNum:", parserResult[0].modNum);
      console.log("First message modId:", parserResult[0].modId);
    }
    console.log("\n");
    
    // Test 2: NormalizerRegistry test
    console.log("2. Testing NormalizerRegistry:");
    const normalizedResult = normalizerRegistry.normalize(testTopic, testMessage);
    console.log("Normalized result type:", Array.isArray(normalizedResult) ? "Array" : "Object");
    if (Array.isArray(normalizedResult)) {
      console.log("Number of messages:", normalizedResult.length);
      console.log("First message deviceId:", normalizedResult[0].deviceId);
      console.log("First message sensorType:", normalizedResult[0].sensorType);
      console.log("First message modNum:", normalizedResult[0].modNum);
      console.log("First message modId:", normalizedResult[0].modId);
      
      // Verify all messages have valid deviceIds
      const allHaveDeviceId = normalizedResult.every(msg => msg.deviceId && msg.deviceId !== "unknown");
      console.log("All messages have valid deviceId:", allHaveDeviceId);
      
      // Verify all messages have valid sensorTypes
      const allHaveSensorType = normalizedResult.every(msg => msg.sensorType && msg.sensorType !== "unknown");
      console.log("All messages have valid sensorType:", allHaveSensorType);
    }
    console.log("\n");
    
    // Test 3: Simulate database save
    console.log("3. Testing database save simulation:");
    if (Array.isArray(normalizedResult)) {
      normalizedResult.forEach((msg, index) => {
        console.log(`Message ${index + 1}:`);
        console.log(`  deviceId: ${msg.deviceId}`);
        console.log(`  deviceType: ${msg.deviceType}`);
        console.log(`  modNum: ${msg.modNum}`);
        console.log(`  modId: ${msg.modId}`);
        console.log(`  sensorType: ${msg.sensorType}`);
        console.log(`  msgType: ${msg.msgType}`);
        console.log(`  ts: ${msg.ts}`);
        console.log(`  payload keys: ${Object.keys(msg.payload || {})}`);
        console.log(`  meta keys: ${Object.keys(msg.meta || {})}`);
        console.log("");
      });
    }
    
    console.log("✅ Test completed successfully!");
    console.log("The fix should resolve the 'Column device_id cannot be null' error.");
    
  } catch (error) {
    console.error("❌ Test failed:", error);
  }
}

// Run the test
testV6800Fix();