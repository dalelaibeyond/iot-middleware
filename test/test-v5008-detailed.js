const { parse } = require('./modules/normalizers/v5008Parser');

// Test case from the normalization guide for Temperature & Humidity
const topic = "V5008Upload/2437871205/TemHum";
const hexString = "028C0909950A1B2938350B1B2337530C1B0336270D000000000E000000000F0000000035019E28";
const messageBuffer = Buffer.from(hexString, 'hex');

// Parse the message
const result = parse(topic, messageBuffer);

// Display the full result
console.log("=== Detailed V5008 Parser Test ===");
console.log("Topic:", topic);
console.log("Raw Hex:", hexString);
console.log("\nParsed Result:");
console.log(JSON.stringify(result, null, 2));

// Expected result from the guide
const expected = {
  "deviceId": "2437871205",
  "deviceType": "V5008",
  "msgType": "TempHum",
  "modAdd": 2,
  "modPort": null,
  "modId": "8C090995",
  "payload": [
    { "thAdd": 10, "temp": 27.41, "hum": 56.53 },
    { "thAdd": 11, "temp": 27.35, "hum": 55.83 },
    { "thAdd": 12, "temp": 27.03, "hum": 54.39 },
    { "thAdd": 13, "temp": 0, "hum": 0 },
    { "thAdd": 14, "temp": 0, "hum": 0 },
    { "thAdd": 15, "temp": 0, "hum": 0 }
  ],
  "meta": {
    "topic": "V5008Upload/2437871205/TemHum",
    "rawHexString": "028C0909950A1B2938350B1B2337530C1B0336270D000000000E000000000F0000000035019E28"
  }
};

console.log("\n=== Comparison ===");
console.log("Expected msgType:", expected.msgType, "| Actual:", result.msgType);
console.log("Expected modAdd:", expected.modAdd, "| Actual:", result.modAdd);
console.log("Expected modId:", expected.modId, "| Actual:", result.modId);
console.log("Expected payload length:", expected.payload.length, "| Actual:", result.payload.length);

// Check each temperature/humidity reading
console.log("\n=== Temperature/Humidity Readings ===");
for (let i = 0; i < Math.min(expected.payload.length, result.payload.length); i++) {
  const exp = expected.payload[i];
  const act = result.payload[i];
  console.log(`Reading ${i + 1}:`);
  console.log(`  Expected: thAdd=${exp.thAdd}, temp=${exp.temp}, hum=${exp.hum}`);
  console.log(`  Actual:   thAdd=${act.thAdd}, temp=${act.temp}, hum=${act.hum}`);
  console.log(`  Match: ${exp.thAdd === act.thAdd && exp.temp === act.temp && exp.hum === act.hum ? '✅' : '❌'}`);
}