# V5008_normalization_guide.md

Below is a **developer-facing `.md` document** that clearly explains **how to normalize each MQTT message** type from the V5008 gateway into **unified JSON objects**.

You can include this file as

📄 `doc/V5008_normalization_guide.md` in your project.

---

```markdown
# 🧩 V5008 Gateway Message Normalization Guide

This document describes how to parse and normalize raw hex string from the V5008 IoT gateway into standard JSON format for middleware processing.

---

## 🔧 General Rules

1. All raw MQTT messages are hex strings (e.g. `"BB01000000F303..."`).
2. Each field is **1 byte (2 hex chars)** unless otherwise noted.
3. Multi-byte fields use parentheses — e.g. `(4B)` = 8 hex chars.
4. Repeated groups are indicated by `xN`.
5. All normalized JSON share a consistent structure:
   ```json
   {
     "deviceId":"<deviceId>",
     "deviceType":"V5008",
     "msgType":"TemHum" | "Noise" | "Door" | "Rfid" | "Heartbeat" | "DeviceInfo" | "ModuleInfo",
     "sensorType":"<sensorType>",
     "modNum": <modNum>,
    "modId":"<modId>",
     "ts": "2025-09-25T07:56:31Z",
     
     "payload":{...},
     "meta":{"rawTopic":"...", "rawHexString":"...", "msgId": <message_code_as_integer>}
   }
   ```

---

## 🫀 1. Heartbeat Message

**MQTT Topic:**

```
V5008Upload/{device_id}/OpeAck
```

**Raw Format:**

```json
[CB or CC] ( [modAdd + modId(4B) + uNum] x 10 ) [msgCode(4B)]

Example:

topic: V5008Upload/2437871205/OpeAck
Raw: CC01EC3737BF0C028C090995120300000000000400000000000500000000000600000000000700000000000800000000000900000000000A00000000003401778E

Note:
valid value only modAdd from 1-5;
```

**Normalized JSON:**

```json
{
  "deviceId":"2437871205",
  "deviceType":"V5008",
  "msgType":"Heartbeat",
  "sensorType":"OpeAck",
  "modNum": null,
 "modId":null,
  "ts": "2025-09-25T07:56:31Z",
  
  "payload":[
    { "num": 1, "modId" : '3963041727', "uCount"  : 12 },
    { "num": 2, "modId" : '2349402517', "uCount"  : 18 },
    { "num": 3, "modId" : '0',          "uCount"  : 0 },
    { "num": 4, "modId" : '0',          "uCount"  : 0 },
    { "num": 5, "modId" : '0',          "uCount"  : 0 }
  ],
  
  "meta":{
   "rawTopic":"V5008Upload/2437871205/OpeAck",
   "rawHexString":"CC01EC3737BF0C028C090995120300000000000400000000000500000000000600000000000700000000000800000000000900000000000A00000000003401778E",
   "msgId": 875822
  }
}

```

---

## 🏷 2. RFID Tag Update

**MQTT Topic:**

```
V5008Upload/{device_id}/LabelState
```

**Raw Format:**

```
[BB][modNum][modId(4B)][Reserved][uCount][rfidCount] ( [num + alarm + rfid(4B)] x rfidCount ) [msgCode(4B)]

Example:
Topic: V5008Upload/2437871205/LabelState
Raw: BB028C0909950012030400DD3950641100DD23B0B41200DD27EE344C01EC3F
```

**Normalized JSON:**

```json
{
  "deviceId":"2437871205",
  "deviceType":"V5008",
  "msgType":"Rfid",
  "sensorType":"LabelState",
  "modNum": 2,
 "modId":"2349402517",
  "ts": "2025-09-25T07:56:31Z",
  
  "payload":{
	  "uCount":18,
	  "rfidCount":3,
	  "rfidData":[
      { "num":4, "alarm": 0,  "rfid": "DD395064" },
      { "num":17, "alarm": 0,  "rfid": "DD23B0B4" },
      { "num":18, "alarm": 0,  "rfid": "DD27EE34" }
	  ]
  },
  
  "meta":{
   "rawTopic":"V5008Upload/2437871205/LabelState",
   "rawHexString":"BB028C0909950012030400DD3950641100DD23B0B41200DD27EE344C01EC3F",
   "msgId": 784063
  }
}
```

---

## 🌡 3. Temperature & Humidity

**MQTT Topic:**

```
V5008Upload/{device_id}/TemHum
```

**Raw Format:**

```
[modAdd][modId(4B)] ([thAdd + temp(4B) + hum(4B)] x 6) [msgCode(4B)]

