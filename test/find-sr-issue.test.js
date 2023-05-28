import { escape } from "node:querystring";

import nock from "nock";
import quibble from "quibble";
import sinon from "sinon";
import test from "ava";

import { ISSUE_ID } from "../lib/definitions/constants.js";
import findSRIssues from "../lib/find-sr-issues.js";
import { authenticate } from "./helpers/mock-github.js";
import { TestOctokit } from "./helpers/test-octokit.js";

// mock rate limit imported via lib/get-client.js
await quibble.esm("../lib/semantic-release-octokit.js", {}, TestOctokit); // eslint-disable-line
const getClient = (await import("../lib/get-client.js")).default;

const githubToken = "github_token";
const client = getClient({ githubToken });

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

test.serial("Filter out issues without ID", async (t) => {
  const owner = "test_user";
  const repo = "test_repo";
  const githubToken = "github_token";
  const title = "The automated release is failing 🚨";
  const issues = [
    { number: 1, body: "Issue 1 body", title },
    { number: 2, body: `Issue 2 body\n\n${ISSUE_ID}`, title },
    { number: 3, body: `Issue 3 body\n\n${ISSUE_ID}`, title },
  ];
  const github = authenticate({}, { githubToken })
    .get(
      `/search/issues?q=${escape("in:title")}+${escape(
        `repo:${owner}/${repo}`
      )}+${escape("type:issue")}+${escape("state:open")}+${escape(title)}`
    )
    .reply(200, { items: issues });

  const srIssues = await findSRIssues(client, title, owner, repo);

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

  t.true(github.isDone());
});

test.serial("Return empty array if not issues found", async (t) => {
  const owner = "test_user";
  const repo = "test_repo";
  const githubToken = "github_token";
  const title = "The automated release is failing 🚨";
  const issues = [];
  const github = authenticate({}, { githubToken })
    .get(
      `/search/issues?q=${escape("in:title")}+${escape(
        `repo:${owner}/${repo}`
      )}+${escape("type:issue")}+${escape("state:open")}+${escape(title)}`
    )
    .reply(200, { items: issues });

  const srIssues = await findSRIssues(client, title, owner, repo);

  t.deepEqual(srIssues, []);

  t.true(github.isDone());
});

test.serial("Return empty array if not issues has matching ID", async (t) => {
  const owner = "test_user";
  const repo = "test_repo";
  const githubToken = "github_token";
  const title = "The automated release is failing 🚨";
  const issues = [
    { number: 1, body: "Issue 1 body", title },
    { number: 2, body: "Issue 2 body", title },
  ];
  const github = authenticate({}, { githubToken })
    .get(
      `/search/issues?q=${escape("in:title")}+${escape(
        `repo:${owner}/${repo}`
      )}+${escape("type:issue")}+${escape("state:open")}+${escape(title)}`
    )
    .reply(200, { items: issues });

  const srIssues = await findSRIssues(client, title, owner, repo);

  t.deepEqual(srIssues, []);
  t.true(github.isDone());
});
