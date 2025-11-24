const logger = require("../utils/logger");
const { colorJson } = require("../utils/colorJson");

// Import the V5008 parser
const v5008Parser = require("../modules/normalizers/v5008Parser");

// First message - initial state with one tag
const topic1 = "V5008Upload/2437871205/LabelState";
const hexMessage1 = "bb01ec3737bf0006010100dd354b74aa002744";
const message1 = Buffer.from(hexMessage1, "hex");

console.log("=== Testing RFID State Changes ===");
console.log("\n1. First message - Initial state with one tag:");
console.log(`Topic: ${topic1}`);
console.log(`Hex: ${hexMessage1}`);

try {
  // Parse the first message
  const result1 = v5008Parser.parse(topic1, message1, { test: true });
  
  console.log("\nResult 1:");
  console.log(colorJson(result1.payload));
  
  // Second message - new tag added
  const topic2 = "V5008Upload/2437871205/LabelState";
  const hexMessage2 = "bb01ec3737bf0006020100dd354b740600dd344a44aa002744";
  const message2 = Buffer.from(hexMessage2, "hex");
  
  console.log("\n\n2. Second message - New tag added:");
  console.log(`Topic: ${topic2}`);
  console.log(`Hex: ${hexMessage2}`);
  
  // Parse the second message
  const result2 = v5008Parser.parse(topic2, message2, { test: true });
  
  console.log("\nResult 2:");
  console.log(colorJson(result2.payload));
  
  // Analysis
  console.log("\n=== Analysis ===");
  console.log(`First message RFID count: ${result1.payload.rfidCount}`);
  console.log(`Second message RFID count: ${result2.payload.rfidCount}`);
  
  if (result1.payload.rfidData && result2.payload.rfidData) {
    console.log("\nFirst message tags:");
    result1.payload.rfidData.forEach((tag, index) => {
      console.log(`  Tag ${index + 1}: Position=${tag.num}, RFID=${tag.rfid}, Action=${tag.action || 'N/A'}`);
    });
    
    console.log("\nSecond message tags:");
    result2.payload.rfidData.forEach((tag, index) => {
      console.log(`  Tag ${index + 1}: Position=${tag.num}, RFID=${tag.rfid}, Action=${tag.action || 'N/A'}`);
    });
    
    // Check if only the new tag is shown in the second message
    const expectedNewTag = result2.payload.rfidData.find(tag => tag.rfid === "DD344A44");
    const existingTag = result2.payload.rfidData.find(tag => tag.rfid === "DD354B74");
    
    if (expectedNewTag && expectedNewTag.action === "attached") {
      console.log(`\n✅ New tag DD344A44 correctly marked as 'attached'`);
    } else {
      console.log(`\n❌ New tag DD344A44 not found or not marked as 'attached'`);
    }
    
    if (existingTag) {
      console.log(`❌ Existing tag DD354B74 should not be shown in the output`);
    } else {
      console.log(`✅ Existing tag DD354B74 correctly filtered out from output`);
    }
    
    // Check if only one tag is in the output (the new one)
    if (result2.payload.rfidData.length === 1) {
      console.log(`✅ Only one tag shown in output (the new tag)`);
    } else {
      console.log(`❌ Expected 1 tag in output, got ${result2.payload.rfidData.length}`);
    }
  }
} catch (error) {
  console.error("Error during parsing:", error);
}