Example:
Topic: V5008Upload/2437871205/TemHum
Raw: 028C0909950A1B2938350B1B2337530C1B0336270D000000000E000000000F0000000035019E28
```

**Normalized JSON:**

```json
{
  "deviceId":"2437871205",
  "deviceType":"V5008",
  "msgType":"TempHum",
  "sensorType":"TemHum",
  "modNum": 2,
 "modId":"2349402517",
  "ts": "2025-09-25T07:56:31Z",
  
  "payload": [
    { "add":10, "temp": 27.41, "hum": 56.53 },
    { "add":11, "temp": 27.35, "hum": 55.83 },
    { "add":12, "temp": 27.03, "hum": 54.39 },
    { "add":13, "temp": 0, "hum": 0 },
    { "add":14, "temp": 0, "hum": 0 },
    { "add":15, "temp": 0, "hum": 0 }
  ],
  
  "meta":{
   "rawTopic":"V5008Upload/2437871205/TemHum",
   "rawHexString":"028C0909950A1B2938350B1B2337530C1B0336270D000000000E000000000F0000000035019E28",
   "msgId": 876840
  }
}

  
```

---

## 🔊 4. Noise Level

**MQTT Topic:**

```
V5008Upload/{device_id}/Noise
```

**Raw Format:**

```
[modAdd][modId(4B)] ( [nsAdd + nsLevel(4B)] x 3 ) [msgCode(4B)]

Example:
Topic: V5008Upload/2437871205/Noise
Raw: 028C0909951000000000110000000012000000007001DB9E
```

**Normalized JSON:**

```json
{
  "deviceId":"2437871205",
  "deviceType":"V5008",
  "msgType":"Noise",
  "sensorType":"Noise",
  "modNum": 2,
 "modId":"2349402517",
  "ts": "2025-09-25T07:56:31Z",
  
  "payload": [
    { "add": 16, "noise": 0 },
    { "add": 17, "noise": 0 },
    { "add": 18, "noise": 0 }
  ],
  
  "meta":{
   "rawTopic":"V5008Upload/2437871205/Noise",
   "rawHexString":"028C0909951000000000110000000012000000007001DB9E",
   "msgId": 456414
  }
}
```

---

## 🚪 5. Door Status

**MQTT Topic:**

```
V5008Upload/{device_id}/OpeAck

```

**Raw Format:**

```
[BA][modAdd][modId(4B)][drStatus] [msgCode(4B)]

Example:
Topic: V5008Upload/2437871205/OpeAck
Raw: BA01EC3737BF1194016082
```

**Normalized JSON:**

```json
{
  "deviceId":"2437871205",
  "deviceType":"V5008",
  "msgType":"Door",
  "sensorType":"OpeAck",
  "modNum": 2,
 "modId":"2349402517",
  "ts": "2025-09-25T07:56:31Z",
  
  "payload": {
   "status":"0x11"
  },
  
  "meta":{
   "rawTopic":"V5008Upload/2437871205/OpeAck",
   "rawHexString":"BA01EC3737BF1194016082",
   "msgId": 144130
  }
}
```

---

## 🧠 6. Device & Module Info

**MQTT Topic:**

```
V5008Upload/{device_id}/OpeAck

```

### For Device Info

**Raw Format:**

```
[EF][01][deviceType(2B)][firmwareVer(4B)][ip(4B)][mask(4B)][gateway(4B)][mac(6B)][msgCode(4B)]

Example:

