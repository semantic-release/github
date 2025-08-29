import sinon from "sinon";
import test from "ava";
import fetchMock from "fetch-mock";

import { ISSUE_ID } from "../lib/definitions/constants.js";
import findSRIssues from "../lib/find-sr-issues.js";
import { TestOctokit } from "./helpers/test-octokit.js";

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

test("Filter out issues without ID", async (t) => {
  const owner = "test_user";
  const repo = "test_repo";
  const title = "The automated release is failing 🚨";
  const labels = [];
  const issues = [
    { number: 1, body: "Issue 1 body", title },
    { number: 2, body: `Issue 2 body\n\n${ISSUE_ID}`, title },
    { number: 3, body: `Issue 3 body\n\n${ISSUE_ID}`, title },
  ];

  const fetch = fetchMock
    .sandbox()
    .postOnce("https://api.github.local/graphql", {
      data: {
        repository: {
          issues: { nodes: issues },
        },
      },
    });

  const srIssues = await findSRIssues(
    new TestOctokit({ request: { fetch } }),
    t.context.logger,
    title,
    labels,
    owner,
    repo,
  );

  t.deepEqual(srIssues, [
    {
      number: 2,
      body: "Issue 2 body\n\n<!-- semantic-release:github -->",
      title,
    },
    {
      number: 3,
      body: "Issue 3 body\n\n<!-- semantic-release:github -->",
      title,
    },
  ]);

  t.true(fetch.done());
});

test("Return empty array if not issues found", async (t) => {
  const owner = "test_user";
  const repo = "test_repo";
  const title = "The automated release is failing 🚨";
  const labels = [];
  const fetch = fetchMock
    .sandbox()
    .postOnce("https://api.github.local/graphql", {
      data: {
        repository: {
          issues: { nodes: [] },
        },
      },
    });

  const srIssues = await findSRIssues(
    new TestOctokit({ request: { fetch } }),
    t.context.logger,
    title,
    labels,
    owner,
    repo,
  );

  t.deepEqual(srIssues, []);

  t.true(fetch.done());
});

test("Return empty array if not issues has matching ID", async (t) => {
  const owner = "test_user";
  const repo = "test_repo";
  const title = "The automated release is failing 🚨";
  const labels = [];
  const issues = [
    { number: 1, body: "Issue 1 body", title },
    { number: 2, body: "Issue 2 body", title },
  ];
  const fetch = fetchMock
    .sandbox()
    .postOnce("https://api.github.local/graphql", {
      data: {
        repository: {
          issues: { nodes: issues },
        },
      },
    });

  const srIssues = await findSRIssues(
    new TestOctokit({ request: { fetch } }),
    t.context.logger,
    title,
    labels,
    owner,
    repo,
  );

  t.deepEqual(srIssues, []);
  t.true(fetch.done());
});
