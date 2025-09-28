function info(msg, ...args) {
  console.log(`[INFO] ${new Date().toISOString()} - ${msg}`, ...args);
}

function error(msg, ...args) {
  console.error(`[ERROR] ${new Date().toISOString()} - ${msg}`, ...args);
}

function warn(msg, ...args) {
  console.warn(`[WARN] ${new Date().toISOString()} - ${msg}`, ...args); 
}

function debug(msg, ...args) {
  if (process.env.DEBUG) {
    console.log(`[DEBUG] ${new Date().toISOString()} - ${msg}`, ...args);
  }
}

module.exports = { info, warn, error, debug };