Topic: V5008Upload/2437871205/OpeAck
Raw: EF011390958DD85FC0A864D3FFFF0000C0A800018082914EF665B7013C37

```

**Normalized JSON:**

```json
{
  "deviceId":"2437871205",
  "deviceType":"V5008",
  "msgType":"DeviceInfo",
  "sensorType":"OpeAck",
  "modNum": null,
 "modId":null,
  "ts": "2025-09-25T07:56:31Z",
  
  "payload": {
      "fmVersion":"2509101151",
      "ip":"192.168.100.211",
      "mask":"255.255.0.0",
      "gateway":"192.168.0.1",
      "mac":"80:82:91:4E:F6:65"
   },
   
  "meta":{
    "rawTopic":"V5008Upload/2437871205/OpeAck",
    "rawHexString":"EF011390958DD85FC0A864D3FFFF0000C0A800018082914EF665B7013C37",
    "msgId": 202815
  }
}
```

### For Module Info

**Raw Format:**

```
[EF][02] ( [modAdd + modFirwareVer(6B)] x (until the rest bytes < 7) ) [msgCode(4B)]

Example:

Topic:V5008Upload/2437871205/OpeAck
Raw:EF02010000898393CC020000898393CCB801BCF7
```

**Normalized JSON:**

```json
{
  "deviceId":"2437871205",
  "deviceType":"V5008",
  "msgType":"ModuleInfo",
  "sensorType":"OpeAck",
  "modAdd": null,
  "modPort": null,
	"modId": null,
  "ts": "2025-09-25T07:56:31Z",
  
  "payload": [
      { "add":1, "fmVersion": "2307101644" },
      { "add":2, "fmVersion": "2307101644" }
   ],
  
  "meta":{
   "rawTopic":"V5008Upload/2437871205/OpeAck",
   "rawHexString":"EF02010000898393CC020000898393CCB801BCF7",
   "msgId": 191511
  }
}
```

---

## 🧩 Summary Table

| Message Type | MQTT Topic | Identifier | Normalized Type | Notes |
| --- | --- | --- | --- | --- |
| Heartbeat | `OpeAck` | `CB` / `CC` | `Heartbeat` | Lists module and sensor counts |
| RFID Tag Update | `LabelState` | `BB` | `Rfid` | Tag & alarm state per U position |
| Temperature & Humidity | `TemHum` | – | `TempHum` | 6 sets per module |
| Noise Level | `Noise` | – | `Noise` | 3 sets per module |
| Door Status | `OpeAck` | `BA` | `Door` | Rack door open/close |
| Device Info | `OpeAck` | `EF01` | `DeviceInfo` | Device network info |
| Module Info | `OpeAck` | `EF02` | `ModuleInfo` | Each module’s firmware version |

---

## 🧰 Implementation Notes

- Use a lookup map for message identifiers:
    
    ```jsx
    const MSG_TYPE_MAP = {
      //identify message type by topic[2]
      "LabelState": "Rfid",
      "TemHum": "TempHum",
      "Noise": "Noise",

      //identify message type by header
      "CB": "Heartbeat",
      "CC": "Heartbeat",
      "BA": "Door",
      "EF01": "DeviceInfo",
      "EF02": "ModuleInfo"
    };
    ```
    
- Common functions:

```jsx
//Convert hex substrings to numbers using:
const val = parseInt(hex.substr(pos, len), 16);

  // Helper to read hex substrings as numbers or strings
  const readHex = (str, start, len) => str.slice(start, start + len);
  const readNum = (str, start, len) => parseInt(str.slice(start, start + len), 16);
  const readIP = (sec1, sec2, sec3, sec4) => {  return [sec1, sec2, sec3, sec4].join('.');}
  
  
  //Convert 4-byte float-like values by combining integer and fraction parts:
  const integer = parseInt(hex.substr(pos, 4), 16);
  const fraction = parseInt(hex.substr(pos + 4, 4), 16);
  const value = parseFloat(`${integer}.${fraction}`);
```

---

📘 **End of Document**

*Last updated: 2025-10-27*