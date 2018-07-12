const {isUndefined, castArray} = require('lodash');

module.exports = (
  {githubUrl, githubApiPathPrefix, proxy, assets, successComment, failTitle, failComment, labels, assignees},
  {env}
) => ({
  githubToken: env.GH_TOKEN || env.GITHUB_TOKEN,
  githubUrl: githubUrl || env.GH_URL || env.GITHUB_URL,
  githubApiPathPrefix: githubApiPathPrefix || env.GH_PREFIX || env.GITHUB_PREFIX || '',
  proxy: proxy || env.HTTP_PROXY,
  assets: assets ? castArray(assets) : assets,
  successComment,
  failTitle: isUndefined(failTitle) || failTitle === false ? 'The automated release is failing 🚨' : failTitle,
  failComment,
  labels: isUndefined(labels) ? ['semantic-release'] : labels === false ? [] : castArray(labels),
  assignees: assignees ? castArray(assignees) : assignees,
});
