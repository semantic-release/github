const url = require('url');
const GitHubApi = require('@octokit/rest');

module.exports = (githubToken, githubUrl, githubApiPathPrefix) => {
  const {port, protocol, hostname} = githubUrl ? url.parse(githubUrl) : {};
  const github = new GitHubApi({
    port,
    protocol: (protocol || '').split(':')[0] || null,
    host: hostname,
    pathPrefix: githubApiPathPrefix,
  });
  github.authenticate({type: 'token', token: githubToken});
  return github;
};
