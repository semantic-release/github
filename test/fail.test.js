import SemanticReleaseError from "@semantic-release/error";
import sinon from "sinon";
import test from "ava";
import fetchMock from "fetch-mock";

import { ISSUE_ID, RELEASE_FAIL_LABEL } from "../lib/definitions/constants.js";
import { TestOctokit } from "./helpers/test-octokit.js";

/* eslint camelcase: ["error", {properties: "never"}] */

import fail from "../lib/fail.js";

test.beforeEach((t) => {
  // Mock logger
  t.context.log = sinon.stub();
  t.context.error = sinon.stub();
  t.context.warn = sinon.stub();
  t.context.logger = {
    log: t.context.log,
    error: t.context.error,
    warn: t.context.warn,
  };
});

test("Open a new issue with the list of errors", async (t) => {
  const owner = "test_user";
  const repo = "test_repo";
  const redirectedOwner = "test_user_2";
  const redirectedRepo = "test_repo_2";
  const env = { GITHUB_TOKEN: "github_token" };
  const failTitle = "The automated release is failing 🚨";
  const pluginConfig = { failTitle };
  const options = { repositoryUrl: `https://github.com/${owner}/${repo}.git` };
  const errors = [
    new SemanticReleaseError("Error message 1", "ERR1", "Error 1 details"),
    new SemanticReleaseError("Error message 2", "ERR2", "Error 2 details"),
    new SemanticReleaseError("Error message 3", "ERR3", "Error 3 details"),
  ];
  const fm = fetchMock
    .createInstance()
    .get(
      "https://api.github.local/repos/test_user/test_repo",
      {
        full_name: `${redirectedOwner}/${redirectedRepo}`,
      },
      { repeat: 1 },
    )
    .post(
      "https://api.github.local/graphql",
      {
        data: {
          repository: {
            issues: { nodes: [] },
          },
        },
      },
      { repeat: 1 },
    )
    .post(
      ({ url, options }) => {
        if (
          url !==
          `https://api.github.local/repos/${redirectedOwner}/${redirectedRepo}/issues`
        )
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
      {
        html_url: "https://github.com/issues/1",
        number: 1,
      },
      { repeat: 1 },
    );

  await fail(
    pluginConfig,
    {
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

  t.true(
    t.context.log.calledWith(
      "Created issue #%d: %s.",
      1,
      "https://github.com/issues/1",
    ),
  );
  t.true(fm.callHistory.done());
});

test("Open a new issue with the list of errors and custom title and comment", async (t) => {
  const owner = "test_user";
  const repo = "test_repo";
  const env = { GITHUB_TOKEN: "github_token" };
  const failTitle = "Custom title";
  const failComment = `branch \${branch.name} \${errors[0].message} \${errors[1].message} \${errors[2].message}`;
  const pluginConfig = { failTitle, failComment };
  const options = {
    repositoryUrl: `https://github.com/${owner}/${repo}.git`,
  };
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
        full_name: `${owner}/${repo}`,
        clone_url: `https://api.github.local/${owner}/${repo}.git`,
      },
      { repeat: 1 },
    )
    .post(
      "https://api.github.local/graphql",
      {
        data: {
          repository: {
            issues: { nodes: [] },
          },
        },
      },
      { repeat: 1 },
    )
    .post(
      `https://api.github.local/repos/${owner}/${repo}/issues`,
      { html_url: "https://github.com/issues/1", number: 1 },
      {
        body: {
          title: failTitle,
          body: `branch master Error message 1 Error message 2 Error message 3\n\n${ISSUE_ID}`,
          labels: ["semantic-release", RELEASE_FAIL_LABEL],
        },
        repeat: 1,
      },
    );

  await fail(
    pluginConfig,
    {
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

  t.true(
    t.context.log.calledWith(
      "Created issue #%d: %s.",
      1,
      "https://github.com/issues/1",
    ),
  );
  t.true(fm.callHistory.done());
});

test("Open a new issue with assignees and the list of errors", async (t) => {
  const owner = "test_user";
  const repo = "test_repo";
  const env = { GITHUB_TOKEN: "github_token" };
  const failTitle = "The automated release is failing 🚨";
  const assignees = ["user1", "user2"];
  const pluginConfig = { failTitle, assignees };
  const options = {
    repositoryUrl: `https://github.com/${owner}/${repo}.git`,
  };
  const errors = [
    new SemanticReleaseError("Error message 1", "ERR1", "Error 1 details"),
    new SemanticReleaseError("Error message 2", "ERR2", "Error 2 details"),
  ];

  const fm = fetchMock
    .createInstance()
    .get(
      `https://api.github.local/repos/${owner}/${repo}`,
      {
        full_name: `${owner}/${repo}`,
        clone_url: `https://api.github.local/${owner}/${repo}.git`,
      },
      { repeat: 1 },
    )
    .post(
      "https://api.github.local/graphql",
      {
        data: {
          repository: {
            issues: { nodes: [] },
          },
        },
      },
      { repeat: 1 },
    )
    .post(
      ({ url, options }) => {
        if (url !== `https://api.github.local/repos/${owner}/${repo}/issues`)
          return false;

        const data = JSON.parse(options.body);
        t.is(data.title, failTitle);
        t.regex(
          data.body,
          /---\n\n### Error message 1\n\nError 1 details\n\n---\n\n### Error message 2\n\nError 2 details\n\n---/,
        );
        t.deepEqual(data.labels, ["semantic-release", RELEASE_FAIL_LABEL]);
        t.deepEqual(data.assignees, ["user1", "user2"]);
        return true;
      },
      { html_url: "https://github.com/issues/1", number: 1 },
      { repeat: 1 },
    );

  await fail(
    pluginConfig,
    {
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

  t.true(
    t.context.log.calledWith(
      "Created issue #%d: %s.",
      1,
      "https://github.com/issues/1",
    ),
  );
  t.true(fm.callHistory.done());
});

test("Open a new issue without labels and the list of errors", async (t) => {
  const owner = "test_user";
  const repo = "test_repo";
  const env = { GITHUB_TOKEN: "github_token" };
  const failTitle = "The automated release is failing 🚨";
  const labels = false;
  const pluginConfig = { failTitle, labels };
  const options = {
    repositoryUrl: `https://github.com/${owner}/${repo}.git`,
  };
  const errors = [
    new SemanticReleaseError("Error message 1", "ERR1", "Error 1 details"),
    new SemanticReleaseError("Error message 2", "ERR2", "Error 2 details"),
  ];

  const fm = fetchMock
    .createInstance()
    .get(
      `https://api.github.local/repos/${owner}/${repo}`,
      {
        full_name: `${owner}/${repo}`,
        clone_url: `https://api.github.local/${owner}/${repo}.git`,
      },
      { repeat: 1 },
    )
    .post(
      "https://api.github.local/graphql",
      {
        data: {
          repository: {
            issues: { nodes: [] },
          },
        },
      },
      { repeat: 1 },
    )
    .post(
      ({ url, options }) => {
        if (url !== `https://api.github.local/repos/${owner}/${repo}/issues`)
          return false;

        const data = JSON.parse(options.body);
        t.is(data.title, failTitle);
        t.regex(
          data.body,
          /---\n\n### Error message 1\n\nError 1 details\n\n---\n\n### Error message 2\n\nError 2 details\n\n---/,
        );
        t.deepEqual(data.labels, [RELEASE_FAIL_LABEL]);
        return true;
      },
      { html_url: "https://github.com/issues/1", number: 1 },
      { repeat: 1 },
    );

  await fail(
    pluginConfig,
    {
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

  t.true(
    t.context.log.calledWith(
      "Created issue #%d: %s.",
      1,
      "https://github.com/issues/1",
    ),
  );
  t.true(fm.callHistory.done());
});

test("Update the first existing issue with the list of errors", async (t) => {
  const owner = "test_user";
  const repo = "test_repo";
  const env = { GITHUB_TOKEN: "github_token" };
  const failTitle = "The automated release is failing 🚨";
  const pluginConfig = { failTitle };
  const options = {
    repositoryUrl: `https://github.com/${owner}/${repo}.git`,
  };
  const errors = [
    new SemanticReleaseError("Error message 1", "ERR1", "Error 1 details"),
    new SemanticReleaseError("Error message 2", "ERR2", "Error 2 details"),
    new SemanticReleaseError("Error message 3", "ERR3", "Error 3 details"),
  ];
  const issues = [
    { number: 1, body: "Issue 1 body", title: failTitle },
    { number: 2, body: `Issue 2 body\n\n${ISSUE_ID}`, title: failTitle },
    { number: 3, body: `Issue 3 body\n\n${ISSUE_ID}`, title: failTitle },
  ];

  const fm = fetchMock
    .createInstance()
    .get(
      `https://api.github.local/repos/${owner}/${repo}`,
      {
        full_name: `${owner}/${repo}`,
        clone_url: `https://api.github.local/${owner}/${repo}.git`,
      },
      { repeat: 1 },
    )
    .post(
      "https://api.github.local/graphql",
      {
        data: {
          repository: {
            issues: { nodes: issues },
          },
        },
      },
      { repeat: 1 },
    )
    .post(
      ({ url, options }) => {
        if (
          url !==
          `https://api.github.local/repos/${owner}/${repo}/issues/2/comments`
        )
          return false;
        t.regex(
          JSON.parse(options.body).body,
          /---\n\n### Error message 1\n\nError 1 details\n\n---\n\n### Error message 2\n\nError 2 details\n\n---\n\n### Error message 3\n\nError 3 details\n\n---/,
        );
        return true;
      },
      { html_url: "https://github.com/issues/2", number: 2 },
      { repeat: 1 },
    );

  await fail(
    pluginConfig,
    {
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

  t.true(
    t.context.log.calledWith("Found existing semantic-release issue #%d.", 2),
  );
  t.true(
    t.context.log.calledWith(
      "Added comment to issue #%d: %s.",
      2,
      "https://github.com/issues/2",
    ),
  );
  t.true(fm.callHistory.done());
});

test('Skip if "failComment" is "false"', async (t) => {
  const owner = "test_user";
  const repo = "test_repo";
  const env = { GITHUB_TOKEN: "github_token" };
  const pluginConfig = { failComment: false };
  const options = { repositoryUrl: `https://github.com/${owner}/${repo}.git` };
  const errors = [
    new SemanticReleaseError("Error message 1", "ERR1", "Error 1 details"),
    new SemanticReleaseError("Error message 2", "ERR2", "Error 2 details"),
    new SemanticReleaseError("Error message 3", "ERR3", "Error 3 details"),
  ];

  await fail(
    pluginConfig,
    {
      env,
      options,
      branch: { name: "master" },
      errors,
      logger: t.context.logger,
    },
    {
      Octokit: TestOctokit.defaults((options) => ({
        ...options,
        request: { ...options.request, fetch },
      })),
    },
  );

  t.true(t.context.log.calledWith("Skip issue creation."));
});

test('Skip if "failTitle" is "false"', async (t) => {
  const owner = "test_user";
  const repo = "test_repo";
  const env = { GITHUB_TOKEN: "github_token" };
  const pluginConfig = { failTitle: false };
  const options = { repositoryUrl: `https://github.com/${owner}/${repo}.git` };
  const errors = [
    new SemanticReleaseError("Error message 1", "ERR1", "Error 1 details"),
    new SemanticReleaseError("Error message 2", "ERR2", "Error 2 details"),
    new SemanticReleaseError("Error message 3", "ERR3", "Error 3 details"),
  ];

  await fail(
    pluginConfig,
    {
      env,
      options,
      branch: { name: "master" },
      errors,
      logger: t.context.logger,
    },
    {
      Octokit: TestOctokit.defaults((options) => ({
        ...options,
        request: { ...options.request, fetch },
      })),
    },
  );

  t.true(t.context.log.calledWith("Skip issue creation."));
});

test('Does not post comments if "failCommentCondition" is "false"', async (t) => {
  const owner = "test_user";
  const repo = "test_repo";
  const env = { GITHUB_TOKEN: "github_token" };
  const pluginConfig = { failCommentCondition: false };
  const options = { repositoryUrl: `https://github.com/${owner}/${repo}.git` };

  await fail(
    pluginConfig,
    {
      env,
      options,
      branch: { name: "master" },
      logger: t.context.logger,
    },
    {
      Octokit: TestOctokit.defaults((options) => ({
        ...options,
        request: { ...options.request, fetch },
      })),
    },
  );

  t.true(t.context.log.calledWith("Skip issue creation."));
});

test('Does not post comments on existing issues when "failCommentCondition" is "false"', async (t) => {
  const owner = "test_user";
  const repo = "test_repo";
  const failTitle = "The automated release is failing 🚨";
  const env = { GITHUB_TOKEN: "github_token" };
  const pluginConfig = { failCommentCondition: "<% return false; %>" };
  const options = { repositoryUrl: `https://github.com/${owner}/${repo}.git` };
  const errors = [
    new SemanticReleaseError("Error message 1", "ERR1", "Error 1 details"),
    new SemanticReleaseError("Error message 2", "ERR2", "Error 2 details"),
    new SemanticReleaseError("Error message 3", "ERR3", "Error 3 details"),
  ];
  const issues = [
    { number: 1, body: "Issue 1 body", title: failTitle },
    { number: 2, body: `Issue 2 body\n\n${ISSUE_ID}`, title: failTitle },
    { number: 3, body: `Issue 3 body\n\n${ISSUE_ID}`, title: failTitle },
  ];

  const fm = fetchMock
    .createInstance()
    .get(
      `https://api.github.local/repos/${owner}/${repo}`,
      {
        full_name: `${owner}/${repo}`,
      },
      { repeat: 1 },
    )
    .post(
      ({ url, options }) =>
        url === "https://api.github.local/graphql" &&
        JSON.parse(options.body).query.includes("query getSRIssues("),
      {
        data: {
          repository: {
            issues: { nodes: issues },
          },
        },
      },
      { repeat: 1 },
    );

  await fail(
    pluginConfig,
    {
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

  t.true(fm.callHistory.done());
  t.true(t.context.log.calledWith("Skip commenting on or creating an issue."));
});

test(`Post new issue if none exists yet, but don't comment on existing issues when "failCommentCondition" disallows it`, async (t) => {
  const owner = "test_user";
  const repo = "test_repo";
  const env = { GITHUB_TOKEN: "github_token" };
  const errors = [{ message: "An error occured" }];
  const failTitle = "The automated release is failing 🚨";
  const pluginConfig = {
    failTitle,
    failComment: `Error: Release for branch \${branch.name} failed with error: \${errors.map(error => error.message).join(';')}`,
    failCommentCondition: "<% return !issue; %>",
  };
  const options = {
    repositoryUrl: `https://github.com/${owner}/${repo}.git`,
  };

  const fm = fetchMock
    .createInstance()
    .get(
      `https://api.github.local/repos/${owner}/${repo}`,
      {
        full_name: `${owner}/${repo}`,
      },
      { repeat: 1 },
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
      { repeat: 1 },
    )
    .post(
      ({ url, options }) => {
        if (url !== `https://api.github.local/repos/${owner}/${repo}/issues`)
          return false;
        t.regex(
          JSON.parse(options.body).body,
          /Error: Release for branch master failed with error: An error occured\n\n<!-- semantic-release:github -->/,
        );
        return true;
      },
      { html_url: "https://github.com/issues/2", number: 2 },
      { repeat: 1 },
    );

  await fail(
    pluginConfig,
    {
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

  t.true(fm.callHistory.done());
  t.true(
    t.context.log.calledWith(
      "Created issue #%d: %s.",
      2,
      "https://github.com/issues/2",
    ),
  );
});
