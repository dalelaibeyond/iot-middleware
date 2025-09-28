# IoT Middleware v3

## Overview
Advanced high-performance IoT middleware designed for processing thousands of concurrent sensor messages while providing a robust bridge between MQTT-enabled devices and applications.

### High-Performance Architecture
- **Parallel Processing**
  - Worker Pool for concurrent message processing
  - Auto-scaling based on system load
  - Worker health monitoring and recovery
  - Efficient thread utilization

- **Resilience Patterns**
  - Circuit breaker for error prevention
  - Rate limiting for traffic control
  - Memory-aware operations
  - Graceful degradation under high load

- **Optimized Data Handling**
  - Smart batch processing with memory management
  - Write buffer optimization
  - Efficient message queuing
  - Performance monitoring and metrics

### Core Features
- **Event-Driven Framework**
  - Central event bus for decoupled communication
  - Pluggable module system for extensibility
  - Middleware-based message processing pipeline
  - Dynamic plugin loading system

- **Real-time Data Processing**
  - MQTT message normalization with configurable schemas
  - Multi-topic MQTT subscription support
  - WebSocket broadcasting for real-time updates
  - HTTP callback notifications with retry mechanism
  - In-memory latest data store

### MQTT Topic Format
The middleware expects MQTT messages to follow this topic hierarchy:
```
<category>/<gatewayId>/<type>
```

Valid topic examples:
- `sensors/gateway123/temperature` - For temperature sensor data
- `sensors/gateway123/humidity` - For humidity sensor data
- `devices/gateway456/status` - For device status updates
- `devices/gateway456/control` - For device control messages

Where:
- `<category>` is either "sensors" or "devices"
- `<gatewayId>` is your gateway's unique identifier
- `<type>` is the sensor type or message type

- **Efficient Data Storage**
  - Write buffer with batch processing
  - MySQL historical data storage
  - Efficient query support with indexing

- **Rich Integration Interfaces**
  - RESTful API endpoints
  - WebSocket real-time feed
  - HTTP callback system
  - Interactive documentation

- **Production-Ready Features**
  - Rate limiting
  - Data compression
  - Error handling & recovery
  - Health monitoring
  - System metrics

## Setup

### 1. Install Dependencies
```bash
npm install
```

### 2. Configuration

The middleware uses a two-tier configuration system:
1. Environment-specific variables in `.env`
2. System-wide settings in `config/config.json`

#### 2.1 Environment Variables (`.env`)
Create a `.env` file with:
```properties
# Server Configuration
PORT=3000
NODE_ENV=development
DEBUG=true

# MQTT Connection
MQTT_URL=mqtt://localhost:1883

# Database Configuration
DB_HOST=localhost
DB_USER=root
DB_PASS=yourpassword
DB_NAME=iot_middleware
```

#### 2.2 System Configuration (`config/config.json`)
Create or modify `config/config.json` to control system behavior:

```json
{
    "mqtt": {
        "topics": [
            "sensors/#",
            "devices/#"
        ],
        "options": {
            "qos": 1,
            "reconnectPeriod": 5000,
            "keepalive": 60
        }
    },
    "server": {
        "rateLimit": {
            "windowMs": 900000,
            "maxRequests": 100
        },
        "compression": {
            "level": 6,
            "threshold": "1kb"
        }
    },
    "writeBuffer": {
        "maxSize": 1000,
        "flushInterval": 5000,
        "maxRetries": 3
    },
    "callbacks": {
        "retryLimit": 3,
        "retryDelay": 1000
    },
    "logger": {
        "level": "info",
        "file": {
            "dir": "logs",
            "filename": "app.log"
        },
        "format": "[{timestamp}] {level} {message}"
    }
}
```

##### Configuration Sections:

- **mqtt**: MQTT subscription settings
  - `topics`: Array of topics to subscribe to
  - `options`: MQTT client options (QoS, reconnection, etc.)

- **server**: HTTP server settings
  - `rateLimit`: API rate limiting configuration
  - `compression`: Response compression settings

- **writeBuffer**: Database write optimization
  - `maxSize`: Maximum records before forced flush
  - `flushInterval`: Milliseconds between auto-flushes
  - `maxRetries`: Retry attempts for failed writes

- **callbacks**: HTTP callback settings
  - `retryLimit`: Maximum retry attempts
  - `retryDelay`: Milliseconds between retries

- **logger**: Logging configuration
  - `level`: Log level (error, warn, info, debug)
  - `file`: Log file settings
  - `format`: Log message format template

### 3. Database Setup
Create MySQL database and tables:

