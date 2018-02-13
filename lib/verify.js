const {isString, isPlainObject, isUndefined, isArray} = require('lodash');
const parseGithubUrl = require('parse-github-url');
const urlJoin = require('url-join');
const AggregateError = require('aggregate-error');
const resolveConfig = require('./resolve-config');
const getClient = require('./get-client');
const getError = require('./get-error');

const isNonEmptyString = value => isString(value) && value.trim();
const isStringOrStringArray = value => isNonEmptyString(value) || (isArray(value) && value.every(isNonEmptyString));

module.exports = async (pluginConfig, {options: {repositoryUrl}, logger}) => {
  const errors = [];
  const {
    githubToken,
    githubUrl,
    githubApiPathPrefix,
    assets,
    successComment,
    failComment,
    failTitle,
    labels,
    assignees,
  } = resolveConfig(pluginConfig);

  if (
    !isUndefined(assets) &&
    assets !== false &&
    !(
      isArray(assets) &&
      assets.every(asset => isStringOrStringArray(asset) || (isPlainObject(asset) && isStringOrStringArray(asset.path)))
    )
  ) {
    errors.push(getError('EINVALIDASSETS', {assets}));
  }

  if (!isUndefined(successComment) && successComment !== false && !isNonEmptyString(successComment)) {
    errors.push(getError('EINVALIDSUCCESSCOMMENT', {successComment}));
  }

  if (!isUndefined(failTitle) && failTitle !== false && !isNonEmptyString(failTitle)) {
    errors.push(getError('EINVALIDFAILTITLE', {failTitle}));
  }

  if (!isUndefined(failComment) && failComment !== false && !isNonEmptyString(failComment)) {
    errors.push(getError('EINVALIDFAILCOMMENT', {failComment}));
  }

  if (
    !isUndefined(labels) &&
    labels !== false &&
    !(isArray(labels) && labels.every(label => isStringOrStringArray(label)))
  ) {
    errors.push(getError('EINVALIDLABELS', {labels}));
  }

  if (
    !isUndefined(assignees) &&
    assignees !== false &&
    !(isArray(assignees) && assignees.every(assignee => isStringOrStringArray(assignee)))
  ) {
    errors.push(getError('EINVALIDASSIGNEES', {assignees}));
  }

  if (githubUrl) {
    logger.log('Verify GitHub authentication (%s)', urlJoin(githubUrl, githubApiPathPrefix));
  } else {
    logger.log('Verify GitHub authentication');
  }

  const {name: repo, owner} = parseGithubUrl(repositoryUrl);
  if (!owner || !repo) {
    errors.push(getError('EINVALIDGITHUBURL'));
  }

  if (githubToken) {
    const github = getClient({githubToken, githubUrl, githubApiPathPrefix});

    try {
      const {data: {permissions: {push}}} = await github.repos.get({repo, owner});
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
  } else {
    errors.push(getError('ENOGHTOKEN', {owner, repo}));
  }
  if (errors.length > 0) {
    throw new AggregateError(errors);
  }
};
