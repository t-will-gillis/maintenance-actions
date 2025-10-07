#!/usr/bin/env node

/**
 * Entry point for "Add Update Label Weekly" workflow action
 * This script bridges between GitHub Actions composite action and the core logic
 */

const path = require('path');
const { Octokit } = require('@octokit/rest');
const { context } = require('@actions/github');

// Load utilities from shared folder
const logger = require('../shared/logger');

// Load staleness-specific config loader and logic
const loadStalenessConfig = require('../core/add-update-label-weekly/config');
const addLabelMain = require('../core/add-update-label-weekly/add-label');

async function run() {
  try {
    logger.info('Starting Add Update Label Weekly action');
    
    // Get paths
    const maintenanceActionsPath = path.join(process.cwd(), '.maintenance-actions');
    const projectRepoPath = path.join(process.cwd(), '.project-repo');
    
    // Initialize Octokit with token from environment
    const token = process.env.GITHUB_TOKEN;
    if (!token) {
      throw new Error('GITHUB_TOKEN environment variable is required');
    }
    
    const octokit = new Octokit({ auth: token });
    
    // Build GitHub API wrapper similar to actions/github-script
    const github = {
      rest: octokit.rest,
      request: octokit.request.bind(octokit),
      graphql: octokit.graphql.bind(octokit),
    };
    
    // Get configuration
    const configPath = process.env.CONFIG_PATH || '.github/maintenance-actions/add-update-label-config.yml';
    const overrides = {
      updatedByDays: process.env.OVERRIDE_UPDATED_BY_DAYS || undefined,
      commentByDays: process.env.OVERRIDE_COMMENT_BY_DAYS || undefined,
      inactiveUpdatedByDays: process.env.OVERRIDE_INACTIVE_UPDATED_BY_DAYS || undefined,
      targetStatus: process.env.OVERRIDE_TARGET_STATUS || undefined,
      labelStatusUpdated: process.env.OVERRIDE_LABEL_STATUS_UPDATED || undefined,
      labelStatusInactive1: process.env.OVERRIDE_LABEL_STATUS_INACTIVE1 || undefined,
      labelStatusInactive2: process.env.OVERRIDE_LABEL_STATUS_INACTIVE2 || undefined,
    };
    
    const config = loadConfig({
      projectRepoPath,
      configPath,
      overrides,
    });
    
    // Run the main logic
    await addLabelMain({
      g: github,
      c: context,
      config,
      projectRepoPath,
    });
    
    logger.info('Action completed successfully');
  } catch (error) {
    logger.error('Action failed:', error);
    process.exit(1);
  }
}

run();
