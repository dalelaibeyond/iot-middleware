const ModularConfigManager = require("./config/ModularConfigManager");
const ComponentRegistry = require("./modules/core/ComponentRegistry");
const logger = require("./utils/logger");

async function testModularArchitecture() {
  try {
    logger.info("Testing Modular Architecture...");
    
    // Test configuration loading
    logger.info("1. Testing configuration loading...");
    const configManager = new ModularConfigManager();
    const config = configManager.getConfig();
    logger.info("Configuration loaded successfully");
    
    // Test component registry
    logger.info("2. Testing component registry...");
    const registry = new ComponentRegistry(config);
    logger.info("Component registry created successfully");
    
    // Test component factory registration
    logger.info("3. Testing component factory registration...");
    const factories = Array.from(registry.componentFactories.keys());
    logger.info(`Registered factories: ${factories.join(", ")}`);
    
    // Test module enabling/disabling
    logger.info("4. Testing module configuration...");
    const enabledModules = configManager.getEnabledModules();
    logger.info(`Enabled modules: ${enabledModules.join(", ")}`);
    
    for (const moduleName of enabledModules) {
      const enabledComponents = configManager.getEnabledComponents(moduleName);
      logger.info(`Module ${moduleName} has enabled components: ${enabledComponents.join(", ")}`);
    }
    
    // Test normalizer registry
    logger.info("5. Testing normalizer registry...");
    const normalizerRegistry = require("./modules/normalizers/NormalizerRegistry");
    const parsers = normalizerRegistry.getAllParsers();
    logger.info(`Registered parsers: ${parsers.map(p => p.deviceType).join(", ")}`);
    
    // Test message normalization
    logger.info("6. Testing message normalization...");
    const { normalize } = require("./modules/normalizers");
    
    // Test V6800 normalization (JSON format)
    const v6800Topic = "V6800Upload/gateway001/temperature";
    const v6800Message = JSON.stringify({
      devId: "gateway001",
      temperature: 25.5,
      time: new Date().toISOString()
    });
    
    const normalizedV6800 = normalize(v6800Topic, v6800Message);
    if (normalizedV6800) {
      logger.info("V6800 message normalized successfully", {
        deviceId: normalizedV6800.deviceId,
        deviceType: normalizedV6800.deviceType,
        sensorType: normalizedV6800.sensorType
      });
    } else {
      logger.warn("V6800 message normalization failed");
    }
    
    // Test V5008 normalization (hex format)
    const v5008Topic = "V5008Upload/gateway002/humidity";
    const v5008Message = "48656C6C6F576F726C64"; // "HelloWorld" in hex
    
    const normalizedV5008 = normalize(v5008Topic, v5008Message);
    if (normalizedV5008) {
      logger.info("V5008 message normalized successfully", {
        deviceId: normalizedV5008.deviceId,
        deviceType: normalizedV5008.deviceType,
        sensorType: normalizedV5008.sensorType
      });
    } else {
      logger.warn("V5008 message normalization failed");
    }
    
    logger.info("Modular Architecture Test Completed Successfully!");
    return true;
  } catch (error) {
    logger.error("Modular Architecture Test Failed:", error);
    return false;
  }
}

// Run the test
testModularArchitecture()
  .then(success => {
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    logger.error("Test execution failed:", error);
    process.exit(1);
  });