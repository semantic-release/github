const urljoin = require('url-join');
const {HttpProxyAgent} = require('http-proxy-agent');
const {HttpsProxyAgent} = require('https-proxy-agent');

const SemanticReleaseOctokit = require('./semantic-release-octokit');

module.exports = ({githubToken, githubUrl, githubApiPathPrefix, proxy}) => {
  const baseUrl = githubUrl && urljoin(githubUrl, githubApiPathPrefix);
  const octokit = new SemanticReleaseOctokit({
    auth: `token ${githubToken}`,
    baseUrl,
    request: {
      agent: proxy
        ? baseUrl && new URL(baseUrl).protocol.replace(':', '') === 'http'
          ? // Some `proxy.headers` need to be passed as second arguments since version 6 or 7
            // For simplicity, we just pass the same proxy object twice. It works 🤷🏻
            new HttpProxyAgent(proxy, proxy)
          : new HttpsProxyAgent(proxy, proxy)
        : undefined,
    },
  });

  return octokit;
};
