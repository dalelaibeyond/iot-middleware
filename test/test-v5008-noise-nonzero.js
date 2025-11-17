const { parse } = require('../modules/normalizers/v5008Parser');

// Test with non-zero noise values
console.log('Testing Noise message parsing with non-zero values...');
const topic = "V5008Upload/2437871205/Noise";

// Let's create a proper hex message with non-zero noise values
// 01 = modNum (1)
// EC3737BF = modId (3963041727)
// 10 = add for first sensor (16)
// 00000100 = noise for first sensor (256)
// 11 = add for second sensor (17)
// 00000200 = noise for second sensor (512)
// 12 = add for third sensor (18)
// 00000300 = noise for third sensor (768)
// B70000D0 = msgId (3070230736)

// Building the hex string step by step:
const modNum = "01";
const modId = "EC3737BF";
const sensor1 = "10" + "00000100"; // add=16, noise=256
const sensor2 = "11" + "00000200"; // add=17, noise=512
const sensor3 = "12" + "00000300"; // add=18, noise=768
const msgId = "B70000D0";

const hexMessage = modNum + modId + sensor1 + sensor2 + sensor3 + msgId;
console.log('Constructed hex message:', hexMessage);
console.log('Hex message length:', hexMessage.length, 'characters (', hexMessage.length/2, 'bytes)');

const message = Buffer.from(hexMessage, 'hex');

console.log('Topic:', topic);
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
  payload: [
    { add: 16, noise: 256 },
    { add: 17, noise: 512 },
    { add: 18, noise: 768 }
  ],
  meta: {
    rawTopic: "V5008Upload/2437871205/Noise",
    rawHexString: hexMessage,
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