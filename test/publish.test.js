import sinon from "sinon";
import { temporaryDirectory } from "tempy";
import test from "ava";
import fetchMock from "fetch-mock";

import { TestOctokit } from "./helpers/test-octokit.js";

/* eslint camelcase: ["error", {properties: "never"}] */

import publish from "../lib/publish.js";

const cwd = "test/fixtures/files";

test.beforeEach((t) => {
  // Mock logger
  t.context.log = sinon.stub();
  t.context.error = sinon.stub();
  t.context.logger = { log: t.context.log, error: t.context.error };
});

test("Publish a release", async (t) => {
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
  const uploadUri = `/api/uploads/repos/${owner}/${repo}/releases/${releaseId}/assets`;
  const uploadUrl = `https://github.com${uploadUri}{?name,label}`;
  const branch = "test_branch";

  const fetch = fetchMock.sandbox().postOnce(
    `https://api.github.local/repos/${owner}/${repo}/releases`,
    {
      upload_url: uploadUrl,
      html_url: releaseUrl,
    },
    {
      body: {
        tag_name: nextRelease.gitTag,
        target_commitish: branch,
        name: nextRelease.name,
        body: nextRelease.notes,
        prerelease: false,
      },
    },
  );

  const result = await publish(
    pluginConfig,
    {
      cwd,
      env,
      options,
      branch: { name: branch, type: "release", main: true },
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
    "Published GitHub release: %s",
    releaseUrl,
  ]);
  t.true(fetch.done());
});

test("Publish a release on a channel", async (t) => {
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
  const uploadUri = `/api/uploads/repos/${owner}/${repo}/releases/${releaseId}/assets`;
  const uploadUrl = `https://github.com${uploadUri}{?name,label}`;
  const branch = "test_branch";

  const fetch = fetchMock.sandbox().postOnce(
    `https://api.github.local/repos/${owner}/${repo}/releases`,
    {
      upload_url: uploadUrl,
      html_url: releaseUrl,
    },
    {
      body: {
        tag_name: nextRelease.gitTag,
        target_commitish: branch,
        name: nextRelease.name,
        body: nextRelease.notes,
        prerelease: true,
      },
    },
  );

  const result = await publish(
    pluginConfig,
    {
      cwd,
      env,
      options,
      branch: { name: branch, type: "release", channel: "next", main: false },
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
    "Published GitHub release: %s",
    releaseUrl,
  ]);
  t.true(fetch.done());
});

test("Publish a prerelease", async (t) => {
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
  const uploadUri = `/api/uploads/repos/${owner}/${repo}/releases/${releaseId}/assets`;
  const uploadUrl = `https://github.com${uploadUri}{?name,label}`;
  const branch = "test_branch";

  const fetch = fetchMock.sandbox().postOnce(
    `https://api.github.local/repos/${owner}/${repo}/releases`,
    {
      upload_url: uploadUrl,
      html_url: releaseUrl,
    },
    {
      body: {
        tag_name: nextRelease.gitTag,
        target_commitish: branch,
        name: nextRelease.name,
        body: nextRelease.notes,
        prerelease: true,
      },
    },
  );

  const result = await publish(
    pluginConfig,
    {
      cwd,
      env,
      options,
      branch: { name: branch, type: "prerelease", channel: "beta" },
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
    "Published GitHub release: %s",
    releaseUrl,
  ]);
  t.true(fetch.done());
});

test("Publish a maintenance release", async (t) => {
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
  const uploadUri = `/api/uploads/repos/${owner}/${repo}/releases/${releaseId}/assets`;
  const uploadUrl = `https://github.com${uploadUri}{?name,label}`;
  const branch = "test_branch";

  const fetch = fetchMock.sandbox().postOnce(
    `https://api.github.local/repos/${owner}/${repo}/releases`,
    {
      upload_url: uploadUrl,
      html_url: releaseUrl,
      id: releaseId,
    },
    {
      body: {
        tag_name: nextRelease.gitTag,
        target_commitish: branch,
        name: nextRelease.name,
        body: nextRelease.notes,
        prerelease: false,
      },
    },
  );

  const result = await publish(
    pluginConfig,
    {
      cwd,
      env,
      options,
      branch: {
        name: "test_branch",
        type: "maintenance",
        channel: "1.x",
        main: false,
      },
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
    "Published GitHub release: %s",
    releaseUrl,
  ]);
  t.true(fetch.done());
});

