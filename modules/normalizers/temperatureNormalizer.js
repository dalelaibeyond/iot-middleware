module.exports = function normalizeTemperature(raw, topic, meta = {}) {
  // Convert Unix timestamp to ISO format if provided
  const timestamp = raw.time ? new Date(raw.time).toISOString() : new Date().toISOString();

  return {
    deviceId: raw.devId || raw.deviceId || raw.id || "unknown",
    sensorType: "temperature",
    ts: timestamp,
    seq: raw.seq,
    payload: {
      temp: raw.tmp || raw.value || raw.temperature,
      unit: raw.unit || "C",
      rackNo: raw.rackNo,
      posU: raw.posU
    },
    meta: {
      rawTopic: topic,
      ...meta
    }
  };
};
