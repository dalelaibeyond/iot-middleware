# 🧩 V6800 Gateway Message Normalization Guide

This document describes how to parse and normalize raw JSON messages from the V6800 IoT gateway into standard JSON format for middleware processing.

---

## 🔧 General Rules

1. All raw MQTT messages are JSON objects (not hex strings like V5008).
2. Each message contains a `msg_type` field that identifies the message type.
3. Device ID is extracted from `gateway_sn` or `module_sn` field in the raw message.
4. Message ID is extracted from `uuid_number` field in the raw message.
5. All normalized JSON share a consistent structure:
   
```json
{
  "deviceId":"<deviceId>",
  "deviceType":"V6800",
  "msgType":"Heartbeat" | "Rfid" | "TempHum" | "Noise" | "Door" | "DevModInfo",
  "sensorType":"<sensorType>",
  "modNum": <modNum>,
  "modId":"<modId>",
  "ts": "2025-09-25T07:56:31Z",
  "payload":{...},
  "meta":{"rawTopic":"...", "msgId":"..."}
}
```

---

## 🫀 1. Heartbeat Message

**MQTT Topic:**

```
V6800Upload/{device_id}/OpeAck
```

**Raw Format:**

```json
{
  "msg_type": "heart_beat_req",
  "module_type": "mt_gw",
  "module_sn": "2123456789",
  "bus_V": "23.92",
  "bus_I": "6.50",
  "main_power": 0,
  "backup_power": 1,
  "uuid_number": 2140003913,
  "data": [
    { "module_index": 2, "module_sn": "2349402517", "module_m_num": 1, "module_u_num": 6 }
  ]
}
```

**Field Mapping:**
- `deviceId`: `module_sn` (gateway serial number)
- `msgId`: `uuid_number`
- `modPort`: `null` (not applicable for heartbeat)
- `modId`: `null` (not applicable for heartbeat)
- `payload`: Array of modules with `modPort`, `modId`, and `uNum` fields

**Normalized JSON:**

```json
{
  "deviceId":"2123456789",
  "deviceType":"V6800",
  "msgType":"Heartbeat",
  "sensorType":"OpeAck",
  "modNum": null,
  "modId":null,
  "ts": "2025-09-25T07:56:31Z",
  "payload":[
    {"modPort": 2, "modId":"2349402517", "uNum": 6}
  ],
  "meta":{
    "rawTopic":"V6800Upload/2123456789/OpeAck",
    "msgId":"2140003913"
  }
}
```

---

## 🏷 2. RFID Tag Update

**MQTT Topic:**

```
V6800Upload/{device_id}/LabelState
```

**Raw Format:**

```json
{
  "msg_type": "u_state_changed_notify_req",
  "gateway_sn": "2123456789",
  "uuid_number": 1747983279,
  "data": [
    {
      "host_gateway_port_index": 2,
      "extend_module_sn": "2349402517",
      "u_data": [
        { "u_index": 1, "new_state": 1, "old_state": 0, "tag_code": "DD3CE9C4", "warning": 0 }
      ]
    }
  ]
}
```

**Field Mapping:**
- `deviceId`: `gateway_sn`
- `msgId`: `uuid_number`
- `modPort`: `host_gateway_port_index`
- `modId`: `extend_module_sn`
- `payload.rfidData.pos`: `u_index`
- `payload.rfidData.alarm`: `warning`
- `payload.rfidData.rfid`: `tag_code`
- `payload.rfidData.action`: "attached" if `new_state=1`, "detached" if `new_state=0`

**Normalized JSON:**

```json
{
  "deviceId":"2123456789",
  "deviceType":"V6800",
  "msgType":"Rfid",
  "sensorType":"LabelState",
  "modNum": 2,
  "modId":"2349402517",
  "ts": "2025-09-25T07:56:31Z",
  "payload":{
    "rfidData":[
      { "pos": 1, "alarm": 0, "rfid": "DD3CE9C4", "action": "attached" }
    ]
  },
  "meta":{
    "rawTopic":"V6800Upload/2123456789/LabelState",
    "msgId":"1747983279"
  }
}
```

**Note:** If multiple `host_gateway_port_index` values exist, create an array of normalized JSON objects, each reflecting a specific port.

---

## 🌡 3. Temperature & Humidity

**MQTT Topic:**

```
V6800Upload/{device_id}/TemHum
```

**Raw Format:**

