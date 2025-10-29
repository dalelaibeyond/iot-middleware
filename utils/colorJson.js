/**
 * Utility function to colorize JSON output for console display
 * @param {Object} obj - Object to colorize
 * @param {number} indent - Current indentation level
 * @returns {string} Colorized JSON string
 */
function colorJson(obj, indent = 0) {
  const spaces = '  '.repeat(indent);
  const nextSpaces = '  '.repeat(indent + 1);
  const reset = '\x1b[0m';
  const green = '\x1b[32m';
  const white = '\x1b[37m';
  
  if (obj === null) {
    return 'null';
  }
  
  if (typeof obj !== 'object') {
    // Color primitive values (strings, numbers, booleans) in green
    const value = typeof obj === 'string' ? `"${obj}"` : String(obj);
    return green + value + reset;
  }
  
  if (Array.isArray(obj)) {
    if (obj.length === 0) return '[]';
    
    // Check if this is an array of objects and we should format it in a compact way
    if (obj.length > 0 && typeof obj[0] === 'object' && !Array.isArray(obj[0])) {
      // Get all unique keys from all objects to determine column widths
      const allKeys = new Set();
      obj.forEach(item => {
        if (typeof item === 'object' && item !== null) {
          Object.keys(item).forEach(key => allKeys.add(key));
        }
      });
      
      const keysArray = Array.from(allKeys);
      const keyWidths = {};
      
      // Calculate maximum width for each key
      keysArray.forEach(key => {
        keyWidths[key] = key.length;
        obj.forEach(item => {
          if (item && item.hasOwnProperty(key)) {
            const valueStr = typeof item[key] === 'string' ? `"${item[key]}"` : String(item[key]);
            keyWidths[key] = Math.max(keyWidths[key], valueStr.length);
          }
        });
      });
      
      // Format as aligned objects
      let result = '[\n';
      obj.forEach((item, index) => {
        if (typeof item === 'object' && item !== null) {
          result += nextSpaces + '{ ';
          
          const itemKeys = Object.keys(item);
          itemKeys.forEach((key, keyIndex) => {
            const valueStr = typeof item[key] === 'string' ? `"${item[key]}"` : String(item[key]);
            const padding = ' '.repeat(keyWidths[key] - valueStr.length);
            
            result += white + key + reset + ': ' + green + valueStr + reset + padding;
            
            if (keyIndex < itemKeys.length - 1) {
              result += ', ';
            }
          });
          
          result += ' }';
        } else {
          result += nextSpaces + colorJson(item, 0);
        }
        
        if (index < obj.length - 1) result += ',';
        result += '\n';
      });
      result += spaces + ']';
      return result;
    }
    
    // Regular array formatting
    let result = '[\n';
    obj.forEach((item, index) => {
      result += nextSpaces + colorJson(item, indent + 1);
      if (index < obj.length - 1) result += ',';
      result += '\n';
    });
    result += spaces + ']';
    return result;
  }
  
  const keys = Object.keys(obj);
  if (keys.length === 0) return '{}';
  
  let result = '{\n';
  keys.forEach((key, index) => {
    // Color keys in white
    result += nextSpaces + white + key + reset + ': ' + colorJson(obj[key], indent + 1);
    if (index < keys.length - 1) result += ',';
    result += '\n';
  });
  result += spaces + '}';
  return result;
}

module.exports = { colorJson };