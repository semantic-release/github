import test from "ava";
import sinon from "sinon";
import SemanticReleaseError from "@semantic-release/error";
import fetchMock from "fetch-mock";
import { RELEASE_FAIL_LABEL } from "../lib/definitions/constants.js";

import { TestOctokit } from "./helpers/test-octokit.js";

const cwd = "test/fixtures/files";
let cacheBuster = 0;

test.beforeEach(async (t) => {
  t.context.m = await import(`../index.js?${++cacheBuster}`);
  // Stub the logger
  t.context.log = sinon.stub();
  t.context.error = sinon.stub();
  t.context.warn = sinon.stub();
  t.context.logger = {
    log: t.context.log,
    error: t.context.error,
    warn: t.context.warn,
  };
});

test("Verify GitHub auth", async (t) => {
  const owner = "test_user";
  const repo = "test_repo";
  const env = { GITHUB_TOKEN: "github_token" };
  const options = {
    repositoryUrl: `git+https://othertesturl.com/${owner}/${repo}.git`,
  };

  const fm = fetchMock
    .createInstance()
    .get(`https://api.github.local/repos/${owner}/${repo}`, {
      permissions: {
        push: true,
      },
      clone_url: `https://api.github.local/${owner}/${repo}.git`,
    });

  await t.notThrowsAsync(
    t.context.m.verifyConditions(
      {},
      { cwd, env, options, logger: t.context.logger },
      {
        Octokit: TestOctokit.defaults((options) => ({
          ...options,
          request: { ...options.request, fetch: fm.fetchHandler },
        })),
      },
    ),
  );

  t.true(fm.callHistory.done());
});

test("Verify GitHub auth with publish options", async (t) => {
  const owner = "test_user";
  const repo = "test_repo";
  const env = { GITHUB_TOKEN: "github_token" };
  const options = {
    publish: { path: "@semantic-release/github" },
    repositoryUrl: `git+https://othertesturl.com/${owner}/${repo}.git`,
  };
  const fm = fetchMock
    .createInstance()
    .get(`https://api.github.local/repos/${owner}/${repo}`, {
      permissions: {
        push: true,
      },
      clone_url: `https://api.github.local/${owner}/${repo}.git`,
    });

  await t.notThrowsAsync(
    t.context.m.verifyConditions(
      {},
      { cwd, env, options, logger: t.context.logger },
      {
        Octokit: TestOctokit.defaults((options) => ({
          ...options,
          request: { ...options.request, fetch: fm.fetchHandler },
        })),
      },
    ),
  );

  t.true(fm.callHistory.done());
});

test("Verify GitHub auth and assets config", async (t) => {
  const owner = "test_user";
  const repo = "test_repo";
  const env = { GITHUB_TOKEN: "github_token" };
  const assets = [
    { path: "lib/file.js" },
    "file.js",
    ["dist/**"],
    ["dist/**", "!dist/*.js"],
    { path: ["dist/**", "!dist/*.js"] },
  ];
  const options = {
    publish: [{ path: "@semantic-release/npm" }],
    repositoryUrl: `git+https://othertesturl.com/${owner}/${repo}.git`,
  };
  const fm = fetchMock
    .createInstance()
    .get(`https://api.github.local/repos/${owner}/${repo}`, {
      permissions: {
        push: true,
      },
      clone_url: `https://api.github.local/${owner}/${repo}.git`,
    });

  await t.notThrowsAsync(
    t.context.m.verifyConditions(
      { assets },
      { cwd, env, options, logger: t.context.logger },
      {
        Octokit: TestOctokit.defaults((options) => ({
          ...options,
          request: { ...options.request, fetch: fm.fetchHandler },
        })),
      },
    ),
  );

  t.true(fm.callHistory.done());
});

