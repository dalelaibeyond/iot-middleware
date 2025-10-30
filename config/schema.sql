CREATE DATABASE IF NOT EXISTS iot_middleware;
USE iot_middleware;

CREATE TABLE IF NOT EXISTS sensor_data (
    id INT AUTO_INCREMENT PRIMARY KEY,
    device_id VARCHAR(32) NOT NULL,
    device_type CHAR(5) NOT NULL, -- "V5008" or "V6800" or "G6000".
    mod_number INT, -- U-Sensor Module identifier (1-5 for V5008, 1-24 for V6800)
    mod_id VARCHAR(32), -- U-Sensor Module ID
    sensor_type VARCHAR(32), -- Topic segment 2 (e.g., "OpeAck", "LabelState", "TemHum", "Noise")
    msg_Type VARCHAR(32) NOT NULL, -- "Rfid", "TemHum", "noise", "Door", "Heartbeat", "DeviceInfo" or "ModuleInfo", identify how to parse the message
    timestamp DATETIME NOT NULL, -- This stores the actual timestamp from the device/message
    payload JSON NOT NULL,
    meta JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, -- This is when the record was inserted into the database
    INDEX idx_device_ts (device_id, timestamp),
    INDEX idx_device_type (device_type),
    INDEX idx_mod_number (mod_number),
    INDEX idx_mod_id (mod_id),
    INDEX idx_sensor_type (sensor_type)
);