```sql
CREATE DATABASE iot_middleware;
USE iot_middleware;

CREATE TABLE sensor_data (
    id INT AUTO_INCREMENT PRIMARY KEY,
    device_id VARCHAR(64) NOT NULL,
    sensor_type VARCHAR(32) NOT NULL,
    timestamp DATETIME NOT NULL,
    payload JSON NOT NULL,
    meta JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_device_ts (device_id, timestamp)
);
```

### 4. Run Server
Development mode with auto-reload:
```bash
npm run dev
```

Production mode:
```bash
npm start
```

## Features & Endpoints

### REST API

1. Latest Data
```http
GET /api/latest                 # Get all latest sensor data
GET /api/latest/:deviceId       # Get latest data for specific device
```

2. Historical Data
```http
GET /api/history/:deviceId      # Get device history
Query Parameters:
  - limit: Number of records (default: 50)
```

3. System & Monitoring
```http
GET /system/health              # Health check endpoint
GET /system/metrics             # System metrics
```

### WebSocket Interface

Connect to `ws://localhost:3000` to receive real-time updates.
Data format matches the REST API response format.

### HTTP Callbacks

Register callback URLs to receive real-time notifications:
```http
POST /api/callbacks
Content-Type: application/json

{
    "url": "http://your-server/callback",
    "retryLimit": 3,            # Optional
    "retryDelay": 1000         # Optional, in milliseconds
}
```

## Message Format

### Input (Example Temperature Sensor)
```json
{
  "devId": "A-Temp-001",
  "rackNo": "42",
  "posU": "18",
  "tmp": 27.3,
  "unit": "C",
  "time": 1695653130000
}
```

### Normalized Output
```json
{
  "deviceId": "A-Temp-001",
  "sensorType": "temperature",
  "ts": "2025-09-25T08:05:30.000Z",
  "payload": {
    "temp": 27.3,
    "unit": "C",
    "rackNo": "42",
    "posU": "18"
  },
  "meta": {
    "rawTopic": "sensors/temperature/aa",
    "gatewayId": "temperature"
  }
}
```

## Project Structure
```
iot-middleware-v3/
├── config/
│   ├── config.json        # System configuration
│   ├── db.js             # Database configuration
│   └── schema.sql        # Database schema
├── modules/
│   ├── core/             # Core framework components
│   │   ├── eventBus.js   # Central event system
│   │   ├── messageProcessor.js # Message pipeline
│   │   └── pluginManager.js # Plugin system
│   ├── plugins/          # Extensible plugins
│   │   └── messageEnrichment.js # Message enhancement
│   ├── mqttClient.js     # MQTT subscriber
│   ├── mqttHandler.js    # MQTT message handler
│   ├── wsServer.js       # WebSocket server
│   ├── writeBuffer.js    # Database write buffer
│   ├── callbackManager.js # HTTP callbacks
│   ├── dataStore.js      # In-memory store
│   ├── dbStore.js        # MySQL operations
│   └── normalizers/      # Message normalizers
├── routes/
│   ├── api.js            # API routes
│   ├── index.js          # Main routes
│   └── system.js         # System endpoints
├── utils/
│   └── logger.js         # Logging utility
├── public/
│   └── about.html        # Documentation page
└── server.js             # Main application
```

## Testing

### 1. MQTT Messages
```bash
# Temperature sensor data
mosquitto_pub -t "sensors/temperature/aa" -m '{
  "devId": "A-Temp-001",
  "rackNo": "42",
  "posU": "18",
  "tmp": 27.3,
  "unit": "C",
  "time": 1695653130000
}'
```

### 2. WebSocket Client
```javascript
const ws = new WebSocket('ws://localhost:3000');
ws.onmessage = (event) => {
    console.log('Received:', JSON.parse(event.data));
};
```

## Performance Features

- **Write Buffering**: Efficient batch database writes
- **Rate Limiting**: Prevent API abuse
- **Compression**: Reduced bandwidth usage
- **Connection Pooling**: Efficient database connections
- **Automatic Retries**: For HTTP callbacks

## Monitoring & Maintenance

### Health Check
```http
GET /system/health
```

### System Metrics
```http
GET /system/metrics
```
Returns:
- CPU & Memory usage
- Connected WebSocket clients
- Write buffer status
- Database connection pool status

## Production Considerations

1. **Security**
   - Use TLS for MQTT (mqtts://)
   - Enable authentication
   - Set up proper firewall rules
   - Configure appropriate rate limits

2. **Configuration**
   - Adjust buffer sizes based on load
   - Set appropriate retry limits
   - Configure logging levels
   - Tune compression settings

3. **Scaling**
   - Implement Redis for shared state
   - Use database replication
   - Consider message queue for high load
   - Configure multiple MQTT topics

4. **Monitoring**
   - Set up proper logging levels
   - Monitor system metrics
   - Configure alerts
   - Watch write buffer metrics

## Contributing

1. Fork the repository
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Create a new Pull Request
