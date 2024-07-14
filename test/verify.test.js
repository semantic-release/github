import sinon from "sinon";
import test from "ava";
import fetchMock from "fetch-mock";

import { TestOctokit } from "./helpers/test-octokit.js";

/* eslint camelcase: ["error", {properties: "never"}] */

import verify from "../lib/verify.js";

test.beforeEach((t) => {
  // Mock logger
  t.context.log = sinon.stub();
  t.context.error = sinon.stub();
  t.context.logger = { log: t.context.log, error: t.context.error };
});

test("Verify package, token and repository access", async (t) => {
  const owner = "test_user";
  const repo = "test_repo";
  const env = { GH_TOKEN: "github_token" };
  const proxy = "https://localhost";
  const assets = [{ path: "lib/file.js" }, "file.js"];
  const successComment = "Test comment";
  const failTitle = "Test title";
  const failComment = "Test comment";
  const labels = ["semantic-release"];
  const discussionCategoryName = "Announcements";

  const fetch = fetchMock
    .sandbox()
    .get(`https://api.github.local/repos/${owner}/${repo}`, {
      permissions: { push: true },
      clone_url: `git+https://othertesturl.com/${owner}/${repo}.git`,
    });

  await t.notThrowsAsync(
    verify(
      {
        proxy,
        assets,
        successComment,
        failTitle,
        failComment,
        labels,
        discussionCategoryName,
      },
      {
        env,
        options: {
          repositoryUrl: `git+https://othertesturl.com/${owner}/${repo}.git`,
        },
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
  t.true(fetch.done());
});

test('Verify package, token and repository access with "proxy", "asset", "discussionCategoryName", "successComment", "failTitle", "failComment" and "label" set to "null"', async (t) => {
  const owner = "test_user";
  const repo = "test_repo";
  const env = { GH_TOKEN: "github_token" };
  const proxy = null;
  const assets = null;
  const successComment = null;
  const failTitle = null;
  const failComment = null;
  const labels = null;
  const discussionCategoryName = null;

  const fetch = fetchMock
    .sandbox()
    .get(`https://api.github.local/repos/${owner}/${repo}`, {
      permissions: { push: true },
      clone_url: `git+https://othertesturl.com/${owner}/${repo}.git`,
    });

  await t.notThrowsAsync(
    verify(
      {
        proxy,
        assets,
        successComment,
        failTitle,
        failComment,
        labels,
        discussionCategoryName,
      },
      {
        env,
        options: {
          repositoryUrl: `git+https://othertesturl.com/${owner}/${repo}.git`,
        },
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
  t.true(fetch.done());
});

test("Verify package, token and repository access and custom URL with prefix", async (t) => {
  const owner = "test_user";
  const repo = "test_repo";
  const env = { GH_TOKEN: "github_token" };
  const githubUrl = "https://othertesturl.com:9090";
  const githubApiPathPrefix = "prefix";

  const fetch = fetchMock
    .sandbox()
    .get(`https://othertesturl.com:9090/prefix/repos/${owner}/${repo}`, {
      permissions: { push: true },
      clone_url: `git@othertesturl.com:${owner}/${repo}.git`,
    });

  await t.notThrowsAsync(
    verify(
      { githubUrl, githubApiPathPrefix },
      {
        env,
        options: {
          repositoryUrl: `git@othertesturl.com:${owner}/${repo}.git`,
        },
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

  t.true(fetch.done());
  t.deepEqual(t.context.log.args[0], [
    "Verify GitHub authentication (%s)",
    "https://othertesturl.com:9090/prefix",
  ]);
});

test("Verify package, token and repository access and custom URL without prefix", async (t) => {
  const owner = "test_user";
  const repo = "test_repo";
  const env = { GH_TOKEN: "github_token" };
  const githubUrl = "https://othertesturl.com:9090";

  const fetch = fetchMock
    .sandbox()
    .get(`https://othertesturl.com:9090/repos/${owner}/${repo}`, {
      permissions: { push: true },
      clone_url: `git@othertesturl.com:${owner}/${repo}.git`,
    });

  await t.notThrowsAsync(
    verify(
      { githubUrl },
      {
        env,
        options: {
          repositoryUrl: `git@othertesturl.com:${owner}/${repo}.git`,
        },
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

  t.true(fetch.done());
  t.deepEqual(t.context.log.args[0], [
    "Verify GitHub authentication (%s)",
    "https://othertesturl.com:9090",
  ]);
});

test("Verify package, token and repository access and shorthand repositoryUrl URL", async (t) => {
  const owner = "test_user";
  const repo = "test_repo";
  const env = { GH_TOKEN: "github_token" };
  const githubUrl = "https://othertesturl.com:9090";

  const fetch = fetchMock
    .sandbox()
    .get(`https://othertesturl.com:9090/repos/${owner}/${repo}`, {
      permissions: { push: true },
      clone_url: `github:${owner}/${repo}`,
    });

  await t.notThrowsAsync(
    verify(
      { githubUrl },
      {
        env,
        options: { repositoryUrl: `github:${owner}/${repo}` },
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

  t.true(fetch.done());
  t.deepEqual(t.context.log.args[0], [
    "Verify GitHub authentication (%s)",
    "https://othertesturl.com:9090",
  ]);
});

test("Verify package, token and repository with environment variables", async (t) => {
  const owner = "test_user";
  const repo = "test_repo";
  const env = {
    GH_URL: "https://othertesturl.com:443",
    GH_TOKEN: "github_token",
    GH_PREFIX: "prefix",
    HTTP_PROXY: "https://localhost",
  };
  const fetch = fetchMock
    .sandbox()
    .get(`https://othertesturl.com:443/prefix/repos/${owner}/${repo}`, {
      permissions: { push: true },
      clone_url: `git@othertesturl.com:${owner}/${repo}.git`,
    });

  await t.notThrowsAsync(
    verify(
      {},
      {
        env,
        options: {
          repositoryUrl: `git@othertesturl.com:${owner}/${repo}.git`,
        },
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

  t.true(fetch.done());
  t.deepEqual(t.context.log.args[0], [
    "Verify GitHub authentication (%s)",
    "https://othertesturl.com:443/prefix",
  ]);
});

test("Verify package, token and repository access with alternative environment variables", async (t) => {
  const owner = "test_user";
  const repo = "test_repo";
  const env = {
    GITHUB_URL: "https://othertesturl.com:443",
    GITHUB_TOKEN: "github_token",
    GITHUB_PREFIX: "prefix",
  };

  const fetch = fetchMock
    .sandbox()
    .get(`https://othertesturl.com:443/prefix/repos/${owner}/${repo}`, {
      permissions: { push: true },
      clone_url: `git@othertesturl.com:${owner}/${repo}.git`,
    });

  await t.notThrowsAsync(
    verify(
      {},
      {
        env,
        options: {
          repositoryUrl: `git@othertesturl.com:${owner}/${repo}.git`,
        },
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
  t.true(fetch.done());
});

test("Verify package, token and repository access with custom API URL", async (t) => {
  const owner = "test_user";
  const repo = "test_repo";
  const env = { GH_TOKEN: "github_token" };
  const githubUrl = "https://othertesturl.com:9090";
  const githubApiUrl = "https://api.othertesturl.com:9090";

  const fetch = fetchMock
    .sandbox()
    .get(`https://api.othertesturl.com:9090/repos/${owner}/${repo}`, {
      permissions: { push: true },
      clone_url: `github:${owner}/${repo}`,
    });

  await t.notThrowsAsync(
    verify(
      { githubUrl, githubApiUrl },
      {
        env,
        options: { repositoryUrl: `github:${owner}/${repo}` },
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

  t.true(fetch.done());
  t.deepEqual(t.context.log.args[0], [
    "Verify GitHub authentication (%s)",
    "https://api.othertesturl.com:9090",
  ]);
});

test("Verify package, token and repository access with API URL in environment variable", async (t) => {
  const owner = "test_user";
  const repo = "test_repo";
  const env = {
    GITHUB_URL: "https://othertesturl.com:443",
    GITHUB_API_URL: "https://api.othertesturl.com:443",
    GITHUB_TOKEN: "github_token",
  };

  const fetch = fetchMock
    .sandbox()
    .get(`https://api.othertesturl.com:443/repos/${owner}/${repo}`, {
      permissions: { push: true },
      clone_url: `git@othertesturl.com:${owner}/${repo}.git`,
    });

  await t.notThrowsAsync(
    verify(
      {},
      {
        env,
        options: {
          repositoryUrl: `git@othertesturl.com:${owner}/${repo}.git`,
        },
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
  t.true(fetch.done());
});

test('Verify "proxy" is a String', async (t) => {
  const owner = "test_user";
  const repo = "test_repo";
  const env = { GH_TOKEN: "github_token" };
  const proxy = "https://locahost";

  const fetch = fetchMock
    .sandbox()
    .get(`https://api.github.local/repos/${owner}/${repo}`, {
      permissions: { push: true },
      clone_url: `git@othertesturl.com:${owner}/${repo}.git`,
    });

  await t.notThrowsAsync(
    verify(
      { proxy },
      {
        env,
        options: { repositoryUrl: `git@othertesturl.com:${owner}/${repo}.git` },
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

  t.true(fetch.done());
});

test('Verify "proxy" is an object with "host" and "port" properties', async (t) => {
  const owner = "test_user";
  const repo = "test_repo";
  const env = { GH_TOKEN: "github_token" };
  const proxy = { host: "locahost", port: 80 };

  const fetch = fetchMock
    .sandbox()
    .get(`https://api.github.local/repos/${owner}/${repo}`, {
      permissions: { push: true },
      clone_url: `git@othertesturl.com:${owner}/${repo}.git`,
    });

  await t.notThrowsAsync(
    verify(
      { proxy },
      {
        env,
        options: {
          repositoryUrl: `git@othertesturl.com:${owner}/${repo}.git`,
        },
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

  t.true(fetch.done());
});

test('Verify "proxy" is a Boolean set to false', async (t) => {
  const owner = "test_user";
  const repo = "test_repo";
  const env = { GH_TOKEN: "github_token" };
  const proxy = false;

  const fetch = fetchMock
    .sandbox()
    .get(`https://api.github.local/repos/${owner}/${repo}`, {
      permissions: { push: true },
      clone_url: `git@othertesturl.com:${owner}/${repo}.git`,
    });

  await t.notThrowsAsync(
    verify(
      { proxy },
      {
        env,
        options: { repositoryUrl: `git@othertesturl.com:${owner}/${repo}.git` },
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

  t.true(fetch.done());
});

test('Verify "assets" is a String', async (t) => {
  const owner = "test_user";
  const repo = "test_repo";
  const env = { GH_TOKEN: "github_token" };
  const assets = "file2.js";

  const fetch = fetchMock
    .sandbox()
    .get(`https://api.github.local/repos/${owner}/${repo}`, {
      permissions: { push: true },
      clone_url: `git@othertesturl.com:${owner}/${repo}.git`,
    });

  await t.notThrowsAsync(
    verify(
      { assets },
      {
        env,
        options: { repositoryUrl: `git@othertesturl.com:${owner}/${repo}.git` },
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

  t.true(fetch.done());
});

test('Verify "assets" is an Object with a path property', async (t) => {
  const owner = "test_user";
  const repo = "test_repo";
  const env = { GH_TOKEN: "github_token" };
  const assets = { path: "file2.js" };

  const fetch = fetchMock
    .sandbox()
    .get(`https://api.github.local/repos/${owner}/${repo}`, {
      permissions: { push: true },
      clone_url: `git@othertesturl.com:${owner}/${repo}.git`,
    });

  await t.notThrowsAsync(
    verify(
      { assets },
      {
        env,
        options: { repositoryUrl: `git@othertesturl.com:${owner}/${repo}.git` },
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

  t.true(fetch.done());
});

test('Verify "assets" is an Array of Object with a path property', async (t) => {
  const owner = "test_user";
  const repo = "test_repo";
  const env = { GH_TOKEN: "github_token" };
  const assets = [{ path: "file1.js" }, { path: "file2.js" }];

  const fetch = fetchMock
    .sandbox()
    .get(`https://api.github.local/repos/${owner}/${repo}`, {
      permissions: { push: true },
      clone_url: `git@othertesturl.com:${owner}/${repo}.git`,
    });

  await t.notThrowsAsync(
    verify(
      { assets },
      {
        env,
        options: {
          repositoryUrl: `git@othertesturl.com:${owner}/${repo}.git`,
        },
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

  t.true(fetch.done());
});

test('Verify "assets" is an Array of glob Arrays', async (t) => {
  const owner = "test_user";
  const repo = "test_repo";
  const env = { GH_TOKEN: "github_token" };
  const assets = [["dist/**", "!**/*.js"], "file2.js"];

  const fetch = fetchMock
    .sandbox()
    .get(`https://api.github.local/repos/${owner}/${repo}`, {
      permissions: { push: true },
      clone_url: `git@othertesturl.com:${owner}/${repo}.git`,
    });

  await t.notThrowsAsync(
    verify(
      { assets },
      {
        env,
        options: { repositoryUrl: `git@othertesturl.com:${owner}/${repo}.git` },
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

  t.true(fetch.done());
});

test('Verify "assets" is an Array of Object with a glob Arrays in path property', async (t) => {
  const owner = "test_user";
  const repo = "test_repo";
  const env = { GH_TOKEN: "github_token" };
  const assets = [{ path: ["dist/**", "!**/*.js"] }, { path: "file2.js" }];

  const fetch = fetchMock
    .sandbox()
    .get(`https://api.github.local/repos/${owner}/${repo}`, {
      permissions: { push: true },
      clone_url: `git@othertesturl.com:${owner}/${repo}.git`,
    });

  await t.notThrowsAsync(
    verify(
      { assets },
      {
        env,
        options: {
          repositoryUrl: `git@othertesturl.com:${owner}/${repo}.git`,
        },
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

  t.true(fetch.done());
});

test('Verify "labels" is a String', async (t) => {
  const owner = "test_user";
  const repo = "test_repo";
  const env = { GH_TOKEN: "github_token" };
  const labels = "semantic-release";

  const fetch = fetchMock
    .sandbox()
    .get(`https://api.github.local/repos/${owner}/${repo}`, {
      permissions: { push: true },
      clone_url: `git@othertesturl.com:${owner}/${repo}.git`,
    });

  await t.notThrowsAsync(
    verify(
      { labels },
      {
        env,
        options: { repositoryUrl: `git@othertesturl.com:${owner}/${repo}.git` },
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

  t.true(fetch.done());
});

test('Verify "assignees" is a String', async (t) => {
  const owner = "test_user";
  const repo = "test_repo";
  const env = { GH_TOKEN: "github_token" };
  const assignees = "user";

  const fetch = fetchMock
    .sandbox()
    .get(`https://api.github.local/repos/${owner}/${repo}`, {
      permissions: { push: true },
      clone_url: `git@othertesturl.com:${owner}/${repo}.git`,
    });

  await t.notThrowsAsync(
    verify(
      { assignees },
      {
        env,
        options: { repositoryUrl: `git@othertesturl.com:${owner}/${repo}.git` },
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

  t.true(fetch.done());
});

test('Verify "addReleases" is a valid string (top)', async (t) => {
  const owner = "test_user";
  const repo = "test_repo";
  const env = { GH_TOKEN: "github_token" };
  const addReleases = "top";

  const fetch = fetchMock
    .sandbox()
    .get(`https://api.github.local/repos/${owner}/${repo}`, {
      permissions: { push: true },
      clone_url: `git@othertesturl.com:${owner}/${repo}.git`,
    });

  await t.notThrowsAsync(
    verify(
      { addReleases },
      {
        env,
        options: { repositoryUrl: `git@othertesturl.com:${owner}/${repo}.git` },
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

  t.true(fetch.done());
});

test('Verify "addReleases" is a valid string (bottom)', async (t) => {
  const owner = "test_user";
  const repo = "test_repo";
  const env = { GH_TOKEN: "github_token" };
  const addReleases = "bottom";

  const fetch = fetchMock
    .sandbox()
    .get(`https://api.github.local/repos/${owner}/${repo}`, {
      permissions: { push: true },
      clone_url: `git@othertesturl.com:${owner}/${repo}.git`,
    });

  await t.notThrowsAsync(
    verify(
      { addReleases },
      {
        env,
        options: { repositoryUrl: `git@othertesturl.com:${owner}/${repo}.git` },
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

  t.true(fetch.done());
});

test('Verify "addReleases" is valid (false)', async (t) => {
  const owner = "test_user";
  const repo = "test_repo";
  const env = { GH_TOKEN: "github_token" };
  const addReleases = false;

  const fetch = fetchMock
    .sandbox()
    .get(`https://api.github.local/repos/${owner}/${repo}`, {
      permissions: { push: true },
      clone_url: `git@othertesturl.com:${owner}/${repo}.git`,
    });

  await t.notThrowsAsync(
    verify(
      { addReleases },
      {
        env,
        options: { repositoryUrl: `git@othertesturl.com:${owner}/${repo}.git` },
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

  t.true(fetch.done());
});

test('Verify "draftRelease" is valid (true)', async (t) => {
  const owner = "test_user";
  const repo = "test_repo";
  const env = { GH_TOKEN: "github_token" };
  const draftRelease = true;

  const fetch = fetchMock
    .sandbox()
    .get(`https://api.github.local/repos/${owner}/${repo}`, {
      permissions: { push: true },
      clone_url: `git@othertesturl.com:${owner}/${repo}.git`,
    });

  await t.notThrowsAsync(
    verify(
      { draftRelease },
      {
        env,
        options: { repositoryUrl: `git@othertesturl.com:${owner}/${repo}.git` },
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

  t.true(fetch.done());
});

test('Verify "draftRelease" is valid (false)', async (t) => {
  const owner = "test_user";
  const repo = "test_repo";
  const env = { GH_TOKEN: "github_token" };
  const draftRelease = false;

  const fetch = fetchMock
    .sandbox()
    .get(`https://api.github.local/repos/${owner}/${repo}`, {
      permissions: { push: true },
      clone_url: `git@othertesturl.com:${owner}/${repo}.git`,
    });

  await t.notThrowsAsync(
    verify(
      { draftRelease },
      {
        env,
        options: { repositoryUrl: `git@othertesturl.com:${owner}/${repo}.git` },
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

  t.true(fetch.done());
});

// https://github.com/semantic-release/github/issues/182
test("Verify if run in GitHub Action", async (t) => {
  const owner = "test_user";
  const repo = "test_repo";
  const env = {
    GITHUB_TOKEN: "v1.1234567890123456789012345678901234567890",
    GITHUB_ACTION: "Release",
  };
  const proxy = "https://localhost";
  const assets = [{ path: "lib/file.js" }, "file.js"];
  const successComment = "Test comment";
  const failTitle = "Test title";
  const failComment = "Test comment";
  const labels = ["semantic-release"];
  const discussionCategoryName = "Announcements";

  const fetch = fetchMock
    .sandbox()
    .getOnce(`https://api.github.local/repos/${owner}/${repo}`, {
      clone_url: `git+https://othertesturl.com/${owner}/${repo}.git`,
    });

  await t.notThrowsAsync(
    verify(
      { proxy, assets, successComment, failTitle, failComment, labels },
      {
        env,
        options: {
          repositoryUrl: `git+https://othertesturl.com/${owner}/${repo}.git`,
        },
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
});

test("Throw SemanticReleaseError for missing github token", async (t) => {
  const {
    errors: [error, ...errors],
  } = await t.throwsAsync(
    verify(
      {},
      {
        env: {},
        options: {
          repositoryUrl: "https://github.com/semantic-release/github.git",
        },
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

  t.is(errors.length, 0);
  t.is(error.name, "SemanticReleaseError");
  t.is(error.code, "ENOGHTOKEN");
});

test("Throw SemanticReleaseError for invalid token", async (t) => {
  const owner = "test_user";
  const repo = "test_repo";
  const env = { GH_TOKEN: "github_token" };

  const fetch = fetchMock
    .sandbox()
    .getOnce(`https://api.github.local/repos/${owner}/${repo}`, 401);

  const errors = await t.throwsAsync(
    verify(
      {},
      {
        env,
        options: { repositoryUrl: `https://github.com/${owner}/${repo}.git` },
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

  t.log(errors);

  // t.is(errors.length, 0);
  // t.is(error.name, "SemanticReleaseError");
  // t.is(error.code, "EINVALIDGHTOKEN");
  // t.true(fetch.done());
});

test("Throw SemanticReleaseError for invalid repositoryUrl", async (t) => {
  const env = { GH_TOKEN: "github_token" };

  const {
    errors: [error, ...errors],
  } = await t.throwsAsync(
    verify(
      {},
      {
        env,
        options: { repositoryUrl: "invalid_url" },
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

  t.is(errors.length, 0);
  t.is(error.name, "SemanticReleaseError");
  t.is(error.code, "EINVALIDGITHUBURL");
});

test("Throw SemanticReleaseError if token doesn't have the push permission on the repository and it's not a Github installation token", async (t) => {
  const owner = "test_user";
  const repo = "test_repo";
  const env = { GH_TOKEN: "github_token" };

  const fetch = fetchMock
    .sandbox()
    .get(`https://api.github.local/repos/${owner}/${repo}`, {
      permissions: { push: false },
      clone_url: `https://github.com/${owner}/${repo}.git`,
    })
    .headOnce(
      "https://api.github.local/installation/repositories?per_page=1",
      403,
    );

  const {
    errors: [error, ...errors],
  } = await t.throwsAsync(
    verify(
      {},
      {
        env,
        options: { repositoryUrl: `https://github.com/${owner}/${repo}.git` },
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

  t.is(errors.length, 0);
  t.is(error.name, "SemanticReleaseError");
  t.is(error.code, "EGHNOPERMISSION");
  t.true(fetch.done());
});

test("Do not throw SemanticReleaseError if token doesn't have the push permission but it is a Github installation token", async (t) => {
  const owner = "test_user";
  const repo = "test_repo";
  const env = { GH_TOKEN: "github_token" };

  const fetch = fetchMock
    .sandbox()
    .get(`https://api.github.local/repos/${owner}/${repo}`, {
      permissions: { push: false },
      clone_url: `https://github.com/${owner}/${repo}.git`,
    })
    .headOnce(
      "https://api.github.local/installation/repositories?per_page=1",
      200,
    );

  await t.notThrowsAsync(
    verify(
      {},
      {
        env,
        options: { repositoryUrl: `https://github.com/${owner}/${repo}.git` },
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

  t.true(fetch.done());
});

test("Throw SemanticReleaseError if the repository doesn't exist", async (t) => {
  const owner = "test_user";
  const repo = "test_repo";
  const env = { GH_TOKEN: "github_token" };

  const fetch = fetchMock
    .sandbox()
    .get(`https://api.github.local/repos/${owner}/${repo}`, 404);

  const {
    errors: [error, ...errors],
  } = await t.throwsAsync(
    verify(
      {},
      {
        env,
        options: { repositoryUrl: `https://github.com/${owner}/${repo}.git` },
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

  t.is(errors.length, 0);
  t.is(error.name, "SemanticReleaseError");
  t.is(error.code, "EMISSINGREPO");
  t.true(fetch.done());
});

test("Throw error if github return any other errors", async (t) => {
  const owner = "test_user";
  const repo = "test_repo";
  const env = { GH_TOKEN: "github_token" };

  const fetch = fetchMock
    .sandbox()
    .getOnce(`https://api.github.local/repos/${owner}/${repo}`, 500);

  const error = await t.throwsAsync(
    verify(
      {},
      {
        env,
        options: { repositoryUrl: `https://github.com/${owner}/${repo}.git` },
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

test('Throw SemanticReleaseError if "proxy" option is not a String or an Object', async (t) => {
  const env = { GH_TOKEN: "github_token" };
  const proxy = 42;

  const {
    errors: [error, ...errors],
  } = await t.throwsAsync(
    verify(
      { proxy },
      {
        env,
        options: {
          repositoryUrl: "https://github.com/semantic-release/github.git",
        },
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

  t.is(errors.length, 0);
  t.is(error.name, "SemanticReleaseError");
  t.is(error.code, "EINVALIDPROXY");
});

test('Throw SemanticReleaseError if "proxy" option is an Object with invalid properties', async (t) => {
  const env = { GH_TOKEN: "github_token" };
  const proxy = { host: 42 };

  const {
    errors: [error, ...errors],
  } = await t.throwsAsync(
    verify(
      { proxy },
      {
        env,
        options: {
          repositoryUrl: "https://github.com/semantic-release/github.git",
        },
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

  t.is(errors.length, 0);
  t.is(error.name, "SemanticReleaseError");
  t.is(error.code, "EINVALIDPROXY");
});

test('Throw SemanticReleaseError if "assets" option is not a String or an Array of Objects', async (t) => {
  const owner = "test_user";
  const repo = "test_repo";
  const env = { GH_TOKEN: "github_token" };
  const assets = 42;

  const fetch = fetchMock
    .sandbox()
    .get(`https://api.github.local/repos/${owner}/${repo}`, {
      permissions: { push: true },
      clone_url: `https://github.com/${owner}/${repo}.git`,
    });

  const {
    errors: [error, ...errors],
  } = await t.throwsAsync(
    verify(
      { assets },
      {
        env,
        options: { repositoryUrl: `https://github.com/${owner}/${repo}.git` },
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

  t.is(errors.length, 0);
  t.is(error.name, "SemanticReleaseError");
  t.is(error.code, "EINVALIDASSETS");
  t.true(fetch.done());
});

test('Throw SemanticReleaseError if "assets" option is an Array with invalid elements', async (t) => {
  const owner = "test_user";
  const repo = "test_repo";
  const env = { GH_TOKEN: "github_token" };
  const assets = ["file.js", 42];

  const fetch = fetchMock
    .sandbox()
    .get(`https://api.github.local/repos/${owner}/${repo}`, {
      permissions: { push: true },
      clone_url: `https://github.com/${owner}/${repo}.git`,
    });

  const {
    errors: [error, ...errors],
  } = await t.throwsAsync(
    verify(
      { assets },
      {
        env,
        options: { repositoryUrl: `https://github.com/${owner}/${repo}.git` },
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

  t.is(errors.length, 0);
  t.is(error.name, "SemanticReleaseError");
  t.is(error.code, "EINVALIDASSETS");
  t.true(fetch.done());
});

test('Throw SemanticReleaseError if "assets" option is an Object missing the "path" property', async (t) => {
  const owner = "test_user";
  const repo = "test_repo";
  const env = { GH_TOKEN: "github_token" };
  const assets = { name: "file.js" };

  const fetch = fetchMock
    .sandbox()
    .get(`https://api.github.local/repos/${owner}/${repo}`, {
      permissions: { push: true },
      clone_url: `https://github.com/${owner}/${repo}.git`,
    });

  const {
    errors: [error, ...errors],
  } = await t.throwsAsync(
    verify(
      { assets },
      {
        env,
        options: { repositoryUrl: `https://github.com/${owner}/${repo}.git` },
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

  t.is(errors.length, 0);
  t.is(error.name, "SemanticReleaseError");
  t.is(error.code, "EINVALIDASSETS");
  t.true(fetch.done());
});

test('Throw SemanticReleaseError if "assets" option is an Array with objects missing the "path" property', async (t) => {
  const owner = "test_user";
  const repo = "test_repo";
  const env = { GH_TOKEN: "github_token" };
  const assets = [{ path: "lib/file.js" }, { name: "file.js" }];

  const fetch = fetchMock
    .sandbox()
    .get(`https://api.github.local/repos/${owner}/${repo}`, {
      permissions: { push: true },
      clone_url: `https://github.com/${owner}/${repo}.git`,
    });

  const {
    errors: [error, ...errors],
  } = await t.throwsAsync(
    verify(
      { assets },
      {
        env,
        options: { repositoryUrl: `https://github.com/${owner}/${repo}.git` },
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

  t.is(errors.length, 0);
  t.is(error.name, "SemanticReleaseError");
  t.is(error.code, "EINVALIDASSETS");
  t.true(fetch.done());
});

test('Throw SemanticReleaseError if "successComment" option is not a String', async (t) => {
  const owner = "test_user";
  const repo = "test_repo";
  const env = { GH_TOKEN: "github_token" };
  const successComment = 42;

  const fetch = fetchMock
    .sandbox()
    .get(`https://api.github.local/repos/${owner}/${repo}`, {
      permissions: { push: true },
      clone_url: `https://github.com/${owner}/${repo}.git`,
    });

  const {
    errors: [error, ...errors],
  } = await t.throwsAsync(
    verify(
      { successComment },
      {
        env,
        options: { repositoryUrl: `https://github.com/${owner}/${repo}.git` },
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

  t.is(errors.length, 0);
  t.is(error.name, "SemanticReleaseError");
  t.is(error.code, "EINVALIDSUCCESSCOMMENT");
  t.true(fetch.done());
});

test('Throw SemanticReleaseError if "successComment" option is an empty String', async (t) => {
  const owner = "test_user";
  const repo = "test_repo";
  const env = { GH_TOKEN: "github_token" };
  const successComment = "";

  const fetch = fetchMock
    .sandbox()
    .get(`https://api.github.local/repos/${owner}/${repo}`, {
      permissions: { push: true },
      clone_url: `https://github.com/${owner}/${repo}.git`,
    });

  const {
    errors: [error, ...errors],
  } = await t.throwsAsync(
    verify(
      { successComment },
      {
        env,
        options: { repositoryUrl: `https://github.com/${owner}/${repo}.git` },
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

  t.is(errors.length, 0);
  t.is(error.name, "SemanticReleaseError");
  t.is(error.code, "EINVALIDSUCCESSCOMMENT");
  t.true(fetch.done());
});

test('Throw SemanticReleaseError if "successComment" option is a whitespace String', async (t) => {
  const owner = "test_user";
  const repo = "test_repo";
  const env = { GH_TOKEN: "github_token" };
  const successComment = "  \n \r ";

  const fetch = fetchMock
    .sandbox()
    .get(`https://api.github.local/repos/${owner}/${repo}`, {
      permissions: { push: true },
      clone_url: `https://github.com/${owner}/${repo}.git`,
    });

  const {
    errors: [error, ...errors],
  } = await t.throwsAsync(
    verify(
      { successComment },
      {
        env,
        options: { repositoryUrl: `https://github.com/${owner}/${repo}.git` },
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

  t.is(errors.length, 0);
  t.is(error.name, "SemanticReleaseError");
  t.is(error.code, "EINVALIDSUCCESSCOMMENT");
  t.true(fetch.done());
});

test('Throw SemanticReleaseError if "failTitle" option is not a String', async (t) => {
  const owner = "test_user";
  const repo = "test_repo";
  const env = { GH_TOKEN: "github_token" };
  const failTitle = 42;

  const fetch = fetchMock
    .sandbox()
    .get(`https://api.github.local/repos/${owner}/${repo}`, {
      permissions: { push: true },
      clone_url: `https://github.com/${owner}/${repo}.git`,
    });

  const {
    errors: [error, ...errors],
  } = await t.throwsAsync(
    verify(
      { failTitle },
      {
        env,
        options: { repositoryUrl: `https://github.com/${owner}/${repo}.git` },
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

  t.is(errors.length, 0);
  t.is(error.name, "SemanticReleaseError");
  t.is(error.code, "EINVALIDFAILTITLE");
  t.true(fetch.done());
});

test('Throw SemanticReleaseError if "failTitle" option is an empty String', async (t) => {
  const owner = "test_user";
  const repo = "test_repo";
  const env = { GH_TOKEN: "github_token" };
  const failTitle = "";

  const fetch = fetchMock
    .sandbox()
    .get(`https://api.github.local/repos/${owner}/${repo}`, {
      permissions: { push: true },
      clone_url: `https://github.com/${owner}/${repo}.git`,
    });

  const {
    errors: [error, ...errors],
  } = await t.throwsAsync(
    verify(
      { failTitle },
      {
        env,
        options: { repositoryUrl: `https://github.com/${owner}/${repo}.git` },
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

  t.is(errors.length, 0);
  t.is(error.name, "SemanticReleaseError");
  t.is(error.code, "EINVALIDFAILTITLE");
  t.true(fetch.done());
});

test('Throw SemanticReleaseError if "failTitle" option is a whitespace String', async (t) => {
  const owner = "test_user";
  const repo = "test_repo";
  const env = { GH_TOKEN: "github_token" };
  const failTitle = "  \n \r ";

  const fetch = fetchMock
    .sandbox()
    .get(`https://api.github.local/repos/${owner}/${repo}`, {
      permissions: { push: true },
      clone_url: `https://github.com/${owner}/${repo}.git`,
    });

  const {
    errors: [error, ...errors],
  } = await t.throwsAsync(
    verify(
      { failTitle },
      {
        env,
        options: { repositoryUrl: `https://github.com/${owner}/${repo}.git` },
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

  t.is(errors.length, 0);
  t.is(error.name, "SemanticReleaseError");
  t.is(error.code, "EINVALIDFAILTITLE");
  t.true(fetch.done());
});

test('Throw SemanticReleaseError if "discussionCategoryName" option is not a String', async (t) => {
  const owner = "test_user";
  const repo = "test_repo";
  const env = { GH_TOKEN: "github_token" };
  const discussionCategoryName = 42;

  const fetch = fetchMock
    .sandbox()
    .get(`https://api.github.local/repos/${owner}/${repo}`, {
      permissions: { push: true },
      clone_url: `https://github.com/${owner}/${repo}.git`,
    });

  const {
    errors: [error, ...errors],
  } = await t.throwsAsync(
    verify(
      { discussionCategoryName },
      {
        env,
        options: { repositoryUrl: `https://github.com/${owner}/${repo}.git` },
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

  t.is(errors.length, 0);
  t.is(error.name, "SemanticReleaseError");
  t.is(error.code, "EINVALIDDISCUSSIONCATEGORYNAME");
  t.true(fetch.done());
});

test('Throw SemanticReleaseError if "discussionCategoryName" option is an empty String', async (t) => {
  const owner = "test_user";
  const repo = "test_repo";
  const env = { GH_TOKEN: "github_token" };
  const discussionCategoryName = "";

  const fetch = fetchMock
    .sandbox()
    .get(`https://api.github.local/repos/${owner}/${repo}`, {
      permissions: { push: true },
      clone_url: `https://github.com/${owner}/${repo}.git`,
    });

  const {
    errors: [error, ...errors],
  } = await t.throwsAsync(
    verify(
      { discussionCategoryName },
      {
        env,
        options: { repositoryUrl: `https://github.com/${owner}/${repo}.git` },
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

  t.is(errors.length, 0);
  t.is(error.name, "SemanticReleaseError");
  t.is(error.code, "EINVALIDDISCUSSIONCATEGORYNAME");
  t.true(fetch.done());
});

test('Throw SemanticReleaseError if "discussionCategoryName" option is a whitespace String', async (t) => {
  const owner = "test_user";
  const repo = "test_repo";
  const env = { GH_TOKEN: "github_token" };
  const discussionCategoryName = "  \n \r ";

  const fetch = fetchMock
    .sandbox()
    .get(`https://api.github.local/repos/${owner}/${repo}`, {
      permissions: { push: true },
      clone_url: `https://github.com/${owner}/${repo}.git`,
    });

  const {
    errors: [error, ...errors],
  } = await t.throwsAsync(
    verify(
      { discussionCategoryName },
      {
        env,
        options: { repositoryUrl: `https://github.com/${owner}/${repo}.git` },
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

  t.is(errors.length, 0);
  t.is(error.name, "SemanticReleaseError");
  t.is(error.code, "EINVALIDDISCUSSIONCATEGORYNAME");
  t.true(fetch.done());
});

test('Throw SemanticReleaseError if "failComment" option is not a String', async (t) => {
  const owner = "test_user";
  const repo = "test_repo";
  const env = { GH_TOKEN: "github_token" };
  const failComment = 42;

  const fetch = fetchMock
    .sandbox()
    .get(`https://api.github.local/repos/${owner}/${repo}`, {
      permissions: { push: true },
      clone_url: `https://github.com/${owner}/${repo}.git`,
    });

  const {
    errors: [error, ...errors],
  } = await t.throwsAsync(
    verify(
      { failComment },
      {
        env,
        options: { repositoryUrl: `https://github.com/${owner}/${repo}.git` },
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

  t.is(errors.length, 0);
  t.is(error.name, "SemanticReleaseError");
  t.is(error.code, "EINVALIDFAILCOMMENT");
  t.true(fetch.done());
});

test('Throw SemanticReleaseError if "failComment" option is an empty String', async (t) => {
  const owner = "test_user";
  const repo = "test_repo";
  const env = { GH_TOKEN: "github_token" };
  const failComment = "";

  const fetch = fetchMock
    .sandbox()
    .get(`https://api.github.local/repos/${owner}/${repo}`, {
      permissions: { push: true },
      clone_url: `https://github.com/${owner}/${repo}.git`,
    });

  const {
    errors: [error, ...errors],
  } = await t.throwsAsync(
    verify(
      { failComment },
      {
        env,
        options: { repositoryUrl: `https://github.com/${owner}/${repo}.git` },
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

  t.is(errors.length, 0);
  t.is(error.name, "SemanticReleaseError");
  t.is(error.code, "EINVALIDFAILCOMMENT");
  t.true(fetch.done());
});

test('Throw SemanticReleaseError if "failComment" option is a whitespace String', async (t) => {
  const owner = "test_user";
  const repo = "test_repo";
  const env = { GH_TOKEN: "github_token" };
  const failComment = "  \n \r ";

  const fetch = fetchMock
    .sandbox()
    .get(`https://api.github.local/repos/${owner}/${repo}`, {
      permissions: { push: true },
      clone_url: `https://github.com/${owner}/${repo}.git`,
    });

  const {
    errors: [error, ...errors],
  } = await t.throwsAsync(
    verify(
      { failComment },
      {
        env,
        options: { repositoryUrl: `https://github.com/${owner}/${repo}.git` },
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

  t.is(errors.length, 0);
  t.is(error.name, "SemanticReleaseError");
  t.is(error.code, "EINVALIDFAILCOMMENT");
  t.true(fetch.done());
});

test('Throw SemanticReleaseError if "labels" option is not a String or an Array of String', async (t) => {
  const owner = "test_user";
  const repo = "test_repo";
  const env = { GH_TOKEN: "github_token" };
  const labels = 42;

  const fetch = fetchMock
    .sandbox()
    .get(`https://api.github.local/repos/${owner}/${repo}`, {
      permissions: { push: true },
      clone_url: `https://github.com/${owner}/${repo}.git`,
    });

  const {
    errors: [error, ...errors],
  } = await t.throwsAsync(
    verify(
      { labels },
      {
        env,
        options: { repositoryUrl: `https://github.com/${owner}/${repo}.git` },
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

  t.is(errors.length, 0);
  t.is(error.name, "SemanticReleaseError");
  t.is(error.code, "EINVALIDLABELS");
  t.true(fetch.done());
});

test('Throw SemanticReleaseError if "labels" option is an Array with invalid elements', async (t) => {
  const owner = "test_user";
  const repo = "test_repo";
  const env = { GH_TOKEN: "github_token" };
  const labels = ["label1", 42];

  const fetch = fetchMock
    .sandbox()
    .get(`https://api.github.local/repos/${owner}/${repo}`, {
      permissions: { push: true },
      clone_url: `https://github.com/${owner}/${repo}.git`,
    });

  const {
    errors: [error, ...errors],
  } = await t.throwsAsync(
    verify(
      { labels },
      {
        env,
        options: { repositoryUrl: `https://github.com/${owner}/${repo}.git` },
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

  t.is(errors.length, 0);
  t.is(error.name, "SemanticReleaseError");
  t.is(error.code, "EINVALIDLABELS");
  t.true(fetch.done());
});

test('Throw SemanticReleaseError if "labels" option is a whitespace String', async (t) => {
  const owner = "test_user";
  const repo = "test_repo";
  const env = { GH_TOKEN: "github_token" };
  const labels = "  \n \r ";

  const fetch = fetchMock
    .sandbox()
    .get(`https://api.github.local/repos/${owner}/${repo}`, {
      permissions: { push: true },
      clone_url: `https://github.com/${owner}/${repo}.git`,
    });

  const {
    errors: [error, ...errors],
  } = await t.throwsAsync(
    verify(
      { labels },
      {
        env,
        options: { repositoryUrl: `https://github.com/${owner}/${repo}.git` },
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

  t.is(errors.length, 0);
  t.is(error.name, "SemanticReleaseError");
  t.is(error.code, "EINVALIDLABELS");
  t.true(fetch.done());
});

test('Throw SemanticReleaseError if "assignees" option is not a String or an Array of String', async (t) => {
  const owner = "test_user";
  const repo = "test_repo";
  const env = { GH_TOKEN: "github_token" };
  const assignees = 42;

  const fetch = fetchMock
    .sandbox()
    .get(`https://api.github.local/repos/${owner}/${repo}`, {
      permissions: { push: true },
      clone_url: `https://github.com/${owner}/${repo}.git`,
    });

  const {
    errors: [error, ...errors],
  } = await t.throwsAsync(
    verify(
      { assignees },
      {
        env,
        options: { repositoryUrl: `https://github.com/${owner}/${repo}.git` },
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

  t.is(errors.length, 0);
  t.is(error.name, "SemanticReleaseError");
  t.is(error.code, "EINVALIDASSIGNEES");
  t.true(fetch.done());
});

test('Throw SemanticReleaseError if "assignees" option is an Array with invalid elements', async (t) => {
  const owner = "test_user";
  const repo = "test_repo";
  const env = { GH_TOKEN: "github_token" };
  const assignees = ["user", 42];

  const fetch = fetchMock
    .sandbox()
    .get(`https://api.github.local/repos/${owner}/${repo}`, {
      permissions: { push: true },
      clone_url: `https://github.com/${owner}/${repo}.git`,
    });

  const {
    errors: [error, ...errors],
  } = await t.throwsAsync(
    verify(
      { assignees },
      {
        env,
        options: { repositoryUrl: `https://github.com/${owner}/${repo}.git` },
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

  t.is(errors.length, 0);
  t.is(error.name, "SemanticReleaseError");
  t.is(error.code, "EINVALIDASSIGNEES");
  t.true(fetch.done());
});

test('Throw SemanticReleaseError if "assignees" option is a whitespace String', async (t) => {
  const owner = "test_user";
  const repo = "test_repo";
  const env = { GH_TOKEN: "github_token" };
  const assignees = "  \n \r ";

  const fetch = fetchMock
    .sandbox()
    .get(`https://api.github.local/repos/${owner}/${repo}`, {
      permissions: { push: true },
      clone_url: `https://github.com/${owner}/${repo}.git`,
    });

  const {
    errors: [error, ...errors],
  } = await t.throwsAsync(
    verify(
      { assignees },
      {
        env,
        options: { repositoryUrl: `https://github.com/${owner}/${repo}.git` },
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

  t.is(errors.length, 0);
  t.is(error.name, "SemanticReleaseError");
  t.is(error.code, "EINVALIDASSIGNEES");
  t.true(fetch.done());
});

test('Throw SemanticReleaseError if "releasedLabels" option is not a String or an Array of String', async (t) => {
  const owner = "test_user";
  const repo = "test_repo";
  const env = { GH_TOKEN: "github_token" };
  const releasedLabels = 42;

  const fetch = fetchMock
    .sandbox()
    .get(`https://api.github.local/repos/${owner}/${repo}`, {
      permissions: { push: true },
      clone_url: `https://github.com/${owner}/${repo}.git`,
    });

  const {
    errors: [error, ...errors],
  } = await t.throwsAsync(
    verify(
      { releasedLabels },
      {
        env,
        options: { repositoryUrl: `https://github.com/${owner}/${repo}.git` },
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

  t.is(errors.length, 0);
  t.is(error.name, "SemanticReleaseError");
  t.is(error.code, "EINVALIDRELEASEDLABELS");
  t.true(fetch.done());
});

test('Throw SemanticReleaseError if "releasedLabels" option is an Array with invalid elements', async (t) => {
  const owner = "test_user";
  const repo = "test_repo";
  const env = { GH_TOKEN: "github_token" };
  const releasedLabels = ["label1", 42];

  const fetch = fetchMock
    .sandbox()
    .get(`https://api.github.local/repos/${owner}/${repo}`, {
      permissions: { push: true },
      clone_url: `https://github.com/${owner}/${repo}.git`,
    });

  const {
    errors: [error, ...errors],
  } = await t.throwsAsync(
    verify(
      { releasedLabels },
      {
        env,
        options: { repositoryUrl: `https://github.com/${owner}/${repo}.git` },
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

  t.is(errors.length, 0);
  t.is(error.name, "SemanticReleaseError");
  t.is(error.code, "EINVALIDRELEASEDLABELS");
  t.true(fetch.done());
});

test('Throw SemanticReleaseError if "releasedLabels" option is a whitespace String', async (t) => {
  const owner = "test_user";
  const repo = "test_repo";
  const env = { GH_TOKEN: "github_token" };
  const releasedLabels = "  \n \r ";

  const fetch = fetchMock
    .sandbox()
    .get(`https://api.github.local/repos/${owner}/${repo}`, {
      permissions: { push: true },
      clone_url: `https://github.com/${owner}/${repo}.git`,
    });

  const {
    errors: [error, ...errors],
  } = await t.throwsAsync(
    verify(
      { releasedLabels },
      {
        env,
        options: { repositoryUrl: `https://github.com/${owner}/${repo}.git` },
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

  t.is(errors.length, 0);
  t.is(error.name, "SemanticReleaseError");
  t.is(error.code, "EINVALIDRELEASEDLABELS");
  t.true(fetch.done());
});

test('Throw SemanticReleaseError if "addReleases" option is not a valid string (botom)', async (t) => {
  const owner = "test_user";
  const repo = "test_repo";
  const env = { GH_TOKEN: "github_token" };
  const addReleases = "botom";

  const fetch = fetchMock
    .sandbox()
    .get(`https://api.github.local/repos/${owner}/${repo}`, {
      permissions: { push: true },
      clone_url: `https://github.com/${owner}/${repo}.git`,
    });

  const {
    errors: [error, ...errors],
  } = await t.throwsAsync(
    verify(
      { addReleases },
      {
        env,
        options: { repositoryUrl: `https://github.com/${owner}/${repo}.git` },
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

  t.is(errors.length, 0);
  t.is(error.name, "SemanticReleaseError");
  t.is(error.code, "EINVALIDADDRELEASES");
  t.true(fetch.done());
});

test('Throw SemanticReleaseError if "addReleases" option is not a valid string (true)', async (t) => {
  const owner = "test_user";
  const repo = "test_repo";
  const env = { GH_TOKEN: "github_token" };
  const addReleases = true;

  const fetch = fetchMock
    .sandbox()
    .get(`https://api.github.local/repos/${owner}/${repo}`, {
      permissions: { push: true },
      clone_url: `https://github.com/${owner}/${repo}.git`,
    });

  const {
    errors: [error, ...errors],
  } = await t.throwsAsync(
    verify(
      { addReleases },
      {
        env,
        options: { repositoryUrl: `https://github.com/${owner}/${repo}.git` },
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

  t.is(errors.length, 0);
  t.is(error.name, "SemanticReleaseError");
  t.is(error.code, "EINVALIDADDRELEASES");
  t.true(fetch.done());
});

test('Throw SemanticReleaseError if "addReleases" option is not a valid string (number)', async (t) => {
  const owner = "test_user";
  const repo = "test_repo";
  const env = { GH_TOKEN: "github_token" };
  const addReleases = 42;

  const fetch = fetchMock
    .sandbox()
    .get(`https://api.github.local/repos/${owner}/${repo}`, {
      permissions: { push: true },
      clone_url: `https://github.com/${owner}/${repo}.git`,
    });

  const {
    errors: [error, ...errors],
  } = await t.throwsAsync(
    verify(
      { addReleases },
      {
        env,
        options: { repositoryUrl: `https://github.com/${owner}/${repo}.git` },
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

  t.is(errors.length, 0);
  t.is(error.name, "SemanticReleaseError");
  t.is(error.code, "EINVALIDADDRELEASES");
  t.true(fetch.done());
});

test('Throw SemanticReleaseError if "draftRelease" option is not a valid boolean (string)', async (t) => {
  const owner = "test_user";
  const repo = "test_repo";
  const env = { GH_TOKEN: "github_token" };
  const draftRelease = "test";

  const fetch = fetchMock
    .sandbox()
    .get(`https://api.github.local/repos/${owner}/${repo}`, {
      permissions: { push: true },
      clone_url: `https://github.com/${owner}/${repo}.git`,
    });

  const {
    errors: [error, ...errors],
  } = await t.throwsAsync(
    verify(
      { draftRelease },
      {
        env,
        options: { repositoryUrl: `https://github.com/${owner}/${repo}.git` },
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

  t.is(errors.length, 0);
  t.is(error.name, "SemanticReleaseError");
  t.is(error.code, "EINVALIDDRAFTRELEASE");
  t.true(fetch.done());
});

test('Throw SemanticReleaseError if "releaseBodyTemplate" option is an empty string', async (t) => {
  const owner = "test_user";
  const repo = "test_repo";
  const env = { GH_TOKEN: "github_token" };

  const fetch = fetchMock
    .sandbox()
    .get(`https://api.github.local/repos/${owner}/${repo}`, {
      permissions: { push: true },
      clone_url: `https://github.com/${owner}/${repo}.git`,
    });

  const {
    errors: [error, ...errors],
  } = await t.throwsAsync(
    verify(
      { releaseBodyTemplate: "" },
      {
        env,
        options: { repositoryUrl: `https://github.com/${owner}/${repo}.git` },
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

  t.is(errors.length, 0);
  t.is(error.name, "SemanticReleaseError");
  t.is(error.code, "EINVALIDRELEASEBODYTEMPLATE");
  t.true(fetch.done());
});

test('Throw SemanticReleaseError if "releaseNameTemplate" option is an empty string', async (t) => {
  const owner = "test_user";
  const repo = "test_repo";
  const env = { GH_TOKEN: "github_token" };

  const fetch = fetchMock
    .sandbox()
    .get(`https://api.github.local/repos/${owner}/${repo}`, {
      permissions: { push: true },
      clone_url: `https://github.com/${owner}/${repo}.git`,
    });

  const {
    errors: [error, ...errors],
  } = await t.throwsAsync(
    verify(
      { releaseNameTemplate: "" },
      {
        env,
        options: { repositoryUrl: `https://github.com/${owner}/${repo}.git` },
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

  t.is(errors.length, 0);
  t.is(error.name, "SemanticReleaseError");
  t.is(error.code, "EINVALIDRELEASENAMETEMPLATE");
  t.true(fetch.done());
});
