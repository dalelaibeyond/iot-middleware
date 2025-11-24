const logger = require("../utils/logger");
const { colorJson } = require("../utils/colorJson");

// Import the V5008 parser
const v5008Parser = require("../modules/normalizers/v5008Parser");

// Test data from the user's example
const topic = "V5008Upload/2437871205/LabelState";
const hexMessage = "bb01ec3737bf0006020100dd354b740600dd344a440d00ba9b";
const message = Buffer.from(hexMessage, "hex");

console.log("Testing V5008 RFID unified normalizer with message:");
console.log(`Topic: ${topic}`);
console.log(`Hex: ${hexMessage}`);
console.log("");

try {
  // Parse the message using the V5008 parser with unified normalizer
  const result = v5008Parser.parse(topic, message, { test: true });
  
  console.log("Result:");
  console.log(colorJson(result));
  
  // Check if the result has the expected structure
  if (result && result.payload && result.payload.rfidData) {
    console.log("\nRFID Data Analysis:");
    console.log(`Total RFID tags: ${result.payload.rfidData.length}`);
    
    result.payload.rfidData.forEach((tag, index) => {
      console.log(`Tag ${index + 1}: Position=${tag.position || tag.num}, RFID=${tag.rfid}, Action=${tag.action || 'N/A'}, Alarm=${tag.alarm}`);
    });
    
    // Check if we have the expected new tag
    const newTag = result.payload.rfidData.find(tag => tag.rfid === "DD344A44");
    if (newTag) {
      console.log(`\n✅ Found expected new tag DD344A44 at position ${newTag.num} with action '${newTag.action}'`);
    } else {
      console.log("\n❌ Expected new tag DD344A44 not found in the result");
    }
    
    // Check for changes metadata
    if (result.meta && result.meta.hasChanges !== undefined) {
      console.log(`\nHas changes: ${result.meta.hasChanges}`);
      if (result.meta.changes && result.meta.changes.length > 0) {
        console.log("Changes detected:");
        result.meta.changes.forEach((change, index) => {
          console.log(`  Change ${index + 1}: Position=${change.position}, RFID=${change.rfid}, Action=${change.action}`);
        });
      }
    }
  } else {
    console.log("❌ Invalid result structure");
  }
} catch (error) {
  console.error("Error during parsing:", error);
}