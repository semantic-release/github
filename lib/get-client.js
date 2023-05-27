const urljoin = require('url-join');
const HttpProxyAgent = require('http-proxy-agent');
const HttpsProxyAgent = require('https-proxy-agent');

const SemanticReleaseOctokit = require('./semantic-release-octokit');

module.exports = ({githubToken, githubUrl, githubApiPathPrefix, proxy}) => {
  const baseUrl = githubUrl && urljoin(githubUrl, githubApiPathPrefix);
  const octokit = new SemanticReleaseOctokit({
    auth: `token ${githubToken}`,
    baseUrl,
    request: {
      agent: proxy
        ? baseUrl && new URL(baseUrl).protocol.replace(':', '') === 'http'
          ? new HttpProxyAgent(proxy)
          : new HttpsProxyAgent(proxy)
        : undefined,
    },
  });

  return octokit;
};
