const verifyGitHub = require('./lib/verify');
const publishGitHub = require('./lib/publish');
const successGitHub = require('./lib/success');

let verified;

async function verifyConditions(pluginConfig, context) {
  const {options} = context;
  // If the GitHub publish plugin is used and has `assets` configured, validate it now in order to prevent any release if the configuration is wrong
  if (options.publish) {
    const publishPlugin = (Array.isArray(options.publish) ? options.publish : [options.publish]).find(
      config => config.path && config.path === '@semantic-release/github'
    );
    if (publishPlugin && publishPlugin.assets) {
      pluginConfig.assets = publishPlugin.assets;
    }
    if (publishPlugin && publishPlugin.successComment) {
      pluginConfig.successComment = publishPlugin.successComment;
    }
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

module.exports = {verifyConditions, publish, success};
