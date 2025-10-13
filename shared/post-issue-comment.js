/**
 * Posts a comment to the specified issue
 * @param {Object} github - the octokit instance
 * @param {Object} context - the GitHub action context
 * @param {Number} issueNum - the issue number where the comment should be posted
 * @param {String} comment - the comment to be posted
 */
async function postIssueComment(github, context, issueNum, comment) {
    try {
        await github.rest.issues.createComment({
            owner: context.repo.owner,
            repo: context.repo.repo,
            issue_number: issueNum,
            body: comment,
        });
        console.log(` ✔️ Comment has been posted to issue #${issueNum}`);
        return true;
    } catch (err) {
        console.error(` 🛑 Failed to post comment to issue #${issueNum}. Please refer to the error below: \n `, err);
        throw new Error(err);
    }
}

module.exports = postIssueComment;