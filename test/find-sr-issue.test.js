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
  t.context.logger = { log: t.context.log, error: t.context.error };
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
  const issues = [];
  const fetch = fetchMock
    .sandbox()
    .postOnce("https://api.github.local/graphql", {
      data: {
        repository: {
          issues: { nodes: [] },
        },
      },
    })
    .getOnce(
      `https://api.github.local/search/issues?q=${encodeURIComponent(
        "in:title",
      )}+${encodeURIComponent(`repo:${owner}/${repo}`)}+${encodeURIComponent(
        "type:issue",
      )}+${encodeURIComponent("state:open")}+${encodeURIComponent(title)}`,
      { items: issues },
    );

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

test("Handle error in searchAPI fallback", async (t) => {
  const owner = "test_user";
  const repo = "test_repo";
  const title = "The automated release is failing 🚨";
  const labels = [];
  const issues = [];

  const response = new Response("Not Found", {
    url: "https://api.github.com/search/issues?q=in%3Atitle+repo%3Aourorg%2Frepo+type%3Aissue+state%3Aopen+The%20automated%20release%20is%20failing%20%F0%9F%9A%A8",
    status: 403,
    headers: {
      "access-control-allow-origin": "*",
      "access-control-expose-headers":
        "ETag, Link, Location, Retry-After, X-GitHub-OTP, X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Used, X-RateLimit-Resource, X-RateLimit-Reset, X-OAuth-Scopes, X-Accepted-OAuth-Scopes, X-Poll-Interval, X-GitHub-Media-Type, X-GitHub-SSO, X-GitHub-Request-Id, Deprecation, Sunset",
      "content-encoding": "gzip",
      "content-security-policy": "default-repo 'none'",
      "content-type": "application/json; charset=utf-8",
      date: "Tue, 28 May 2024 19:49:00 GMT",
      "referrer-policy":
        "origin-when-cross-origin, strict-origin-when-cross-origin",
      server: "GitHub.com",
      "strict-transport-security":
        "max-age=31536000; includeSubdomains; preload",
      "transfer-encoding": "chunked",
      vary: "Accept-Encoding, Accept, X-Requested-With",
      "x-content-type-options": "nosniff",
      "x-frame-options": "deny",
      "x-github-api-version-selected": "2022-11-28",
      "x-github-media-type": "github.v3; format=json",
      "x-github-request-id": "2**0:29*****4:3868737:6*****3:6****52C",
      "x-ratelimit-limit": "30",
      "x-ratelimit-remaining": "30",
      "x-ratelimit-reset": "1716925800",
      "x-ratelimit-resource": "search",
      "x-ratelimit-used": "1",
      "x-xss-protection": "0",
    },
    data: {
      documentation_url:
        "https://docs.github.com/free-pro-team@latest/rest/overview/rate-limits-for-the-rest-api#about-secondary-rate-limits",
      message:
        "You have exceeded a secondary rate limit. Please wait a few minutes before you try again. If you reach out to GitHub Support for help, please include the request ID 2840:295B44:3868737:64A2183:6232352C.",
    },
  });

  const fetch = fetchMock
    .sandbox()
    .postOnce("https://api.github.local/graphql", {
      data: {
        repository: {
          issues: { nodes: issues },
        },
      },
    })
    .getOnce(
      `https://api.github.local/search/issues?q=${encodeURIComponent(
        "in:title",
      )}+${encodeURIComponent(`repo:${owner}/${repo}`)}+${encodeURIComponent(
        "type:issue",
      )}+${encodeURIComponent("state:open")}+${encodeURIComponent(title)}`,
      response,
    );

  const srIssues = await findSRIssues(
    new TestOctokit({ request: { fetch } }),
    t.context.logger,
    title,
    labels,
    owner,
    repo,
  );

  t.true(
    t.context.log.calledWith(
      "An error occured fetching issue via fallback (with GH SearchAPI)",
    ),
  );
  t.log(t.context.log);
  t.true(fetch.done());
});
