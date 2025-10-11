CREATE DATABASE IF NOT EXISTS iot_middleware;
USE iot_middleware;

CREATE TABLE IF NOT EXISTS sensor_data (
    id INT AUTO_INCREMENT PRIMARY KEY,
    device_id VARCHAR(32) NOT NULL,
    device_type CHAR(5) NOT NULL, -- "V5008" or "V6800" or "G6000"
    sensor_add INT, -- when device type is "V5008", this value identifies a rack of sensors
    sensor_port INT, -- when device type is "V6800", this value identifies a rack of sensors
    sensor_id VARCHAR(32) NOT NULL, -- identifies a rack of sensors
    sensor_type VARCHAR(32) NOT NULL, -- "temperature" or "humidity" or "rfid" or "noise", determined after message parsing
    timestamp DATETIME NOT NULL,
    payload JSON NOT NULL,
    meta JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_device_ts (device_id, timestamp),
    INDEX idx_device_type (device_type),
    INDEX idx_sensor_id (sensor_id)
);
