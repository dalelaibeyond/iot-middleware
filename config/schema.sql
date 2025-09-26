CREATE DATABASE IF NOT EXISTS iot_middleware;
USE iot_middleware;

CREATE TABLE IF NOT EXISTS sensor_data (
    id INT AUTO_INCREMENT PRIMARY KEY,
    device_id VARCHAR(64) NOT NULL,
    sensor_type VARCHAR(32) NOT NULL,
    timestamp DATETIME NOT NULL,
    payload JSON NOT NULL,
    meta JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_device_ts (device_id, timestamp)
);
