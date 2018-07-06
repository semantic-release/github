const {isString, isPlainObject, isUndefined, isArray, isNumber} = require('lodash');
const parseGithubUrl = require('parse-github-url');
const urlJoin = require('url-join');
const AggregateError = require('aggregate-error');
const resolveConfig = require('./resolve-config');
const getClient = require('./get-client');
const getError = require('./get-error');

const isNonEmptyString = value => isString(value) && value.trim();
const isStringOrStringArray = value => isNonEmptyString(value) || (isArray(value) && value.every(isNonEmptyString));
const isArrayOf = validator => array => isArray(array) && array.every(value => validator(value));

const VALIDATORS = {
  proxy: proxy =>
    isNonEmptyString(proxy) || (isPlainObject(proxy) && isNonEmptyString(proxy.host) && isNumber(proxy.port)),
  assets: isArrayOf(
    asset => isStringOrStringArray(asset) || (isPlainObject(asset) && isStringOrStringArray(asset.path))
  ),
  successComment: isNonEmptyString,
  failTitle: isNonEmptyString,
  failComment: isNonEmptyString,
  labels: isArrayOf(isStringOrStringArray),
  assignees: isArrayOf(isStringOrStringArray),
};

module.exports = async (pluginConfig, {options: {repositoryUrl}, logger}) => {
  const {githubToken, githubUrl, githubApiPathPrefix, proxy, ...options} = resolveConfig(pluginConfig);

  const errors = Object.entries({...options, proxy}).reduce(
    (errors, [option, value]) =>
      !isUndefined(value) && value !== false && !VALIDATORS[option](value)
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
    } catch (err) {
      if (err.code === 401) {
        errors.push(getError('EINVALIDGHTOKEN', {owner, repo}));
      } else if (err.code === 404) {
        errors.push(getError('EMISSINGREPO', {owner, repo}));
      } else {
        throw err;
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
