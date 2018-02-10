const verifyGitHub = require('./lib/verify');
const publishGitHub = require('./lib/publish');
const successGitHub = require('./lib/success');
const failGitHub = require('./lib/fail');

let verified;

async function verifyConditions(pluginConfig, context) {
  const {options} = context;
  // If the GitHub publish plugin is used and has `assets`, `successComment`, `failComment`, `failTitle`, `labels` or `assignees` configured, validate it now in order to prevent any release if the configuration is wrong
  if (options.publish) {
    const publishPlugin =
      (Array.isArray(options.publish) ? options.publish : [options.publish]).find(
        config => config.path && config.path === '@semantic-release/github'
      ) || {};

    pluginConfig.assets = pluginConfig.assets || publishPlugin.assets;
    pluginConfig.successComment = pluginConfig.successComment || publishPlugin.successComment;
    pluginConfig.failComment = pluginConfig.failComment || publishPlugin.failComment;
    pluginConfig.failTitle = pluginConfig.failTitle || publishPlugin.failTitle;
    pluginConfig.labels = pluginConfig.labels || publishPlugin.labels;
    pluginConfig.assignees = pluginConfig.assignees || publishPlugin.assignees;
  }

  await verifyGitHub(pluginConfig, context);
  verified = true;
}

async function publish(pluginConfig, context) {
  if (!verified) {
    await verifyGitHub(pluginConfig, context);
    verified = true;
  }
  return publishGitHub(pluginConfig, context);
}

async function success(pluginConfig, context) {
  if (!verified) {
    await verifyGitHub(pluginConfig, context);
    verified = true;
  }
  await successGitHub(pluginConfig, context);
}

async function fail(pluginConfig, context) {
  if (!verified) {
    await verifyGitHub(pluginConfig, context);
    verified = true;
  }
  await failGitHub(pluginConfig, context);
}

module.exports = {verifyConditions, publish, success, fail};
