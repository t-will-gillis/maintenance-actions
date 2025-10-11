// Import modules
const fs = require('fs');
const config = require('./config');
const retrieveLabelDirectory = require('../../shared/retrieve-label-directory');
const queryIssueInfo = require('../../shared/query-issue-info');
const findLinkedIssue = require('../../shared/find-linked-issue');
const getTimeline = require('../../shared/get-timeline');
const minimizeIssueComment = require('../../shared/hide-issue-comment');

// Global variables
var github;
var context;

// Use labelKeys to map current labelNames from label directory
const [
  statusUpdated,
  statusInactive1,
  statusInactive2,
  ...excludeLabels
] = [
  config.labelKeys.statusUpdated,
  config.labelKeys.statusInactive1,
  config.labelKeys.statusInactive2,
  ...config.excludeLabelKeys,
].map(retrieveLabelDirectory);

// Calculate cutoff times based on config
const updatedByDays = config.timeframes.updatedByDays;
const commentByDays = config.timeframes.commentByDays;
const inactiveUpdatedByDays = config.timeframes.inactiveUpdatedByDays;
const upperLimitDays = config.timeframes.upperLimitDays;

const threeDayCutoffTime = new Date();
threeDayCutoffTime.setDate(threeDayCutoffTime.getDate() - updatedByDays);
const sevenDayCutoffTime = new Date();
sevenDayCutoffTime.setDate(sevenDayCutoffTime.getDate() - commentByDays);
sevenDayCutoffTime.setMinutes(sevenDayCutoffTime.getMinutes() - 10);
const fourteenDayCutoffTime = new Date();
fourteenDayCutoffTime.setDate(fourteenDayCutoffTime.getDate() - inactiveUpdatedByDays);
const upperLimitCutoffTime = new Date();
upperLimitCutoffTime.setDate(upperLimitCutoffTime.getDate() - upperLimitDays);
upperLimitCutoffTime.setMinutes(upperLimitCutoffTime.getMinutes() + 10);

/**
 * The main function, which retrieves issues from a specific column in a specific project, before examining
 * the timeline of each issue for outdatedness. An update to an issue is either 1.) a comment by the assignee,
 * or 2.) assigning an assignee to the issue. If the last update was not between 7 to 14 days ago, apply the
 * appropriate label and request an update. However, if the assignee has submitted a PR that will fix the issue
 * regardless of when, all update-related labels should be removed.
 * @param {Object} g                   - GitHub object from actions/github-script
 * @param {Object} c                   - context object from actions/github-script
 */
async function main({ g, c }) {
  github = g;
  context = c;

  // Retrieve all issue numbers from a repo
  const issueNums = await getIssueNumsFromRepo();

  for await (let issueNum of issueNums) {
    const timeline = await getTimeline(issueNum, github, context);
    const assignees = await getAssignees(issueNum);
    
    // Error catching 
    if (assignees.length === 0) {
      console.log(`Issue #${issueNum}: Assignee not found, skipping`);
      continue;
    }

    // Add and remove labels as well as post comment if the issue's timeline indicates the issue is inactive, to be updated or up-to-date accordingly
    const responseObject = await isTimelineOutdated(timeline, issueNum, assignees);

    if (responseObject.result === true && responseObject.labels === statusInactive1) {
      await removeLabels(issueNum, statusUpdated, statusInactive2);
      await addLabels(issueNum, responseObject.labels);
      await postComment(issueNum, assignees, statusInactive1);
    } else if (responseObject.result === true && responseObject.labels === statusInactive2) {
      await removeLabels(issueNum, statusInactive1, statusUpdated);
      await addLabels(issueNum, responseObject.labels);
      await postComment(issueNum, assignees, statusInactive2);
    } else if (responseObject.result === false && responseObject.labels === statusUpdated) {
      await removeLabels(issueNum, statusInactive1, statusInactive2);
    } else if (responseObject.result === false && responseObject.labels === '') {
      await removeLabels(issueNum, statusInactive1, statusInactive2, statusUpdated);
    }
  }
}

/**
 * Finds issue numbers for all open & assigned issues, excluding issues labeled with excluded labels,
 * and returning issue numbers only if their status matches the target status from config
 *
 * @returns {Promise<Array>} issueNums     - an array of open, assigned, and statused issue numbers
 */
async function getIssueNumsFromRepo() {
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
    
    if (!issueData.data.length) {
      break;
    } else {
      result = result.concat(issueData.data);
      pageNum++;
    }
  }
  
  for (let { number, labels, pull_request } of result) {
    if (!number) continue;

    // Exclude any pull requests that were found
    if (pull_request != undefined) continue;
  
    // Exclude any issues that have excluded labels
    const issueLabels = labels.map((label) => label.name);
    if (issueLabels.some((item) => excludeLabels.includes(item))) continue;

    // For remaining issues, check if status matches target status
    const { statusName } = await queryIssueInfo(github, context, number);
    if (statusName === config.projectBoard.targetStatus) {
      issueNums.push(number);
    }
  }
  return issueNums;
}