test("Throw SemanticReleaseError if invalid config", async (t) => {
  const env = {};
  const assets = [{ wrongProperty: "lib/file.js" }];
  const successComment = 42;
  const failComment = 42;
  const failTitle = 42;
  const labels = 42;
  const assignees = 42;
  const discussionCategoryName = 42;
  const options = {
    publish: [
      { path: "@semantic-release/npm" },
      {
        path: "@semantic-release/github",
        assets,
        successComment,
        failComment,
        failTitle,
        labels,
        assignees,
        discussionCategoryName,
      },
    ],
    repositoryUrl: "invalid_url",
  };

  const { errors } = await t.throwsAsync(
    t.context.m.verifyConditions(
      {},
      { cwd, env, options, logger: t.context.logger },
      {
        Octokit: TestOctokit.defaults((options) => ({
          ...options,
          request: { ...options.request, fetch: fm.fetchHandler },
        })),
      },
    ),
  );

  t.is(errors[0].name, "SemanticReleaseError");
  t.is(errors[0].code, "EINVALIDASSETS");
  t.is(errors[1].name, "SemanticReleaseError");
  t.is(errors[1].code, "EINVALIDSUCCESSCOMMENT");
  t.is(errors[2].name, "SemanticReleaseError");
  t.is(errors[2].code, "EINVALIDFAILTITLE");
  t.is(errors[3].name, "SemanticReleaseError");
  t.is(errors[3].code, "EINVALIDFAILCOMMENT");
  t.is(errors[4].name, "SemanticReleaseError");
  t.is(errors[4].code, "EINVALIDLABELS");
  t.is(errors[5].name, "SemanticReleaseError");
  t.is(errors[5].code, "EINVALIDASSIGNEES");
  t.is(errors[6].name, "SemanticReleaseError");
  t.is(errors[6].code, "EINVALIDDISCUSSIONCATEGORYNAME");
  t.is(errors[7].name, "SemanticReleaseError");
  t.is(errors[7].code, "EINVALIDGITHUBURL");
  t.is(errors[8].name, "SemanticReleaseError");
  t.is(errors[8].code, "ENOGHTOKEN");
});

test("Publish a release with an array of assets", async (t) => {
  const owner = "test_user";
  const repo = "test_repo";
  const env = { GITHUB_TOKEN: "github_token" };
  const assets = [
    { path: ["upload.txt"], name: "upload_file_name.txt" },
    { path: ["upload_other.txt"], name: "other_file.txt", label: "Other File" },
  ];
  const nextRelease = {
    gitTag: "v1.0.0",
    name: "v1.0.0",
    notes: "Test release note body",
  };
  const options = { repositoryUrl: `https://github.com/${owner}/${repo}.git` };
  const releaseUrl = `https://github.com/${owner}/${repo}/releases/${nextRelease.version}`;
  const assetUrl = `https://github.com/${owner}/${repo}/releases/download/${nextRelease.version}/upload.txt`;
  const otherAssetUrl = `https://github.com/${owner}/${repo}/releases/download/${nextRelease.version}/other_file.txt`;
  const releaseId = 1;
  const uploadOrigin = "https://github.com";
  const uploadUri = `/api/uploads/repos/${owner}/${repo}/releases/${releaseId}/assets`;
  const uploadUrl = `${uploadOrigin}${uploadUri}{?name,label}`;

  const fm = fetchMock
    .createInstance()
    .get(`https://api.github.local/repos/${owner}/${repo}`, {
      permissions: {
        push: true,
      },
      clone_url: `https://api.github.local/${owner}/${repo}.git`,
    })
    .post(
      `https://api.github.local/repos/${owner}/${repo}/releases`,
      { upload_url: uploadUrl, html_url: releaseUrl, id: releaseId },
      {
        body: {
          tag_name: nextRelease.gitTag,
          name: nextRelease.name,
          body: nextRelease.notes,
          draft: true,
          prerelease: false,
        },
      },
    )
    .patch(
      `https://api.github.local/repos/${owner}/${repo}/releases/${releaseId}`,
      { html_url: releaseUrl },
      {
        body: { draft: false },
      },
    )
    .post(
      `${uploadOrigin}${uploadUri}?name=${encodeURIComponent(
        "upload_file_name.txt",
      )}&`,
      {
        browser_download_url: assetUrl,
      },
    )
    .post(
      `${uploadOrigin}${uploadUri}?name=${encodeURIComponent(
        "other_file.txt",
      )}&label=${encodeURIComponent("Other File")}`,
      { browser_download_url: otherAssetUrl },
    );

  const result = await t.context.m.publish(
    { assets },
    {
      cwd,
      env,
      options,
      branch: { type: "release", main: true },
      nextRelease,
      logger: t.context.logger,
    },
    {
      Octokit: TestOctokit.defaults((options) => ({
        ...options,
        request: { ...options.request, fetch: fm.fetchHandler },
      })),
    },
  );

  t.is(result.url, releaseUrl);
  t.deepEqual(t.context.log.args[0], ["Verify GitHub authentication"]);
  t.true(t.context.log.calledWith("Published file %s", otherAssetUrl));
  t.true(t.context.log.calledWith("Published file %s", assetUrl));
  t.true(t.context.log.calledWith("Published GitHub release: %s", releaseUrl));
  t.true(fm.callHistory.done());
});

