// utils/logger.js
const fs = require("fs");
const path = require("path");

const logDir = path.join(__dirname, "../logs");
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir);
}

const logFile = path.join(logDir, "app.log");

function formatDate() {
  return new Date().toISOString().replace("T", " ").split(".")[0];
}

function log(level, message) {
  const formatted = `[${formatDate()}] ${level.toUpperCase()} ${message}`;
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