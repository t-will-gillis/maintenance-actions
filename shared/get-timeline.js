/**
 * Function that returns the timeline of an issue
 * @param {Object} github                 - github object from actions/github-script
 * @param {Object} context                - context object from actions/github-script
 * @param {Number} issueNum               - the issue number
 * @returns {Array<Object>} timelineArray - an array containing the timeline of issue events
 */
async function getTimeline(github, context, issueNum) {

  let timelineArray = [];
  let page = 1;
  
  while (true) {
    try {
      // Equiv: https://docs.github.com/en/rest/issues/timeline?apiVersion=2022-11-28#list-timeline-events-for-an-issue
      // github.request('GET /repos/{owner}/{repo}/issues/{issue_number}/timeline', { })
      const results = await github.rest.issues.listEventsForTimeline({
        owner: context.repo.owner,
        repo: context.repo.repo,
        issue_number: issueNum,
        per_page: 100,
        page: page,
      });

      // If the API call returns an empty array, break out of loop- there is no additional data.
      // Else if data is returned, push it to `timelineArray` and increase the page number (`page`)
      if (!results.data.length) {
        break;
      } else {
        timelineArray.push(...results.data);
        page++;
      }
    } catch (err) {
      console.error(`Error fetching issue timeline (page ${page}):`, err);
      break;
    }
  }

  return timelineArray;
}

module.exports = getTimeline;
