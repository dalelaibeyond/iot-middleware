const { parse } = require('../modules/normalizers/v5008Parser');

// Test case for color set response message
const topic = "V5008Upload/2437871205/OpeAck";
const rawMessage = Buffer.from("AA914EF665A1E1010502060108007F4F", "hex");

console.log("Testing V5008 Color Set Response message parsing...");
console.log("Topic:", topic);
console.log("Raw message (hex):", rawMessage.toString("hex").toUpperCase());
console.log("");

try {
  const result = parse(topic, rawMessage);
  
  if (result) {
    console.log("Parsing successful!");
    console.log("Normalized message:");
    console.log(JSON.stringify(result, null, 2));
    
    // Verify the expected structure
    console.log("\nVerification:");
    console.log("Device ID:", result.deviceId === "2437871205" ? "✓" : "✗", result.deviceId);
    console.log("Device Type:", result.deviceType === "V5008" ? "✓" : "✗", result.deviceType);
    console.log("Sensor Type:", result.sensorType === "OpeAck" ? "✓" : "✗", result.sensorType);
    console.log("Message Type:", result.msgType === "ColorSetResponse" ? "✓" : "✗", result.msgType);
    console.log("Result:", result.meta.result === "success" ? "✓" : "✗", result.meta.result);
    console.log("Message ID:", result.meta.msgId === 134250319 ? "✓" : "✗", result.meta.msgId);
    
    console.log("\nPayload verification:");
    if (result.payload && Array.isArray(result.payload) && result.payload.length === 2) {
      console.log("Payload length:", result.payload.length === 2 ? "✓" : "✗", result.payload.length);
      
      const firstEntry = result.payload[0];
      const secondEntry = result.payload[1];
      
      console.log("First entry num:", firstEntry.num === 5 ? "✓" : "✗", firstEntry.num);
      console.log("First entry color:", firstEntry.color === "purple" ? "✓" : "✗", firstEntry.color);
      console.log("Second entry num:", secondEntry.num === 6 ? "✓" : "✗", secondEntry.num);
      console.log("Second entry color:", secondEntry.color === "red" ? "✓" : "✗", secondEntry.color);
    } else {
      console.log("Payload structure: ✗", result.payload);
    }
  } else {
    console.log("Parsing failed - returned null");
  }
} catch (error) {
  console.error("Error during parsing:", error.message);
}