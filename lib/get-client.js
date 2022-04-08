const {Octokit} = require('@octokit/rest');
const urljoin = require('url-join');
const HttpProxyAgent = require('http-proxy-agent');
const HttpsProxyAgent = require('https-proxy-agent');
const {throttling} = require('@octokit/plugin-throttling');
const {RETRY_CONF} = require('./definitions/retry');
const {THROTTLE_CONF} = require('./definitions/throttle');
const {retry} = require('@octokit/plugin-retry');

module.exports = ({githubToken, githubUrl, githubApiPathPrefix, proxy}) => {
  const onRetry = (retryAfter, options) => {
    github.log.warn(`Request quota exhausted for request ${options.method} ${options.url}`);

    if (options.request.retryCount <= RETRY_CONF.retries) {
      github.log.debug(`Will retry after ${retryAfter}.`);
      return true;
    }
  };

  const baseUrl = githubUrl && urljoin(githubUrl, githubApiPathPrefix);
  const OctokitWithThrottlingAndRetry = Octokit.plugin(throttling, retry);
  const github = new OctokitWithThrottlingAndRetry({
    auth: `token ${githubToken}`,
    baseUrl,
    retry: RETRY_CONF,
    request: {
      agent: proxy
        ? baseUrl && new URL(baseUrl).protocol.replace(':', '') === 'http'
          ? new HttpProxyAgent(proxy)
          : new HttpsProxyAgent(proxy)
        : undefined,
    },
    throttle: {
      ...THROTTLE_CONF,
      onSecondaryRateLimit: onRetry,
      onRateLimit: onRetry,
    },
  });

  return github;
};
