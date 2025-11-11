// Enable debug logging by setting DEBUG environment variable
process.env.DEBUG = '1';

const logger = require("../utils/logger");
const v6800Parser = require("../modules/normalizers/v6800Parser");

// Test data for ColorReq message
const testTopic = "V6800Upload/2123456789/OpeAck";
const testMessage = {
  msg_type: 'u_color',
  gateway_id: '2123456789',
  count: 2,
  uuid_number: 843402420,
  code: 1346589,
  data: [
    {
      index: 2,
      module_id: '3963041727',
      u_num: 12,
      color_data: [
        { index: 1, color: 'none', code: 0 },
        { index: 2, color: 'none', code: 0 },
        { index: 3, color: 'none', code: 0 },
        { index: 4, color: 'none', code: 0 },
        { index: 5, color: 'blue_f', code: 13 },
        { index: 6, color: 'none', code: 0 },
        { index: 7, color: 'none', code: 0 },
        { index: 8, color: 'none', code: 0 },
        { index: 9, color: 'blue_f', code: 13 },
        { index: 10, color: 'none', code: 0 },
        { index: 11, color: 'none', code: 0 },
        { index: 12, color: 'none', code: 0 }
      ]
    },
    {
      index: 4,
      module_id: '2349402517',
      u_num: 18,
      color_data: [
        { index: 1, color: 'none', code: 0 },
        { index: 2, color: 'none', code: 0 },
        { index: 3, color: 'none', code: 0 },
        { index: 4, color: 'none', code: 0 },
        { index: 5, color: 'none', code: 0 },
        { index: 6, color: 'none', code: 0 },
        { index: 7, color: 'blue_f', code: 13 },
        { index: 8, color: 'none', code: 0 },
        { index: 9, color: 'blue_f', code: 13 },
        { index: 10, color: 'none', code: 0 },
        { index: 11, color: 'none', code: 0 },
        { index: 12, color: 'none', code: 0 },
        { index: 13, color: 'none', code: 0 },
        { index: 14, color: 'none', code: 0 },
        { index: 15, color: 'none', code: 0 },
        { index: 16, color: 'none', code: 0 },
        { index: 17, color: 'none', code: 0 },
        { index: 18, color: 'none', code: 0 }
      ]
    }
  ]
};

async function testColorReqMessage() {
  console.log("Testing V6800 ColorReq message parsing...\n");
  
  try {
    // Test the parser
    const result = v6800Parser.parse(testTopic, testMessage);
    
    console.log("1. Result type:", Array.isArray(result) ? "Array" : "Object");
    
    if (Array.isArray(result)) {
      console.log("2. Number of messages:", result.length);
      
      result.forEach((msg, index) => {
        console.log(`\n3. Message ${index + 1}:`);
        console.log("   deviceId:", msg.deviceId);
        console.log("   deviceType:", msg.deviceType);
        console.log("   sensorType:", msg.sensorType);
        console.log("   msgType:", msg.msgType);
        console.log("   modNum:", msg.modNum);
        console.log("   modId:", msg.modId);
        console.log("   payload type:", Array.isArray(msg.payload) ? "Array" : "Object");
        
        if (Array.isArray(msg.payload)) {
          console.log("   payload length:", msg.payload.length);
          console.log("   First few payload items:");
          msg.payload.slice(0, 3).forEach((item, i) => {
            console.log(`     [${i}]: pos=${item.pos}, color=${item.color}, code=${item.code}`);
          });
        }
      });
      
      // Verify all messages have valid fields
      const allHaveDeviceId = result.every(msg => msg.deviceId && msg.deviceId !== "unknown");
      const allHaveModNum = result.every(msg => msg.modNum !== null && msg.modNum !== undefined);
      const allHaveModId = result.every(msg => msg.modId && msg.modId !== "unknown");
      
      console.log("\n4. Verification:");
      console.log("   All messages have valid deviceId:", allHaveDeviceId);
      console.log("   All messages have valid modNum:", allHaveModNum);
      console.log("   All messages have valid modId:", allHaveModId);
      
      if (allHaveDeviceId && allHaveModNum && allHaveModId) {
        console.log("\n✅ ColorReq message parsing test PASSED!");
      } else {
        console.log("\n❌ ColorReq message parsing test FAILED!");
      }
    } else {
      console.log("❌ Expected array but got:", typeof result);
    }
    
  } catch (error) {
    console.error("❌ Test failed with error:", error);
  }
}

// Run the test
testColorReqMessage();