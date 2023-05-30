/* eslint require-atomic-updates: off */

import { defaultTo, castArray } from "lodash-es";

import verifyGitHub from "./lib/verify.js";
import addChannelGitHub from "./lib/add-channel.js";
import publishGitHub from "./lib/publish.js";
import successGitHub from "./lib/success.js";
import failGitHub from "./lib/fail.js";
import { SemanticReleaseOctokit, getOctokitInstance } from "./lib/octokit.js";

let verified;
let octokit;

export async function verifyConditions(
  pluginConfig,
  context,
  { Octokit = SemanticReleaseOctokit } = {}
) {
  const { options } = context;
  // If the GitHub publish plugin is used and has `assets`, `successComment`, `failComment`, `failTitle`, `labels` or `assignees` configured, validate it now in order to prevent any release if the configuration is wrong
  if (options.publish) {
    const publishPlugin =
      castArray(options.publish).find(
        (config) => config.path && config.path === "@semantic-release/github"
      ) || {};

    pluginConfig.assets = defaultTo(pluginConfig.assets, publishPlugin.assets);
    pluginConfig.successComment = defaultTo(
      pluginConfig.successComment,
      publishPlugin.successComment
    );
    pluginConfig.failComment = defaultTo(
      pluginConfig.failComment,
      publishPlugin.failComment
    );
    pluginConfig.failTitle = defaultTo(
      pluginConfig.failTitle,
      publishPlugin.failTitle
    );
    pluginConfig.labels = defaultTo(pluginConfig.labels, publishPlugin.labels);
    pluginConfig.assignees = defaultTo(
      pluginConfig.assignees,
      publishPlugin.assignees
    );
  }

  octokit = octokit || getOctokitInstance(Octokit, pluginConfig, context);

  await verifyGitHub(pluginConfig, context, { octokit });
  verified = true;
}

export async function publish(
  pluginConfig,
  context,
  { Octokit = SemanticReleaseOctokit } = {}
) {
  octokit = octokit || getOctokitInstance(Octokit, pluginConfig, context);

  if (!verified) {
    await verifyGitHub(pluginConfig, context, { octokit });
    verified = true;
  }

  return publishGitHub(pluginConfig, context, { octokit });
}

export async function addChannel(
  pluginConfig,
  context,
  { Octokit = SemanticReleaseOctokit } = {}
) {
  octokit = octokit || getOctokitInstance(Octokit, pluginConfig, context);

  if (!verified) {
    await verifyGitHub(pluginConfig, context, { octokit });
    verified = true;
  }

  return addChannelGitHub(pluginConfig, context, { octokit });
}

export async function success(
  pluginConfig,
  context,
  { Octokit = SemanticReleaseOctokit } = {}
) {
  octokit = octokit || getOctokitInstance(Octokit, pluginConfig, context);

  if (!verified) {
    await verifyGitHub(pluginConfig, context, { octokit });
    verified = true;
  }

  await successGitHub(pluginConfig, context, { octokit });
}

export async function fail(
  pluginConfig,
  context,
  { Octokit = SemanticReleaseOctokit } = {}
) {
  octokit = octokit || getOctokitInstance(Octokit, pluginConfig, context);

  if (!verified) {
    await verifyGitHub(pluginConfig, context, { octokit });
    verified = true;
  }

  await failGitHub(pluginConfig, context, { octokit });
}
