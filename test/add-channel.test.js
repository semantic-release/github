import test from "ava";
import sinon from "sinon";
import fetchMock from "fetch-mock";

import { TestOctokit } from "./helpers/test-octokit.js";

/* eslint camelcase: ["error", {properties: "never"}] */

import addChannel from "../lib/add-channel.js";

test.beforeEach((t) => {
  // Mock logger
  t.context.log = sinon.stub();
  t.context.error = sinon.stub();
  t.context.logger = { log: t.context.log, error: t.context.error };
});

test("Update a release", async (t) => {
  const owner = "test_user";
  const repo = "test_repo";
  const env = { GITHUB_TOKEN: "github_token" };
  const pluginConfig = {};
  const nextRelease = {
    gitTag: "v1.0.0",
    name: "v1.0.0",
    notes: "Test release note body",
  };
  const options = { repositoryUrl: `https://github.com/${owner}/${repo}.git` };
  const releaseUrl = `https://github.com/${owner}/${repo}/releases/${nextRelease.version}`;
  const releaseId = 1;

  const fetch = fetchMock
    .sandbox()
    .getOnce(
      `https://api.github.local/repos/${owner}/${repo}/releases/tags/${nextRelease.gitTag}`,
      {
        id: releaseId,
      },
    )
    .patchOnce(
      `https://api.github.local/repos/${owner}/${repo}/releases/${releaseId}`,
      {
        html_url: releaseUrl,
      },
      {
        body: {
          tag_name: nextRelease.gitTag,
          name: nextRelease.name,
          prerelease: false,
        },
      },
    );

  const result = await addChannel(
    pluginConfig,
    {
      env,
      options,
      branch: { type: "release", main: true },
      nextRelease,
      logger: t.context.logger,
    },
    {
      Octokit: TestOctokit.defaults((options) => ({
        ...options,
        request: { ...options.request, fetch },
      })),
    },
  );

  t.is(result.url, releaseUrl);
  t.deepEqual(t.context.log.args[0], [
    "Updated GitHub release: %s",
    releaseUrl,
  ]);
  t.true(fetch.done());
});

test("Update a maintenance release", async (t) => {
  const owner = "test_user";
  const repo = "test_repo";
  const env = { GITHUB_TOKEN: "github_token" };
  const pluginConfig = {};
  const nextRelease = {
    gitTag: "v1.0.0",
    channel: "1.x",
    name: "v1.0.0",
    notes: "Test release note body",
  };
  const options = { repositoryUrl: `https://github.com/${owner}/${repo}.git` };
  const releaseUrl = `https://github.com/${owner}/${repo}/releases/${nextRelease.version}`;
  const releaseId = 1;

  const fetch = fetchMock
    .sandbox()
    .getOnce(
      `https://api.github.local/repos/${owner}/${repo}/releases/tags/${nextRelease.gitTag}`,
      {
        id: releaseId,
      },
    )
    .patchOnce(
      `https://api.github.local/repos/${owner}/${repo}/releases/${releaseId}`,
      {
        html_url: releaseUrl,
      },
      {
        body: {
          tag_name: nextRelease.gitTag,
          name: nextRelease.name,
          prerelease: false,
        },
      },
    );

  const result = await addChannel(
    pluginConfig,
    {
      env,
      options,
      branch: { type: "maintenance", channel: "1.x", main: false },
      nextRelease,
      logger: t.context.logger,
    },
    {
      Octokit: TestOctokit.defaults((options) => ({
        ...options,
        request: { ...options.request, fetch },
      })),
    },
  );

  t.is(result.url, releaseUrl);
  t.deepEqual(t.context.log.args[0], [
    "Updated GitHub release: %s",
    releaseUrl,
  ]);
  t.true(fetch.done());
});

