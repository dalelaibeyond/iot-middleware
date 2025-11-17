const { parse } = require('../modules/normalizers/v6800Parser');

// Test data for SetColor message
const topic = "V6800Upload/2123456789/OpeAck";
const rawMessage = {
  msg_type: 'set_module_property_result_req',
  gateway_sn: '2123456789',
  set_property_type: 8001,
  uuid_number: 871147680,
  data: [
    { host_gateway_port_index: 2, extend_module_sn: '3963041727', module_type: 'mt_ul', set_property_result: 0 },
    { host_gateway_port_index: 4, extend_module_sn: '2349402517', module_type: 'mt_ul', set_property_result: 0 }
  ]
};

// Expected normalized message
const expectedMessage = {
  deviceId: "2123456789",
  deviceType: "V6800",
  sensorType: "OpeAck",
  msgType: "SetColor",
  modNum: null,
  modId: null,
  ts: "2025-11-13T01:17:25.076Z",
  meta: {
    rawTopic: "V6800Upload/2123456789/OpeAck",
    msgId: 871147680,
    msgType: "set_module_property_result_req"
  },
  payload: [
    { modNum: 2, modId: "3963041727", result: "success" },
    { modNum: 4, modId: "2349402517", result: "success" }
  ]
};

// Test the parser
console.log("Testing V6800 SetColor message parser...");
console.log("Raw message:", JSON.stringify(rawMessage, null, 2));

const result = parse(topic, rawMessage);

console.log("\nNormalized result:");
console.log(JSON.stringify(result, null, 2));

// Verify the result
console.log("\nVerification:");
console.log("Device ID:", result.deviceId === expectedMessage.deviceId ? "✓" : "✗");
console.log("Device Type:", result.deviceType === expectedMessage.deviceType ? "✓" : "✗");
console.log("Sensor Type:", result.sensorType === expectedMessage.sensorType ? "✓" : "✗");
console.log("Message Type:", result.msgType === expectedMessage.msgType ? "✓" : "✗");
console.log("Message ID:", result.meta.msgId === expectedMessage.meta.msgId ? "✓" : "✗");
console.log("Raw Message Type:", result.meta.msgType === expectedMessage.meta.msgType ? "✓" : "✗");

// Check payload
if (Array.isArray(result.payload) && result.payload.length === 2) {
  console.log("Payload length:", result.payload.length === 2 ? "✓" : "✗");
  console.log("First module result:", result.payload[0].result === "success" ? "✓" : "✗");
  console.log("Second module result:", result.payload[1].result === "success" ? "✓" : "✗");
} else {
  console.log("Payload structure: ✗");
}

// Test with a failed result
console.log("\n\nTesting with a failed result...");
const failedMessage = {
  msg_type: 'set_module_property_result_req',
  gateway_sn: '2123456789',
  set_property_type: 8001,
  uuid_number: 871147681,
  data: [
    { host_gateway_port_index: 2, extend_module_sn: '3963041727', module_type: 'mt_ul', set_property_result: 1 }
  ]
};

const failedResult = parse(topic, failedMessage);
console.log("Failed result:", JSON.stringify(failedResult, null, 2));
console.log("Failed module result:", failedResult.payload[0].result === "fail" ? "✓" : "✗");