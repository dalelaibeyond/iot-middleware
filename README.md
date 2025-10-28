# IoT Middleware v3 - Modular Architecture

A highly modular IoT middleware platform for processing, normalizing, and distributing sensor data from various IoT devices.

## Overview

IoT Middleware v3 provides a flexible, configuration-driven architecture for handling IoT sensor data. It supports multiple device types (V5008, V6800, G6000) through pluggable normalizers and provides various output options including database storage, REST APIs, WebSockets, and message relaying.

## Architecture

The middleware is organized into module groups that can be enabled/disabled independently:

### Group 1: Core (Required)
- **MQTT Client**: Receives raw sensor messages from MQTT brokers
- **Normalizer**: Central message normalizer with device-specific parsers
- **Data Store**: In-memory storage for normalized messages

### Group 2: Storage (Optional)
- **Database**: MySQL database for persistent storage
- **Cache**: In-memory caching for frequently accessed data
- **Write Buffer**: Buffered writing to database for performance

### Group 3: API (Optional)
- **REST API**: RESTful API for HTTP access to sensor data
- **WebSocket**: Real-time API for live sensor data updates
- **Webhook**: Webhook API for push notifications

### Group 4: Relay (Optional)
- **Message Relay**: Relays normalized messages to MQTT brokers

### Group 5: Security (Optional)
- **Auth Manager**: JWT-based authentication and authorization
- **Input Validator**: Data validation and sanitization

### Group 6: Monitoring (Optional)
- **Metrics Collector**: Prometheus-compatible metrics
- **Alert Manager**: Configurable alerting system

### Group 7: Processing (Optional)
- **Data Validator**: Schema-based data validation
- **Data Transformer**: Message transformation pipeline

### Group 8: Resilience (Optional)
- **Circuit Breaker**: Fault tolerance for external services
- **Retry Manager**: Intelligent retry with exponential backoff

## Features

- **Modular Architecture**: Enable/disable features through configuration
- **Device Support**: Built-in support for V5008, V6800, and G6000 devices
- **Multiple Outputs**: Database storage, REST API, WebSocket, and message relay
- **Fault Tolerance**: Continues operating even if optional services are unavailable
- **Security**: Authentication, authorization, and input validation
- **Observability**: Metrics collection, monitoring, and alerting
- **Resilience**: Circuit breaker pattern and intelligent retry mechanisms
- **Performance**: Optimized batching, caching, and connection pooling
- **Environment Variables**: Full support for environment variable configuration
- **Plugin System**: Easy to extend with new device types and components

## Quick Start

### Prerequisites

- Node.js 14 or higher
- MySQL (optional, for database storage)
- MQTT Broker (optional, for receiving messages)

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd iot-middleware-v3

# Install dependencies
npm install

# Copy environment template
cp .env.example .env

# Edit configuration
nano config/modular-config.json
```

### Configuration

The middleware uses `config/modular-config.json` for configuration. Environment variables can be used with `${VAR_NAME:default}` syntax.

Key environment variables:
- `PORT`: Server port (default: 3000)
- `MQTT_URL`: MQTT broker URL (default: mqtt://localhost:1883)
- `DB_HOST`: Database host (default: localhost)
- `DB_USER`: Database user (default: root)
- `DB_PASS`: Database password (default: empty)
- `DB_NAME`: Database name (default: iot_middleware)
- `LOG_LEVEL`: Logging level (default: info)

### Running the Application

```bash
# Development mode
npm run dev

