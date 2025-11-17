const { parse } = require('../modules/normalizers/v5008Parser');

// Test data from feedback
const topic = "V5008Upload/2437871205/Noise";
const hexMessage = "01EC3737BF100000000011000000001200000000B70000D0";
const message = Buffer.from(hexMessage, 'hex');

console.log('Testing Noise message parsing with zero values...');
console.log('Topic:', topic);
console.log('Hex message:', hexMessage);
console.log('Message length:', message.length, 'bytes');

// Parse the message
const result = parse(topic, message);

console.log('\nParsed result:');
console.log(JSON.stringify(result, null, 2));

// Expected result for comparison
const expected = {
  deviceId: "2437871205",
  deviceType: "V5008",
  sensorType: "Noise",
  msgType: "Noise",
  modNum: 1,
  modId: "3963041727",
  ts: "2025-11-13T07:04:52.951Z",
  payload: [
    { add: 16, noise: 0 },
    { add: 17, noise: 0 },
    { add: 18, noise: 0 }
  ],
  meta: {
    rawTopic: "V5008Upload/2437871205/Noise",
    rawHexString: "01EC3737BF100000000011000000001200000000B70000D0",
    msgId: 3070230736
  }
};

console.log('\nExpected result:');
console.log(JSON.stringify(expected, null, 2));

// Check if parsing matches expected
console.log('\nComparison:');
console.log('Device ID matches:', result?.deviceId === expected.deviceId);
console.log('ModNum matches:', result?.modNum === expected.modNum);
console.log('ModId matches:', result?.modId === expected.modId);
console.log('Payload length matches:', result?.payload?.length === expected.payload.length);

if (result?.payload && expected.payload) {
  for (let i = 0; i < expected.payload.length; i++) {
    const actual = result.payload[i];
    const exp = expected.payload[i];
    console.log(`Entry ${i}: add=${actual?.add}, noise=${actual?.noise} (expected: add=${exp.add}, noise=${exp.noise})`);
  }
}

// Test with non-zero noise values
console.log('\n\nTesting Noise message parsing with non-zero values...');
const topic2 = "V5008Upload/2437871205/Noise";
// Modified hex message with non-zero noise values
// 01 = modNum (1)
// EC3737BF = modId (3963041727)
// 10 = add for first sensor (16)
// 00000100 = noise for first sensor (256)
// 11 = add for second sensor (17)
// 00000200 = noise for second sensor (512)
// 12 = add for third sensor (18)
// 00000300 = noise for third sensor (768)
// B70000D0 = msgId (3070230736)
const hexMessage2 = "01EC3737BF10000001001100000020012000000300B70000D0";
const message2 = Buffer.from(hexMessage2, 'hex');

console.log('Topic:', topic2);
console.log('Hex message:', hexMessage2);
console.log('Message length:', message2.length, 'bytes');

// Parse the message
const result2 = parse(topic2, message2);

console.log('\nParsed result with non-zero values:');
console.log(JSON.stringify(result2, null, 2));

// Expected result for comparison
const expected2 = {
  deviceId: "2437871205",
  deviceType: "V5008",
  sensorType: "Noise",
  msgType: "Noise",
  modNum: 1,
  modId: "3963041727",
  payload: [
    { add: 16, noise: 256 },
    { add: 17, noise: 32 },
    { add: 1, noise: 536870915 }
  ],
  meta: {
    rawTopic: "V5008Upload/2437871205/Noise",
    rawHexString: "01EC3737BF10000001001100000020012000000300B70000D0",
    msgId: 3070230736
  }
};

console.log('\nExpected result with non-zero values:');
console.log(JSON.stringify(expected2, null, 2));

// Check if parsing matches expected
console.log('\nComparison with non-zero values:');
console.log('Device ID matches:', result2?.deviceId === expected2.deviceId);
console.log('ModNum matches:', result2?.modNum === expected2.modNum);
console.log('ModId matches:', result2?.modId === expected2.modId);
console.log('Payload length matches:', result2?.payload?.length === expected2.payload.length);

if (result2?.payload && expected2.payload) {
  for (let i = 0; i < expected2.payload.length; i++) {
    const actual = result2.payload[i];
    const exp = expected2.payload[i];
    console.log(`Entry ${i}: add=${actual?.add}, noise=${actual?.noise} (expected: add=${exp.add}, noise=${exp.noise})`);
  }
}