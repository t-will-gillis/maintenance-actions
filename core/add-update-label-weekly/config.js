const loadConfig = require('../../shared/load-config');

/**
 * Loads and validates configuration specific to the staleness workflow
 * @param {Object} options
 * @param {string} options.projectRepoPath - Path to project repo
 * @param {string} options.configPath - Path to config file
 * @param {Object} options.overrides - Action input overrides
 * @returns {Object} Validated staleness configuration
 */
function loadActionConfig({ projectRepoPath, configPath, overrides = {} }) {
  // Define defaults specific to workflow
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
      inactiveByDays: parseInt(overrides.inactiveByDays) || undefined,
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
  
  // Validate required fields for workflow
  loadConfig.validateConfig(config, [
    'timeframes.updatedByDays',
    'timeframes.commentByDays',
    'timeframes.inactiveByDays',
    'labels.statusUpdated',
    'labels.statusInactive1',
    'labels.statusInactive2',
  ]);
  
  return config;
}

// Default comment template if none is provided in config
function defaultCommentTemplate() {
  return `Hello \${assignees}!
  
  Please add an update comment using the below template (even if you have a pull request). Afterwards, remove the \`\${label}\` label and add the \`\${statusUpdated}\` label.

  1. Progress: "What is the current status of your issue? What have you completed and what is left to do?"
  2. Blockers: "Explain any difficulties or errors encountered."
  3. Availability: "How much time will you have this week to work on this issue?"
  4. ETA: "When do you expect this issue to be completed?"
  5. Pictures (optional): "Add any pictures of the visual changes made to the site so far."

  If you need help, be sure to either: 1) place your issue in the "Questions/ In Review" status column of the Project Board and ask for help at your next meeting; 2) put a \`\${statusHelpWanted}\` label on your issue and pull request; or 3) put up a request for assistance on the #hfla-site channel. Please note that including your questions in the issue comments- along with screenshots, if applicable- will help us to help you. [Here](https://github.com/hackforla/website/issues/1619#issuecomment-897315561) and [here](https://github.com/hackforla/website/issues/1908#issuecomment-877908152) are examples of well-formed questions.

  <sub>You are receiving this comment because your last comment was before \${cutoffTime}.</sub>
  
  Thanks for being part of the HfLA!`;
}
module.exports = loadActionConfig;
