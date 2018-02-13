const url = require('url');
const {get, set} = require('lodash');
const GitHubApi = require('@octokit/rest');
const pRetry = require('p-retry');

/**
 * Exponential backoff configuration for retries.
 */
const DEFAULT_RETRY = {retries: 3, factor: 2, minTimeout: 1000};
/**
 * Octokit functions to retry.
 */
const RETRY_FUNCTIONS = [
  'repos.createRelease',
  'repos.uploadAsset',
  'search.issues',
  'issues.create',
  'issues.edit',
  'issues.createComment',
];
/**
 * Http error codes for which to not retry.
 */
const SKIP_RETRY_CODES = [400, 401, 403];

module.exports = (githubToken, githubUrl, githubApiPathPrefix, retryConf = DEFAULT_RETRY) => {
  const {port, protocol, hostname} = githubUrl ? url.parse(githubUrl) : {};
  const github = new GitHubApi({
    port,
    protocol: (protocol || '').split(':')[0] || null,
    host: hostname,
    pathPrefix: githubApiPathPrefix,
  });
  github.authenticate({type: 'token', token: githubToken});
  retryable(github, RETRY_FUNCTIONS, retryConf);

  return github;
};

function retryable(obj, props, retryConf) {
  for (const prop of props) {
    const func = get(obj, prop);
    set(obj, prop, (...args) =>
      pRetry(async () => {
        try {
          return await func(...args);
        } catch (err) {
          if (SKIP_RETRY_CODES.includes(err.code)) {
            // If the API return a 400, 401 or 403 error, do not retry
            throw new pRetry.AbortError(err);
          }
          throw err;
        }
      }, retryConf)
    );
  }
}
