import { stat } from "node:fs/promises";
import { resolve } from "node:path";
import { escape } from "node:querystring";

import nock from "nock";
import sinon from "sinon";
import tempy from "tempy";
import test from "ava";

import { authenticate, upload } from "./helpers/mock-github.js";
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

test.afterEach.always(() => {
  // Clear nock
  nock.cleanAll();
});

test.serial("Publish a release", async (t) => {
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

  const github = authenticate(env)
    .post(`/repos/${owner}/${repo}/releases`, {
      tag_name: nextRelease.gitTag,
      target_commitish: branch,
      name: nextRelease.name,
      body: nextRelease.notes,
      prerelease: false,
    })
    .reply(200, { upload_url: uploadUrl, html_url: releaseUrl });

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
    { Octokit: TestOctokit }
  );

  t.is(result.url, releaseUrl);
  t.deepEqual(t.context.log.args[0], [
    "Published GitHub release: %s",
    releaseUrl,
  ]);
  t.true(github.isDone());
});

test.serial("Publish a release on a channel", async (t) => {
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

  const github = authenticate(env)
    .post(`/repos/${owner}/${repo}/releases`, {
      tag_name: nextRelease.gitTag,
      target_commitish: branch,
      name: nextRelease.name,
      body: nextRelease.notes,
      prerelease: true,
    })
    .reply(200, { upload_url: uploadUrl, html_url: releaseUrl });

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
    { Octokit: TestOctokit }
  );

  t.is(result.url, releaseUrl);
  t.deepEqual(t.context.log.args[0], [
    "Published GitHub release: %s",
    releaseUrl,
  ]);
  t.true(github.isDone());
});

test.serial("Publish a prerelease", async (t) => {
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

  const github = authenticate(env)
    .post(`/repos/${owner}/${repo}/releases`, {
      tag_name: nextRelease.gitTag,
      target_commitish: branch,
      name: nextRelease.name,
      body: nextRelease.notes,
      prerelease: true,
    })
    .reply(200, { upload_url: uploadUrl, html_url: releaseUrl });

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
    { Octokit: TestOctokit }
  );

  t.is(result.url, releaseUrl);
  t.deepEqual(t.context.log.args[0], [
    "Published GitHub release: %s",
    releaseUrl,
  ]);
  t.true(github.isDone());
});

test.serial("Publish a maintenance release", async (t) => {
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

  const github = authenticate(env)
    .post(`/repos/${owner}/${repo}/releases`, {
      tag_name: nextRelease.gitTag,
      target_commitish: branch,
      name: nextRelease.name,
      body: nextRelease.notes,
      prerelease: false,
    })
    .reply(200, { upload_url: uploadUrl, html_url: releaseUrl, id: releaseId });

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
    { Octokit: TestOctokit }
  );

  t.is(result.url, releaseUrl);
  t.deepEqual(t.context.log.args[0], [
    "Published GitHub release: %s",
    releaseUrl,
  ]);
  t.true(github.isDone());
});

test.serial("Publish a release with one asset", async (t) => {
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
  const uploadUri = `/api/uploads/repos/${owner}/${repo}/releases/${releaseId}/assets`;
  const uploadUrl = `https://github.com${uploadUri}{?name,label}`;
  const branch = "test_branch";

  const github = authenticate(env)
    .post(`/repos/${owner}/${repo}/releases`, {
      tag_name: nextRelease.gitTag,
      target_commitish: branch,
      name: nextRelease.name,
      body: nextRelease.notes,
      draft: true,
      prerelease: false,
    })
    .reply(200, {
      upload_url: uploadUrl,
      html_url: untaggedReleaseUrl,
      id: releaseId,
    })
    .patch(`/repos/${owner}/${repo}/releases/${releaseId}`, { draft: false })
    .reply(200, { upload_url: uploadUrl, html_url: releaseUrl });

  const githubUpload = upload(env, {
    uploadUrl: "https://github.com",
    contentLength: (await stat(resolve(cwd, ".dotfile"))).size,
  })
    .post(
      `${uploadUri}?name=${escape(".dotfile")}&label=${escape(
        "A dotfile with no ext"
      )}`
    )
    .reply(200, { browser_download_url: assetUrl });

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
    { Octokit: TestOctokit }
  );

  t.is(result.url, releaseUrl);
  t.true(t.context.log.calledWith("Published GitHub release: %s", releaseUrl));
  t.true(t.context.log.calledWith("Published file %s", assetUrl));
  t.true(github.isDone());
  t.true(githubUpload.isDone());
});

