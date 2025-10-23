const core = require('@actions/core');
const github = require('@actions/github');
const resolveConfigs = require('../shared/resolve-configs');
const resolveLabels = require('../shared/resolve-labels');
const addUpdateLabelWeekly = require('../core/REV-add-update-label-weekly');
const yaml = require('js-yaml');

/**
 * Main entry point for the Add Update Label Weekly action
 * Orchestrates configuration loading, label resolution, and workflow execution
 */
async function run() {
  try {
    console.log('='.repeat(60));
    console.log('Add Update Label Weekly - Starting');
    console.log('='.repeat(60));
    
    // Get action inputs
    const token = core.getInput('github-token', { required: true });
    const configPath = core.getInput('config-path') || '.github/maintenance-actions/add-update-label-config.yml';
    
    // Initialize GitHub client
    const octokit = github.getOctokit(token);
    const context = github.context;
    
    // Get project repository path
    const projectRepoPath = process.env.GITHUB_WORKSPACE;
    if (!projectRepoPath) {
      throw new Error('GITHUB_WORKSPACE environment variable not set');
    }
    
    // console.log(`Project repository: ${context.repo.owner}/${context.repo.repo}`);
    // console.log(`Working directory: ${projectRepoPath}`);
    // console.log('');
    
    // Define workflow-specific defaults
    const defaults = getDefaults();
    
    // Load and merge configuration
    console.log('--- Configuration Loading ---');
    const config = resolveConfigs.resolve({
      projectRepoPath,
      configPath,
      defaults,
      overrides: {}, // Can be populated from action inputs if needed
      requiredFields: [
        'timeframes.updatedByDays',
        'timeframes.commentByDays',
        'timeframes.inactiveByDays',
        'timeframes.upperLimitDays',
        'projectBoard.targetStatus',
        'commentTemplate',
      ],
    });
    console.log('');
    
    // Determine label directory path from config
    const labelDirectoryPath = config.labelDirectoryPath || '.github/maintenance-actions/label-directory.yml';
    
    // Resolve label keys to label names
    console.log('--- Label Resolution ---');
    const labels = await resolveLabels.resolve({
      projectRepoPath,
      labelDirectoryPath,
      requiredKeys: [
        'statusUpdated',
        'statusInactive1',
        'statusInactive2',
      ],
      optionalKeys: [
        'draft',
        'er',
        'epic',
        'dependency',
        'skillsIssueCompleted',
        'statusHelpWanted',
      ],
    });
    console.log('');
    
    // Execute the workflow
    console.log('--- Workflow Execution ---');
    console.log('Starting issue staleness check...');
    console.log('');
    
    await addUpdateLabelWeekly({
      github: octokit,
      context,
      labels,
      config,
    });
    
    console.log('');
    console.log('='.repeat(60));
    console.log('Add Update Label Weekly - Completed Successfully');
    console.log('='.repeat(60));
    
  } catch (error) {
    console.error('');
    console.error('='.repeat(60));
    console.error('Add Update Label Weekly - Failed');
    console.error('='.repeat(60));
    console.error('Error details:', error.message);
    if (error.stack) {
      console.error('Stack trace:', error.stack);
    }
    core.setFailed(`Action failed: ${error.message}`);
  }
}

/**
 * Returns default values for "Add Update Label Weekly" workflow if not specified in config
 * @returns {Object}    - Default configuration
 */
function getDefaults() {
  return {
    timeframes: {
      updatedByDays: 3,      // Issues updated within this many days are considered current
      commentByDays: 7,      // Issues not updated for this many days are prompted for an update
      inactiveByDays: 14,    // Issues not updated for this many days are marked as inactive
      upperLimitDays: 35,    // Bot comments older than this are not checked (to reduce API calls)
    },
    
    projectBoard: {
      targetStatus: 'In progress (actively working)', 
    },
    
    labels: {
      ignored: [
        'draft',
        'er',
        'epic',
        'dependency',
        'skillsIssueCompleted',
        'complexity0'
      ],
    },
    
    bots: [
      'github-actions[bot]',
      'HackforLABot',
    ],
    
    timezone: 'America/Los_Angeles',
    
    commentTemplate: getDefaultCommentTemplate(),
    
    labelDirectoryPath: '.github/maintenance-actions/label-directory.yml',
  };
}

/**
 * Returns the default comment template
 * @returns {string} Comment template with placeholders
 */
function getDefaultCommentTemplate() {
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

// Run the action
run();