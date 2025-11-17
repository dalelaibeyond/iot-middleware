const { parse } = require('../modules/normalizers/v5008Parser');

// Test case for ColorReq message with failure result
const testColorReqFailureMessage = () => {
  // Modified example with cmdResult = A0 (failure)
  const topic = "V5008Upload/2437871205/OpeAck";
  const rawHex = "AA914EF665A0E4010000000D0D083A00A139"; // Changed A1 to A0
  const message = Buffer.from(rawHex, 'hex');
  
  console.log('Testing ColorReq message parsing with failure result...');
  console.log('Topic:', topic);
  console.log('Raw hex:', rawHex);
  console.log('Message length:', message.length);
  
  const result = parse(topic, message);
  
  console.log('\nParsed result:');
  console.log(JSON.stringify(result, null, 2));
  
  // Verify the result field
  if (result && result.meta && result.meta.result === "failure") {
    console.log('\n✅ Result field correctly set to "failure" (cmdResult: 0xA0)');
  } else {
    console.log('\n❌ Result field missing or incorrect:', result?.meta?.result);
  }
};

// Run the test
testColorReqFailureMessage();