test("Update a prerelease", async (t) => {
  const owner = "test_user";
  const repo = "test_repo";
  const env = { GITHUB_TOKEN: "github_token" };
  const pluginConfig = {};
  const nextRelease = {
    gitTag: "v1.0.0",
    name: "v1.0.0",
    notes: "Test release note body",
  };
  const options = { repositoryUrl: `https://github.com/${owner}/${repo}.git` };
  const releaseUrl = `https://github.com/${owner}/${repo}/releases/${nextRelease.version}`;
  const releaseId = 1;

  const fetch = fetchMock
    .sandbox()
    .getOnce(
      `https://api.github.local/repos/${owner}/${repo}/releases/tags/${nextRelease.gitTag}`,
      {
        id: releaseId,
      },
    )
    .patchOnce(
      `https://api.github.local/repos/${owner}/${repo}/releases/${releaseId}`,
      {
        html_url: releaseUrl,
      },
      {
        body: {
          tag_name: nextRelease.gitTag,
          name: nextRelease.name,
          prerelease: false,
        },
      },
    );

  const result = await addChannel(
    pluginConfig,
    {
      env,
      options,
      branch: { type: "maintenance", channel: "1.x", main: false },
      nextRelease,
      logger: t.context.logger,
    },
    {
      Octokit: TestOctokit.defaults((options) => ({
        ...options,
        request: { ...options.request, fetch },
      })),
    },
  );

  t.is(result.url, releaseUrl);
  t.deepEqual(t.context.log.args[0], [
    "Updated GitHub release: %s",
    releaseUrl,
  ]);
  t.true(fetch.done());
});

test("Update a release with a custom github url", async (t) => {
  const owner = "test_user";
  const repo = "test_repo";
  const env = {
    GH_URL: "https://othertesturl.com:443",
    GH_TOKEN: "github_token",
    GH_PREFIX: "prefix",
  };
  const pluginConfig = {};
  const nextRelease = {
    gitTag: "v1.0.0",
    name: "v1.0.0",
    notes: "Test release note body",
  };
  const options = { repositoryUrl: `${env.GH_URL}/${owner}/${repo}.git` };
  const releaseUrl = `${env.GH_URL}/${owner}/${repo}/releases/${nextRelease.version}`;
  const releaseId = 1;

  const fetch = fetchMock
    .sandbox()
    .getOnce(
      `https://othertesturl.com:443/prefix/repos/${owner}/${repo}/releases/tags/${nextRelease.gitTag}`,
      {
        id: releaseId,
      },
    )
    .patchOnce(
      `https://othertesturl.com:443/prefix/repos/${owner}/${repo}/releases/${releaseId}`,
      {
        html_url: releaseUrl,
      },
      {
        body: {
          tag_name: nextRelease.gitTag,
          name: nextRelease.name,
          prerelease: false,
        },
      },
    );

  const result = await addChannel(
    pluginConfig,
    {
      env,
      options,
      branch: { type: "release", main: true },
      nextRelease,
      logger: t.context.logger,
    },
    {
      Octokit: TestOctokit.defaults((options) => ({
        ...options,
        request: { ...options.request, fetch },
      })),
    },
  );

  t.is(result.url, releaseUrl);
  t.deepEqual(t.context.log.args[0], [
    "Updated GitHub release: %s",
    releaseUrl,
  ]);
  t.true(fetch.done());
});

test("Create the new release if current one is missing", async (t) => {
  const owner = "test_user";
  const repo = "test_repo";
  const env = { GITHUB_TOKEN: "github_token" };
  const pluginConfig = {};
  const nextRelease = {
    gitTag: "v1.0.0",
    name: "v1.0.0",
    notes: "Test release note body",
  };
  const options = { repositoryUrl: `https://github.com/${owner}/${repo}.git` };
  const releaseUrl = `https://github.com/${owner}/${repo}/releases/${nextRelease.version}`;

  const fetch = fetchMock
    .sandbox()
    .getOnce(
      `https://api.github.local/repos/${owner}/${repo}/releases/tags/${nextRelease.gitTag}`,
      404,
    )
    .postOnce(
      `https://api.github.local/repos/${owner}/${repo}/releases`,
      {
        html_url: releaseUrl,
      },
      {
        body: {
          tag_name: nextRelease.gitTag,
          name: nextRelease.name,
          body: nextRelease.notes,
          prerelease: false,
        },
      },
    );

  const result = await addChannel(
    pluginConfig,
    {
      env,
      options,
      branch: { type: "release", main: true },
      nextRelease,
      logger: t.context.logger,
    },
    {
      Octokit: TestOctokit.defaults((options) => ({
        ...options,
        request: { ...options.request, fetch },
      })),
    },
  );

  t.is(result.url, releaseUrl);
  t.deepEqual(t.context.log.args[0], [
    "There is no release for tag %s, creating a new one",
    nextRelease.gitTag,
  ]);
  t.deepEqual(t.context.log.args[1], [
    "Published GitHub release: %s",
    releaseUrl,
  ]);
  t.true(fetch.done());
});