test("Publish a release with release information in assets", async (t) => {
  const owner = "test_user";
  const repo = "test_repo";
  const env = { GITHUB_TOKEN: "github_token" };
  const assets = [
    {
      path: ["upload.txt"],
      name: `file_with_release_\${nextRelease.gitTag}_in_filename.txt`,
      label: `File with release \${nextRelease.gitTag} in label`,
    },
  ];
  const nextRelease = {
    gitTag: "v1.0.0",
    name: "v1.0.0",
    notes: "Test release note body",
  };
  const options = {
    repositoryUrl: `https://github.com/${owner}/${repo}.git`,
  };
  const releaseUrl = `https://github.com/${owner}/${repo}/releases/${nextRelease.version}`;
  const assetUrl = `https://github.com/${owner}/${repo}/releases/download/${nextRelease.version}/file_with_release_v1.0.0_in_filename.txt`;
  const releaseId = 1;
  const uploadOrigin = "https://github.com";
  const uploadUri = `/api/uploads/repos/${owner}/${repo}/releases/${releaseId}/assets`;
  const uploadUrl = `${uploadOrigin}${uploadUri}{?name,label}`;

  const fm = fetchMock
    .createInstance()
    .get(`https://api.github.local/repos/${owner}/${repo}`, {
      permissions: {
        push: true,
      },
      clone_url: `https://api.github.local/${owner}/${repo}.git`,
    })
    .post(
      `https://api.github.local/repos/${owner}/${repo}/releases`,
      { upload_url: uploadUrl, html_url: releaseUrl, id: releaseId },
      {
        body: {
          tag_name: nextRelease.gitTag,
          name: nextRelease.gitTag,
          body: nextRelease.notes,
          draft: true,
          prerelease: true,
        },
      },
    )
    .patch(
      `https://api.github.local/repos/${owner}/${repo}/releases/${releaseId}`,
      { html_url: releaseUrl },
      {
        body: { draft: false },
      },
    )
    .post(
      `${uploadOrigin}${uploadUri}?name=${encodeURIComponent(
        "file_with_release_v1.0.0_in_filename.txt",
      )}&label=${encodeURIComponent("File with release v1.0.0 in label")}`,
      { browser_download_url: assetUrl },
    );

  const result = await t.context.m.publish(
    { assets },
    {
      cwd,
      env,
      options,
      branch: { type: "release" },
      nextRelease,
      logger: t.context.logger,
    },
    {
      Octokit: TestOctokit.defaults((options) => ({
        ...options,
        request: { ...options.request, fetch: fm.fetchHandler },
      })),
    },
  );

  t.is(result.url, releaseUrl);
  t.deepEqual(t.context.log.args[0], ["Verify GitHub authentication"]);
  t.true(t.context.log.calledWith("Published file %s", assetUrl));
  t.true(t.context.log.calledWith("Published GitHub release: %s", releaseUrl));
  t.true(fm.callHistory.done());
});

test("Update a release", async (t) => {
  const owner = "test_user";
  const repo = "test_repo";
  const env = { GITHUB_TOKEN: "github_token" };
  const nextRelease = {
    gitTag: "v1.0.0",
    name: "v1.0.0",
    notes: "Test release note body",
  };
  const options = { repositoryUrl: `https://github.com/${owner}/${repo}.git` };
  const releaseUrl = `https://github.com/${owner}/${repo}/releases/${nextRelease.version}`;
  const releaseId = 1;

  const fm = fetchMock
    .createInstance()
    .get(`https://api.github.local/repos/${owner}/${repo}`, {
      permissions: {
        push: true,
      },
      clone_url: `https://api.github.local/${owner}/${repo}.git`,
    })
    .get(
      `https://api.github.local/repos/${owner}/${repo}/releases/tags/${nextRelease.gitTag}`,
      { id: releaseId },
    )
    .patch(
      `https://api.github.local/repos/${owner}/${repo}/releases/${releaseId}`,
      { html_url: releaseUrl },
      {
        body: {
          tag_name: nextRelease.gitTag,
          name: nextRelease.name,
          prerelease: false,
        },
      },
    );

  const result = await t.context.m.addChannel(
    {},
    {
      cwd,
      env,
      options,
      branch: { type: "release", main: true },
      nextRelease,
      logger: t.context.logger,
    },
    {
      Octokit: TestOctokit.defaults((options) => ({
        ...options,
        request: { ...options.request, fetch: fm.fetchHandler },
      })),
    },
  );

  t.is(result.url, releaseUrl);
  t.deepEqual(t.context.log.args[0], ["Verify GitHub authentication"]);
  t.deepEqual(t.context.log.args[1], [
    "Updated GitHub release: %s",
    releaseUrl,
  ]);
  t.true(fm.callHistory.done());
});

