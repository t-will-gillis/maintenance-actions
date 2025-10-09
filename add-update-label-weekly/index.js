/**
 * Entry point for "Add Update Label Weekly" workflow action
 * Called by actions/github-script with github and context already initialized
 */

const path = require('path');

// Load action-specific config loader and logic
const loadActionConfig = require('../core/add-update-label-weekly/config');
const actionMain = require('../core/add-update-label-weekly/add-label');

async function run({ github, context }) {
  try {
    console.log('Starting "Add Update Label Weekly" workflow');
    
    // Get paths from environment (set by action.yml)
    const projectRepoPath = process.env.PROJECT_REPO_PATH || path.join(process.cwd(), '../.project-repo');
    
    // Get configuration from environment variables
    const configPath = process.env.CONFIG_PATH || '.github/maintenance-actions/add-update-label-weekly-config.yml';
    const overrides = {
      updatedByDays: process.env.OVERRIDE_UPDATED_BY_DAYS || undefined,
      commentByDays: process.env.OVERRIDE_COMMENT_BY_DAYS || undefined,
      inactiveUpdatedByDays: process.env.OVERRIDE_INACTIVE_UPDATED_BY_DAYS || undefined,
      targetStatus: process.env.OVERRIDE_TARGET_STATUS || undefined,
      labelStatusUpdated: process.env.OVERRIDE_LABEL_STATUS_UPDATED || undefined,
      labelStatusInactive1: process.env.OVERRIDE_LABEL_STATUS_INACTIVE1 || undefined,
      labelStatusInactive2: process.env.OVERRIDE_LABEL_STATUS_INACTIVE2 || undefined,
    };
    
    const config = loadActionConfig({
      projectRepoPath,
      configPath,
      overrides,
    });
    
    // Run the main logic
    await actionMain({
      g: github,
      c: context,
      config,
      projectRepoPath,
    });
    
    console.log('Action completed successfully');
  } catch (error) {
    console.error('Action failed:', error);
    throw error; // Re-throw so github-script marks the action as failed
  }
}

module.exports = run;