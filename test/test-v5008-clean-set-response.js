const { parse } = require('../modules/normalizers/v5008Parser');

// Test case for CleanSetResponse message
const testCleanSetResponseMessage = () => {
  // Example from requirements
  const topic = "V5008Upload/2437871205/OpeAck";
  const rawHex = "aa914ef665a1e101060142028127";
  const message = Buffer.from(rawHex, 'hex');
  
  console.log('Testing CleanSetResponse message parsing...');
  console.log('Topic:', topic);
  console.log('Raw hex:', rawHex);
  console.log('Message length:', message.length);
  
  const result = parse(topic, message);
  
  console.log('\nParsed result:');
  console.log(JSON.stringify(result, null, 2));
  
  // Verify result matches expected format
  if (result && result.msgType === 'CleanSetResponse') {
    console.log('\n✅ Message type correctly identified as CleanSetResponse');
    
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
    
    if (result.meta.msgId === 537047283) {
      console.log('✅ Message ID correctly extracted');
    } else {
      console.log('❌ Message ID mismatch:', result.meta.msgId);
    }
    
    if (result.meta.result === 'success') {
      console.log('✅ Result field correctly set to "success" (cmdResult: 0xA1)');
    } else {
      console.log('❌ Result field missing or incorrect:', result.meta?.result);
    }
    
    // Check payload structure
    const expectedPayload = [
      {num: 6, color: "red"}
    ];
    
    if (JSON.stringify(result.payload) === JSON.stringify(expectedPayload)) {
      console.log('✅ Payload correctly parsed');
    } else {
      console.log('❌ Payload mismatch');
      console.log('Expected:', JSON.stringify(expectedPayload));
      console.log('Actual:', JSON.stringify(result.payload));
    }
  } else {
    console.log('❌ Failed to identify message as CleanSetResponse');
  }
};

// Run test
testCleanSetResponseMessage();