Got it 👍 Let’s put everything together into a **complete Version 3 skeleton** of your IoT middleware with MySQL support, modular structure, `/about` static page (with docs + “Try It” button), and README instructions.

---

# 📂 Project Structure (v3)

```
iot-middleware-v3/
├── package.json
├── server.js
├── config/
│   └── db.js
├── modules/
│   ├── mqttClient.js
│   ├── mqttHandler.js
│   ├── messageRelay.js
│   ├── normalizers/
│   │   ├── index.js
│   │   └── temperatureNormalizer.js
│   ├── dataStore.js
│   ├── dbStore.js
│   ├── writeBuffer.js
│   ├── wsServer.js
│   ├── core/
│   │   ├── eventBus.js
│   │   ├── messageProcessor.js
│   │   ├── pluginManager.js
│   │   ├── resilience.js
│   │   └── workerPool.js
│   └── plugins/
│       └── messageEnrichment.js
├── routes/
│   ├── api.js
│   └── index.js
├── public/
│   └── about.html
└── README.md
```

---

# 📄 `package.json`

```json
{
  "name": "iot-middleware-v3",
  "version": "3.0.0",
  "description": "IoT Middleware v3 - MQTT to REST API with MySQL storage",
  "main": "server.js",
  "scripts": {
    "start": "node server.js",
    "dev": "nodemon server.js"
  },
  "dependencies": {
    "express": "^4.19.0",
    "mqtt": "^5.3.0",
    "mysql2": "^3.9.7"
  },
  "devDependencies": {
    "nodemon": "^3.1.0"
  }
}
```

---

# 📄 `modules/messageRelay.js`

```js
const mqtt = require("mqtt");
const logger = require("../utils/logger");
const config = require("../config/config.json");

class MessageRelay {
    constructor(options = {}) {
        this.config = config.messageRelay;
        this.enabled = this.config.enabled;
        this.topicPrefix = this.config.topicPrefix;
        this.patterns = this.config.patterns;
        
        if (this.enabled) {
            this.connect(options.mqttUrl);
        }
    }

    generateNewTopic(originalTopic) {
        if (originalTopic.includes(`/${this.topicPrefix}/`)) {
            return null; // Prevent recursion
        }

        const parts = originalTopic.split('/');
        const [category, gatewayId, type] = parts;
        
        return this.patterns[category]
            ?.replace('${prefix}', this.topicPrefix)
            ?.replace('${gatewayId}', gatewayId)
            ?.replace('${type}', type);
    }

    publishNormalizedMessage(originalTopic, message) {
        if (!this.enabled) return;
        
        const newTopic = this.generateNewTopic(originalTopic);
        if (newTopic) {
            this.mqttClient.publish(newTopic, JSON.stringify(message));
        }
    }
}

module.exports = MessageRelay;
```

---

# 📄 `server.js`

```js
const express = require("express");
const path = require("path");
const apiRoutes = require("./routes/api");
const indexRoutes = require("./routes/index");
const MQTTHandler = require("./modules/mqttHandler");

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());

// Static docs
app.use(express.static(path.join(__dirname, "public")));

// Routes
app.use("/", indexRoutes);
app.use("/api", apiRoutes);

app.listen(PORT, () => {
  console.log(`IoT Middleware v3 running at http://localhost:${PORT}`);
});
```

---

# 📄 `config/config.json`

```json
{
  "mqtt": {
    "topics": ["sensors/#", "devices/#"],
    "options": {
      "qos": 1,
      "reconnectPeriod": 5000,
      "keepalive": 60
    }
  },
  "messageRelay": {
    "enabled": true,
    "topicPrefix": "new",
    "patterns": {
      "sensors": "sensors/${prefix}/${gatewayId}/${type}",
      "devices": "devices/${prefix}/${gatewayId}/${type}"
    }
  },
  "database": {
    "enabled": true,
    "connectionPool": {
      "waitForConnections": true,
      "connectionLimit": 10,
      "queueLimit": 0
    }
  }
}
```

# 📄 `config/db.js`

```js
const mysql = require("mysql2/promise");
const config = require("./config.json");
const logger = require("../utils/logger");

let pool = null;

if (config.database.enabled) {
  pool = mysql.createPool({
    host: process.env.DB_HOST || "localhost",
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASS || "",
    database: process.env.DB_NAME || "iot_middleware",
    ...config.database.connectionPool
  });

  pool.getConnection()
    .then(connection => {
      logger.info("Database connection established successfully");
      connection.release();
    })
    .catch(err => {
      logger.error("Failed to connect to database:", err);
    });
} else {
  logger.info("Database storage is disabled in configuration");
}

module.exports = {
  pool,
  isEnabled: config.database.enabled
};
```

---

# 📄 `modules/dataStore.js` (in-memory latest data)

```js
const latestData = new Map();

function set(sensorId, data) {
  latestData.set(sensorId, data);
}

function get(sensorId) {
  return latestData.get(sensorId);
}

function getAll() {
  return Object.fromEntries(latestData);
}

module.exports = { set, get, getAll };
```

---

# 📄 `modules/dbStore.js` (MySQL history)

```js
const pool = require("../config/db");

async function saveHistory(data) {
  const { id, type, value, unit, timestamp } = data;
  await pool.query(
    "INSERT INTO sensor_data (sensor_id, type, value, unit, timestamp) VALUES (?, ?, ?, ?, ?)",
    [id, type, value, unit, timestamp]
  );
}