test.serial(
  "Publish a release with one asset and custom github url",
  async (t) => {
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

    const github = authenticate(env, {})
      .post(`/repos/${owner}/${repo}/releases`, {
        tag_name: nextRelease.gitTag,
        target_commitish: branch,
        name: nextRelease.name,
        body: nextRelease.notes,
        draft: true,
        prerelease: false,
      })
      .reply(200, {
        upload_url: uploadUrl,
        html_url: untaggedReleaseUrl,
        id: releaseId,
      })
      .patch(`/repos/${owner}/${repo}/releases/${releaseId}`, { draft: false })
      .reply(200, { upload_url: uploadUrl, html_url: releaseUrl });

    const githubUpload = upload(env, {
      uploadUrl: env.GH_URL,
      contentLength: (await stat(resolve(cwd, "upload.txt"))).size,
    })
      .post(
        `${uploadUri}?name=${escape("upload.txt")}&label=${escape(
          "A text file"
        )}`
      )
      .reply(200, { browser_download_url: assetUrl });

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
      { Octokit: TestOctokit }
    );

    t.is(result.url, releaseUrl);
    t.true(
      t.context.log.calledWith("Published GitHub release: %s", releaseUrl)
    );
    t.true(t.context.log.calledWith("Published file %s", assetUrl));
    t.true(github.isDone());
    t.true(githubUpload.isDone());
  }
);

test.serial("Publish a release with an array of missing assets", async (t) => {
  const owner = "test_user";
  const repo = "test_repo";
  const env = { GITHUB_TOKEN: "github_token" };
  const emptyDirectory = tempy.directory();
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
  const uploadUri = `/api/uploads/repos/${owner}/${repo}/releases/${releaseId}/assets`;
  const uploadUrl = `https://github.com${uploadUri}{?name,label}`;
  const branch = "test_branch";

  const github = authenticate(env)
    .post(`/repos/${owner}/${repo}/releases`, {
      tag_name: nextRelease.gitTag,
      target_commitish: branch,
      name: nextRelease.name,
      body: nextRelease.notes,
      draft: true,
      prerelease: false,
    })
    .reply(200, {
      upload_url: uploadUrl,
      html_url: untaggedReleaseUrl,
      id: releaseId,
    })
    .patch(`/repos/${owner}/${repo}/releases/${releaseId}`, { draft: false })
    .reply(200, { html_url: releaseUrl });

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
    { Octokit: TestOctokit }
  );

  t.is(result.url, releaseUrl);
  t.true(t.context.log.calledWith("Published GitHub release: %s", releaseUrl));
  t.true(
    t.context.error.calledWith(
      "The asset %s cannot be read, and will be ignored.",
      "missing.txt"
    )
  );
  t.true(
    t.context.error.calledWith(
      "The asset %s is not a file, and will be ignored.",
      emptyDirectory
    )
  );
  t.true(github.isDone());
});

test.serial("Publish a draft release", async (t) => {
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

  const github = authenticate(env)
    .post(`/repos/${owner}/${repo}/releases`, {
      tag_name: nextRelease.gitTag,
      target_commitish: branch,
      name: nextRelease.name,
      body: nextRelease.notes,
      draft: true,
      prerelease: false,
    })
    .reply(200, { upload_url: uploadUrl, html_url: releaseUrl });

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
    { Octokit: TestOctokit }
  );

  t.is(result.url, releaseUrl);
  t.deepEqual(t.context.log.args[0], [
    "Created GitHub draft release: %s",
    releaseUrl,
  ]);
  t.true(github.isDone());
});

test.serial("Publish a draft release with one asset", async (t) => {
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
  const uploadUri = `/api/uploads/repos/${owner}/${repo}/releases/${releaseId}/assets`;
  const uploadUrl = `https://github.com${uploadUri}{?name,label}`;
  const branch = "test_branch";

  const github = authenticate(env)
    .post(`/repos/${owner}/${repo}/releases`, {
      tag_name: nextRelease.gitTag,
      target_commitish: branch,
      name: nextRelease.name,
      body: nextRelease.notes,
      draft: true,
      prerelease: false,
    })
    .reply(200, { upload_url: uploadUrl, html_url: releaseUrl, id: releaseId });

  const githubUpload = upload(env, {
    uploadUrl: "https://github.com",
    contentLength: (await stat(resolve(cwd, ".dotfile"))).size,
  })
    .post(
      `${uploadUri}?name=${escape(".dotfile")}&label=${escape(
        "A dotfile with no ext"
      )}`
    )
    .reply(200, { browser_download_url: assetUrl });

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
    { Octokit: TestOctokit }
  );

  t.is(result.url, releaseUrl);
  t.true(
    t.context.log.calledWith("Created GitHub draft release: %s", releaseUrl)
  );
  t.true(t.context.log.calledWith("Published file %s", assetUrl));
  t.true(github.isDone());
  t.true(githubUpload.isDone());
});

test.serial(
  "Publish a release when env.GITHUB_URL is set to https://github.com (Default in GitHub Actions, #268)",
  async (t) => {
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

    const github = authenticate(env)
      .post(`/repos/${owner}/${repo}/releases`, {
        tag_name: nextRelease.gitTag,
        target_commitish: branch,
        name: nextRelease.name,
        body: nextRelease.notes,
        prerelease: false,
      })
      .reply(200, { upload_url: uploadUrl, html_url: releaseUrl });

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
      { Octokit: TestOctokit }
    );

    t.is(result.url, releaseUrl);
    t.deepEqual(t.context.log.args[0], [
      "Published GitHub release: %s",
      releaseUrl,
    ]);
    t.true(github.isDone());
  }
);
