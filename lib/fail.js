const {template} = require('lodash');
const parseGithubUrl = require('parse-github-url');
const debug = require('debug')('semantic-release:github');
const ISSUE_ID = require('./definitions/sr-issue-id');
const resolveConfig = require('./resolve-config');
const getClient = require('./get-client');
const findSRIssues = require('./find-sr-issues');
const getFailComment = require('./get-fail-comment');

module.exports = async (pluginConfig, {options: {branch, repositoryUrl}, errors, logger}) => {
  const {githubToken, githubUrl, githubApiPathPrefix, proxy, failComment, failTitle, labels, assignees} = resolveConfig(
    pluginConfig
  );
  const {name: repo, owner} = parseGithubUrl(repositoryUrl);
  const github = getClient({githubToken, githubUrl, githubApiPathPrefix, proxy});
  const body = failComment ? template(failComment)({branch, errors}) : getFailComment(branch, errors);
  const [srIssue] = await findSRIssues(github, failTitle, owner, repo);

  if (srIssue) {
    logger.log('Found existing semantic-release issue #%d.', srIssue.number);
    const comment = {owner, repo, number: srIssue.number, body};
    debug('create comment: %O', comment);
    const {
      data: {html_url: url},
    } = await github.issues.createComment(comment);
    logger.log('Added comment to issue #%d: %s.', srIssue.number, url);
  } else {
    const newIssue = {owner, repo, title: failTitle, body: `${body}\n\n${ISSUE_ID}`, labels, assignees};
    debug('create issue: %O', newIssue);
    const {
      data: {html_url: url, number},
    } = await github.issues.create(newIssue);
    logger.log('Created issue #%d: %s.', number, url);
  }
};
