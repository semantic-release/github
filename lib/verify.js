const {isString, isPlainObject, isUndefined, isArray} = require('lodash');
const parseGithubUrl = require('parse-github-url');
const urlJoin = require('url-join');
const AggregateError = require('aggregate-error');
const SemanticReleaseError = require('@semantic-release/error');
const resolveConfig = require('./resolve-config');
const getClient = require('./get-client');

const isNonEmptyString = value => isString(value) && value.trim();
const isStringOrStringArray = value => isNonEmptyString(value) || (isArray(value) && value.every(isNonEmptyString));

module.exports = async (pluginConfig, {options: {repositoryUrl}, logger}) => {
  const errors = [];
  const {githubToken, githubUrl, githubApiPathPrefix, assets, successComment} = resolveConfig(pluginConfig);

  if (
    !isUndefined(assets) &&
    assets !== false &&
    !(
      isArray(assets) &&
      assets.every(asset => isStringOrStringArray(asset) || (isPlainObject(asset) && isStringOrStringArray(asset.path)))
    )
  ) {
    errors.push(
      new SemanticReleaseError(
        'The "assets" options must be an Array of Strings or Objects with a path property.',
        'EINVALIDASSETS'
      )
    );
  }

  if (!isUndefined(successComment) && successComment !== false && !isNonEmptyString(successComment)) {
    errors.push(
      new SemanticReleaseError(
        'The "successComment" options, if defined, must be a non empty String.',
        'EINVALIDSUCCESSCOMMENT'
      )
    );
  }

  if (githubUrl) {
    logger.log('Verify GitHub authentication (%s)', urlJoin(githubUrl, githubApiPathPrefix));
  } else {
    logger.log('Verify GitHub authentication');
  }

  const {name: repo, owner} = parseGithubUrl(repositoryUrl);
  if (!owner || !repo) {
    errors.push(new SemanticReleaseError('The git repository URL is not a valid GitHub URL.', 'EINVALIDGITURL'));
  }

  if (githubToken) {
    const github = getClient(githubToken, githubUrl, githubApiPathPrefix);

    try {
      const {data: {permissions: {push}}} = await github.repos.get({repo, owner});
      if (!push) {
        errors.push(
          new SemanticReleaseError(
            `The github token doesn't allow to push on the repository ${owner}/${repo}.`,
            'EGHNOPERMISSION'
          )
        );
      }
    } catch (err) {
      if (err.code === 401) {
        errors.push(new SemanticReleaseError('Invalid GitHub token.', 'EINVALIDGHTOKEN'));
      } else if (err.code === 404) {
        errors.push(new SemanticReleaseError(`The repository ${owner}/${repo} doesn't exist.`, 'EMISSINGREPO'));
      } else {
        throw err;
      }
    }
  } else {
    errors.push(new SemanticReleaseError('No github token specified.', 'ENOGHTOKEN'));
  }
  if (errors.length > 0) {
    throw new AggregateError(errors);
  }
};
