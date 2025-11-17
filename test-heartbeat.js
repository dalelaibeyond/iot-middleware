const { parse } = require('./modules/normalizers/v5008Parser');

// Test Heartbeat message
const topic = "V5008Upload/2437871205/OpeAck";
const hexString = "CC01EC3737BF0C028C090995120300000000000400000000000500000000000600000000000700000000000800000000000900000000000A00000000003401778E";
const messageBuffer = Buffer.from(hexString, 'hex');

// Parse the message
const result = parse(topic, messageBuffer);

// Display the full result
console.log("=== Heartbeat Message Test ===");
console.log("Topic:", topic);
console.log("Raw Hex:", hexString);
console.log("\nParsed Result:");
console.log(JSON.stringify(result, null, 2));