# Production mode
npm start
```

## Configuration Guide

### Module Configuration

Each module group can be enabled or disabled independently:

```json
{
  "modules": {
    "core": {
      "enabled": true,
      "description": "Core functionality for MQTT message processing and normalization",
      "components": {
        "mqtt": { "enabled": true },
        "normalizer": { "enabled": true },
        "dataStore": { "enabled": true }
      }
    },
    "storage": {
      "enabled": true,
      "description": "Persistent storage options for sensor data",
      "components": {
        "database": { "enabled": true },
        "cache": { "enabled": true },
        "writeBuffer": { "enabled": true }
      }
    },
    "api": {
      "enabled": true,
      "description": "API endpoints for external access to sensor data",
      "components": {
        "rest": { "enabled": true },
        "websocket": { "enabled": true },
        "webhook": { "enabled": false }
      }
    },
    "relay": {
      "enabled": true,
      "description": "Message relay for forwarding normalized messages",
      "components": {
        "messageRelay": { "enabled": true }
      }
    },
    "security": {
      "enabled": false,
      "description": "Security and authentication features",
      "components": {
        "authManager": { "enabled": false },
        "inputValidator": { "enabled": false }
      }
    },
    "monitoring": {
      "enabled": false,
      "description": "Monitoring and observability",
      "components": {
        "metricsCollector": { "enabled": false },
        "alertManager": { "enabled": false }
      }
    },
    "processing": {
      "enabled": false,
      "description": "Data processing pipeline",
      "components": {
        "dataValidator": { "enabled": false },
        "dataTransformer": { "enabled": false }
      }
    },
    "resilience": {
      "enabled": false,
      "description": "Error handling and recovery",
      "components": {
        "circuitBreaker": { "enabled": false },
        "retryManager": { "enabled": false }
      }
    }
  }
}
```

### MQTT Configuration

```json
{
  "modules": {
    "core": {
      "components": {
        "mqtt": {
          "enabled": true,
          "config": {
            "url": "${MQTT_URL:mqtt://localhost:1883}",
            "topics": ["V5008Upload/#", "V6800Upload/#", "G6000Upload/#"],
            "options": {
              "qos": 1,
              "reconnectPeriod": 5000,
              "keepalive": 60
            }
          }
        }
      }
    }
  }
}
```

### Database Configuration

```json
{
  "modules": {
    "storage": {
      "components": {
        "database": {
          "enabled": true,
          "config": {
            "connectionPool": {
              "waitForConnections": true,
              "connectionLimit": 10,
              "queueLimit": 0
            }
          }
        }
      }
    }
  }
}
```

## API Reference

### REST API Endpoints

#### Health Check
```
GET /api/health
```
Returns the health status of the application.

#### Application Statistics
```
GET /api/stats
```
Returns statistics about enabled modules and components.

#### Device List
```
GET /api/devices
```
Returns a list of all devices that have sent data.

#### Device Data
```
GET /api/devices/:deviceId/data?limit=50&startTime=2023-01-01&endTime=2023-01-02
```
Returns data for a specific device with optional filtering.

#### Device History
```
GET /api/devices/:deviceId/history?limit=50
```
Returns historical data for a device from the database.

#### Configuration
```
GET /api/config
```
Returns the current configuration (without sensitive data).

#### Normalizer Information
```
GET /api/normalizers
```
Returns information about registered device parsers.

#### Database Test (Security enabled)
```
POST /api/test/database
```
Tests database connection and saves a test message (requires authentication).

#### Write Buffer Status
```
GET /api/status/writebuffer
```
Returns current status of the write buffer component.

#### Metrics (Monitoring enabled)
```
GET /api/metrics
```
Returns Prometheus-compatible metrics (when monitoring module is enabled).

#### Alerts (Alert Manager enabled)
```
GET /api/alerts
POST /api/alerts
```
Get or configure alert rules (when alert manager is enabled).

### WebSocket API

Connect to `ws://localhost:3000` to receive real-time sensor data updates.

#### Authentication (Security enabled)
When security module is enabled, WebSocket connections require authentication:
```javascript
const ws = new WebSocket('ws://localhost:3000', [], {
  headers: {
    'Authorization': 'Bearer YOUR_JWT_TOKEN'
  }
});
```

## Device Integration

### Supported Device Types

#### V5008 Devices
- Sends binary/hex encoded messages
- Topics: `V5008Upload/<gatewayId>/<sensorType>`
- Parser extracts sensor data from hex payload

#### V6800 Devices
- Sends JSON format messages
- Topics: `V6800Upload/<gatewayId>/<sensorType>`
- Parser extracts data from JSON payload

#### G6000 Devices
- Sends binary/hex encoded messages
- Topics: `G6000Upload/<gatewayId>/<sensorType>`
- Parser extracts sensor data from hex payload

### Message Format

All normalized messages follow this structure:

```json
{
  "deviceId": "gateway001",
  "deviceType": "V6800",
  "sensorId": "gateway001-temperature",
  "sensorType": "temperature",
  "ts": "2023-01-01T12:00:00.000Z",
  "payload": {
    // Device-specific sensor data
  },
  "meta": {
    "rawTopic": "V6800Upload/gateway001/temperature",
    "deviceType": "V6800",
    "normalizedBy": "V6800",
    "normalizedAt": "2023-01-01T12:00:00.000Z",
    "parserVersion": "1.0.0"
  }
}
```

## Adding New Device Types

### 1. Create a Parser

