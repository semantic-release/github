const {uniqBy, template} = require('lodash');
const parseGithubUrl = require('parse-github-url');
const pReduce = require('p-reduce');
const AggregateError = require('aggregate-error');
const issueParser = require('issue-parser')('github');
const debug = require('debug')('semantic-release:github');
const resolveConfig = require('./resolve-config');
const getClient = require('./get-client');
const getSuccessComment = require('./get-success-comment');
const findSRIssues = require('./find-sr-issues');

module.exports = async (
  pluginConfig,
  {options: {branch, repositoryUrl}, lastRelease, commits, nextRelease, releases, logger}
) => {
  const {githubToken, githubUrl, githubApiPathPrefix, successComment, failTitle} = resolveConfig(pluginConfig);
  const {name: repo, owner} = parseGithubUrl(repositoryUrl);
  const github = getClient(githubToken, githubUrl, githubApiPathPrefix);
  const releaseInfos = releases.filter(release => Boolean(release.name));

  // Search for PRs associated with any commit in the release
  const {data: {items: prs}} = await github.search.issues({
    q: `${commits.map(commit => commit.hash).join('+')}+repo:${owner}/${repo}+type:pr`,
  });

  debug('found pull requests: %O', prs.map(pr => pr.number));

  // Parse the release commits message and PRs body to find resolved issues/PRs via comment keyworkds
  const issues = uniqBy(
    [...prs.map(pr => pr.body), ...commits.map(commit => commit.message)]
      .reduce((issues, message) => {
        return message
          ? issues.concat(issueParser(message).actions.map(action => ({number: parseInt(action.issue, 10)})))
          : issues;
      }, [])
      .filter(issue => !prs.find(pr => pr.number === issue.number)),
    'number'
  );

  debug('found issues via comments: %O', issues);

  const errors = [];

  // Make requests serially to avoid hitting the rate limit (https://developer.github.com/v3/guides/best-practices-for-integrators/#dealing-with-abuse-rate-limits)
  await pReduce([...prs, ...issues], async (_, issue) => {
    const body = successComment
      ? template(successComment)({branch, lastRelease, commits, nextRelease, releases, issue})
      : getSuccessComment(issue, releaseInfos, nextRelease);
    try {
      const comment = {owner, repo, number: issue.number, body};
      debug('create comment: %O', comment);
      const {data: {html_url: url}} = await github.issues.createComment(comment);
      logger.log('Added comment to issue #%d: %s', issue.number, url);
    } catch (err) {
      errors.push(err);
      logger.error('Failed to add a comment to the issue #%d.', issue.number);
      // Don't throw right away and continue to update other issues
    }
  });

  const srIssues = await findSRIssues(github, failTitle, owner, repo);

  debug('found semantic-release issues: %O', srIssues);

  await pReduce(srIssues, async (_, issue) => {
    debug('close issue: %O', issue);
    try {
      const updateIssue = {owner, repo, number: issue.number, state: 'closed'};
      debug('closing issue: %O', updateIssue);
      const {data: {html_url: url}} = await github.issues.edit(updateIssue);
      logger.log('Closed issue #%d: %s.', issue.number, url);
    } catch (err) {
      errors.push(err);
      logger.error('Failed to close the issue #%d.', issue.number);
      // Don't throw right away and continue to close other issues
    }
  });

  if (errors.length > 0) {
    throw new AggregateError(errors);
  }
};
