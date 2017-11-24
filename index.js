const verifyGithub = require('./lib/verify');
const publishGithub = require('./lib/publish');

let verified;

async function verifyConditions(pluginConfig, {options}) {
  // If the Github publish plugin is used and has `assets` configured, validate it now in order to prevent any release if the configuration is wrong
  if (options.publish) {
    const publishPlugin = (Array.isArray(options.publish) ? options.publish : [options.publish]).find(
      config => config.path && config.path === '@semantic-release/github'
    );
    if (publishPlugin && publishPlugin.assets) {
      pluginConfig.assets = publishPlugin.assets;
    }
  }

  await verifyGithub(pluginConfig, options);
  verified = true;
}

async function publish(pluginConfig, {nextRelease, options, logger}) {
  if (!verified) {
    await verifyGithub(pluginConfig, options);
    verified = true;
  }
  await publishGithub(pluginConfig, options, nextRelease, logger);
}

module.exports = {verifyConditions, publish};