/**
 * Assesses whether the timeline is outdated.
 * @param {Array} timeline      - a list of events in the timeline of an issue, retrieved from the issues API
 * @param {Number} issueNum     - the issue's number
 * @param {String} assignees    - a list of the issue's assignee's username
 * @returns true if timeline indicates the issue is outdated/inactive, false if not; also returns appropriate labels that should be retained or added to the issue
 */
function isTimelineOutdated(timeline, issueNum, assignees) {
  let lastAssignedTimestamp = null;
  let lastCommentTimestamp = null;
  let commentsToBeMinimized = [];

  for (let i = timeline.length - 1; i >= 0; i--) {
    let eventObj = timeline[i];
    let eventType = eventObj.event;
    let isOpenLinkedPullRequest = eventType === 'cross-referenced' && isLinkedIssue(eventObj, issueNum) && eventObj.source.issue.state === 'open';

    if (isOpenLinkedPullRequest && assignees.includes(eventObj.actor.login)) {
      console.log(`Issue #${issueNum}: Assignee fixes/resolves/closes issue with an open pull request, remove all update-related labels`);
      return { result: false, labels: '' };
    }

    else if(
      eventType === 'cross-referenced' && 
      eventObj.source?.issue?.pull_request &&
      eventObj.source.issue.state === 'closed'
    ) {
      console.log(`Issue #${issueNum}: Linked pull request has been closed.`);
    }

    let eventTimestamp = eventObj.updated_at || eventObj.created_at;

    if (!lastCommentTimestamp && eventType === 'commented' && isCommentByAssignees(eventObj, assignees)) {
      lastCommentTimestamp = eventTimestamp;
    }

    else if (!lastAssignedTimestamp && eventType === 'assigned' && assignees.includes(eventObj.assignee.login)) {
      lastAssignedTimestamp = eventTimestamp;
    }

    if (isMomentRecent(eventObj.created_at, upperLimitCutoffTime) && !isMomentRecent(eventObj.created_at, sevenDayCutoffTime) && eventType === 'commented' && isCommentByBot(eventObj)) { 
      console.log(`Comment ${eventObj.node_id} is outdated (i.e. > 7 days old) and will be minimized.`);
      commentsToBeMinimized.push(eventObj.node_id);
    }
  }

  minimizeComments(commentsToBeMinimized);

  if (lastCommentTimestamp && isMomentRecent(lastCommentTimestamp, threeDayCutoffTime)) {
    console.log(`Issue #${issueNum}: Commented by assignee within ${updatedByDays} days, retain '${statusUpdated}' label`);
    return { result: false, labels: statusUpdated }
  }

  if (lastAssignedTimestamp && isMomentRecent(lastAssignedTimestamp, threeDayCutoffTime)) {
    console.log(`Issue #${issueNum}: Assigned to assignee within ${updatedByDays} days, no update-related labels should be used`);
    return { result: false, labels: '' }
  }

  if ((lastCommentTimestamp && isMomentRecent(lastCommentTimestamp, sevenDayCutoffTime)) || (lastAssignedTimestamp && isMomentRecent(lastAssignedTimestamp, sevenDayCutoffTime))) {
    if ((lastCommentTimestamp && isMomentRecent(lastCommentTimestamp, sevenDayCutoffTime))) {
      console.log(`Issue #${issueNum}: Commented by assignee between ${updatedByDays} and ${commentByDays} days, no update-related labels should be used; timestamp: ${lastCommentTimestamp}`)
    } else if (lastAssignedTimestamp && isMomentRecent(lastAssignedTimestamp, sevenDayCutoffTime)) {
      console.log(`Issue #${issueNum}: Assigned between ${updatedByDays} and ${commentByDays} days, no update-related labels should be used; timestamp: ${lastAssignedTimestamp}`)
    }
    return { result: false, labels: '' }
  }

  if ((lastCommentTimestamp && isMomentRecent(lastCommentTimestamp, fourteenDayCutoffTime)) || (lastAssignedTimestamp && isMomentRecent(lastAssignedTimestamp, fourteenDayCutoffTime))) {
    if ((lastCommentTimestamp && isMomentRecent(lastCommentTimestamp, fourteenDayCutoffTime))) {
      console.log(`Issue #${issueNum}: Commented by assignee between ${commentByDays} and ${inactiveUpdatedByDays} days, use '${statusInactive1}' label; timestamp: ${lastCommentTimestamp}`)
    } else if (lastAssignedTimestamp && isMomentRecent(lastAssignedTimestamp, fourteenDayCutoffTime)) {
      console.log(`Issue #${issueNum}: Assigned between ${commentByDays} and ${inactiveUpdatedByDays} days, use '${statusInactive1}' label; timestamp: ${lastAssignedTimestamp}`)
    }
    return { result: true, labels: statusInactive1 }
  }

  console.log(`Issue #${issueNum}: No update within ${inactiveUpdatedByDays} days, use '${statusInactive2}' label`)
  return { result: true, labels: statusInactive2 }
}

