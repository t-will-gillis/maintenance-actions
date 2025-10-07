const loadConfig = require('../../shared/load-config');

/**
 * Loads and validates configuration specific to the staleness workflow
 * @param {Object} options
 * @param {string} options.projectRepoPath - Path to project repo
 * @param {string} options.configPath - Path to config file
 * @param {Object} options.overrides - Action input overrides
 * @returns {Object} Validated staleness configuration
 */
function loadStalenessConfig({ projectRepoPath, configPath, overrides = {} }) {
  // Define defaults specific to staleness workflow
  const defaults = {
    timeframes: {
      updatedByDays: 3,
      commentByDays: 7,
      inactiveUpdatedByDays: 14,
      upperLimitDays: 35,
    },
    
    projectBoard: {
      targetStatus: 'In progress (actively working)',
    },
    
    labels: {
      statusUpdated: 'Status: Updated',
      statusInactive1: 'Status: To Update',
      statusInactive2: 'Status: Inactive',
      exclude: ['Draft', 'ER', 'Epic', 'Dependency'],
    },
    
    bots: ['github-actions[bot]'],
    
    commentTemplate: defaultCommentTemplate(),
    
    labelDirectoryPath: '.github/label-directory.json',
    
    projectBoardIds: null,
  };
  
  // Transform flat overrides to nested structure
  const nestedOverrides = {
    timeframes: {
      updatedByDays: parseInt(overrides.updatedByDays) || undefined,
      commentByDays: parseInt(overrides.commentByDays) || undefined,
      inactiveUpdatedByDays: parseInt(overrides.inactiveUpdatedByDays) || undefined,
    },
    projectBoard: {
      targetStatus: overrides.targetStatus || undefined,
    },
    labels: {
      statusUpdated: overrides.labelStatusUpdated || undefined,
      statusInactive1: overrides.labelStatusInactive1 || undefined,
      statusInactive2: overrides.labelStatusInactive2 || undefined,
    },
  };
  
  // Load configuration using generic loader
  const config = loadConfig({
    projectRepoPath,
    configPath,
    overrides: nestedOverrides,
    defaults,
  });
  
  // Validate required fields for staleness workflow
  loadConfig.validateConfig(config, [
    'timeframes.updatedByDays',
    'timeframes.commentByDays',
    'timeframes.inactiveUpdatedByDays',
    'labels.statusUpdated',
    'labels.statusInactive1',
    'labels.statusInactive2',
  ]);
  
  return config;
}

function defaultCommentTemplate() {
  return `Hello \${assignees}! 👋

This issue has been labeled with **\${label}** because it hasn't been updated recently.

Your issue was last updated before **\${cutoffTime}**. Please provide an update by:
- Commenting on your progress
- Asking questions if you're blocked
- Updating the issue description

Thanks for being part of the team! 🙌`;
}

module.exports = loadStalenessConfig;
