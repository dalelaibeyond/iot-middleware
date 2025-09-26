# IoT Middleware v3

## Overview
Advanced IoT middleware that provides a robust bridge between MQTT-enabled devices and applications with:

- **Real-time Data Processing**
  - MQTT message normalization with configurable schemas
  - WebSocket broadcasting for real-time updates
  - HTTP callback notifications with retry mechanism
  - In-memory latest data store

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

### 2. Configure Environment Variables
Create a `.env` file with:
```properties
# Server Configuration
PORT=3000
NODE_ENV=development
DEBUG=true

# MQTT Configuration
MQTT_URL=mqtt://localhost:1883

# Database Configuration
DB_HOST=localhost
DB_USER=root
DB_PASS=yourpassword
DB_NAME=iot_middleware

# Performance Tuning
WRITE_BUFFER_SIZE=1000
WRITE_BUFFER_INTERVAL=5000
```

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
│   ├── db.js              # Database configuration
│   └── schema.sql         # Database schema
├── modules/
│   ├── mqttClient.js      # MQTT subscriber
│   ├── wsServer.js        # WebSocket server
│   ├── writeBuffer.js     # Database write buffer
│   ├── callbackManager.js # HTTP callbacks
│   ├── dataStore.js       # In-memory store
│   ├── dbStore.js         # MySQL operations
│   └── normalizers/       # Message normalizers
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

2. **Scaling**
   - Implement Redis for shared state
   - Use database replication
   - Consider message queue for high load

3. **Monitoring**
   - Set up proper logging
   - Monitor system metrics
   - Configure alerts

## Contributing

1. Fork the repository
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Create a new Pull Request
