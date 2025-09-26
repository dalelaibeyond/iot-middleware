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
