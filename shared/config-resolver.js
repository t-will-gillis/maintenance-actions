const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

/**
 * Resolves configuration by merging defaults, project config, and overrides
 * @param {Object} options
 * @param {string} options.projectRepoPath - Path to the project repository
 * @param {string} options.configPath - Relative path to config file
 * @param {Object} options.defaults - Default configuration values
 * @param {Object} options.overrides - Runtime overrides (from action inputs)
 * @param {Array<string>} options.requiredFields - Dot-notation paths that must exist
 * @returns {Object} Merged and validated configuration
 * @throws {Error} If validation fails
 */
function resolve({ 
  projectRepoPath, 
  configPath, 
  defaults = {}, 
  overrides = {}, 
  requiredFields = [] 
}) {
  const fullPath = path.join(projectRepoPath, configPath);
  
  let projectConfig = {};
  
  // Load project config if it exists
  if (fs.existsSync(fullPath)) {
    try {
      const fileContents = fs.readFileSync(fullPath, 'utf8');
      projectConfig = yaml.load(fileContents) || {};
      console.log(`Loaded configuration from: ${configPath}`);
    } catch (error) {
      if (error.name === 'YAMLException') {
        throw new Error(
          `Failed to parse configuration YAML at ${configPath}: ${error.message}`
        );
      }
      throw error;
    }
  } else {
    console.log(`Configuration file not found at ${configPath}, using defaults only`);
  }
  
  // Deep merge: defaults < projectConfig < overrides
  const config = deepMerge(defaults, projectConfig, overrides);
  
  // Log the final configuration (excluding sensitive data)
  console.log('Final configuration:');
  console.log(JSON.stringify(sanitizeForLogging(config), null, 2));
  
  // Validate required fields
  validateRequiredFields(config, requiredFields);
  
  return config;
}

/**
 * Deep merges multiple objects, with later objects overriding earlier ones
 * @param {...Object} objects - Objects to merge
 * @returns {Object} Merged object
 */
function deepMerge(...objects) {
  const result = {};
  
  for (const obj of objects) {
    if (!obj) continue;
    
    for (const key in obj) {
      if (!obj.hasOwnProperty(key)) continue;
      
      const value = obj[key];
      
      // If value is an object (but not array or null), recurse
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        result[key] = deepMerge(result[key] || {}, value);
      } 
      // For arrays and primitives, override completely
      else if (value !== undefined) {
        result[key] = value;
      }
    }
  }
  
  return result;
}

/**
 * Validates that required fields exist in the config
 * @param {Object} config - Configuration object to validate
 * @param {Array<string>} requiredFields - Array of dot-notation field paths
 * @throws {Error} If any required fields are missing
 */
function validateRequiredFields(config, requiredFields) {
  const missing = [];
  
  for (const field of requiredFields) {
    const keys = field.split('.');
    let value = config;
    
    // Navigate through nested structure
    for (const key of keys) {
      if (value === null || value === undefined) {
        value = undefined;
        break;
      }
      value = value[key];
    }
    
    // Check if value exists and is not empty
    if (value === undefined || value === null || value === '') {
      missing.push(field);
    }
  }
  
  if (missing.length > 0) {
    throw new Error(
      `Configuration validation failed. Missing required fields:\n` +
      `  ${missing.join('\n  ')}\n` +
      `Please ensure your configuration file includes these fields.`
    );
  }
  
  console.log(`✓ Configuration validation passed (${requiredFields.length} required fields checked)`);
}

/**
 * Removes sensitive data from config for logging
 * @param {Object} config - Configuration object
 * @returns {Object} Sanitized config
 */
function sanitizeForLogging(config) {
  const sanitized = JSON.parse(JSON.stringify(config));
  
  // Remove or redact sensitive fields
  const sensitiveKeys = ['token', 'password', 'secret', 'key'];
  
  function redactSensitive(obj) {
    for (const key in obj) {
      if (typeof obj[key] === 'object' && obj[key] !== null) {
        redactSensitive(obj[key]);
      } else if (sensitiveKeys.some(sensitive => key.toLowerCase().includes(sensitive))) {
        obj[key] = '[REDACTED]';
      }
    }
  }
  
  redactSensitive(sanitized);
  return sanitized;
}

module.exports = { resolve, deepMerge, validateRequiredFields };