test("Comment and add labels on PR included in the releases", async (t) => {
  const owner = "test_user";
  const repo = "test_repo";
  const env = { GITHUB_TOKEN: "github_token" };
  const failTitle = "The automated release is failing 🚨";
  const prs = [{ number: 1, __typename: "PullRequest", state: "closed" }];
  const options = {
    repositoryUrl: `https://github.com/${owner}/${repo}.git`,
  };
  const commits = [{ hash: "123", message: "Commit 1 message" }];
  const nextRelease = { version: "1.0.0" };
  const releases = [
    { name: "GitHub release", url: "https://github.com/release" },
  ];

  const fm = fetchMock
    .createInstance()
    .get(
      `https://api.github.local/repos/${owner}/${repo}`,
      {
        permissions: { push: true },
        full_name: `${owner}/${repo}`,
        clone_url: `htttps://api.github.local/${owner}/${repo}.git`,
      },
      {
        repeat: 2,
      },
    )
    .post(
      ({ url, options }) =>
        url === "https://api.github.local/graphql" &&
        /query getAssociatedPRs\(/.test(JSON.parse(options.body).query),
      {
        data: {
          repository: {
            commit123: {
              oid: "123",
              associatedPullRequests: {
                pageInfo: {
                  endCursor: "NI",
                  hasNextPage: false,
                },
                nodes: [prs[0]],
              },
            },
          },
        },
      },
      { repeat: 1 },
    )
    .get(
      `https://api.github.local/repos/${owner}/${repo}/pulls/1/commits`,
      [{ sha: commits[0].hash }],
      { repeat: 1 },
    )
    .post(
      `https://api.github.local/repos/${owner}/${repo}/issues/1/comments`,
      { html_url: "https://github.com/successcomment-1" },
      { repeat: 1 },
    )
    .post(
      `https://api.github.local/repos/${owner}/${repo}/issues/1/labels`,
      {},
      {
        body: ["released"],
        repeat: 1,
      },
    )
    .post(
      ({ url, options }) =>
        url === "https://api.github.local/graphql" &&
        /query getSRIssues\(/.test(JSON.parse(options.body).query),
      {
        data: {
          repository: {
            issues: { nodes: [] },
          },
        },
      },
      { repeat: 1 },
    );

  await t.context.m.success(
    { failTitle },
    {
      cwd,
      env,
      options,
      commits,
      nextRelease,
      releases,
      logger: t.context.logger,
    },
    {
      Octokit: TestOctokit.defaults((options) => ({
        ...options,
        request: { ...options.request, fetch: fm.fetchHandler },
      })),
    },
  );

  t.deepEqual(t.context.log.args[0], ["Verify GitHub authentication"]);
  t.true(
    t.context.log.calledWith(
      "Added comment to PR #%d: %s",
      1,
      "https://github.com/successcomment-1",
    ),
  );
  t.true(
    t.context.log.calledWith("Added labels %O to PR #%d", ["released"], 1),
  );
  t.true(fm.callHistory.done());
});

test("Open a new issue with the list of errors", async (t) => {
  const owner = "test_user";
  const repo = "test_repo";
  const env = { GITHUB_TOKEN: "github_token" };
  const failTitle = "The automated release is failing 🚨";
  const options = { repositoryUrl: `https://github.com/${owner}/${repo}.git` };
  const errors = [
    new SemanticReleaseError("Error message 1", "ERR1", "Error 1 details"),
    new SemanticReleaseError("Error message 2", "ERR2", "Error 2 details"),
    new SemanticReleaseError("Error message 3", "ERR3", "Error 3 details"),
  ];

  const fm = fetchMock
    .createInstance()
    .get(
      `https://api.github.local/repos/${owner}/${repo}`,
      {
        permissions: { push: true },
        full_name: `${owner}/${repo}`,
        clone_url: `htttps://api.github.local/${owner}/${repo}.git`,
      },
      { repeat: 2 },
    )
    .post("https://api.github.local/graphql", {
      data: {
        repository: {
          issues: { nodes: [] },
        },
      },
    })
    .post(
      ({ url, options }) => {
        if (url !== `https://api.github.local/repos/${owner}/${repo}/issues`)
          return false;
        const data = JSON.parse(options.body);
        t.is(data.title, failTitle);
        t.regex(
          data.body,
          /---\n\n### Error message 1\n\nError 1 details\n\n---\n\n### Error message 2\n\nError 2 details\n\n---\n\n### Error message 3\n\nError 3 details\n\n---/,
        );
        t.deepEqual(data.labels, ["semantic-release", RELEASE_FAIL_LABEL]);

        return true;
      },
      { html_url: "https://github.com/issues/1", number: 1 },
    );

  await t.context.m.fail(
    { failTitle },
    {
      cwd,
      env,
      options,
      branch: { name: "master" },
      errors,
      logger: t.context.logger,
    },
    {
      Octokit: TestOctokit.defaults((options) => ({
        ...options,
        request: { ...options.request, fetch: fm.fetchHandler },
      })),
    },
  );

  t.deepEqual(t.context.log.args[0], ["Verify GitHub authentication"]);
  t.true(
    t.context.log.calledWith(
      "Created issue #%d: %s.",
      1,
      "https://github.com/issues/1",
    ),
  );
  t.true(fm.callHistory.done());
});

test("Verify, release and notify success", async (t) => {
  const owner = "test_user";
  const repo = "test_repo";
  const env = { GITHUB_TOKEN: "github_token" };
  const assets = [
    "upload.txt",
    { path: "upload_other.txt", name: "other_file.txt", label: "Other File" },
  ];
  const failTitle = "The automated release is failing 🚨";
  const options = {
    publish: [
      { path: "@semantic-release/npm" },
      { path: "@semantic-release/github", assets },
    ],
    repositoryUrl: `https://github.com/${owner}/${repo}.git`,
  };
  const nextRelease = {
    gitTag: "v1.0.0",
    name: "v1.0.0",
    notes: "Test release note body",
  };
  const releaseUrl = `https://github.com/${owner}/${repo}/releases/${nextRelease.version}`;
  const assetUrl = `https://github.com/${owner}/${repo}/releases/download/${nextRelease.version}/upload.txt`;
  const otherAssetUrl = `https://github.com/${owner}/${repo}/releases/download/${nextRelease.version}/other_file.txt`;
  const releaseId = 1;
  const uploadOrigin = "https://github.com";
  const uploadUri = `/api/uploads/repos/${owner}/${repo}/releases/${releaseId}/assets`;
  const uploadUrl = `${uploadOrigin}${uploadUri}{?name,label}`;
  const prs = [{ number: 1, pull_request: true, state: "closed" }];
  const commits = [{ hash: "123", message: "Commit 1 message" }];

  const fm = fetchMock
    .createInstance()
    .get(
      `https://api.github.local/repos/${owner}/${repo}`,
      {
        permissions: { push: true },
        full_name: `${owner}/${repo}`,
        clone_url: `htttps://api.github.local/${owner}/${repo}.git`,
      },
      {
        repeat: 2,
      },
    )
    .post(
      ({ url, options }) =>
        url === "https://api.github.local/graphql" &&
        JSON.parse(options.body).query.includes("query getAssociatedPRs("),
      {
        data: {
          repository: {
            commit123: {
              oid: "123",
              associatedPullRequests: {
                pageInfo: {
                  endCursor: "NI",
                  hasNextPage: false,
                },
                nodes: [prs[0]],
              },
            },
          },
        },
      },
    )
    .post(
      ({ url, options }) =>
        url === "https://api.github.local/graphql" &&
        JSON.parse(options.body).query.includes("query getSRIssues("),
      {
        data: {
          repository: {
            issues: { nodes: [] },
          },
        },
      },
    )
    .post(
      `https://api.github.local/repos/${owner}/${repo}/releases`,
      {
        upload_url: uploadUrl,
        html_url: releaseUrl,
        id: releaseId,
      },
      {
        body: {
          tag_name: nextRelease.gitTag,
          name: nextRelease.name,
          body: nextRelease.notes,
          draft: true,
          prerelease: false,
        },
      },
    )
    .patch(
      `https://api.github.local/repos/${owner}/${repo}/releases/${releaseId}`,
      { html_url: releaseUrl },
      { body: { draft: false } },
    )
    .get(`https://api.github.local/repos/${owner}/${repo}/pulls/1/commits`, [
      { sha: commits[0].hash },
    ])
    .post(
      `https://api.github.local/repos/${owner}/${repo}/issues/1/labels`,
      {},
      { body: ["released"] },
    )
    .post(
      `${uploadOrigin}${uploadUri}?name=${encodeURIComponent("upload.txt")}&`,
      { browser_download_url: assetUrl },
    )
    .post(
      `${uploadOrigin}${uploadUri}?name=other_file.txt&label=${encodeURIComponent(
        "Other File",
      )}`,
      {
        browser_download_url: otherAssetUrl,
      },
    )
    .post(`https://api.github.local/repos/${owner}/${repo}/issues/1/comments`, {
      html_url: "https://github.com/successcomment-1",
    });

  await t.notThrowsAsync(
    t.context.m.verifyConditions(
      {},
      { cwd, env, options, logger: t.context.logger },
      {
        Octokit: TestOctokit.defaults((options) => ({
          ...options,
          request: { ...options.request, fetch: fm.fetchHandler },
        })),
      },
    ),
  );
  await t.context.m.publish(
    { assets },
    {
      cwd,
      env,
      options,
      branch: { type: "release", main: true },
      nextRelease,
      logger: t.context.logger,
    },
    {
      Octokit: TestOctokit.defaults((options) => ({
        ...options,
        request: { ...options.request, fetch: fm.fetchHandler },
      })),
    },
  );
  await t.context.m.success(
    { assets, failTitle },
    {
      cwd,
      env,
      options,
      nextRelease,
      commits,
      releases: [],
      logger: t.context.logger,
    },
    {
      Octokit: TestOctokit.defaults((options) => ({
        ...options,
        request: { ...options.request, fetch: fm.fetchHandler },
      })),
    },
  );

  t.deepEqual(t.context.log.args[0], ["Verify GitHub authentication"]);
  t.true(t.context.log.calledWith("Published file %s", otherAssetUrl));
  t.true(t.context.log.calledWith("Published file %s", assetUrl));
  t.true(t.context.log.calledWith("Published GitHub release: %s", releaseUrl));
  t.true(fm.callHistory.done());
});

test("Verify, update release and notify success", async (t) => {
  const owner = "test_user";
  const repo = "test_repo";
  const env = { GITHUB_TOKEN: "github_token" };
  const failTitle = "The automated release is failing 🚨";
  const options = {
    publish: [
      { path: "@semantic-release/npm" },
      { path: "@semantic-release/github" },
    ],
    repositoryUrl: `https://github.com/${owner}/${repo}.git`,
  };
  const nextRelease = {
    gitTag: "v1.0.0",
    name: "v1.0.0",
    notes: "Test release note body",
  };
  const releaseUrl = `https://github.com/${owner}/${repo}/releases/${nextRelease.version}`;
  const releaseId = 1;
  const prs = [{ number: 1, pull_request: true, state: "closed" }];
  const commits = [
    { hash: "123", message: "Commit 1 message", tree: { long: "aaa" } },
  ];

  const fm = fetchMock
    .createInstance()
    .get(
      `https://api.github.local/repos/${owner}/${repo}`,
      {
        permissions: { push: true },
        full_name: `${owner}/${repo}`,
        clone_url: `htttps://api.github.local/${owner}/${repo}.git`,
      },
      {
        repeat: 2,
      },
    )
    .get(
      `https://api.github.local/repos/${owner}/${repo}/releases/tags/${nextRelease.gitTag}`,
      { id: releaseId },
    )
    .patch(
      `https://api.github.local/repos/${owner}/${repo}/releases/${releaseId}`,
      { html_url: releaseUrl },
      {
        body: {
          tag_name: nextRelease.gitTag,
          name: nextRelease.name,
          prerelease: false,
        },
      },
    )
    .post(
      ({ url, options }) =>
        url === "https://api.github.local/graphql" &&
        /query getAssociatedPRs\(/.test(JSON.parse(options.body).query),
      {
        data: {
          repository: {
            commit123: {
              oid: "123",
              associatedPullRequests: {
                pageInfo: {
                  endCursor: "NI",
                  hasNextPage: false,
                },
                nodes: [prs[0]],
              },
            },
          },
        },
      },
      { repeat: 1 },
    )
    .get(
      `https://api.github.local/repos/${owner}/${repo}/pulls/1/commits`,
      [{ sha: commits[0].hash }],
      { repeat: 1 },
    )
    .post(
      `https://api.github.local/repos/${owner}/${repo}/issues/1/comments`,
      { html_url: "https://github.com/successcomment-1" },
      { repeat: 1 },
    )
    .post(
      `https://api.github.local/repos/${owner}/${repo}/issues/1/labels`,
      {},
      {
        body: ["released"],
        repeat: 1,
      },
    )
    .post(
      ({ url, options }) =>
        url === "https://api.github.local/graphql" &&
        /query getSRIssues\(/.test(JSON.parse(options.body).query),
      {
        data: {
          repository: {
            issues: { nodes: [] },
          },
        },
      },
      { repeat: 1 },
    );

  await t.notThrowsAsync(
    t.context.m.verifyConditions(
      {},
      { cwd, env, options, logger: t.context.logger },
      {
        Octokit: TestOctokit.defaults((options) => ({
          ...options,
          request: { ...options.request, fetch: fm.fetchHandler },
        })),
      },
    ),
  );
  await t.context.m.addChannel(
    {},
    {
      cwd,
      env,
      branch: { type: "release", main: true },
      nextRelease,
      options,
      logger: t.context.logger,
    },
    {
      Octokit: TestOctokit.defaults((options) => ({
        ...options,
        request: { ...options.request, fetch: fm.fetchHandler },
      })),
    },
  );
  await t.context.m.success(
    { failTitle },
    {
      cwd,
      env,
      options,
      nextRelease,
      commits,
      releases: [],
      logger: t.context.logger,
    },
    {
      Octokit: TestOctokit.defaults((options) => ({
        ...options,
        request: { ...options.request, fetch: fm.fetchHandler },
      })),
    },
  );

  t.deepEqual(t.context.log.args[0], ["Verify GitHub authentication"]);
  t.deepEqual(t.context.log.args[1], [
    "Updated GitHub release: %s",
    releaseUrl,
  ]);
  t.true(fm.callHistory.done());
});

test("Verify and notify failure", async (t) => {
  const owner = "test_user";
  const repo = "test_repo";
  const env = { GITHUB_TOKEN: "github_token" };
  const failTitle = "The automated release is failing 🚨";
  const options = { repositoryUrl: `https://github.com/${owner}/${repo}.git` };
  const errors = [
    new SemanticReleaseError("Error message 1", "ERR1", "Error 1 details"),
    new SemanticReleaseError("Error message 2", "ERR2", "Error 2 details"),
    new SemanticReleaseError("Error message 3", "ERR3", "Error 3 details"),
  ];

  const fm = fetchMock
    .createInstance()
    .get(
      `https://api.github.local/repos/${owner}/${repo}`,
      {
        permissions: { push: true },
        full_name: `${owner}/${repo}`,
        clone_url: `htttps://api.github.local/${owner}/${repo}.git`,
      },
      {
        repeat: 2,
      },
    )
    .post("https://api.github.local/graphql", {
      data: {
        repository: {
          issues: { nodes: [] },
        },
      },
    })
    .post(`https://api.github.local/repos/${owner}/${repo}/issues`, {
      html_url: "https://github.com/issues/1",
      number: 1,
    });

  await t.notThrowsAsync(
    t.context.m.verifyConditions(
      {},
      { cwd, env, options, logger: t.context.logger },
      {
        Octokit: TestOctokit.defaults((options) => ({
          ...options,
          request: { ...options.request, fetch: fm.fetchHandler },
        })),
      },
    ),
  );
  await t.context.m.fail(
    { failTitle },
    {
      cwd,
      env,
      options,
      branch: { name: "master" },
      errors,
      logger: t.context.logger,
    },
    {
      Octokit: TestOctokit.defaults((options) => ({
        ...options,
        request: { ...options.request, fetch: fm.fetchHandler },
      })),
    },
  );

  t.deepEqual(t.context.log.args[0], ["Verify GitHub authentication"]);
  t.true(
    t.context.log.calledWith(
      "Created issue #%d: %s.",
      1,
      "https://github.com/issues/1",
    ),
  );
  t.true(fm.callHistory.done());
});
