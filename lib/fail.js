const {template} = require('lodash');
const debug = require('debug')('semantic-release:github');
const parseGithubUrl = require('./parse-github-url');
const {ISSUE_ID} = require('./definitions/constants');
const resolveConfig = require('./resolve-config');
const getClient = require('./get-client');
const findSRIssues = require('./find-sr-issues');
const getFailComment = require('./get-fail-comment');

module.exports = async (pluginConfig, context) => {
  const {
    options: {repositoryUrl},
    branch,
    errors,
    logger,
  } = context;
  const {githubToken, githubUrl, githubApiPathPrefix, proxy, failComment, failTitle, labels, assignees} = resolveConfig(
    pluginConfig,
    context
  );

  if (failComment === false || failTitle === false) {
    logger.log('Skip issue creation.');
  } else {
    const octokit = getClient({githubToken, githubUrl, githubApiPathPrefix, proxy});
    // In case the repo changed name, get the new `repo`/`owner` as the search API will not follow redirects
    const {data: repoData} = await octokit.request('GET /repos/{owner}/{repo}', parseGithubUrl(repositoryUrl));
    const [owner, repo] = repoData.full_name.split('/');
    const body = failComment ? template(failComment)({branch, errors}) : getFailComment(branch, errors);
    const [srIssue] = await findSRIssues(octokit, failTitle, owner, repo);

    if (srIssue) {
      logger.log('Found existing semantic-release issue #%d.', srIssue.number);
      const comment = {owner, repo, issue_number: srIssue.number, body};
      debug('create comment: %O', comment);
      const {
        data: {html_url: url},
      } = await octokit.request('POST /repos/{owner}/{repo}/issues/{issue_number}/comments', comment);
      logger.log('Added comment to issue #%d: %s.', srIssue.number, url);
    } else {
      const newIssue = {
        owner,
        repo,
        title: failTitle,
        body: `${body}\n\n${ISSUE_ID}`,
        labels: labels || [],
        assignees,
      };
      debug('create issue: %O', newIssue);
      const {
        data: {html_url: url, number},
      } = await octokit.request('POST /repos/{owner}/{repo}/issues', newIssue);
      logger.log('Created issue #%d: %s.', number, url);
    }
  }
};
