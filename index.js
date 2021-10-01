/* eslint require-atomic-updates: off */

import {defaultTo, castArray} from 'lodash';

import verifyGitHub from './lib/verify';
import addChannelGitHub from './lib/add-channel';
import publishGitHub from './lib/publish';
import successGitHub from './lib/success';
import failGitHub from './lib/fail';

let verified;

async function verifyConditions(pluginConfig, context) {
  const {options} = context;
  // If the GitHub publish plugin is used and has `assets`, `successComment`, `failComment`, `failTitle`, `labels` or `assignees` configured, validate it now in order to prevent any release if the configuration is wrong
  if (options.publish) {
    const publishPlugin =
      castArray(options.publish).find((config) => config.path && config.path === '@semantic-release/github') || {};

    pluginConfig.assets = defaultTo(pluginConfig.assets, publishPlugin.assets);
    pluginConfig.successComment = defaultTo(pluginConfig.successComment, publishPlugin.successComment);
    pluginConfig.failComment = defaultTo(pluginConfig.failComment, publishPlugin.failComment);
    pluginConfig.failTitle = defaultTo(pluginConfig.failTitle, publishPlugin.failTitle);
    pluginConfig.labels = defaultTo(pluginConfig.labels, publishPlugin.labels);
    pluginConfig.assignees = defaultTo(pluginConfig.assignees, publishPlugin.assignees);
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

async function addChannel(pluginConfig, context) {
  if (!verified) {
    await verifyGitHub(pluginConfig, context);
    verified = true;
  }

  return addChannelGitHub(pluginConfig, context);
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

export default {verifyConditions, addChannel, publish, success, fail};
