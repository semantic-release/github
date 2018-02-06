const verifyGitHub = require('./lib/verify');
const publishGitHub = require('./lib/publish');

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

module.exports = {verifyConditions, publish};
