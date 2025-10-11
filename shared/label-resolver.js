const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

/**
 * Resolves label keys to actual label names from a project's label directory
 * @param {Object} options
 * @param {string} options.projectRepoPath - Path to the project repository
 * @param {string} options.labelDirectoryPath - Relative path to label-directory.yml
 * @param {Array<string>} options.requiredKeys - Label keys that must exist
 * @param {Array<string>} options.optionalKeys - Label keys that are optional
 * @returns {Object} Mapping of label keys to label names
 * @throws {Error} If label directory not found or required keys missing
 */
async function resolve({ 
  projectRepoPath, 
  labelDirectoryPath, 
  requiredKeys = [], 
  optionalKeys = [] 
}) {
  const fullPath = path.join(projectRepoPath, labelDirectoryPath);
  
  // Check if label directory exists
  if (!fs.existsSync(fullPath)) {
    throw new Error(
      `Label directory not found at: ${labelDirectoryPath}\n` +
      `Expected location: ${fullPath}\n` +
      `Please ensure your project has a label directory file.`
    );
  }
  
  // Load and parse YAML
  let labelDirectory;
  try {
    const fileContents = fs.readFileSync(fullPath, 'utf8');
    labelDirectory = yaml.load(fileContents);
    
    if (!labelDirectory || typeof labelDirectory !== 'object') {
      throw new Error('Label directory file is empty or invalid');
    }
  } catch (error) {
    if (error.name === 'YAMLException') {
      throw new Error(
        `Failed to parse label directory YAML at ${labelDirectoryPath}: ${error.message}`
      );
    }
    throw error;
  }
  
  console.log(`Loaded label directory from: ${labelDirectoryPath}`);
  console.log(`Available label keys: ${Object.keys(labelDirectory).join(', ')}`);
  
  // Validate required keys exist
  const missingKeys = requiredKeys.filter(key => !labelDirectory[key]);
  if (missingKeys.length > 0) {
    throw new Error(
      `Missing required label keys in ${labelDirectoryPath}: ${missingKeys.join(', ')}\n` +
      `Required keys: ${requiredKeys.join(', ')}\n` +
      `Found keys: ${Object.keys(labelDirectory).join(', ')}`
    );
  }
  
  // Build resolved labels object
  const resolvedLabels = {};
  const allKeys = [...requiredKeys, ...optionalKeys];
  
  allKeys.forEach(key => {
    if (labelDirectory[key]) {
      resolvedLabels[key] = labelDirectory[key];
      console.log(`  ${key} → "${labelDirectory[key]}"`);
    } else if (optionalKeys.includes(key)) {
      console.log(`  ${key} → (not defined, skipping)`);
    }
  });
  
  console.log(`Successfully resolved ${Object.keys(resolvedLabels).length} labels`);
  return resolvedLabels;
}

module.exports = { resolve };