```javascript
// modules/normalizers/myDeviceParser.js
const logger = require("../../utils/logger");

function parse(topic, message, meta = {}) {
  try {
    // Extract device info from topic
    const topicParts = topic.split("/");
    const deviceType = topicParts[0].slice(0, 5);
    const gatewayId = topicParts[1] || "unknown";
    const sensorType = topicParts[2] || "unknown";

    // Parse message
    const payload = typeof message === "string" ? JSON.parse(message) : message;

    // Create normalized message
    return {
      deviceId: gatewayId,
      deviceType: deviceType,
      sensorId: `${gatewayId}-${sensorType}`,
      sensorType: sensorType,
      ts: new Date().toISOString(),
      payload: payload,
      meta: {
        rawTopic: topic,
        deviceType: deviceType,
        ...meta
      }
    };
  } catch (error) {
    logger.error(`MyDevice parsing failed: ${error.message}`);
    return null;
  }
}

module.exports = { parse };
```

### 2. Register the Parser

```javascript
// In modules/normalizers/NormalizerRegistry.js
const myDeviceParser = require("./myDeviceParser");

// In registerDefaultParsers()
this.registerParser("MYDEV", myDeviceParser, {
  version: "1.0.0",
  description: "Parser for MyDevice sensors"
});
```

### 3. Update Configuration

```json
{
  "modules": {
    "core": {
      "components": {
        "mqtt": {
          "config": {
            "topics": ["MYDEVUpload/#"]
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
// modules/myComponent/MyComponent.js
const BaseComponent = require("../core/BaseComponent");

class MyComponent extends BaseComponent {
  async initialize() {
    // Initialization logic
    this.logger.info("MyComponent initialized");
  }
  
  async shutdown() {
    // Cleanup logic
    super.shutdown();
  }
  
  // Component methods
  processMessage(message) {
    // Process message
  }
}

module.exports = MyComponent;
```

### 2. Register Component Factory

```javascript
// In modules/core/ComponentRegistry.js
registerDefaultFactories() {
  // ... existing factories
  this.registerFactory("myComponent", () => require("../myComponent/MyComponent"));
}
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

## Monitoring and Debugging

### Logging

The middleware uses structured logging with configurable levels:
- `error`: Error messages
- `warn`: Warning messages
- `info`: Informational messages
- `debug`: Debug messages

Set the `LOG_LEVEL` environment variable to control verbosity.

### Health Checks

Use the `/api/health` endpoint to monitor application health.

### Statistics

The `/api/stats` endpoint provides detailed statistics about:
- Enabled modules and components
- Normalizer registry statistics
- Component status

## Database Schema

The middleware uses a `sensor_data` table with the following structure:

```sql
CREATE TABLE sensor_data (
  id INT AUTO_INCREMENT PRIMARY KEY,
  device_id VARCHAR(255) NOT NULL,
  device_type VARCHAR(50) NOT NULL,
  sensor_add VARCHAR(50),
  sensor_port VARCHAR(50),
  sensor_id VARCHAR(255) NOT NULL,
  msg_Type VARCHAR(100) NOT NULL,
  timestamp DATETIME NOT NULL,
  payload JSON,
  meta JSON,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_device_id (device_id),
  INDEX idx_timestamp (timestamp),
  INDEX idx_device_type (device_type)
);
```

## Performance Considerations

### Write Buffer

The write buffer component batches database writes for better performance:
- `maxSize`: Maximum number of messages before auto-flush (default: 1000)
- `flushInterval`: Time-based flush interval in milliseconds (default: 5000)
- `maxRetries`: Number of retry attempts for failed writes (default: 3)

### Cache Configuration

The cache component stores frequently accessed data:
- `maxSize`: Maximum number of cached items (default: 10000)
- `ttl`: Time to live for cached items in milliseconds (default: 3600000)

## Troubleshooting

### Common Issues

1. **MQTT Connection Failed**
   - Check MQTT broker is running
   - Verify MQTT_URL environment variable
   - Check network connectivity

2. **Database Connection Failed**
   - Check MySQL server is running
   - Verify database credentials
   - Check database exists

3. **Messages Not Normalized**
   - Check topic patterns match device topics
   - Verify parser is registered for device type
   - Check message format matches expected parser

### Debug Mode

Enable debug logging:
```bash
LOG_LEVEL=debug npm start
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Submit a pull request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Support

For support and questions:
- Create an issue in the repository
- Check the documentation in `doc/MODULAR_ARCHITECTURE.md`
