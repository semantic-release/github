const {Octokit} = require('@octokit/rest');
const {throttling} = require('@octokit/plugin-throttling');
const {retry} = require('@octokit/plugin-retry');
const urljoin = require('url-join');
const HttpProxyAgent = require('http-proxy-agent');
const HttpsProxyAgent = require('https-proxy-agent');

const SemanticReleaseOctokit = Octokit.plugin(throttling, retry);

const {RETRY_CONF} = require('./definitions/rate-limit');

module.exports = ({githubToken, githubUrl, githubApiPathPrefix, proxy}) => {
  const baseUrl = githubUrl && urljoin(githubUrl, githubApiPathPrefix);
  const github = new SemanticReleaseOctokit({
    auth: `token ${githubToken}`,
    baseUrl,
    request: {
      agent: proxy
        ? baseUrl && new URL(baseUrl).protocol.replace(':', '') === 'http'
          ? new HttpProxyAgent(proxy)
          : new HttpsProxyAgent(proxy)
        : undefined,
    },
    throttle: {
      onRateLimit: (retryAfter, options) => {
        github.log.warn(`Request quota exhausted for request ${options.method} ${options.url}`);

        if (options.request.retryCount <= RETRY_CONF.retries) {
          github.log.debug(`Will retry after ${retryAfter}.`);
          return true;
        }

        return false;
      },
      onAbuseLimit: (retryAfter, options) => {
        github.log.warn(`Abuse detected for request ${options.method} ${options.url}`);
      },
    },
  });

  return github;
};
