const {isNil, castArray} = require('lodash');
const resolveProxy = require('./resolve-proxy');

module.exports = (
  {
    githubUrl,
    githubApiPathPrefix,
    proxy,
    assets,
    successComment,
    failTitle,
    failComment,
    labels,
    assignees,
    releasedLabels,
    addReleases,
  },
  {env}
) => {
  githubUrl ||= env.GITHUB_API_URL || env.GH_URL || env.GITHUB_URL;

  return {
    githubToken: env.GH_TOKEN || env.GITHUB_TOKEN,
    githubUrl,
    githubApiPathPrefix: githubApiPathPrefix || env.GH_PREFIX || env.GITHUB_PREFIX || '',
    proxy: isNil(proxy) ? resolveProxy(githubUrl, env) : proxy,
    assets: assets ? castArray(assets) : assets,
    successComment,
    failTitle: isNil(failTitle) ? 'The automated release is failing 🚨' : failTitle,
    failComment,
    labels: isNil(labels) ? ['semantic-release'] : labels === false ? false : castArray(labels),
    assignees: assignees ? castArray(assignees) : assignees,
    releasedLabels: isNil(releasedLabels)
      ? [`released<%= nextRelease.channel ? \` on @\${nextRelease.channel}\` : "" %>`]
      : releasedLabels === false
      ? false
      : castArray(releasedLabels),
    addReleases: isNil(addReleases) ? false : addReleases,
  };
};
