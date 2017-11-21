const {parse} = require('url');
const gitUrlParse = require('git-url-parse');
const GitHubApi = require('github');
const resolveConfig = require('./resolve-config');
const SemanticReleaseError = require('@semantic-release/error');

module.exports = async (pluginConfig, {name, repository}) => {
  const {githubToken, githubUrl, githubApiPathPrefix, assets} = resolveConfig(pluginConfig);

  if (!name) {
    throw new SemanticReleaseError('No "name" found in package.json.', 'ENOPKGNAME');
  }

  if (!repository || !repository.url) {
    throw new SemanticReleaseError('No "repository" found in package.json.', 'ENOPKGREPO');
  }

  if (!githubToken) {
    throw new SemanticReleaseError('No github token specified.', 'ENOGHTOKEN');
  }

  if (assets && assets.length > 0) {
    // Verify that every asset is either a string or an object with path attribute defined
    if (!assets.every(asset => typeof asset === 'string' || (typeof asset === 'object' && Boolean(asset.path)))) {
      throw new SemanticReleaseError(
        'The "assets" options must be an Array of strings or objects with a path property.',
        'EINVALIDASSETS'
      );
    }
  }

  const {name: repo, owner} = gitUrlParse(repository.url);
  let {port, protocol, hostname: host} = githubUrl ? parse(githubUrl) : {};
  protocol = (protocol || '').split(':')[0] || null;

  const github = new GitHubApi({port, protocol, host, pathPrefix: githubApiPathPrefix});
  github.authenticate({type: 'token', token: githubToken});

  let push;
  try {
    ({data: {permissions: {push}}} = await github.repos.get({repo, owner}));
  } catch (err) {
    if (err.code === 401) {
      throw new SemanticReleaseError('Invalid Github token.', 'EINVALIDGHTOKEN');
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
