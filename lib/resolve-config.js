const {isUndefined, castArray} = require('lodash');

module.exports = ({
  githubUrl,
  githubApiPathPrefix,
  assets,
  successComment,
  failComment,
  failTitle,
  labels,
  assignees,
}) => ({
  githubToken: process.env.GH_TOKEN || process.env.GITHUB_TOKEN,
  githubUrl: githubUrl || process.env.GH_URL || process.env.GITHUB_URL,
  githubApiPathPrefix: githubApiPathPrefix || process.env.GH_PREFIX || process.env.GITHUB_PREFIX || '',
  assets: assets ? castArray(assets) : assets,
  successComment,
  failComment,
  failTitle: isUndefined(failTitle) || failTitle === false ? 'The automated release is failing 🚨' : failTitle,
  labels: isUndefined(labels) ? ['semantic-release'] : labels === false ? [] : castArray(labels),
  assignees: assignees ? castArray(assignees) : assignees,
});
