const {isUndefined, castArray} = require('lodash');

module.exports = ({
  githubUrl,
  githubApiPathPrefix,
  proxy,
  assets,
  successComment,
  failTitle,
  failComment,
  labels,
  assignees,
}) => ({
  githubToken: process.env.GH_TOKEN || process.env.GITHUB_TOKEN,
  githubUrl: githubUrl || process.env.GH_URL || process.env.GITHUB_URL,
  githubApiPathPrefix: githubApiPathPrefix || process.env.GH_PREFIX || process.env.GITHUB_PREFIX || '',
  proxy: proxy || process.env.HTTP_PROXY,
  assets: assets ? castArray(assets) : assets,
  successComment,
  failTitle: isUndefined(failTitle) || failTitle === false ? 'The automated release is failing 🚨' : failTitle,
  failComment,
  labels: isUndefined(labels) ? ['semantic-release'] : labels === false ? [] : castArray(labels),
  assignees: assignees ? castArray(assignees) : assignees,
});
