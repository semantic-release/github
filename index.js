const verifyGitHub = require('./lib/verify');
const publishGitHub = require('./lib/publish');

let verified;

async function verifyConditions(pluginConfig, {options, logger}) {
  // If the GitHub publish plugin is used and has `assets` configured, validate it now in order to prevent any release if the configuration is wrong
  if (options.publish) {
    const publishPlugin = (Array.isArray(options.publish) ? options.publish : [options.publish]).find(
      config => config.path && config.path === '@semantic-release/github'
    );
    if (publishPlugin && publishPlugin.assets) {
      pluginConfig.assets = publishPlugin.assets;
    }
  }

  await verifyGitHub(pluginConfig, options, logger);
  verified = true;
}

async function publish(pluginConfig, {nextRelease, options, logger}) {
  if (!verified) {
    await verifyGitHub(pluginConfig, options, logger);
    verified = true;
  }
  await publishGitHub(pluginConfig, options, nextRelease, logger);
}

module.exports = {verifyConditions, publish};
