# Event System in IoT Middleware v3

This document describes the event flow architecture in the IoT Middleware v3 project, including where events are created, sent, listened for, and handled.

## Core Event Infrastructure

### EventBus Module (`modules/core/eventBus.js`)

The event system is built around a centralized EventBus that extends Node.js's EventEmitter:

- **Singleton Pattern**: The EventBus is implemented as a singleton to ensure all components use the same event instance
- **Unlimited Listeners**: Sets `setMaxListeners(0)` to allow unlimited event listeners
- **Core Methods**:
  - `publish(event, data)` - Emits an event with data
  - `subscribe(event, handler)` - Registers an event listener
  - `subscribeOnce(event, handler)` - Registers a one-time event listener
  - `unsubscribe(event, handler)` - Removes an event listener

## Event Flow Architecture

### 1. Event Creation Points

#### MQTT Module (`modules/mqtt/MQTTClient.js`)
- **Event**: `mqtt.message`
- **Trigger**: When an MQTT message is received on a subscribed topic
- **Location**: In the `message` event handler of the MQTT client
- **Code**: `eventBus.emit("mqtt.message", { topic, message })`

#### Message Relay Module (`modules/mqtt/messageRelay.js`)
- **Event**: `relay.message`
- **Trigger**: When a message needs to be relayed to another MQTT topic
- **Location**: In the `relayMessage` method
- **Code**: `eventBus.emit("relay.message", { topic: transformed.topic, payload: transformed.payload })`

#### Modular Application (`modules/ModularApplication.js`)
- **Events**: `message.processed`, `message.error`
- **Trigger**: After message processing or when errors occur
- **Location**: In message handling methods
- **Code**: 
  - `eventBus.emit("message.processed", normalized)`
  - `eventBus.emit("message.error", { error, data })`

### 2. Event Registry and Listener Registration

#### ComponentRegistry (`modules/core/ComponentRegistry.js`)
The ComponentRegistry is responsible for setting up event listeners during component initialization:

- **MQTT Component**: Subscribes to MQTT topics and emits `mqtt.message` events
- **WebSocket Component**: Subscribes to `message.processed` events for broadcasting
- **Cache Component**: Subscribes to `message.processed` events to update cache

#### ModularApplication (`modules/ModularApplication.js`)
The main application registers core event listeners in `setupEventListeners()`:

```javascript
// Handle MQTT messages
eventBus.on("mqtt.message", this.handleMqttMessage.bind(this));

// Handle processed messages
eventBus.on("message.processed", this.handleProcessedMessage.bind(this));

// Handle message errors
eventBus.on("message.error", this.handleMessageError.bind(this));

// Handle relay messages
eventBus.on("relay.message", this.handleRelayMessage.bind(this));
```

### 3. Event Handling Locations

#### ModularApplication (`modules/ModularApplication.js`)
- **`handleMqttMessage(data)`**: Processes incoming MQTT messages, normalizes them, and stores them
- **`handleProcessedMessage(message)`**: Handles processed messages by updating cache, write buffer, and broadcasting to WebSocket clients
- **`handleMessageError(data)`**: Handles message processing errors
- **`handleRelayMessage(relayData)`**: Publishes relay messages to MQTT topics

#### WebSocketServer (`modules/api/WebSocketServer.js`)
- **`broadcast(message)`**: Broadcasts processed messages to all connected WebSocket clients
- **Registration**: `eventBus.on("message.processed", this.broadcast.bind(this))`

#### MessageRelay (`modules/mqtt/messageRelay.js`)
- **`handleMessage(message)`**: Processes messages and applies relay rules
- **Registration**: `eventBus.on("message.processed", this.handleMessage.bind(this))`

#### CacheManager (`modules/storage/CacheManager.js`)
- **Cache Update**: Updates cache with processed messages
- **Registration**: `eventBus.on("message.processed", (message) => { instance.set(message.deviceId, message); })`

## Event Types and Data Flow

### 1. `mqtt.message` Event
- **Purpose**: Signals arrival of a new MQTT message
- **Data Structure**: `{ topic, message }`
- **Flow**: MQTTClient → EventBus → ModularApplication.handleMqttMessage

### 2. `message.processed` Event
- **Purpose**: Signals that a message has been normalized and processed
- **Data Structure**: Normalized message object with deviceId, deviceType, payload, etc.
- **Flow**: ModularApplication → EventBus → [CacheManager, WebSocketServer, MessageRelay, WriteBuffer]

### 3. `message.error` Event
- **Purpose**: Signals an error in message processing
- **Data Structure**: `{ error, data }` or `{ error, message }`
- **Flow**: Various components → EventBus → ModularApplication.handleMessageError

### 4. `relay.message` Event
- **Purpose**: Signals that a message needs to be relayed to another MQTT topic
- **Data Structure**: `{ topic, payload }`
- **Flow**: MessageRelay → EventBus → ModularApplication.handleRelayMessage → MQTTClient

### 5. `relay.success` and `relay.error` Events
- **Purpose**: Signals success or failure of message relay operations
- **Data Structure**: `{ sourceTopic, targetTopic }` or `{ error, sourceTopic }`
- **Flow**: MessageRelay → EventBus (for monitoring/logging)

## Complete Message Flow Example

1. **MQTT Message Arrival**
   - MQTTClient receives message on subscribed topic
   - Emits `mqtt.message` event with `{ topic, message }`

2. **Message Processing**
   - ModularApplication.handleMqttMessage receives the event
   - Normalizes the message using the normalizer module
   - Stores the normalized message in dataStore
   - Emits `message.processed` event with normalized data

3. **Message Distribution**
   - CacheManager receives `message.processed` and updates cache
   - WebSocketServer receives `message.processed` and broadcasts to clients
   - MessageRelay receives `message.processed` and applies relay rules
   - WriteBuffer receives `message.processed` and queues for database storage

4. **Message Relay (if applicable)**
   - MessageRelay emits `relay.message` event
   - ModularApplication.handleRelayMessage receives the event
   - MQTTClient publishes the relayed message to the target topic

## Event-Driven Benefits

1. **Decoupling**: Components communicate through events without direct dependencies
2. **Scalability**: New components can easily subscribe to existing events
3. **Flexibility**: Event handlers can be added/removed dynamically
4. **Testability**: Components can be tested in isolation with mock events
5. **Maintainability**: Clear separation of concerns between event producers and consumers

## Configuration and Customization

Event subscriptions and handling can be configured through:
- **Component Configuration**: Enable/disable components in `config/modular-config.json`
- **Event Handlers**: Add custom handlers in component initialization
- **Relay Rules**: Configure message relay patterns in the messageRelay module options

This event-driven architecture provides a robust foundation for the IoT middleware, allowing for flexible message processing and component interaction.