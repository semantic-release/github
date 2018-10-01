const {isString, isPlainObject, isNil, isArray, isNumber} = require('lodash');
const parseGithubUrl = require('parse-github-url');
const urlJoin = require('url-join');
const AggregateError = require('aggregate-error');
const resolveConfig = require('./resolve-config');
const getClient = require('./get-client');
const getError = require('./get-error');

const isNonEmptyString = value => isString(value) && value.trim();
const isStringOrStringArray = value => isNonEmptyString(value) || (isArray(value) && value.every(isNonEmptyString));
const isArrayOf = validator => array => isArray(array) && array.every(value => validator(value));
const canBeDisabled = validator => value => value === false || validator(value);

const VALIDATORS = {
  proxy: proxy =>
    isNonEmptyString(proxy) || (isPlainObject(proxy) && isNonEmptyString(proxy.host) && isNumber(proxy.port)),
  assets: isArrayOf(
    asset => isStringOrStringArray(asset) || (isPlainObject(asset) && isStringOrStringArray(asset.path))
  ),
  successComment: canBeDisabled(isNonEmptyString),
  failTitle: canBeDisabled(isNonEmptyString),
  failComment: canBeDisabled(isNonEmptyString),
  labels: canBeDisabled(isArrayOf(isNonEmptyString)),
  assignees: isArrayOf(isNonEmptyString),
  releasedLabels: canBeDisabled(isArrayOf(isNonEmptyString)),
};

module.exports = async (pluginConfig, context) => {
  const {
    options: {repositoryUrl},
    logger,
  } = context;
  const {githubToken, githubUrl, githubApiPathPrefix, proxy, ...options} = resolveConfig(pluginConfig, context);

  const errors = Object.entries({...options, proxy}).reduce(
    (errors, [option, value]) =>
      !isNil(value) && !VALIDATORS[option](value)
        ? [...errors, getError(`EINVALID${option.toUpperCase()}`, {[option]: value})]
        : errors,
    []
  );

  if (githubUrl) {
    logger.log('Verify GitHub authentication (%s)', urlJoin(githubUrl, githubApiPathPrefix));
  } else {
    logger.log('Verify GitHub authentication');
  }

  const {name: repo, owner} = parseGithubUrl(repositoryUrl);
  if (!owner || !repo) {
    errors.push(getError('EINVALIDGITHUBURL'));
  } else if (githubToken && !errors.find(({code}) => code === 'EINVALIDPROXY')) {
    const github = getClient({githubToken, githubUrl, githubApiPathPrefix, proxy});

    try {
      const {
        data: {
          permissions: {push},
        },
      } = await github.repos.get({repo, owner});
      if (!push) {
        errors.push(getError('EGHNOPERMISSION', {owner, repo}));
      }
    } catch (error) {
      if (error.code === 401) {
        errors.push(getError('EINVALIDGHTOKEN', {owner, repo}));
      } else if (error.code === 404) {
        errors.push(getError('EMISSINGREPO', {owner, repo}));
      } else {
        throw error;
      }
    }
  }

  if (!githubToken) {
    errors.push(getError('ENOGHTOKEN', {owner, repo}));
  }

  if (errors.length > 0) {
    throw new AggregateError(errors);
  }
};
