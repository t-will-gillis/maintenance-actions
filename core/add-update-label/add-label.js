const path = require('path');
const fs = require('fs');

// Load utility functions from shared folder
const getTimeline = require('../../shared/get-timeline');
const findLinkedIssue = require('../../shared/find-linked-issue');
const minimizeIssueComment = require('../../shared/hide-issue-comment');
const logger = require('../../shared/logger');

// Global variables
var github;
var context;
var config;

/**
 * Main function with configuration passed in
 * @param {Object} params
 * @param {Object} params.g - GitHub object from actions/github-script
 * @param {Object} params.c - context object from actions/github-script  
 * @param {Object} params.config - Configuration object
 * @param {string} params.projectRepoPath - Path to project repo checkout
 */
async function main({ g, c, config: cfg, projectRepoPath }) {
  github = g;
  context = c;
  config = cfg;
  
  logger.info('Starting issue staleness check');
  logger.info(`Target status: ${config.projectBoard.targetStatus}`);
  logger.info(`Timeframes: ${JSON.stringify(config.timeframes)}`);
  
  // Calculate cutoff times
  const cutoffTimes = calculateCutoffTimes(config.timeframes);
  
  // Get label names (either from config or project's label directory)
  const labels = await getLabels(projectRepoPath);
  
  // Retrieve all issue numbers
  const issueNums = await getIssueNumsFromRepo(labels.exclude);
  logger.info(`Found ${issueNums.length} issues to check`);
  
  for await (let issueNum of issueNums) {
    const timeline = await getTimeline(issueNum, github, context);
    const assignees = await getAssignees(issueNum);
    
    if (assignees.length === 0) {
      logger.warn(`Issue #${issueNum}: No assignees, skipping`);
      continue;
    }
    
    const result = await analyzeTimeline(
      timeline, 
      issueNum, 
      assignees, 
      cutoffTimes,
      labels
    );
    
    await applyLabelsAndComments(issueNum, assignees, result, labels);
  }
  
  logger.info('Issue staleness check complete');
}

function calculateCutoffTimes(timeframes) {
  const now = new Date();
  
  return {
    updated: new Date(now - timeframes.updatedByDays * 24 * 60 * 60 * 1000),
    comment: new Date(now - timeframes.commentByDays * 24 * 60 * 60 * 1000 - 10 * 60 * 1000),
    inactive: new Date(now - timeframes.inactiveUpdatedByDays * 24 * 60 * 60 * 1000),
    upperLimit: new Date(now - timeframes.upperLimitDays * 24 * 60 * 60 * 1000 + 10 * 60 * 1000),
  };
}

async function getLabels(projectRepoPath) {
  // Try to load from project's label directory
  const labelDirPath = path.join(projectRepoPath, config.labelDirectoryPath);
  
  let labelMapping = {};
  if (fs.existsSync(labelDirPath)) {
    logger.info(`Loading labels from: ${config.labelDirectoryPath}`);
    const labelData = JSON.parse(fs.readFileSync(labelDirPath, 'utf8'));
    
    // Map keys to actual label names
    labelMapping = {
      statusUpdated: labelData.statusUpdated || config.labels.statusUpdated,
      statusInactive1: labelData.statusInactive1 || config.labels.statusInactive1,
      statusInactive2: labelData.statusInactive2 || config.labels.statusInactive2,
      exclude: config.labels.exclude,
    };
  } else {
    logger.info('No label directory found, using config values');
    labelMapping = {
      statusUpdated: config.labels.statusUpdated,
      statusInactive1: config.labels.statusInactive1,
      statusInactive2: config.labels.statusInactive2,
      exclude: config.labels.exclude,
    };
  }
  
  return labelMapping;
}

async function getIssueNumsFromRepo(excludeLabels) {
  let issueNums = [];
  let pageNum = 1;
  let result = [];
  
  while (true) {
    const issueData = await github.request('GET /repos/{owner}/{repo}/issues', {
      owner: context.repo.owner,
      repo: context.repo.repo,
      assignee: '*',
      per_page: 100,
      page: pageNum,
    });
    
    if (!issueData.data.length) break;
    
    result = result.concat(issueData.data);
    pageNum++;
  }
  
  for (let { number, labels, pull_request } of result) {
    if (!number) continue;
    if (pull_request != undefined) continue;
    
    const issueLabels = labels.map(l => l.name);
    if (issueLabels.some(label => excludeLabels.includes(label))) continue;
    
    // Check project board status if projectBoardIds is configured
    if (config.projectBoardIds) {
      const status = await queryIssueStatus(number);
      if (status !== config.projectBoard.targetStatus) continue;
    }
    
    issueNums.push(number);
  }
  
  return issueNums;
}

async function queryIssueStatus(issueNum) {
  // This would use GraphQL to query project board status
  // Simplified for now - in real implementation would use projectBoardIds from config
  logger.debug(`Would query project board status for issue #${issueNum}`);
  return config.projectBoard.targetStatus; // Placeholder
}

