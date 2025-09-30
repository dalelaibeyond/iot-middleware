# Changelog

## 2025-09-30 - Bug Fixes and Code Cleanup

### Fixed Issues

#### 1. MQTT Message Processing Not Working
- **Issue**: Messages published to MQTT topics were not being stored or retrievable via API
- **Root Cause**: 
  - Wrong method name: `messageProcessor.processMessage()` instead of `messageProcessor.process()`
  - MQTT wildcard subscriptions not matching incoming messages
- **Fix**: 
  - Changed method call to `messageProcessor.process()` in `Application.js`
  - Added `topicMatches()` method to `MQTTClient.js` to properly handle MQTT wildcards (`+` and `#`)
  - Modified message handler to iterate through subscription patterns and match against incoming topics

#### 2. Database Connection Errors
- **Issue**: WriteBuffer trying to call non-existent methods on DatabaseManager
- **Root Cause**: DatabaseManager missing `saveBatch()` and `saveHistory()` methods
- **Fix**: 
  - Added `saveBatch()`, `saveHistory()`, and `getHistory()` methods to DatabaseManager
  - Added `toMySQLDateTime()` helper to convert ISO timestamps to MySQL DATETIME format
  - Disabled database in config.json to avoid connection errors when MySQL is not running

### Code Quality Improvements

#### Replaced console.log() with Proper Logging
Replaced all `console.log()` and `console.error()` statements with proper logger calls:

**Files Modified:**
1. `modules/storage/dataStore.js`
   - Removed debug console.log statements
   - Added `logger.debug()` for data storage events

2. `modules/mqtt/MQTTClient.js`
   - Replaced console.log with `logger.debug()` for message reception
   - Added warning when no handlers found for a topic

3. `modules/Application.js`
   - Replaced all console.log with `logger.debug()`
   - Improved log messages with structured data (deviceId, sensorType)

4. `modules/core/messageProcessor.js`
   - Replaced console.log with `logger.debug()`
   - Removed unnecessary middleware counting logs
   - Improved log message clarity

5. `routes/api.js`
   - Replaced console.error with `logger.error()`
   - Added logger import

6. `modules/normalizers/index.js`
   - Replaced console.error with `logger.error()`
   - Added logger import

### Benefits
- **Consistent Logging**: All logs now go through the centralized logger
- **Log Levels**: Proper use of debug, info, warn, and error levels
- **Structured Data**: Important data (deviceId, sensorType) included in log context
- **Production Ready**: Debug logs can be disabled via environment variables
- **Better Debugging**: Logger includes timestamps and log levels automatically

### Configuration Changes
- Set `database.enabled` to `false` in `config.json` (can be re-enabled when MySQL is available)

### Testing
After these changes, the system now:
1. ✅ Receives MQTT messages on wildcard topics (e.g., `sensors/#`)
2. ✅ Processes messages through the middleware pipeline
3. ✅ Normalizes data (converts `devId` → `deviceId`, etc.)
4. ✅ Stores data in memory (dataStore)
5. ✅ Serves data via API endpoints (`/api/latest`, `/api/latest/:deviceId`)
6. ✅ Logs properly using the logger utility
7. ✅ No database errors when MySQL is disabled
