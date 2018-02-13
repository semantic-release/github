const url = require('url');
const Octokit = require('@octokit/rest');
const octokitRequest = require('@octokit/rest/lib/request');
const pRetry = require('p-retry');
const delay = require('delay');

/**
 * Http error codes for which to not retry.
 */
const SKIP_RETRY_CODES = [400, 401, 403];

module.exports = (githubToken, githubUrl, githubApiPathPrefix, retry = {retries: 3, factor: 2, minTimeout: 1000}) => {
  const {port, protocol, hostname} = githubUrl ? url.parse(githubUrl) : {};
  const github = new Octokit({
    port,
    protocol: (protocol || '').split(':')[0] || null,
    host: hostname,
    pathPrefix: githubApiPathPrefix,
  });

  const initialDelay = retry.minTimeout;
  const retryConf = {
    factor: retry.factor,
    minTimeout: retry.minTimeout * retry.factor,
    retries: retry.retries - 1,
    maxTimeout: retry.maxTimeout,
  };

  github.plugin(retryPlugin(retryConf, initialDelay));
  github.authenticate({type: 'token', token: githubToken});

  return github;
};

function retryPlugin(retry, initialDelay) {
  return octokit =>
    octokit.hook.error('request', async (error, options) => {
      if (SKIP_RETRY_CODES.includes(error.code)) {
        throw error;
      }

      await delay(initialDelay);

      return pRetry(async () => {
        try {
          return await octokitRequest(options);
        } catch (err) {
          if (SKIP_RETRY_CODES.includes(err.code)) {
            // If the API return a 400, 401 or 403 error, do not retry
            throw new pRetry.AbortError(err);
          }
          throw err;
        }
      }, retry);
    });
}