async function analyzeTimeline(timeline, issueNum, assignees, cutoffTimes, labels) {
  let lastAssignedTimestamp = null;
  let lastCommentTimestamp = null;
  let commentsToMinimize = [];
  
  for (let i = timeline.length - 1; i >= 0; i--) {
    let event = timeline[i];
    let eventType = event.event;
    
    // Check for open linked PR by assignee
    if (eventType === 'cross-referenced' && 
        isLinkedIssue(event, issueNum) && 
        event.source.issue.state === 'open' &&
        assignees.includes(event.actor.login)) {
      logger.info(`Issue #${issueNum}: Open PR by assignee, remove all labels`);
      return { action: 'remove-all', labels: '' };
    }
    
    let eventTimestamp = event.updated_at || event.created_at;
    
    // Track last comment by assignee
    if (!lastCommentTimestamp && 
        eventType === 'commented' && 
        assignees.includes(event.actor.login)) {
      lastCommentTimestamp = eventTimestamp;
    }
    
    // Track last assignment
    if (!lastAssignedTimestamp && 
        eventType === 'assigned' && 
        assignees.includes(event.assignee.login)) {
      lastAssignedTimestamp = eventTimestamp;
    }
    
    // Collect outdated bot comments to minimize
    if (isBotComment(event) &&
        new Date(event.created_at) >= cutoffTimes.upperLimit &&
        new Date(event.created_at) < cutoffTimes.comment) {
      logger.debug(`Comment ${event.node_id} will be minimized`);
      commentsToMinimize.push(event.node_id);
    }
  }
  
  // Minimize outdated comments
  await minimizeComments(commentsToMinimize);
  
  // Determine appropriate label based on activity
  const lastActivity = lastCommentTimestamp || lastAssignedTimestamp;
  
  if (!lastActivity) {
    logger.info(`Issue #${issueNum}: No activity found, mark inactive`);
    return { action: 'add', labels: labels.statusInactive2 };
  }
  
  const activityDate = new Date(lastActivity);
  
  if (activityDate >= cutoffTimes.updated) {
    logger.info(`Issue #${issueNum}: Recent activity, retain updated label`);
    return { action: 'retain-updated', labels: labels.statusUpdated };
  }
  
  if (activityDate >= cutoffTimes.comment) {
    logger.info(`Issue #${issueNum}: Activity within grace period, no labels`);
    return { action: 'remove-all', labels: '' };
  }
  
  if (activityDate >= cutoffTimes.inactive) {
    logger.info(`Issue #${issueNum}: Needs update`);
    return { action: 'add', labels: labels.statusInactive1 };
  }
  
  logger.info(`Issue #${issueNum}: Inactive`);
  return { action: 'add', labels: labels.statusInactive2 };
}

async function applyLabelsAndComments(issueNum, assignees, result, labels) {
  if (result.action === 'add' && result.labels === labels.statusInactive1) {
    await removeLabels(issueNum, labels.statusUpdated, labels.statusInactive2);
    await addLabels(issueNum, result.labels);
    await postComment(issueNum, assignees, result.labels);
  } else if (result.action === 'add' && result.labels === labels.statusInactive2) {
    await removeLabels(issueNum, labels.statusInactive1, labels.statusUpdated);
    await addLabels(issueNum, result.labels);
    await postComment(issueNum, assignees, result.labels);
  } else if (result.action === 'retain-updated') {
    await removeLabels(issueNum, labels.statusInactive1, labels.statusInactive2);
  } else if (result.action === 'remove-all') {
    await removeLabels(issueNum, labels.statusInactive1, labels.statusInactive2, labels.statusUpdated);
  }
}

async function removeLabels(issueNum, ...labels) {
  for (let label of labels) {
    try {
      await github.request('DELETE /repos/{owner}/{repo}/issues/{issue_number}/labels/{name}', {
        owner: context.repo.owner,
        repo: context.repo.repo,
        issue_number: issueNum,
        name: label,
      });
      logger.debug(`Removed '${label}' from issue #${issueNum}`);
    } catch (err) {
      if (err.status !== 404) {
        logger.error(`Failed to remove '${label}':`, err);
      }
    }
  }
}

async function addLabels(issueNum, ...labels) {
  try {
    await github.rest.issues.addLabels({
      owner: context.repo.owner,
      repo: context.repo.repo,
      issue_number: issueNum,
      labels: labels,
    });
    logger.debug(`Added '${labels}' to issue #${issueNum}`);
  } catch (err) {
    logger.error(`Failed to add labels:`, err);
  }
}

async function postComment(issueNum, assignees, labelString) {
  try {
    const assigneeString = assignees.map(a => `@${a}`).join(', ');
    const body = formatCommentTemplate(assigneeString, labelString);
    
    await github.rest.issues.createComment({
      owner: context.repo.owner,
      repo: context.repo.repo,
      issue_number: issueNum,
      body: body,
    });
    logger.debug(`Posted comment to issue #${issueNum}`);
  } catch (err) {
    logger.error(`Failed to post comment:`, err);
  }
}

function formatCommentTemplate(assignees, label) {
  const cutoffTime = new Date(Date.now() - config.timeframes.updatedByDays * 24 * 60 * 60 * 1000);
  const cutoffString = cutoffTime.toLocaleString('en-US', {
    dateStyle: 'full',
    timeStyle: 'short',
    timeZone: 'America/Los_Angeles',
  });
  
  return config.commentTemplate
    .replace('${assignees}', assignees)
    .replace('${label}', label)
    .replace('${cutoffTime}', cutoffString);
}

function isLinkedIssue(event, issueNum) {
  if (!event.source.pull_request) return false;
  return findLinkedIssue(event.source.issue.body) == issueNum;
}

function isBotComment(event) {
  const MARKER = '<!-- Skills Issue Activity Record -->';
  if (event.event !== 'commented') return false;
  if (event.body && event.body.includes(MARKER)) return false;
  return config.bots.includes(event.actor.login);
}

async function getAssignees(issueNum) {
  try {
    const result = await github.rest.issues.get({
      owner: context.repo.owner,
      repo: context.repo.repo,
      issue_number: issueNum,
    });
    return result.data.assignees.map(a => a.login);
  } catch (err) {
    logger.error(`Failed to get assignees:`, err);
    return [];
  }
}

async function minimizeComments(nodeIds) {
  for (const nodeId of nodeIds) {
    await new Promise(resolve => setTimeout(resolve, 1000));
    await minimizeIssueComment(github, nodeId);
  }
}

module.exports = main;
