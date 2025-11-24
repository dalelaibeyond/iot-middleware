const logger = require("../utils/logger");
const { colorJson } = require("../utils/colorJson");

// Import the V5008 parser
const v5008Parser = require("../modules/normalizers/v5008Parser");

console.log("=== Testing RFID Real Scenario ===");
console.log("\nSimulating a scenario where tag DD354B74 is already attached, and DD344A44 is newly attached");

try {
  // First, simulate a previous state with one tag already attached
  const topic1 = "V5008Upload/2437871205/LabelState";
  const hexMessage1 = "bb01ec3737bf0006010100dd354b74aa002744";
  const message1 = Buffer.from(hexMessage1, "hex");
  
  console.log("\n1. Simulating previous state (tag DD354B74 already attached):");
  console.log(`Topic: ${topic1}`);
  console.log(`Hex: ${hexMessage1}`);
  
  const result1 = v5008Parser.parse(topic1, message1, { test: true });
  console.log("\nResult 1 (establishing initial state):");
  console.log(colorJson(result1.payload));
  
  // Now simulate the actual message from the user's background
  const topic2 = "V5008Upload/2437871205/LabelState";
  const hexMessage2 = "bb01ec3737bf0006020100dd354b740600dd344a44aa002744";
  const message2 = Buffer.from(hexMessage2, "hex");
  
  console.log("\n\n2. Actual message from user's background (new tag DD344A44 attached):");
  console.log(`Topic: ${topic2}`);
  console.log(`Hex: ${hexMessage2}`);
  
  const result2 = v5008Parser.parse(topic2, message2, { test: true });
  console.log("\nResult 2 (should only show new tag):");
  console.log(colorJson(result2.payload));
  
  // Analysis
  console.log("\n=== Analysis ===");
  if (result2.payload && result2.payload.rfidData) {
    console.log(`RFID count in result: ${result2.payload.rfidData.length}`);
    
    console.log("\nTags in result:");
    result2.payload.rfidData.forEach((tag, index) => {
      console.log(`  Tag ${index + 1}: Position=${tag.num}, RFID=${tag.rfid}, Action=${tag.action || 'N/A'}`);
    });
    
    // Check if only the new tag is shown
    const newTag = result2.payload.rfidData.find(tag => tag.rfid === "DD344A44");
    const existingTag = result2.payload.rfidData.find(tag => tag.rfid === "DD354B74");
    
    if (newTag && newTag.action === "attached") {
      console.log(`\n✅ New tag DD344A44 correctly marked as 'attached'`);
    } else {
      console.log(`\n❌ New tag DD344A44 not found or not marked as 'attached'`);
    }
    
    if (!existingTag) {
      console.log(`✅ Existing tag DD354B74 correctly filtered out from output`);
    } else {
      console.log(`❌ Existing tag DD354B74 should not be shown in output`);
    }
    
    // Check if only one tag is in the output (the new one)
    if (result2.payload.rfidData.length === 1) {
      console.log(`✅ Only one tag shown in output (the new tag)`);
    } else {
      console.log(`❌ Expected 1 tag in output, got ${result2.payload.rfidData.length}`);
    }
    
    // Check if the output matches the expected format from the documentation
    const expectedOutput = {
      rfidData: [
        { num: 6, alarm: 0, rfid: "DD344A44", action: "attached" }
      ]
    };
    
    console.log("\n=== Expected vs Actual ===");
    console.log("Expected output:");
    console.log(JSON.stringify(expectedOutput, null, 2));
    
    console.log("\nActual output:");
    console.log(JSON.stringify({
      rfidData: result2.payload.rfidData
    }, null, 2));
    
    const matches = result2.payload.rfidData.length === 1 &&
                   result2.payload.rfidData[0].num === 6 &&
                   result2.payload.rfidData[0].rfid === "DD344A44" &&
                   result2.payload.rfidData[0].action === "attached" &&
                   result2.payload.rfidData[0].alarm === 0;
    
    if (matches) {
      console.log("\n✅ Output matches expected format from documentation");
    } else {
      console.log("\n❌ Output does not match expected format from documentation");
    }
  }
} catch (error) {
  console.error("Error during parsing:", error);
}