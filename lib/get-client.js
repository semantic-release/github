const {Octokit} = require('@octokit/rest');
const pRetry = require('p-retry');
const urljoin = require('url-join');
const HttpProxyAgent = require('http-proxy-agent');
const HttpsProxyAgent = require('https-proxy-agent');
const { throttling } = require("@octokit/plugin-throttling");

module.exports = ({githubToken, githubUrl, githubApiPathPrefix, proxy}) => {
  const baseUrl = githubUrl && urljoin(githubUrl, githubApiPathPrefix);
  const OctokitWithThrottling = Octokit.plugin(throttling);
  const github = new OctokitWithThrottling({
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
      onSecondaryRateLimit: (retryAfter, options, octokit) => {
        octokit.log.error("onSecondaryLimit", retryAfter, options);
      },
      onRateLimit: (retryAfter, options, octokit) => {
        octokit.log.error("onRateLimit", retryAfter, options);
      },
    },
  });

  return github;
};
