const {isString, isPlainObject, isUndefined, isArray} = require('lodash');
const parseGithubUrl = require('parse-github-url');
const urlJoin = require('url-join');
const SemanticReleaseError = require('@semantic-release/error');
const resolveConfig = require('./resolve-config');
const getClient = require('./get-client');

module.exports = async (pluginConfig, {repositoryUrl}, logger) => {
  const {githubToken, githubUrl, githubApiPathPrefix, assets} = resolveConfig(pluginConfig);

  if (!githubToken) {
    throw new SemanticReleaseError('No github token specified.', 'ENOGHTOKEN');
  }

  if (
    !isUndefined(assets) &&
    assets !== false &&
    !(
      isArray(assets) &&
      assets.every(asset => isStringOrStringArray(asset) || (isPlainObject(asset) && isStringOrStringArray(asset.path)))
    )
  ) {
    throw new SemanticReleaseError(
      'The "assets" options must be an Array of Strings or Objects with a path property.',
      'EINVALIDASSETS'
    );
  }

  const {name: repo, owner} = parseGithubUrl(repositoryUrl);
  if (!owner || !repo) {
    throw new SemanticReleaseError(
      `The git repository URL ${repositoryUrl} is not a valid GitHub URL.`,
      'EINVALIDGITURL'
    );
  }

  if (githubUrl) {
    logger.log('Verify GitHub authentication (%s)', urlJoin(githubUrl, githubApiPathPrefix));
  } else {
    logger.log('Verify GitHub authentication');
  }

  const github = getClient(githubToken, githubUrl, githubApiPathPrefix);
  let push;

  try {
    ({data: {permissions: {push}}} = await github.repos.get({repo, owner}));
  } catch (err) {
    if (err.code === 401) {
      throw new SemanticReleaseError('Invalid GitHub token.', 'EINVALIDGHTOKEN');
    } else if (err.code === 404) {
      throw new SemanticReleaseError(`The repository ${owner}/${repo} doesn't exist.`, 'EMISSINGREPO');
    }
    throw err;
  }
  if (!push) {
    throw new SemanticReleaseError(
      `The github token doesn't allow to push on the repository ${owner}/${repo}.`,
      'EGHNOPERMISSION'
    );
  }
};

function isStringOrStringArray(value) {
  return isString(value) || (isArray(value) && value.every(isString));
}
