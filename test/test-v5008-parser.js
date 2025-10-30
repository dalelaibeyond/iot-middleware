const { parse } = require('../modules/normalizers/v5008Parser');
const logger = require('../utils/logger');

// Test cases from the normalization guide
const testCases = [
  {
    name: "Heartbeat Message",
    topic: "V5008Upload/2437871205/OpeAck",
    hexString: "CC01EC3737BF0C028C090995120300000000000400000000000500000000000600000000000700000000000800000000000900000000000A00000000003401778E",
    expectedType: "Heartbeat"
  },
  {
    name: "RFID Tag Update",
    topic: "V5008Upload/2437871205/LabelState",
    hexString: "BB028C0909950012030400DD3950641100DD23B0B41200DD27EE344C01EC3F",
    expectedType: "Rfid"
  },
  {
    name: "Temperature & Humidity",
    topic: "V5008Upload/2437871205/TemHum",
    hexString: "028C0909950A1B2938350B1B2337530C1B0336270D000000000E000000000F0000000035019E28",
    expectedType: "TempHum"
  },
  {
    name: "Noise Level",
    topic: "V5008Upload/2437871205/Noise",
    hexString: "028C0909951000000000110000000012000000007001DB9E",
    expectedType: "Noise"
  },
  {
    name: "Door Status",
    topic: "V5008Upload/2437871205/OpeAck",
    hexString: "BA01EC3737BF1194016082",
    expectedType: "Door"
  },
  {
    name: "Device Info",
    topic: "V5008Upload/2437871205/OpeAck",
    hexString: "EF011390958DD85FC0A864D3FFFF0000C0A800018082914EF665B7013C37",
    expectedType: "DeviceInfo"
  },
  {
    name: "Module Info",
    topic: "V5008Upload/2437871205/OpeAck",
    hexString: "EF02010000898393CC020000898393CCB801BCF7",
    expectedType: "ModuleInfo"
  }
];

// Run tests
function runTests() {
  console.log("=== V5008 Parser Test Suite ===\n");
  
  testCases.forEach((testCase, index) => {
    console.log(`Test ${index + 1}: ${testCase.name}`);
    console.log(`Topic: ${testCase.topic}`);
    console.log(`Expected Type: ${testCase.expectedType}`);
    
    try {
      // Convert hex string to buffer (as it would come from MQTT)
      const messageBuffer = Buffer.from(testCase.hexString, 'hex');
      
      // Parse the message
      const result = parse(testCase.topic, messageBuffer);
      
      if (result) {
        console.log(`✅ Parsed successfully!`);
        console.log(`   Device ID: ${result.deviceId}`);
        console.log(`   Message Type: ${result.msgType}`);
        console.log(`   Module Number: ${result.modNum}`);
        console.log(`   Module ID: ${result.modId}`);
        
        // Print payload based on message type
        if (testCase.expectedType === "Heartbeat") {
          console.log(`   Payload (modules count): ${result.payload.length}`);
        } else if (testCase.expectedType === "Rfid") {
          console.log(`   Payload: uCount=${result.payload.uCount}, rfidNum=${result.payload.rfidNum}, rfidData count=${result.payload.rfidData.length}`);
        } else if (testCase.expectedType === "TempHum") {
          console.log(`   Payload (temp/hum sets): ${result.payload.length}`);
        } else if (testCase.expectedType === "Noise") {
          console.log(`   Payload (noise sets): ${result.payload.length}`);
        } else if (testCase.expectedType === "Door") {
          console.log(`   Payload: status=${result.payload.status}`);
        } else if (testCase.expectedType === "DeviceInfo") {
          console.log(`   Payload: fmVersion=${result.payload.fmVersion}, ip=${result.payload.ip}, mac=${result.payload.mac}`);
        } else if (testCase.expectedType === "ModuleInfo") {
          console.log(`   Payload (modules count): ${result.payload.length}`);
        }
        
        // Check for msgId in meta
        if (result.meta && result.meta.msgId !== undefined) {
          console.log(`   Message ID (msgId): ${result.meta.msgId}`);
        }
        
        // Verify the message type matches expected
        if (result.msgType === testCase.expectedType) {
          console.log(`✅ Message type matches expected: ${result.msgType}`);
        } else {
          console.log(`❌ Message type mismatch! Expected: ${testCase.expectedType}, Got: ${result.msgType}`);
        }
      } else {
        console.log(`❌ Failed to parse message`);
      }
    } catch (error) {
      console.log(`❌ Error during parsing: ${error.message}`);
    }
    
    console.log("\n" + "-".repeat(50) + "\n");
  });
}

// Run the tests
runTests();