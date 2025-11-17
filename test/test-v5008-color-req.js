const { parse } = require('../modules/normalizers/v5008Parser');

// Test case for ColorReq message
const testColorReqMessage = () => {
  // Example from requirements
  const topic = "V5008Upload/2437871205/OpeAck";
  const rawHex = "AA914EF665A1E4010000000D0D083A00A139";
  const message = Buffer.from(rawHex, 'hex');
  
  console.log('Testing ColorReq message parsing...');
  console.log('Topic:', topic);
  console.log('Raw hex:', rawHex);
  console.log('Message length:', message.length);
  
  const result = parse(topic, message);
  
  console.log('\nParsed result:');
  console.log(JSON.stringify(result, null, 2));
  
  // Verify the result matches expected format
  if (result && result.msgType === 'ColorReq') {
    console.log('\n✅ Message type correctly identified as ColorReq');
    
    if (result.deviceId === '2437871205') {
      console.log('✅ Device ID correctly extracted');
    } else {
      console.log('❌ Device ID mismatch:', result.deviceId);
    }
    
    if (result.sensorType === 'OpeAck') {
      console.log('✅ Sensor type correctly identified');
    } else {
      console.log('❌ Sensor type mismatch:', result.sensorType);
    }
    
    if (result.meta.msgId === 973119801) {
      console.log('✅ Message ID correctly extracted');
    } else {
      console.log('❌ Message ID mismatch:', result.meta.msgId);
    }
    
    // Check color data
    const expectedColors = [
      { num: 1, color: "off" },
      { num: 2, color: "off" },
      { num: 3, color: "off" },
      { num: 4, color: "blue_f" },
      { num: 5, color: "blue_f" },
      { num: 6, color: "red_f" }
    ];
    
    if (JSON.stringify(result.payload) === JSON.stringify(expectedColors)) {
      console.log('✅ Color data correctly parsed');
    } else {
      console.log('❌ Color data mismatch');
      console.log('Expected:', JSON.stringify(expectedColors));
      console.log('Actual:', JSON.stringify(result.payload));
    }
    
    // Check for result field in meta
    if (result.meta && result.meta.result === "success") {
      console.log('✅ Result field correctly set to "success" (cmdResult: 0xA1)');
    } else {
      console.log('❌ Result field missing or incorrect:', result.meta?.result);
      console.log('   Note: The cmdResult in the test message is 0xA1, which should be interpreted as success');
    }
  } else {
    console.log('❌ Failed to identify message as ColorReq');
  }
};

// Run the test
testColorReqMessage();