```json
{
  "msg_type": "temper_humidity_exception_nofity_req",
  "gateway_sn": "2123456789",
  "uuid_number": 975528252,
  "data": [
    {
      "host_gateway_port_index": 2,
      "extend_module_sn": "2349402517",
      "th_data": [
        { "temper_position": 10, "hygrometer_position": 10, "temper_swot": 25.41, "hygrometer_swot": 62.90 },
        { "temper_position": 11, "hygrometer_position": 11, "temper_swot": 27.10, "hygrometer_swot": 68.80 },
        { "temper_position": 12, "hygrometer_position": 12, "temper_swot": 25.60, "hygrometer_swot": 59.51 },
        { "temper_position": 13, "hygrometer_position": 13, "temper_swot": 0, "hygrometer_swot": 0 },
        { "temper_position": 14, "hygrometer_position": 14, "temper_swot": 0, "hygrometer_swot": 0 },
        { "temper_position": 15, "hygrometer_position": 15, "temper_swot": 0, "hygrometer_swot": 0 }
      ]
    }
  ]
}
```

**Field Mapping:**
- `deviceId`: `gateway_sn`
- `msgId`: `uuid_number`
- `modPort`: `host_gateway_port_index`
- `modId`: `extend_module_sn`
- `payload[].add`: `temper_position` (same as `hygrometer_position`)
- `payload[].temp`: `temper_swot`
- `payload[].hum`: `hygrometer_swot`

**Normalized JSON:**

```json
{
  "deviceId":"2123456789",
  "deviceType":"V6800",
  "msgType":"TempHum",
  "sensorType":"TemHum",
  "modNum": 2,
  "modId":"2349402517",
  "ts": "2025-09-25T07:56:31Z",
  "payload": [
    { "add": 10, "temp": 25.41, "hum": 62.90 },
    { "add": 11, "temp": 27.10, "hum": 68.80 },
    { "add": 12, "temp": 25.60, "hum": 59.51 },
    { "add": 13, "temp": 0, "hum": 0 },
    { "add": 14, "temp": 0, "hum": 0 },
    { "add": 15, "temp": 0, "hum": 0 }
  ],
  "meta":{
    "rawTopic":"V6800Upload/2123456789/TemHum",
    "msgId":"975528252"
  }
}
```

**Note:** If multiple `host_gateway_port_index` values exist, create an array of normalized JSON objects, each reflecting a specific port.

---

## 🔊 4. Noise Level

**MQTT Topic:**

```
V6800Upload/{device_id}/Noise
```

**Raw Format:**

```json
{
  "msg_type": "noise_exception_nofity_req",
  "gateway_sn": "2123456789",
  "uuid_number": 975528253,
  "data": [
    {
      "host_gateway_port_index": 2,
      "extend_module_sn": "2349402517",
      "noise_data": [
        { "noise_position": 16, "noise_swot": 29.90 },
        { "noise_position": 17, "noise_swot": 41.80 },
        { "noise_position": 18, "noise_swot": 52.92 }
      ]
    }
  ]
}
```

**Field Mapping:**
- `deviceId`: `gateway_sn`
- `msgId`: `uuid_number`
- `modPort`: `host_gateway_port_index`
- `modId`: `extend_module_sn`
- `payload[].add`: `noise_position`
- `payload[].noise`: `noise_swot`

**Normalized JSON:**

```json
{
  "deviceId":"2123456789",
  "deviceType":"V6800",
  "msgType":"Noise",
  "sensorType":"Noise",
  "modNum": 2,
  "modId":"2349402517",
  "ts": "2025-09-25T07:56:31Z",
  "payload":[
    { "add": 16, "noise": 29.90 },
    { "add": 17, "noise": 41.80 },
    { "add": 18, "noise": 52.92 }
  ],
  "meta":{
    "rawTopic":"V6800Upload/2123456789/Noise",
    "msgId":"975528253"
  }
}
```

**Note:** If multiple `host_gateway_port_index` values exist, create an array of normalized JSON objects, each reflecting a specific port.

---

## 🚪 5. Door Status

**MQTT Topic:**

```
V6800Upload/{device_id}/OpeAck
```

**Raw Format:**

```json
{
  "msg_type": "door_state_changed_notify_req",
  "gateway_sn": "2123456789",
  "uuid_number": 1216019422,
  "data": [
    { 
      "extend_module_sn": "2349402517", 
      "host_gateway_port_index": 2, 
      "new_state": 1 
    }
  ]
}
```

**Field Mapping:**
- `deviceId`: `gateway_sn`
- `msgId`: `uuid_number`
- `modPort`: `host_gateway_port_index`
- `modId`: `extend_module_sn`
- `payload.drStatus`: Hex string representation of `new_state` (e.g., "0x01" for 1, "0x00" for 0)

**Normalized JSON:**

```json
{
  "deviceId":"2123456789",
  "deviceType":"V6800",
  "msgType":"Door",
  "sensorType":"OpeAck",
  "modNum": 2,
  "modId":"2349402517",
  "ts": "2025-09-25T07:56:31Z",
  "payload": {
    "drStatus":"0x01"
  },
  "meta":{
    "rawTopic":"V6800Upload/2123456789/OpeAck",
    "msgId":"1216019422"
  }
}
```

