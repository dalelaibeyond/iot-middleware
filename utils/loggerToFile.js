// utils/logger.js
const fs = require("fs");
const path = require("path");

const config = require('../config/config.json');

const logDir = path.join(__dirname, "..", config.logger.file.dir);
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir);
}

const logFile = path.join(logDir, config.logger.file.filename);

function formatDate() {
  return new Date().toISOString().replace("T", " ").split(".")[0];
}

function log(level, message) {
  // Skip logs below configured level
  const levels = { error: 0, warn: 1, info: 2, debug: 3 };
  if (levels[level] > levels[config.logger.level]) return;

  const formatted = config.logger.format
    .replace('{timestamp}', formatDate())
    .replace('{level}', level.toUpperCase())
    .replace('{message}', message);
  
  console.log(formatted);
  fs.appendFileSync(logFile, formatted + "\n");
}

module.exports = {
  info: (msg) => log("info", msg),
  warn: (msg) => log("warn", msg),
  error: (msg) => log("error", msg),
};

// Example usage:
// logger.info("This is an info message");
// logger.warn("This is a warning message");
// logger.error("This is an error message");