/**
 * Removes labels from a specified issue
 * @param {Number} issueNum    - an issue's number
 * @param {Array} labels       - an array containing the labels to remove (captures the rest of the parameters)
 */
async function removeLabels(issueNum, ...labels) {
  for (let label of labels) {
    try {
      await github.request('DELETE /repos/{owner}/{repo}/issues/{issue_number}/labels/{name}', {
        owner: context.repo.owner,
        repo: context.repo.repo,
        issue_number: issueNum,
        name: label,
      });
      console.log(` '${label}' label has been removed`);
    } catch (err) {
      if (err.status === 404) {
        console.log(` '${label}' label not found, no need to remove`);
      } else {
        console.error(`Function failed to remove labels. Please refer to the error below: \n `, err);
      }
    }
  }
}

/**
 * Adds labels to a specified issue
 * @param {Number} issueNum   -an issue's number
 * @param {Array} labels      -an array containing the labels to add (captures the rest of the parameters)
 */
async function addLabels(issueNum, ...labels) {
  try {
    await github.rest.issues.addLabels({
      owner: context.repo.owner,
      repo: context.repo.repo,
      issue_number: issueNum,
      labels: labels,
    });
    console.log(` '${labels}' label has been added`);
  } catch (err) {
    console.error(`Function failed to add labels. Please refer to the error below: \n `, err);
  }
}

async function postComment(issueNum, assignees, labelString) {
  try {
    const assigneeString = createAssigneeString(assignees);
    const instructions = formatComment(assigneeString, labelString);
    await github.rest.issues.createComment({
      owner: context.repo.owner,
      repo: context.repo.repo,
      issue_number: issueNum,
      body: instructions,
    });
  } catch (err) {
    console.error(`Function failed to post comments. Please refer to the error below: \n `, err);
  }
}

/***********************
*** HELPER FUNCTIONS ***
***********************/
function isMomentRecent(dateString, cutoffTime) {
  const dateStringObj = new Date(dateString);
  if (dateStringObj >= cutoffTime) {
    return true;
  } else {
    return false;
  }
}

function isLinkedIssue(data, issueNum) {
  if (!data.source.pull_request) return false;
  return findLinkedIssue(data.source.issue.body) == issueNum
}

function isCommentByAssignees(data, assignees) {
  return assignees.includes(data.actor.login);
}

async function getAssignees(issueNum) {
  try {
    const results = await github.rest.issues.get({
      owner: context.repo.owner,
      repo: context.repo.repo,
      issue_number: issueNum,
    });
    const assigneesData = results.data.assignees;
    const assigneesLogins = filterForAssigneesLogins(assigneesData);
    return assigneesLogins;
  } catch (err) {
    console.error(`Function failed to get assignees. Please refer to the error below: \n `, err);
    return null;
  }
}

function filterForAssigneesLogins(data) {
  const logins = [];
  for (let item of data) {
    logins.push(item.login);
  }
  return logins;
}

function createAssigneeString(assignees) {
  const assigneeString = [];
  for (let assignee of assignees) {
    assigneeString.push(`@${assignee}`);
  }
  return assigneeString.join(', ');
}

function formatComment(assignees, labelString) {
  const path = config.paths.commentTemplate;
  const text = fs.readFileSync(path).toString('utf-8');
  const options = {
    dateStyle: 'full',
    timeStyle: 'short',
    timeZone: 'America/Los_Angeles',
  };
  const cutoffTimeString = threeDayCutoffTime.toLocaleString('en-US', options);
  let completedInstuctions = text.replace('${assignees}', assignees).replace('${cutoffTime}', cutoffTimeString).replace('${label}', labelString);
  return completedInstuctions;
}

function isCommentByBot(data) {
  const MARKER = '<!-- Skills Issue Activity Record -->'; 
  if (data.body.includes(MARKER)) {
    console.log(`Found "Skills Issue Activity Record" - do not minimize`);
    return false; 
  }
  return config.botUsernames.includes(data.actor.login);
}

async function minimizeComments(comment_node_ids) {
  for (const node_id of comment_node_ids) {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    await minimizeIssueComment(github, node_id);
  }
}

module.exports = main;