**Note:** If multiple `host_gateway_port_index` values exist, create an array of normalized JSON objects, each reflecting a specific port.

---

## 🧠 6. Device & Module Info

**MQTT Topic:**

```
V6800Upload/{device_id}/OpeAck
```

**Raw Format:**

```json
{
  "msg_type": "devies_init_req",
  "gateway_sn": "2123456789",
  "gateway_ip": "192.168.100.139",
  "gateway_mac": "08:80:7E:91:61:15",
  "uuid_number": 408744622,
  "data": [
    { 
      "module_type": "mt_ul", 
      "module_index": 2, 
      "module_sn": "2349402517", 
      "module_m_num": 1, 
      "module_u_num": 6, 
      "module_sw_version": "2307101644", 
      "module_supplier": "Digitalor", 
      "module_brand": "Digitalor", 
      "module_model": "Digitalor" 
    }
  ]
}
```

**Field Mapping:**
- `deviceId`: `gateway_sn`
- `msgId`: `uuid_number`
- `modPort`: `null` (not applicable for device info)
- `modId`: `null` (not applicable for device info)
- `payload.ip`: `gateway_ip`
- `payload.mac`: `gateway_mac`
- `payload.module[].modPort`: `module_index`
- `payload.module[].modId`: `module_sn`
- `payload.module[].uNum`: `module_u_num`
- `payload.module[].modFirwareVer`: `module_sw_version`

**Normalized JSON:**

```json
{
  "deviceId":"2123456789",
  "deviceType":"V6800",
  "msgType":"DevModInfo",
  "sensorType":"OpeAck",
  "modNum": null,
  "modId":null,
  "ts": "2025-09-25T07:56:31Z",
  "payload": {
    "firmwareVer": null,
    "ip": "192.168.100.139",
    "mask": null,
    "gateway": null,
    "mac": "08:80:7E:91:61:15",
    "module": [
      {"modPort": 2, "modId": "2349402517", "uNum": 6, "modFirwareVer": "2307101644"}
    ]
  },
  "meta":{
    "rawTopic":"V6800Upload/2123456789/OpeAck",
    "msgId":"408744622"
  }
}
```

---

## 🧩 Summary Table

| Message Type | MQTT Topic | msg_type | Normalized Type | Notes |
| --- | --- | --- | --- | --- |
| Heartbeat | `OpeAck` | `heart_beat_req` | `Heartbeat` | Lists module and sensor counts |
| RFID Tag Update | `LabelState` | `u_state_changed_notify_req` | `Rfid` | Tag & alarm state per U position |
| Temperature & Humidity | `TemHum` | `temper_humidity_exception_nofity_req` | `TempHum` | 6 sets per module |
| Noise Level | `Noise` | `noise_exception_nofity_req` | `Noise` | 3 sets per module |
| Door Status | `OpeAck` | `door_state_changed_notify_req` | `Door` | Rack door open/close |
| Device & Module Info | `OpeAck` | `devies_init_req` | `DevModInfo` | Device network and module info |

---

## 🧰 Implementation Notes

### Message Type Detection

Use a lookup map for message types:
    
```javascript
const MSG_TYPE_MAP = {
  "heart_beat_req": "Heartbeat",
  "u_state_changed_notify_req": "Rfid",
  "temper_humidity_exception_nofity_req": "TempHum",
  "noise_exception_nofity_req": "Noise",
  "door_state_changed_notify_req": "Door",
  "devies_init_req": "DevModInfo"
};
```

### Device ID Extraction

```javascript
// Extract device ID from raw message
const getDeviceId = (rawMessage) => {
  return rawMessage.gateway_sn || rawMessage.module_sn || "unknown";
};
```

### Multiple Port Handling

```javascript
// Helper to handle multiple ports
const createPortSpecificMessages = (rawMessage, baseMessage) => {
  const data = rawMessage.data || [];
  
  if (data.length === 1) {
    // Single port - return single message
    return {
      ...baseMessage,
      modPort: data[0].host_gateway_port_index || null,
      modId: data[0].extend_module_sn || null
    };
  }
  
  // Multiple ports - return array of messages
  return data.map(portData => ({
    ...baseMessage,
    modPort: portData.host_gateway_port_index,
    modId: portData.extend_module_sn,
    payload: processPortData(portData)
  }));
};
```

### RFID Action Mapping

```javascript
// Convert new_state to action string
const getRfidAction = (newState) => {
  return newState === 1 ? "attached" : "detached";
};
```

### Door Status Formatting

```javascript
// Convert door state to hex string
const formatDoorStatus = (newState) => {
  return `0x${newState.toString(16).padStart(2, '0').toUpperCase()}`;
};
```

---

📘 **End of Document**

*Last updated: 2025-10-28*