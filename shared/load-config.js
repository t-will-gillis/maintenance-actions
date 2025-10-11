const fs = require('fs');
const path = require('path');
// const yaml = require('js-yaml');

/**
 * Generic configuration loader for all maintenance actions
 * Loads configuration from project's config file and merges with overrides
 * 
 * @param {Object} options
 * @param {string} options.projectRepoPath - Path to checked out project repo
 * @param {string} options.configPath - Relative path to config file in project
 * @param {Object} options.overrides - Optional overrides from action inputs
 * @param {Object} options.defaults - Default values for this action
 * @returns {Object} Merged configuration object
 */
function loadConfig({ projectRepoPath, configPath, overrides = {}, defaults = {} }) {
  const fullConfigPath = path.join(projectRepoPath, configPath);
  
  let fileConfig = {};
  
  // Try to load config file if it exists
  if (fs.existsSync(fullConfigPath)) {
    const configContent = fs.readFileSync(fullConfigPath, 'utf8');
    
    // Support both YAML and JSON
    if (configPath.endsWith('.yml') || configPath.endsWith('.yaml')) {
      fileConfig = yaml.load(configContent);
      console.log('this is a yaml. needs something to read it');
    } else if (configPath.endsWith('.json')) {
      fileConfig = JSON.parse(configContent);
    } else {
      throw new Error(`Unsupported config file format: ${configPath}. Use .yml, .yaml, or .json`);
    }
    
    console.log(`[Config] Loaded from: ${configPath}`);
  } else {
    console.log(`[Config] No file found at ${configPath}, using defaults and overrides`);
  }
  
  // Merge priority: overrides > fileConfig > defaults
  const finalConfig = deepMerge(defaults, fileConfig, overrides);
  
  // Add metadata
  finalConfig._meta = {
    projectRepoPath,
    configPath,
    loadedFromFile: fs.existsSync(fullConfigPath),
  };
  
  console.log('[Config] Final configuration:', JSON.stringify(finalConfig, null, 2));
  return finalConfig;
}

/**
 * Deep merge objects (overrides take precedence)
 * @param {...Object} objects - Objects to merge
 * @returns {Object} Merged object
 */
function deepMerge(...objects) {
  const result = {};
  
  for (const obj of objects) {
    for (const key in obj) {
      if (obj[key] === undefined || obj[key] === null || obj[key] === '') {
        continue; // Skip empty override values
      }
      
      if (typeof obj[key] === 'object' && !Array.isArray(obj[key]) && obj[key] !== null) {
        result[key] = deepMerge(result[key] || {}, obj[key]);
      } else {
        result[key] = obj[key];
      }
    }
  }
  
  return result;
}

/**
 * Validates that required config fields are present
 * @param {Object} config - Configuration object
 * @param {Array<string>} requiredFields - Array of required field paths (e.g., 'labels.statusUpdated')
 * @throws {Error} If required fields are missing
 */
function validateConfig(config, requiredFields = []) {
  const missing = [];
  
  for (const fieldPath of requiredFields) {
    const value = getNestedValue(config, fieldPath);
    if (value === undefined || value === null) {
      missing.push(fieldPath);
    }
  }
  
  if (missing.length > 0) {
    throw new Error(`Missing required configuration fields: ${missing.join(', ')}`);
  }
}

/**
 * Get nested object value by path string
 * @param {Object} obj - Object to traverse
 * @param {string} path - Dot-separated path (e.g., 'labels.statusUpdated')
 * @returns {*} Value at path or undefined
 */
function getNestedValue(obj, path) {
  return path.split('.').reduce((current, key) => current?.[key], obj);
}

module.exports = loadConfig;
module.exports.validateConfig = validateConfig;
module.exports.deepMerge = deepMerge;
