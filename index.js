const {callbackify} = require('util');
const verifyGithub = require('./lib/verify');
const publishGit = require('./lib/publish');

let verified;

async function verifyConditions(pluginConfig, {pkg, options: {publish}}) {
  // If the Github publish plugin is used and has `assets` configured, validate it now in order to prevent any release if the configuration is wrong
  if (publish) {
    const publishPlugin = (Array.isArray(publish) ? publish : [publish]).find(
      config => config.path && config.path === '@semantic-release/github'
    );
    if (publishPlugin && publishPlugin.assets) {
      pluginConfig.assets = publishPlugin.assets;
    }
  }

  await verifyGithub(pluginConfig, pkg);
  verified = true;
}

async function publish(pluginConfig, {pkg, nextRelease, options, logger}) {
  if (!verified) {
    await verifyGithub(pluginConfig, pkg);
    verified = true;
  }
  await publishGit(pluginConfig, options, pkg, nextRelease, logger);
}

module.exports = {verifyConditions: callbackify(verifyConditions), publish: callbackify(publish)};
