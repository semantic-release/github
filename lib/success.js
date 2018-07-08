const {isUndefined, uniqBy, template, flatten} = require('lodash');
const parseGithubUrl = require('parse-github-url');
const pFilter = require('p-filter');
const AggregateError = require('aggregate-error');
const issueParser = require('issue-parser');
const debug = require('debug')('semantic-release:github');
const resolveConfig = require('./resolve-config');
const getClient = require('./get-client');
const getSearchQueries = require('./get-search-queries');
const getSuccessComment = require('./get-success-comment');
const findSRIssues = require('./find-sr-issues');

module.exports = async (
  pluginConfig,
  {options: {branch, repositoryUrl}, lastRelease, commits, nextRelease, releases, logger}
) => {
  const {githubToken, githubUrl, githubApiPathPrefix, proxy, successComment, failTitle} = resolveConfig(pluginConfig);
  const {name: repo, owner} = parseGithubUrl(repositoryUrl);
  const github = getClient({githubToken, githubUrl, githubApiPathPrefix, proxy});
  const parser = issueParser('github', githubUrl ? {hosts: [githubUrl]} : {});
  const releaseInfos = releases.filter(release => Boolean(release.name));
  const shas = commits.map(commit => commit.hash);
  const treeShas = commits.map(commit => commit.tree.long);

  const searchQueries = getSearchQueries(`repo:${owner}/${repo}+type:pr+is:merged`, shas).map(
    async q => (await github.search.issues({q})).data.items
  );

  const prs = await pFilter(uniqBy(flatten(await Promise.all(searchQueries)), 'number'), async ({number}) =>
    (await github.pullRequests.getCommits({owner, repo, number})).data.find(
      ({sha, commit}) => shas.includes(sha) || treeShas.includes(commit.tree.sha)
    )
  );

  debug('found pull requests: %O', prs.map(pr => pr.number));

  // Parse the release commits message and PRs body to find resolved issues/PRs via comment keyworkds
  const issues = [...prs.map(pr => pr.body), ...commits.map(commit => commit.message)].reduce((issues, message) => {
    return message
      ? issues.concat(
          parser(message)
            .actions.filter(action => isUndefined(action.slug) || action.slug === `${owner}/${repo}`)
            .map(action => ({number: parseInt(action.issue, 10)}))
        )
      : issues;
  }, []);

  debug('found issues via comments: %O', issues);

  const errors = [];

  await Promise.all(
    uniqBy([...prs, ...issues], 'number').map(async issue => {
      const body = successComment
        ? template(successComment)({branch, lastRelease, commits, nextRelease, releases, issue})
        : getSuccessComment(issue, releaseInfos, nextRelease);
      try {
        const state = issue.state || (await github.issues.get({owner, repo, number: issue.number})).data.state;

        if (state === 'closed') {
          const comment = {owner, repo, number: issue.number, body};
          debug('create comment: %O', comment);
          const {
            data: {html_url: url},
          } = await github.issues.createComment(comment);
          logger.log('Added comment to issue #%d: %s', issue.number, url);
        } else {
          logger.log("Skip comment on issue #%d as it's open: %s", issue.number);
        }
      } catch (err) {
        if (err.code === 404) {
          logger.error("Failed to add a comment to the issue #%d as it doesn't exists.", issue.number);
        } else {
          errors.push(err);
          logger.error('Failed to add a comment to the issue #%d.', issue.number);
          // Don't throw right away and continue to update other issues
        }
      }
    })
  );

  const srIssues = await findSRIssues(github, failTitle, owner, repo);

  debug('found semantic-release issues: %O', srIssues);

  await Promise.all(
    srIssues.map(async issue => {
      debug('close issue: %O', issue);
      try {
        const updateIssue = {owner, repo, number: issue.number, state: 'closed'};
        debug('closing issue: %O', updateIssue);
        const {
          data: {html_url: url},
        } = await github.issues.edit(updateIssue);
        logger.log('Closed issue #%d: %s.', issue.number, url);
      } catch (err) {
        errors.push(err);
        logger.error('Failed to close the issue #%d.', issue.number);
        // Don't throw right away and continue to close other issues
      }
    })
  );

  if (errors.length > 0) {
    throw new AggregateError(errors);
  }
};
