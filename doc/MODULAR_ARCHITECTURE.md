# IoT Middleware v3 - Modular Architecture Guide

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Core Components](#core-components)
3. [Module System](#module-system)
4. [Event-Driven Communication](#event-driven-communication)
5. [Component Lifecycle](#component-lifecycle)
6. [Data Flow](#data-flow)
7. [Configuration System](#configuration-system)
8. [Extensibility Points](#extensibility-points)
9. [Design Patterns](#design-patterns)
10. [Implementation Guidelines](#implementation-guidelines)

## Architecture Overview

IoT Middleware v3 is built on a modular, event-driven architecture that enables flexible deployment and easy extension. The system is composed of independent modules that communicate through a central event bus, ensuring loose coupling and high maintainability.

### Key Architectural Principles

1. **Modularity**: Each functional area is encapsulated in its own module
2. **Loose Coupling**: Components communicate through events, not direct references
3. **Configuration-Driven**: Behavior is controlled through configuration, not code changes
4. **Fault Tolerance**: System continues operating even when optional components fail
5. **Extensibility**: New functionality can be added without modifying existing code

## Core Components

### 1. ModularApplication

The main application class that orchestrates all modules and components.

**Location**: `modules/ModularApplication.js`

**Key Responsibilities**:
- Initialize and coordinate all modules
- Handle high-level event routing
- Provide component access interface
- Manage application lifecycle

```javascript
class ModularApplication extends BaseComponent {
  constructor(options = {}) {
    super(options);
    this.configManager = null;
    this.componentRegistry = null;
    this.isInitialized = false;
  }
}
```

### 2. ComponentRegistry

Manages the registration, initialization, and lifecycle of all components.

**Location**: `modules/core/ComponentRegistry.js`

**Key Responsibilities**:
- Register component factories
- Initialize components in dependency order
- Manage component lifecycle
- Provide component access methods

```javascript
class ComponentRegistry {
  constructor(config, options = {}) {
    this.config = config;
    this.options = options;
    this.components = new Map();
    this.componentFactories = new Map();
    this.initializationOrder = [];
  }
}
```

### 3. EventBus

Central communication hub for all components using the publish-subscribe pattern.

**Location**: `modules/core/eventBus.js`

**Key Responsibilities**:
- Route events between components
- Maintain event listeners
- Provide event subscription/unsubscription

```javascript
class EventBus extends EventEmitter {
  constructor() {
    super();
    this.setMaxListeners(0); // Unlimited listeners
  }
}
```

### 4. BaseComponent

Abstract base class that all components must extend.

**Location**: `modules/core/BaseComponent.js`

**Key Responsibilities**:
- Provide common component interface
- Implement default lifecycle methods
- Offer utility functions for validation

```javascript
class BaseComponent {
  constructor(options = {}) {
    this.config = options.config || {};
    this.logger = logger;
    this.options = options;
  }
}
```

## Module System

The middleware is organized into 8 module groups, each with specific responsibilities:

### 1. Core Module (Required)

Essential components for basic functionality.

**Components**:
- **MQTT Client** (`modules/mqtt/MQTTClient.js`)
  - Connects to MQTT broker
  - Subscribes to device topics
  - Publishes messages

- **Normalizer** (`modules/normalizers/`)
  - Normalizes incoming messages
  - Manages device-specific parsers
  - Provides unified message format

- **Data Store** (`modules/storage/dataStore.js`)
  - In-memory storage for recent data
  - Provides fast access to latest readings
  - Manages data expiration

### 2. Storage Module (Optional)

Persistent storage and caching components.

**Components**:
- **Database** (`modules/database/DatabaseManager.js`)
  - MySQL database connection
  - Query execution
  - Transaction management

- **Cache** (`modules/storage/CacheManager.js`)
  - In-memory caching
  - TTL-based expiration
  - LRU eviction policy

- **Write Buffer** (`modules/storage/WriteBuffer.js`)
  - Batches database writes
  - Improves performance
  - Handles retry logic

### 3. API Module (Optional)

External access interfaces.

**Components**:
- **REST API** (`modules/api/RestAPIManager.js`)
  - HTTP endpoints for data access
  - Request validation
  - Response formatting

- **WebSocket** (`modules/api/WebSocketServer.js`)
  - Real-time data streaming
  - Client connection management
  - Message broadcasting

- **Webhook** (`modules/api/CallbackManager.js`)
  - HTTP callback notifications
  - Retry mechanism
  - Event filtering

### 4. Relay Module (Optional)

Message forwarding and distribution.

**Components**:
- **Message Relay** (`modules/mqtt/messageRelay.js`)
  - Forwards normalized messages
  - Topic transformation
  - Selective relay rules

### 5. Security Module (Optional)

Authentication and authorization features.

**Components**:
- **Auth Manager** (`modules/security/AuthManager.js`)
  - JWT token management
  - User authentication
  - Role-based access control

- **Input Validator** (`modules/security/InputValidator.js`)
  - Request validation
  - Data sanitization
  - Schema validation

### 6. Monitoring Module (Optional)

Observability and alerting capabilities.

**Components**:
- **Metrics Collector** (`modules/monitoring/MetricsCollector.js`)
  - Prometheus metrics
  - Performance tracking
  - Resource monitoring

- **Alert Manager** (`modules/monitoring/AlertManager.js`)
  - Rule-based alerting
  - Notification channels
  - Alert aggregation

### 7. Processing Module (Optional)

Data transformation and validation pipeline.

**Components**:
- **Data Validator** (`modules/processing/DataValidator.js`)
  - Schema validation
  - Data quality checks
  - Business rule validation

- **Data Transformer** (`modules/processing/DataTransformer.js`)
  - Message transformation
  - Data enrichment
  - Format conversion

### 8. Resilience Module (Optional)

Error handling and recovery mechanisms.

**Components**:
- **Circuit Breaker** (`modules/resilience/CircuitBreaker.js`)
  - Fault detection
  - Automatic failover
  - Recovery monitoring

- **Retry Manager** (`modules/resilience/RetryManager.js`)
  - Exponential backoff
  - Retry policies
  - Dead letter queue

## Event-Driven Communication

The system uses an event-driven architecture where components communicate through events published on the central event bus.

### Core Events

| Event Name | Description | Payload |
|------------|-------------|---------|
| `mqtt.message` | Raw MQTT message received | `{topic, message}` |
| `message.processed` | Message normalized and processed | Normalized message |
| `message.error` | Error in message processing | `{error, message}` |
| `data.stored` | Data stored in data store | `{deviceId, message}` |
| `relay.message` | Message to be relayed | `{topic, payload}` |

### Normalized Message Structure

All normalized messages follow this consistent structure:

```json
{
  "deviceId": "<device_id>",
  "deviceType": "V5008" | "V6800" | "G6000",
  "sensorType": "<sensor_type>",
  "msgType": "<message_type>",
  "modNum": <module_number>,
  "modId": "<module_id>",
  "ts": "<timestamp>",
  "payload": { ... },
  "meta": { ... }
}
```

**Field Descriptions:**
- `deviceId`: Unique identifier for the device
- `deviceType`: Device model (V5008, V6800, G6000)
- `sensorType`: Type of sensor (from MQTT topic)
- `msgType`: Normalized message type
- `modNum`: Module identifier (1-5 for V5008, 1-24 for V6800, null for G6000)
- `modId`: Module serial number
- `ts`: Message timestamp
- `payload`: Message-specific data
- `meta`: Metadata and original message info

### Event Flow Example

```javascript
// 1. MQTT Client receives message
eventBus.emit("mqtt.message", { topic, message });

// 2. Normalizer processes message
eventBus.on("mqtt.message", async (data) => {
  const normalized = normalizer.normalize(data.topic, data.message);
  if (normalized) {
    eventBus.emit("message.processed", normalized);
  }
});

// 3. Data Store stores message
eventBus.on("message.processed", (message) => {
  dataStore.handleMessage(message);
});

// 4. WebSocket broadcasts to clients
eventBus.on("message.processed", (message) => {
  websocket.broadcast(message);
});
```

## Component Lifecycle

All components follow a standardized lifecycle managed by the ComponentRegistry.

### Lifecycle States

1. **Registration**: Component factory is registered
2. **Instantiation**: Component instance is created
3. **Initialization**: Component's `initialize()` method is called
4. **Active**: Component is fully operational
5. **Shutdown**: Component's `shutdown()` method is called

### Initialization Order

Components are initialized in a specific order to handle dependencies:

1. Core components (mqtt, normalizer, dataStore)
2. Storage components (database, cache, writeBuffer)
3. API components (rest, websocket, webhook)
4. Relay components (messageRelay)
5. Optional modules (security, monitoring, processing, resilience)

### Component Implementation Example

```javascript
class MyComponent extends BaseComponent {
  constructor(options = {}) {
    super(options);
    // Component-specific initialization
  }

  async initialize() {
    // Validate required options
    this.validateOptions(['requiredOption']);
    
    // Component initialization logic
    this.logger.info("MyComponent initialized");
  }

  async shutdown() {
    // Cleanup resources
    this.logger.info("MyComponent shutting down");
    super.shutdown();
  }

  // Component-specific methods
  processMessage(message) {
    // Process incoming messages
  }
}
```

## Data Flow

The system processes IoT data through a well-defined pipeline:

### 1. Message Ingestion

```
MQTT Broker → MQTT Client → Event Bus
```

### 2. Normalization

```
Event Bus → Normalizer → Device Parser → Normalized Message
```

### 3. Processing

```
Normalized Message → Data Validator → Data Transformer → Processed Message
```

### 4. Distribution

```
Processed Message → Data Store
                 → Cache
                 → Write Buffer → Database
                 → WebSocket → Clients
                 → Message Relay → MQTT Broker
                 → Metrics Collector
```

### 5. Monitoring

```
All Events → Metrics Collector → Alert Manager → Notifications
```

## Configuration System

The system uses a hierarchical configuration system that supports:

### Configuration Sources

1. **Default Configuration**: Built-in defaults in `config/modular-config.json`
2. **Environment Variables**: Override settings using `${VAR_NAME:default}` syntax
3. **Runtime Configuration**: Dynamic updates through API

### Configuration Structure

```json
{
  "modules": {
    "moduleName": {
      "enabled": true,
      "description": "Module description",
      "components": {
        "componentName": {
          "enabled": true,
          "config": {
            // Component-specific configuration
          }
        }
      }
    }
  },
  "server": {
    "port": "${PORT:3000}",
    "host": "0.0.0.0"
  },
  "logger": {
    "level": "${LOG_LEVEL:info}"
  }
}
```

### Configuration Access

```javascript
// Get application configuration
const config = application.getConfig();

// Check if module is enabled
const isEnabled = application.isModuleEnabled("moduleName");

// Check if component is enabled
const isComponentEnabled = application.isComponentEnabled("moduleName", "componentName");
```

## Extensibility Points

The architecture provides several ways to extend functionality:

### 1. Adding New Device Types

Create a parser for the new device type:

```javascript
// modules/normalizers/myDeviceParser.js
function parse(topic, message, meta = {}) {
  // Parse device-specific message format
  return normalizedMessage;
}

module.exports = { parse };
```

Register the parser:

```javascript
// In NormalizerRegistry.js
this.registerParser("MYDEV", require("./myDeviceParser"), {
  version: "1.0.0",
  description: "Parser for MyDevice sensors"
});
```

### 2. Adding New Components

Create a component class:

```javascript
// modules/myModule/MyComponent.js
class MyComponent extends BaseComponent {
  async initialize() {
    // Initialize component
  }
  
  async shutdown() {
    // Cleanup resources
  }
}

module.exports = MyComponent;
```

Register the component:

```javascript
// In ComponentRegistry.js
registerDefaultFactories() {
  this.registerFactory("myComponent", () => require("../myModule/MyComponent"));
}
```

### 3. Adding Event Handlers

Subscribe to events in your component:

```javascript
async initialize() {
  super.initialize();
  
  // Subscribe to events
  eventBus.on("message.processed", this.handleMessage.bind(this));
}

handleMessage(message) {
  // Process the message
}
```

## Design Patterns

The architecture implements several design patterns:

### 1. Publisher-Subscriber Pattern

Components communicate through events without direct references.

### 2. Factory Pattern

Component instances are created through factories registered in the ComponentRegistry.

### 3. Singleton Pattern

Some components like DataStore use singleton pattern for shared state.

### 4. Observer Pattern

Components observe events and react to state changes.

### 5. Strategy Pattern

Different parsers implement different strategies for message normalization.

### 6. Circuit Breaker Pattern

Protects the system from cascading failures.

## Implementation Guidelines

### 1. Component Development

- Always extend `BaseComponent`
- Implement `initialize()` and `shutdown()` methods
- Use the provided logger for consistent logging
- Validate required options in `initialize()`
- Emit events for significant state changes

### 2. Error Handling

- Use try-catch blocks for async operations
- Emit error events for handling by other components
- Log errors with appropriate context
- Implement graceful degradation when possible

### 3. Configuration

- Use environment variables for deployment-specific settings
- Provide sensible defaults
- Validate configuration on startup
- Document all configuration options

### 4. Testing

- Unit test each component in isolation
- Mock external dependencies
- Test error conditions
- Verify event emissions

### 5. Performance

- Use batching for high-volume operations
- Implement caching where appropriate
- Monitor resource usage
- Optimize database queries

## Module Dependencies

```
Core Module
├── MQTT Client
├── Normalizer
└── Data Store

Storage Module
├── Database (depends on Core)
├── Cache (depends on Core)
└── Write Buffer (depends on Database, Core)

API Module
├── REST API (depends on Core, Storage)
├── WebSocket (depends on Core)
└── Webhook (depends on Core)

Relay Module
└── Message Relay (depends on Core, MQTT Client)

Security Module
├── Auth Manager (depends on Core)
└── Input Validator (depends on Core)

Monitoring Module
├── Metrics Collector (depends on Core)
└── Alert Manager (depends on Core, Metrics Collector)

Processing Module
├── Data Validator (depends on Core)
└── Data Transformer (depends on Core, Data Validator)

Resilience Module
├── Circuit Breaker (depends on Core)
└── Retry Manager (depends on Core)
```

## Best Practices

1. **Keep Components Focused**: Each component should have a single responsibility
2. **Use Events for Communication**: Avoid direct component-to-component calls
3. **Handle Failures Gracefully**: Implement proper error handling and recovery
4. **Log Appropriately**: Use consistent logging levels and formats
5. **Test Thoroughly**: Write unit and integration tests
6. **Document Everything**: Document configuration options, events, and APIs
7. **Version Your Changes**: Use semantic versioning for releases
8. **Monitor Performance**: Track key metrics and optimize bottlenecks

This architecture guide provides a comprehensive understanding of the IoT Middleware v3 system. For specific implementation details, refer to the source code and inline documentation.