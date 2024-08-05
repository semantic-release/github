import SemanticReleaseError from "@semantic-release/error";
import sinon from "sinon";
import test from "ava";
import fetchMock from "fetch-mock";

import { ISSUE_ID } from "../lib/definitions/constants.js";
import { TestOctokit } from "./helpers/test-octokit.js";

/* eslint camelcase: ["error", {properties: "never"}] */

import fail from "../lib/fail.js";

test.beforeEach((t) => {
  // Mock logger
  t.context.log = sinon.stub();
  t.context.error = sinon.stub();
  t.context.logger = { log: t.context.log, error: t.context.error };
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
  const fetch = fetchMock
    .sandbox()
    .getOnce("https://api.github.local/repos/test_user/test_repo", {
      full_name: `${redirectedOwner}/${redirectedRepo}`,
    })
    .getOnce(
      `https://api.github.local/search/issues?q=${encodeURIComponent(
        "in:title",
      )}+${encodeURIComponent(
        `repo:${redirectedOwner}/${redirectedRepo}`,
      )}+${encodeURIComponent("type:issue")}+${encodeURIComponent(
        "state:open",
      )}+${encodeURIComponent(failTitle)}`,
      { items: [] },
    )
    .postOnce(
      (url, { body }) => {
        t.is(
          url,
          `https://api.github.local/repos/${redirectedOwner}/${redirectedRepo}/issues`,
        );

        const data = JSON.parse(body);
        t.is(data.title, failTitle);
        t.regex(
          data.body,
          /---\n\n### Error message 1\n\nError 1 details\n\n---\n\n### Error message 2\n\nError 2 details\n\n---\n\n### Error message 3\n\nError 3 details\n\n---/,
        );
        t.deepEqual(data.labels, ["semantic-release"]);
        return true;
      },
      {
        html_url: "https://github.com/issues/1",
        number: 1,
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
        request: { ...options.request, fetch },
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
  t.true(fetch.done());
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

  const fetch = fetchMock
    .sandbox()
    .getOnce(`https://api.github.local/repos/${owner}/${repo}`, {
      full_name: `${owner}/${repo}`,
      clone_url: `https://api.github.local/${owner}/${repo}.git`,
    })
    .getOnce(
      `https://api.github.local/search/issues?q=${encodeURIComponent(
        "in:title",
      )}+${encodeURIComponent(`repo:${owner}/${repo}`)}+${encodeURIComponent(
        "type:issue",
      )}+${encodeURIComponent("state:open")}+${encodeURIComponent(failTitle)}`,
      { items: [] },
    )
    .postOnce(
      `https://api.github.local/repos/${owner}/${repo}/issues`,
      { html_url: "https://github.com/issues/1", number: 1 },
      {
        body: {
          title: failTitle,
          body: `branch master Error message 1 Error message 2 Error message 3\n\n${ISSUE_ID}`,
          labels: ["semantic-release"],
        },
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
        request: { ...options.request, fetch },
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
  t.true(fetch.done());
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

  const fetch = fetchMock
    .sandbox()
    .getOnce(`https://api.github.local/repos/${owner}/${repo}`, {
      full_name: `${owner}/${repo}`,
      clone_url: `https://api.github.local/${owner}/${repo}.git`,
    })
    .getOnce(
      `https://api.github.local/search/issues?q=${encodeURIComponent(
        "in:title",
      )}+${encodeURIComponent(`repo:${owner}/${repo}`)}+${encodeURIComponent(
        "type:issue",
      )}+${encodeURIComponent("state:open")}+${encodeURIComponent(failTitle)}`,
      { items: [] },
    )
    .postOnce(
      (url, { body }) => {
        t.is(url, `https://api.github.local/repos/${owner}/${repo}/issues`);

        const data = JSON.parse(body);
        t.is(data.title, failTitle);
        t.regex(
          data.body,
          /---\n\n### Error message 1\n\nError 1 details\n\n---\n\n### Error message 2\n\nError 2 details\n\n---/,
        );
        t.deepEqual(data.labels, ["semantic-release"]);
        t.deepEqual(data.assignees, ["user1", "user2"]);
        return true;
      },
      { html_url: "https://github.com/issues/1", number: 1 },
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
        request: { ...options.request, fetch },
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
  t.true(fetch.done());
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

  const fetch = fetchMock
    .sandbox()
    .getOnce(`https://api.github.local/repos/${owner}/${repo}`, {
      full_name: `${owner}/${repo}`,
      clone_url: `https://api.github.local/${owner}/${repo}.git`,
    })
    .getOnce(
      `https://api.github.local/search/issues?q=${encodeURIComponent(
        "in:title",
      )}+${encodeURIComponent(`repo:${owner}/${repo}`)}+${encodeURIComponent(
        "type:issue",
      )}+${encodeURIComponent("state:open")}+${encodeURIComponent(failTitle)}`,
      { items: [] },
    )
    .postOnce(
      (url, { body }) => {
        t.is(url, `https://api.github.local/repos/${owner}/${repo}/issues`);

        const data = JSON.parse(body);
        t.is(data.title, failTitle);
        t.regex(
          data.body,
          /---\n\n### Error message 1\n\nError 1 details\n\n---\n\n### Error message 2\n\nError 2 details\n\n---/,
        );
        t.deepEqual(data.labels, []);
        return true;
      },
      { html_url: "https://github.com/issues/1", number: 1 },
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
        request: { ...options.request, fetch },
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
  t.true(fetch.done());
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

  const fetch = fetchMock
    .sandbox()
    .getOnce(`https://api.github.local/repos/${owner}/${repo}`, {
      full_name: `${owner}/${repo}`,
      clone_url: `https://api.github.local/${owner}/${repo}.git`,
    })
    .getOnce(
      `https://api.github.local/search/issues?q=${encodeURIComponent(
        "in:title",
      )}+${encodeURIComponent(`repo:${owner}/${repo}`)}+${encodeURIComponent(
        "type:issue",
      )}+${encodeURIComponent("state:open")}+${encodeURIComponent(failTitle)}`,
      { items: issues },
    )
    .postOnce(
      (url, { body }) => {
        t.is(
          url,
          `https://api.github.local/repos/${owner}/${repo}/issues/2/comments`,
        );
        t.regex(
          JSON.parse(body).body,
          /---\n\n### Error message 1\n\nError 1 details\n\n---\n\n### Error message 2\n\nError 2 details\n\n---\n\n### Error message 3\n\nError 3 details\n\n---/,
        );
        return true;
      },
      { html_url: "https://github.com/issues/2", number: 2 },
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
        request: { ...options.request, fetch },
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
  t.true(fetch.done());
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
