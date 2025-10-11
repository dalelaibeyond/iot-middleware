# IoT Middleware v3 - Modular Architecture

This document describes the new modular architecture implemented for the IoT Middleware v3.

## Overview

The IoT Middleware has been refactored to support a highly modular architecture where components can be enabled or disabled through configuration. This allows for greater flexibility and easier maintenance.

## Architecture Components

### 1. Configuration Management

#### ModularConfigManager
- Location: `config/ModularConfigManager.js`
- Purpose: Manages the modular configuration structure with support for environment variables
- Configuration File: `config/modular-config.json`

#### Configuration Structure
```json
{
  "modules": {
    "core": {
      "enabled": true,
      "components": {
        "mqtt": { "enabled": true },
        "normalizer": { "enabled": true },
        "dataStore": { "enabled": true }
      }
    },
    "storage": {
      "enabled": true,
      "components": {
        "database": { "enabled": true },
        "cache": { "enabled": true }
      }
    },
    "api": {
      "enabled": true,
      "components": {
        "rest": { "enabled": true },
        "websocket": { "enabled": true },
        "webhook": { "enabled": false }
      }
    },
    "relay": {
      "enabled": true,
      "components": {
        "messageRelay": { "enabled": true }
      }
    }
  }
}
```

### 2. Component Registry

#### ComponentRegistry
- Location: `modules/core/ComponentRegistry.js`
- Purpose: Manages component lifecycle, initialization, and dependencies
- Features:
  - Automatic component initialization based on configuration
  - Dependency injection
  - Component factory pattern
  - Ordered initialization

### 3. Modular Application

#### ModularApplication
- Location: `modules/ModularApplication.js`
- Purpose: Main application class that uses the ComponentRegistry
- Replaces: The original `Application.js`
- Features:
  - Event-driven architecture
  - Modular message processing
  - Component access through registry

### 4. Enhanced Normalizer

#### NormalizerRegistry
- Location: `modules/normalizers/NormalizerRegistry.js`
- Purpose: Manages device-specific normalizers as plugins
- Features:
  - Dynamic parser registration
  - Parser versioning
  - Fallback handling for unknown device types

### 5. API Management

#### RestAPIManager
- Location: `modules/api/RestAPIManager.js`
- Purpose: Manages all REST API endpoints
- Features:
  - Centralized route management
  - Component-aware endpoints
  - Statistics and monitoring

## Module Groups

### Group 1: Core (MUST)
- **mqtt**: MQTT client for receiving device messages
- **normalizer**: Central message normalizer with device-specific parsers
- **dataStore**: In-memory storage for normalized messages

### Group 2: Storage (Optional)
- **database**: MySQL database for persistent storage
- **cache**: In-memory caching for frequently accessed data
- **writeBuffer**: Buffered writing to database

### Group 3: API (Optional)
- **rest**: RESTful API for HTTP access
- **websocket**: WebSocket API for real-time updates
- **webhook**: Webhook API for push notifications

### Group 4: Relay (Optional)
- **messageRelay**: Relay normalized messages to MQTT broker

## Usage

### Starting the Application
```bash
npm start
```

### Environment Variables
- `PORT`: Server port (default: 3000)
- `MQTT_URL`: MQTT broker URL (default: mqtt://localhost:1883)
- `DB_HOST`: Database host (default: localhost)
- `DB_USER`: Database user (default: root)
- `DB_PASS`: Database password (default: empty)
- `DB_NAME`: Database name (default: iot_middleware)
- `LOG_LEVEL`: Logging level (default: info)

### Configuration Changes
To enable/disable modules or components, modify `config/modular-config.json`:

```json
{
  "modules": {
    "api": {
      "enabled": true,
      "components": {
        "webhook": {
          "enabled": true,
          "config": {
            "retryLimit": 5
          }
        }
      }
    }
  }
}
```

## Adding New Components

### 1. Create Component Class
```javascript
const BaseComponent = require("../core/BaseComponent");

class MyComponent extends BaseComponent {
  async initialize() {
    // Initialization logic
  }
  
  async shutdown() {
    // Cleanup logic
  }
}

module.exports = MyComponent;
```

### 2. Register Component Factory
```javascript
// In ComponentRegistry.registerDefaultFactories()
this.registerFactory("myComponent", () => require("./MyComponent"));
```

### 3. Add to Configuration
```json
{
  "modules": {
    "custom": {
      "enabled": true,
      "components": {
        "myComponent": {
          "enabled": true,
          "config": {
            "option1": "value1"
          }
        }
      }
    }
  }
}
```

## API Endpoints

The REST API provides the following endpoints:

- `GET /api/health` - Health check
- `GET /api/stats` - Application statistics
- `GET /api/devices` - List all devices
- `GET /api/devices/:deviceId/data` - Get device data
- `GET /api/devices/:deviceId/history` - Get device history
- `GET /api/config` - Get configuration (safe version)
- `GET /api/normalizers` - Get normalizer information

## Future Enhancements

### Redis Integration
The CacheManager is designed to support multiple backends. To add Redis support:

1. Install Redis client: `npm install redis`
2. Create Redis adapter
3. Update configuration to specify backend type

### Plugin System
The current architecture provides a foundation for a plugin system where components can be loaded dynamically without code changes.

## Migration from Original Architecture

1. Configuration: Replace `config/config.json` with `config/modular-config.json`
2. Application: Use `ModularApplication` instead of `Application`
3. Components: All components now go through the ComponentRegistry
4. API: API endpoints are managed by RestAPIManager

## Benefits

1. **Flexibility**: Enable/disable features without code changes
2. **Maintainability**: Clear separation of concerns
3. **Extensibility**: Easy to add new components
4. **Configuration**: Centralized configuration with environment variable support
5. **Testing**: Components can be tested in isolation