test("Publish a release with one asset", async (t) => {
  const owner = "test_user";
  const repo = "test_repo";
  const env = { GITHUB_TOKEN: "github_token" };
  const pluginConfig = {
    assets: [
      ["**", "!**/*.txt"],
      { path: ".dotfile", label: "A dotfile with no ext" },
    ],
  };
  const nextRelease = {
    gitTag: "v1.0.0",
    name: "v1.0.0",
    notes: "Test release note body",
  };
  const options = { repositoryUrl: `https://github.com/${owner}/${repo}.git` };
  const untaggedReleaseUrl = `https://github.com/${owner}/${repo}/releases/untagged-123`;
  const releaseUrl = `https://github.com/${owner}/${repo}/releases/${nextRelease.version}`;
  const assetUrl = `https://github.com/${owner}/${repo}/releases/download/${nextRelease.version}/.dotfile`;
  const releaseId = 1;
  const uploadOrigin = `https://uploads.github.local`;
  const uploadUri = `/api/uploads/repos/${owner}/${repo}/releases/${releaseId}/assets`;
  const uploadUrl = `${uploadOrigin}${uploadUri}{?name,label}`;
  const branch = "test_branch";

  const fetch = fetchMock
    .sandbox()
    .postOnce(
      `https://api.github.local/repos/${owner}/${repo}/releases`,
      {
        upload_url: uploadUrl,
        html_url: untaggedReleaseUrl,
        id: releaseId,
      },
      {
        body: {
          tag_name: nextRelease.gitTag,
          target_commitish: branch,
          name: nextRelease.name,
          body: nextRelease.notes,
          draft: true,
          prerelease: false,
        },
      },
    )
    .patchOnce(
      `https://api.github.local/repos/${owner}/${repo}/releases/${releaseId}`,
      { upload_url: uploadUrl, html_url: releaseUrl },
      { body: { draft: false } },
    )
    .postOnce(
      `${uploadOrigin}${uploadUri}?name=${encodeURIComponent(
        ".dotfile",
      )}&label=${encodeURIComponent("A dotfile with no ext")}`,
      { browser_download_url: assetUrl },
    );

  const result = await publish(
    pluginConfig,
    {
      cwd,
      env,
      options,
      branch: { name: branch, type: "release", main: true },
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
  t.true(t.context.log.calledWith("Published GitHub release: %s", releaseUrl));
  t.true(t.context.log.calledWith("Published file %s", assetUrl));
  t.true(fetch.done());
});

test("Publish a release with one asset and custom github url", async (t) => {
  const owner = "test_user";
  const repo = "test_repo";
  const env = {
    GH_URL: "https://othertesturl.com:443",
    GH_TOKEN: "github_token",
    GH_PREFIX: "prefix",
  };
  const pluginConfig = {
    assets: [
      ["*.txt", "!**/*_other.txt"],
      { path: ["*.txt", "!**/*_other.txt"], label: "A text file" },
      "upload.txt",
    ],
  };
  const nextRelease = {
    gitTag: "v1.0.0",
    name: "v1.0.0",
    notes: "Test release note body",
  };
  const options = {
    repositoryUrl: `https://github.com/${owner}/${repo}.git`,
  };
  const untaggedReleaseUrl = `${env.GH_URL}/${owner}/${repo}/releases/untagged-123`;
  const releaseUrl = `${env.GH_URL}/${owner}/${repo}/releases/${nextRelease.version}`;
  const assetUrl = `${env.GH_URL}/${owner}/${repo}/releases/download/${nextRelease.version}/upload.txt`;
  const releaseId = 1;
  const uploadUri = `/api/uploads/repos/${owner}/${repo}/releases/${releaseId}/assets`;
  const uploadUrl = `${env.GH_URL}${uploadUri}{?name,label}`;
  const branch = "test_branch";

  const fetch = fetchMock
    .sandbox()
    .postOnce(
      `${env.GH_URL}/prefix/repos/${owner}/${repo}/releases`,
      {
        upload_url: uploadUrl,
        html_url: untaggedReleaseUrl,
        id: releaseId,
      },
      {
        body: {
          tag_name: nextRelease.gitTag,
          target_commitish: branch,
          name: nextRelease.name,
          body: nextRelease.notes,
          draft: true,
          prerelease: false,
        },
      },
    )
    .patchOnce(
      `${env.GH_URL}/prefix/repos/${owner}/${repo}/releases/${releaseId}`,
      { upload_url: uploadUrl, html_url: releaseUrl },
      { body: { draft: false } },
    )
    .postOnce(
      `${env.GH_URL}${uploadUri}?name=${encodeURIComponent(
        "upload.txt",
      )}&label=${encodeURIComponent("A text file")}`,
      { browser_download_url: assetUrl },
    );

  const result = await publish(
    pluginConfig,
    {
      cwd,
      env,
      options,
      branch: { name: branch, type: "release", main: true },
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
  t.true(t.context.log.calledWith("Published GitHub release: %s", releaseUrl));
  t.true(t.context.log.calledWith("Published file %s", assetUrl));
  t.true(fetch.done());
});

test("Publish a release with an array of missing assets", async (t) => {
  const owner = "test_user";
  const repo = "test_repo";
  const env = { GITHUB_TOKEN: "github_token" };
  const emptyDirectory = temporaryDirectory();
  const pluginConfig = {
    assets: [emptyDirectory, { path: "missing.txt", name: "missing.txt" }],
  };
  const nextRelease = {
    gitTag: "v1.0.0",
    name: "v1.0.0",
    notes: "Test release note body",
  };
  const options = { repositoryUrl: `https://github.com/${owner}/${repo}.git` };
  const untaggedReleaseUrl = `https://github.com/${owner}/${repo}/releases/untagged-123`;
  const releaseUrl = `https://github.com/${owner}/${repo}/releases/${nextRelease.version}`;
  const releaseId = 1;
  const assetUrl = `${env.GH_URL}/${owner}/${repo}/releases/download/${nextRelease.version}/upload.txt`;
  const uploadOrigin = "https://uploads.github.com";
  const uploadUri = `/repos/${owner}/${repo}/releases/${releaseId}/assets`;
  const uploadUrl = `${uploadOrigin}${uploadUri}{?name,label}`;
  const branch = "test_branch";

  const fetch = fetchMock
    .sandbox()
    .postOnce(
      `https://api.github.local/repos/${owner}/${repo}/releases`,
      {
        upload_url: uploadUrl,
        html_url: untaggedReleaseUrl,
        id: releaseId,
      },
      {
        body: {
          tag_name: nextRelease.gitTag,
          target_commitish: branch,
          name: nextRelease.name,
          body: nextRelease.notes,
          draft: true,
          prerelease: false,
        },
      },
    )
    .patchOnce(
      `https://api.github.local/repos/${owner}/${repo}/releases/${releaseId}`,
      { html_url: releaseUrl },
      { body: { draft: false } },
    );

  const result = await publish(
    pluginConfig,
    {
      cwd,
      env,
      options,
      branch: { name: branch, type: "release", main: true },
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
  t.true(t.context.log.calledWith("Published GitHub release: %s", releaseUrl));
  t.true(
    t.context.error.calledWith(
      "The asset %s cannot be read, and will be ignored.",
      "missing.txt",
    ),
  );
  t.true(
    t.context.error.calledWith(
      "The asset %s is not a file, and will be ignored.",
      emptyDirectory,
    ),
  );
  t.true(fetch.done());
});

test("Publish a draft release", async (t) => {
  const owner = "test_user";
  const repo = "test_repo";
  const env = { GITHUB_TOKEN: "github_token" };
  const pluginConfig = { draftRelease: true };
  const nextRelease = {
    gitTag: "v1.0.0",
    name: "v1.0.0",
    notes: "Test release note body",
  };
  const options = { repositoryUrl: `https://github.com/${owner}/${repo}.git` };
  const releaseUrl = `https://github.com/${owner}/${repo}/releases/${nextRelease.version}`;
  const releaseId = 1;
  const uploadUri = `/api/uploads/repos/${owner}/${repo}/releases/${releaseId}/assets`;
  const uploadUrl = `https://github.com${uploadUri}{?name,label}`;
  const branch = "test_branch";

  const fetch = fetchMock.sandbox().postOnce(
    `https://api.github.local/repos/${owner}/${repo}/releases`,
    {
      upload_url: uploadUrl,
      html_url: releaseUrl,
    },
    {
      body: {
        tag_name: nextRelease.gitTag,
        target_commitish: branch,
        name: nextRelease.name,
        body: nextRelease.notes,
        draft: true,
        prerelease: false,
      },
    },
  );

  const result = await publish(
    pluginConfig,
    {
      cwd,
      env,
      options,
      branch: { name: branch, type: "release", main: true },
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
    "Created GitHub draft release: %s",
    releaseUrl,
  ]);
  t.true(fetch.done());
});

test("Publish a draft release with one asset", async (t) => {
  const owner = "test_user";
  const repo = "test_repo";
  const env = { GITHUB_TOKEN: "github_token" };
  const pluginConfig = {
    assets: [
      ["**", "!**/*.txt"],
      { path: ".dotfile", label: "A dotfile with no ext" },
    ],
    draftRelease: true,
  };
  const nextRelease = {
    gitTag: "v1.0.0",
    name: "v1.0.0",
    notes: "Test release note body",
  };
  const options = { repositoryUrl: `https://github.com/${owner}/${repo}.git` };
  const releaseUrl = `https://github.com/${owner}/${repo}/releases/${nextRelease.version}`;
  const assetUrl = `https://github.com/${owner}/${repo}/releases/download/${nextRelease.version}/.dotfile`;
  const releaseId = 1;
  const uploadOrigin = `https://uploads.github.local`;
  const uploadUri = `/api/uploads/repos/${owner}/${repo}/releases/${releaseId}/assets`;
  const uploadUrl = `${uploadOrigin}${uploadUri}{?name,label}`;
  const branch = "test_branch";

  const fetch = fetchMock
    .sandbox()
    .postOnce(
      `https://api.github.local/repos/${owner}/${repo}/releases`,
      {
        upload_url: uploadUrl,
        html_url: releaseUrl,
        id: releaseId,
      },
      {
        body: {
          tag_name: nextRelease.gitTag,
          target_commitish: branch,
          name: nextRelease.name,
          body: nextRelease.notes,
          draft: true,
          prerelease: false,
        },
      },
    )
    .postOnce(
      `${uploadOrigin}${uploadUri}?name=${encodeURIComponent(
        ".dotfile",
      )}&label=${encodeURIComponent("A dotfile with no ext")}`,
      { browser_download_url: assetUrl },
    );

  const result = await publish(
    pluginConfig,
    {
      cwd,
      env,
      options,
      branch: { name: branch, type: "release", main: true },
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
  t.true(
    t.context.log.calledWith("Created GitHub draft release: %s", releaseUrl),
  );
  t.true(t.context.log.calledWith("Published file %s", assetUrl));
  t.true(fetch.done());
});

test("Publish a release when env.GITHUB_URL is set to https://github.com (Default in GitHub Actions, #268)", async (t) => {
  const owner = "test_user";
  const repo = "test_repo";
  const env = {
    GITHUB_TOKEN: "github_token",
    GITHUB_URL: "https://github.com",
    GITHUB_API_URL: "https://api.github.com",
  };
  const pluginConfig = {};
  const nextRelease = {
    gitTag: "v1.0.0",
    name: "v1.0.0",
    notes: "Test release note body",
  };
  const options = {
    repositoryUrl: `https://github.com/${owner}/${repo}.git`,
  };
  const releaseUrl = `https://github.com/${owner}/${repo}/releases/${nextRelease.version}`;
  const releaseId = 1;
  const uploadUri = `/api/uploads/repos/${owner}/${repo}/releases/${releaseId}/assets`;
  const uploadUrl = `https://github.com${uploadUri}{?name,label}`;
  const branch = "test_branch";

  const fetch = fetchMock.sandbox().postOnce(
    `https://api.github.com/repos/${owner}/${repo}/releases`,
    {
      upload_url: uploadUrl,
      html_url: releaseUrl,
    },
    {
      body: {
        tag_name: nextRelease.gitTag,
        target_commitish: branch,
        name: nextRelease.name,
        body: nextRelease.notes,
        prerelease: false,
      },
    },
  );

  const result = await publish(
    pluginConfig,
    {
      cwd,
      env,
      options,
      branch: { name: branch, type: "release", main: true },
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
    "Published GitHub release: %s",
    releaseUrl,
  ]);
  t.true(fetch.done());
});

test("Publish a custom release body", async (t) => {
  const owner = "test_user";
  const repo = "test_repo";
  const env = { GITHUB_TOKEN: "github_token" };
  const pluginConfig = {
    releaseBodyTemplate:
      "To install this run npm install package@<%= nextRelease.name %>\n\n<%= nextRelease.notes %>",
  };
  const nextRelease = {
    gitTag: "v1.0.0",
    name: "v1.0.0",
    notes: "Test release note body",
  };
  const options = { repositoryUrl: `https://github.com/${owner}/${repo}.git` };
  const releaseUrl = `https://github.com/${owner}/${repo}/releases/${nextRelease.version}`;
  const releaseId = 1;
  const uploadUri = `/api/uploads/repos/${owner}/${repo}/releases/${releaseId}/assets`;
  const uploadUrl = `https://github.com${uploadUri}{?name,label}`;
  const branch = "test_branch";

  const fetch = fetchMock.sandbox().postOnce(
    `https://api.github.local/repos/${owner}/${repo}/releases`,
    {
      upload_url: uploadUrl,
      html_url: releaseUrl,
    },
    {
      body: {
        tag_name: nextRelease.gitTag,
        target_commitish: branch,
        name: nextRelease.name,
        body: `To install this run npm install package@${nextRelease.name}\n\n${nextRelease.notes}`,
        prerelease: false,
      },
    },
  );

  const result = await publish(
    pluginConfig,
    {
      cwd,
      env,
      options,
      branch: { name: branch, type: "release", main: true },
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
    "Published GitHub release: %s",
    releaseUrl,
  ]);
  t.true(fetch.done());
});

test("Publish a custom release name", async (t) => {
  const owner = "test_user";
  const repo = "test_repo";
  const env = { GITHUB_TOKEN: "github_token" };
  const pluginConfig = {
    releaseNameTemplate:
      "omg its the best release: <%= nextRelease.name %> 🌈🌈",
  };
  const nextRelease = {
    gitTag: "v1.0.0",
    name: "v1.0.0",
    notes: "Test release note body",
  };
  const options = { repositoryUrl: `https://github.com/${owner}/${repo}.git` };
  const releaseUrl = `https://github.com/${owner}/${repo}/releases/${nextRelease.version}`;
  const releaseId = 1;
  const uploadUri = `/api/uploads/repos/${owner}/${repo}/releases/${releaseId}/assets`;
  const uploadUrl = `https://github.com${uploadUri}{?name,label}`;
  const branch = "test_branch";

  const fetch = fetchMock.sandbox().postOnce(
    `https://api.github.local/repos/${owner}/${repo}/releases`,
    {
      upload_url: uploadUrl,
      html_url: releaseUrl,
    },
    {
      body: {
        tag_name: nextRelease.gitTag,
        target_commitish: branch,
        name: `omg its the best release: ${nextRelease.name} 🌈🌈`,
        body: nextRelease.notes,
        prerelease: false,
      },
    },
  );

  const result = await publish(
    pluginConfig,
    {
      cwd,
      env,
      options,
      branch: { name: branch, type: "release", main: true },
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
    "Published GitHub release: %s",
    releaseUrl,
  ]);
  t.true(fetch.done());
});
