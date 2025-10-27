CREATE DATABASE IF NOT EXISTS iot_middleware;
USE iot_middleware;

CREATE TABLE IF NOT EXISTS sensor_data (
    id INT AUTO_INCREMENT PRIMARY KEY,
    device_id VARCHAR(32) NOT NULL,
    device_type CHAR(5) NOT NULL, -- "V5008" or "V6800" or "G6000"
    mod_add INT, -- Rack Unit sensor module Modbus address, when device type is "V5008", this value identifies a rack of sensors
    mod_port INT, -- Rack Unit sensor module connection port on the V6800 gateway. when device type is "V6800", the device use different connection ports to distinguish it's sensor groups under it.
    mod_id VARCHAR(32), -- Rack Unit sensor module id
    sensor_type VARCHAR(32), -- Topic segment 2 (e.g., "OpeAck", "LabelState", "TemHum", "Noise")
    msg_Type VARCHAR(32) NOT NULL, -- "temperature" or "humidity" or "rfid" or "noise", determined after message parsing
    timestamp DATETIME NOT NULL,
    payload JSON NOT NULL,
    meta JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_device_ts (device_id, timestamp),
    INDEX idx_device_type (device_type),
    INDEX idx_mod_id (mod_id),
    INDEX idx_sensor_type (sensor_type)
);