async function getHistory(sensorId, limit = 50) {
  const [rows] = await pool.query(
    "SELECT * FROM sensor_data WHERE sensor_id = ? ORDER BY timestamp DESC LIMIT ?",
    [sensorId, limit]
  );
  return rows;
}

module.exports = { saveHistory, getHistory };
```

---

# 📄 `modules/normalizers/index.js`

```js
const temperatureNormalizer = require("./temperatureNormalizer");

function normalize(topic, message) {
  try {
    const payload = JSON.parse(message.toString());
    if (topic.startsWith("sensors/temperature")) {
      return temperatureNormalizer(payload);
    }
    return null; // unsupported sensor
  } catch (err) {
    console.error("Normalization failed:", err.message);
    return null;
  }
}

module.exports = { normalize };
```

---

# 📄 `modules/normalizers/temperatureNormalizer.js`

```js
module.exports = function normalizeTemperature(raw) {
  return {
    id: raw.id || "unknown",
    type: "temperature",
    value: raw.value,
    unit: raw.unit || "°C",
    timestamp: raw.timestamp || new Date().toISOString()
  };
};
```

---

# 📄 `modules/mqttClient.js`

```js
const mqtt = require("mqtt");
const { normalize } = require("./normalizers");
const dataStore = require("./dataStore");
const dbStore = require("./dbStore");

const client = mqtt.connect(process.env.MQTT_URL || "mqtt://localhost:1883");

client.on("connect", () => {
  console.log("Connected to MQTT broker");
  client.subscribe("sensors/#");
});

client.on("message", async (topic, message) => {
  const normalized = normalize(topic, message);
  if (normalized) {
    dataStore.set(normalized.id, normalized);
    await dbStore.saveHistory(normalized);
  }
});

module.exports = client;
```

---

# 📄 `routes/index.js`

```js
const express = require("express");
const router = express.Router();

router.get("/", (req, res) => {
  res.redirect("/about.html");
});

module.exports = router;
```

---

# 📄 `routes/api.js`

```js
const express = require("express");
const dataStore = require("../modules/dataStore");
const dbStore = require("../modules/dbStore");

const router = express.Router();

// Get all latest data
router.get("/latest", (req, res) => {
  res.json(dataStore.getAll());
});

// Get latest data for one sensor
router.get("/latest/:id", (req, res) => {
  const data = dataStore.get(req.params.id);
  if (data) return res.json(data);
  res.status(404).json({ error: "Not found" });
});

// Get history from MySQL
router.get("/history/:id", async (req, res) => {
  const limit = parseInt(req.query.limit, 10) || 50;
  try {
    const rows = await dbStore.getHistory(req.params.id, limit);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
```

---

# 📄 `public/about.html`

👉 Already enhanced with navbar and **“Try It”** button for `/api/latest` (from our last step).

---

# 📄 `README.md`

````markdown
# IoT Middleware v3

## Overview
This middleware bridges **MQTT sensors** and **upper applications**:
- Normalizes raw MQTT messages into unified JSON
- Stores the latest data in memory
- Persists history in MySQL
- Exposes REST APIs for integration
- Includes a built-in documentation page at `/about`

---

## Setup

### 1. Clone & Install
```bash
git clone https://github.com/your-org/iot-middleware-v3.git
cd iot-middleware-v3
npm install
````

### 2. Configure Environment

Set environment variables:

```bash
export MQTT_URL=mqtt://localhost:1883
export DB_HOST=localhost
export DB_USER=root
export DB_PASS=yourpassword
export DB_NAME=iot_middleware
```

Or create `.env` file (if using dotenv).

### 3. Database Setup

Create schema:

```sql
CREATE DATABASE iot_middleware;
USE iot_middleware;

CREATE TABLE sensor_data (
  id INT AUTO_INCREMENT PRIMARY KEY,
  sensor_id VARCHAR(64) NOT NULL,
  type VARCHAR(32),
  value FLOAT,
  unit VARCHAR(16),
  timestamp DATETIME
);
```

### 4. Run Server

```bash
npm start
```

Server runs at [http://localhost:3000](http://localhost:3000).

---

## API Usage

### Get All Latest Data

```
GET /api/latest
```

Response:

```json
{
  "tempSensor-123": {
    "id": "tempSensor-123",
    "type": "temperature",
    "value": 23.5,
    "unit": "°C",
    "timestamp": "2025-09-24T08:10:30Z"
  }
}
```

### Get Latest Data by ID

```
GET /api/latest/tempSensor-123
```

### Get History

```
GET /api/history/tempSensor-123?limit=10
```

---

## Documentation Page

Visit:

```
http://localhost:3000/about.html
```

Includes:

* Overview
* API docs
* “Try It” button to test `/api/latest`

---

## Next Steps

* Add WebSocket push
* Add Redis caching
* Support more sensor types

```

---

✅ This is a **complete v3 skeleton** — modular, database-enabled, documented.  
Your next steps:  
1. Run MySQL.  
2. Adjust `.env` or `config/db.js` for your DB credentials.  
3. Test with fake MQTT messages (`mosquitto_pub -t sensors/temperature -m '{"id":"temp1","value":22.3}'`).  

---

Do you want me to also add **Docker support (docker-compose for MySQL + middleware)** so you can spin up the whole stack with one command?
```