test("Throw error if cannot read current release", async (t) => {
  const owner = "test_user";
  const repo = "test_repo";
  const env = { GITHUB_TOKEN: "github_token" };
  const pluginConfig = {};
  const nextRelease = {
    gitTag: "v1.0.0",
    name: "v1.0.0",
    notes: "Test release note body",
  };
  const options = { repositoryUrl: `https://github.com/${owner}/${repo}.git` };

  const fetch = fetchMock
    .sandbox()
    .getOnce(
      `https://api.github.local/repos/${owner}/${repo}/releases/tags/${nextRelease.gitTag}`,
      500,
    );

  const error = await t.throwsAsync(
    addChannel(
      pluginConfig,
      {
        env,
        options,
        branch: { type: "release", main: true },
        nextRelease,
        logger: t.context.logger,
      },
      {
        Octokit: TestOctokit.defaults((options) => ({
          ...options,
          request: { ...options.request, fetch },
        })),
      },
    ),
  );

  t.is(error.status, 500);
  t.true(fetch.done());
});

test("Throw error if cannot create missing current release", async (t) => {
  const owner = "test_user";
  const repo = "test_repo";
  const env = { GITHUB_TOKEN: "github_token" };
  const pluginConfig = {};
  const nextRelease = {
    gitTag: "v1.0.0",
    name: "v1.0.0",
    notes: "Test release note body",
  };
  const options = {
    repositoryUrl: `https://github.com/${owner}/${repo}.git`,
  };

  const fetch = fetchMock
    .sandbox()
    .getOnce(
      `https://api.github.local/repos/${owner}/${repo}/releases/tags/${nextRelease.gitTag}`,
      404,
    )
    .postOnce(`https://api.github.local/repos/${owner}/${repo}/releases`, 500, {
      body: {
        tag_name: nextRelease.gitTag,
        name: nextRelease.name,
        body: nextRelease.notes,
        prerelease: false,
      },
    });

  const error = await t.throwsAsync(
    addChannel(
      pluginConfig,
      {
        env,
        options,
        branch: { type: "release", main: true },
        nextRelease,
        logger: t.context.logger,
      },
      {
        Octokit: TestOctokit.defaults((options) => ({
          ...options,
          request: { ...options.request, fetch },
        })),
      },
    ),
  );

  t.is(error.status, 500);
  t.true(fetch.done());
});

test("Throw error if cannot update release", async (t) => {
  const owner = "test_user";
  const repo = "test_repo";
  const env = { GITHUB_TOKEN: "github_token" };
  const pluginConfig = {};
  const nextRelease = {
    gitTag: "v1.0.0",
    name: "v1.0.0",
    notes: "Test release note body",
  };
  const options = { repositoryUrl: `https://github.com/${owner}/${repo}.git` };
  const releaseId = 1;

  const fetch = fetchMock
    .sandbox()
    .getOnce(
      `https://api.github.local/repos/${owner}/${repo}/releases/tags/${nextRelease.gitTag}`,
      { id: releaseId },
    )
    .patchOnce(
      `https://api.github.local/repos/${owner}/${repo}/releases/${releaseId}`,
      404,
      {
        body: {
          tag_name: nextRelease.gitTag,
          name: nextRelease.name,
          prerelease: false,
        },
      },
    );

  const error = await t.throwsAsync(
    addChannel(
      pluginConfig,
      {
        env,
        options,
        branch: { type: "release", main: true },
        nextRelease,
        logger: t.context.logger,
      },
      {
        Octokit: TestOctokit.defaults((options) => ({
          ...options,
          request: { ...options.request, fetch },
        })),
      },
    ),
  );

  t.is(error.status, 404);
  t.true(fetch.done());
});
