import { repeat } from "lodash-es";
import sinon from "sinon";
import test from "ava";
import fetchMock from "fetch-mock";
import assert from "assert";

import { ISSUE_ID } from "../lib/definitions/constants.js";
import getReleaseLinks from "../lib/get-release-links.js";
import { TestOctokit } from "./helpers/test-octokit.js";

/* eslint camelcase: ["error", {properties: "never"}] */

import success from "../lib/success.js";

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

test("Add comment and labels to PRs associated with release commits and issues solved by PR/commits comments", async (t) => {
  const owner = "test_user";
  const repo = "test_repo";
  const redirectedOwner = "test_user_2";
  const redirectedRepo = "test_repo_2";
  const env = { GITHUB_TOKEN: "github_token" };
  const failTitle = "The automated release is failing 🚨";
  const pluginConfig = { failTitle };
  const prs = [
    { number: 1, __typename: "PullRequest", state: "closed" },
    { number: 2, __typename: "PullRequest", body: "Fixes #3", state: "closed" },
  ];
  const options = {
    branch: "master",
    repositoryUrl: `https://github.com/${owner}/${repo}.git`,
  };
  const commits = [
    {
      hash: "123",
      message: "Commit 1 message\n\n Fix #1",
      tree: { long: "aaa" },
    },
    { hash: "456", message: "Commit 2 message", tree: { long: "ccc" } },
    {
      hash: "789",
      message: `Commit 3 message Closes https://github.com/${redirectedOwner}/${redirectedRepo}/issues/4`,
      tree: { long: "ccc" },
    },
  ];
  const nextRelease = { version: "1.0.0" };
  const releases = [
    { name: "GitHub release", url: "https://github.com/release" },
  ];

  const fetch = fetchMock
    .sandbox()
    .getOnce(`https://api.github.local/repos/${owner}/${repo}`, {
      full_name: `${redirectedOwner}/${redirectedRepo}`,
      clone_url: `https://api.github.local/${owner}/${repo}.git`,
    })
    .postOnce(
      (url, { body }) =>
        url === "https://api.github.local/graphql" &&
        JSON.parse(body).query.includes("query getAssociatedPRs("),
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
            commit456: {
              oid: "456",
              associatedPullRequests: {
                pageInfo: {
                  endCursor: "NI",
                  hasNextPage: false,
                },
                nodes: [prs[1]],
              },
            },
          },
        },
      },
    )
    .postOnce(
      (url, { body }) =>
        url === "https://api.github.local/graphql" &&
        JSON.parse(body).query.includes("query getRelatedIssues("),
      {
        data: {
          repository: {
            issue3: {
              __typename: "Issue",
              id: "I_kw",
              title: "issue title",
              body: "",
              url: "https://github.com/owner/repo/issues/3",
              number: 3,
              createdAt: "2024-07-13T09:58:09Z",
              updatedAt: "2024-08-26T16:19:59Z",
              closedAt: "2024-07-13T09:58:51Z",
              comments: {
                totalCount: 12,
              },
              state: "CLOSED",
              author: {
                login: "user",
                url: "author_url",
                avatarUrl: "author_avatar_url",
                __typename: "User",
              },
              authorAssociation: "OWNER",
              activeLockReason: null,
              labels: {
                nodes: [
                  {
                    id: "label_id",
                    url: "label_url",
                    name: "label_name",
                    color: "ededed",
                    description: "this is a label description",
                    isDefault: false,
                  },
                ],
              },
              milestone: null,
              locked: false,
            },
            issue4: {
              __typename: "Issue",
              id: "I_kw",
              title: "issue title",
              body: "",
              url: "https://github.com/owner/repo/issues/3",
              number: 4,
              createdAt: "2024-07-13T09:58:09Z",
              updatedAt: "2024-08-26T16:19:59Z",
              closedAt: "2024-07-13T09:58:51Z",
              comments: {
                totalCount: 12,
              },
              state: "CLOSED",
              author: {
                login: "user",
                url: "author_url",
                avatarUrl: "author_avatar_url",
                __typename: "User",
              },
              authorAssociation: "OWNER",
              activeLockReason: null,
              labels: {
                nodes: [
                  {
                    id: "label_id",
                    url: "label_url",
                    name: "label_name",
                    color: "ededed",
                    description: "this is a label description",
                    isDefault: false,
                  },
                ],
              },
              milestone: null,
              locked: false,
            },
          },
        },
      },
    )
    .getOnce(
      `https://api.github.local/repos/${redirectedOwner}/${redirectedRepo}/pulls/1/commits`,
      [{ sha: commits[0].hash }],
    )
    .getOnce(
      `https://api.github.local/repos/${redirectedOwner}/${redirectedRepo}/pulls/2/commits`,
      [{ sha: commits[1].hash }],
    )
    .postOnce(
      `https://api.github.local/repos/${redirectedOwner}/${redirectedRepo}/issues/1/comments`,
      {
        html_url: "https://github.com/successcomment-1",
      },
    )
    .postOnce(
      `https://api.github.local/repos/${redirectedOwner}/${redirectedRepo}/issues/1/labels`,
      {},
      { body: ["released"] },
    )
    .postOnce(
      `https://api.github.local/repos/${redirectedOwner}/${redirectedRepo}/issues/2/comments`,
      { html_url: "https://github.com/successcomment-2" },
    )
    .postOnce(
      `https://api.github.local/repos/${redirectedOwner}/${redirectedRepo}/issues/2/labels`,
      {},
      { body: ["released"] },
    )
    .postOnce(
      `https://api.github.local/repos/${redirectedOwner}/${redirectedRepo}/issues/3/comments`,
      { html_url: "https://github.com/successcomment-3" },
    )
    .postOnce(
      `https://api.github.local/repos/${redirectedOwner}/${redirectedRepo}/issues/3/labels`,
      {},
      { body: ["released"] },
    )
    .postOnce(
      `https://api.github.local/repos/${redirectedOwner}/${redirectedRepo}/issues/4/comments`,
      { html_url: "https://github.com/successcomment-4" },
    )
    .postOnce(
      `https://api.github.local/repos/${redirectedOwner}/${redirectedRepo}/issues/4/labels`,
      {},
      { body: ["released"] },
    )
    .postOnce(
      (url, { body }) => {
        t.is(url, "https://api.github.local/graphql");
        t.regex(JSON.parse(body).query, /query getSRIssues\(/);
        return true;
      },
      {
        data: {
          repository: {
            issues: { nodes: [] },
          },
        },
      },
    )
    .getOnce(
      `https://api.github.local/search/issues?q=${encodeURIComponent(
        "in:title",
      )}+${encodeURIComponent(
        `repo:${redirectedOwner}/${redirectedRepo}`,
      )}+${encodeURIComponent("type:issue")}+${encodeURIComponent(
        "state:open",
      )}+${encodeURIComponent(failTitle)}`,
      { items: [] },
    );

  await success(
    pluginConfig,
    {
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
        request: { ...options.request, fetch },
      })),
    },
  );

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
  t.true(
    t.context.log.calledWith(
      "Added comment to PR #%d: %s",
      2,
      "https://github.com/successcomment-2",
    ),
  );
  t.true(
    t.context.log.calledWith("Added labels %O to PR #%d", ["released"], 2),
  );
  t.true(
    t.context.log.calledWith(
      "Added comment to issue #%d: %s",
      3,
      "https://github.com/successcomment-3",
    ),
  );
  t.true(
    t.context.log.calledWith("Added labels %O to issue #%d", ["released"], 3),
  );
  t.true(
    t.context.log.calledWith(
      "Added comment to issue #%d: %s",
      4,
      "https://github.com/successcomment-4",
    ),
  );
  t.true(
    t.context.log.calledWith("Added labels %O to issue #%d", ["released"], 4),
  );
  t.true(fetch.done());
});

test("Add comment and labels to PRs associated with release commits and issues (multipaged associatedPRs)", async (t) => {
  const owner = "test_user";
  const repo = "test_repo";
  const env = { GITHUB_TOKEN: "github_token" };
  const failTitle = "The automated release is failing 🚨";
  const pluginConfig = { failTitle };
  const prs = [
    { number: 1, __typename: "PullRequest", state: "closed" },
    { number: 2, __typename: "PullRequest", body: "Fixes #3", state: "closed" },
    { number: 5, __typename: "PullRequest", state: "closed" },
    { number: 6, __typename: "PullRequest", state: "closed" },
  ];
  const options = {
    branch: "master",
    repositoryUrl: `https://github.com/${owner}/${repo}.git`,
  };
  const commits = [
    {
      hash: "123",
      message: "Commit 1 message\n\n Fix #1",
      tree: { long: "aaa" },
    },
    { hash: "456", message: "Commit 2 message", tree: { long: "ccc" } },
    {
      hash: "789",
      message: `Commit 3 message Closes https://github.com/${owner}/${repo}/issues/4`,
      tree: { long: "ccc" },
    },
  ];
  const nextRelease = { version: "1.0.0" };
  const releases = [
    { name: "GitHub release", url: "https://github.com/release" },
  ];

  const fetch = fetchMock
    .sandbox()
    .getOnce(`https://api.github.local/repos/${owner}/${repo}`, {
      full_name: `${owner}/${repo}`,
    })
    .postOnce("https://api.github.local/graphql", {
      data: {
        repository: {
          commit123: {
            oid: "123",
            associatedPullRequests: {
              pageInfo: {
                endCursor: "YE",
                hasNextPage: true,
              },
              nodes: [prs[0]],
            },
          },
          commit456: {
            oid: "456",
            associatedPullRequests: {
              pageInfo: {
                endCursor: "NI",
                hasNextPage: false,
              },
              nodes: [prs[1]],
            },
          },
          commit789: {
            oid: "789",
            associatedPullRequests: {
              pageInfo: {
                endCursor: "NI",
                hasNextPage: false,
              },
              nodes: [prs[2]],
            },
          },
        },
      },
    })
    .postOnce(
      "https://api.github.local/graphql",
      {
        data: {
          repository: {
            commit: {
              associatedPullRequests: {
                pageInfo: {
                  endCursor: "NE",
                  hasNextPage: false,
                },
                nodes: [prs[3]],
              },
            },
          },
        },
      },
      {
        overwriteRoutes: true,
      },
    )
    .postOnce(
      (url, { body }) =>
        url === "https://api.github.local/graphql" &&
        JSON.parse(body).query.includes("query getRelatedIssues("),
      {
        data: {
          repository: {
            issue3: {
              __typename: "Issue",
              id: "I_kw",
              title: "issue title",
              body: "",
              url: "https://github.com/owner/repo/issues/3",
              number: 3,
              createdAt: "2024-07-13T09:58:09Z",
              updatedAt: "2024-08-26T16:19:59Z",
              closedAt: "2024-07-13T09:58:51Z",
              comments: {
                totalCount: 12,
              },
              state: "CLOSED",
              author: {
                login: "user",
                url: "author_url",
                avatarUrl: "author_avatar_url",
                __typename: "User",
              },
              authorAssociation: "OWNER",
              activeLockReason: null,
              labels: {
                nodes: [
                  {
                    id: "label_id",
                    url: "label_url",
                    name: "label_name",
                    color: "ededed",
                    description: "this is a label description",
                    isDefault: false,
                  },
                ],
              },
              milestone: null,
              locked: false,
            },
            issue4: {
              __typename: "Issue",
              id: "I_kw",
              title: "issue title",
              body: "",
              url: "https://github.com/owner/repo/issues/4",
              number: 4,
              createdAt: "2024-07-13T09:58:09Z",
              updatedAt: "2024-08-26T16:19:59Z",
              closedAt: "2024-07-13T09:58:51Z",
              comments: {
                totalCount: 12,
              },
              state: "CLOSED",
              author: {
                login: "user",
                url: "author_url",
                avatarUrl: "author_avatar_url",
                __typename: "User",
              },
              authorAssociation: "OWNER",
              activeLockReason: null,
              labels: {
                nodes: [
                  {
                    id: "label_id",
                    url: "label_url",
                    name: "label_name",
                    color: "ededed",
                    description: "this is a label description",
                    isDefault: false,
                  },
                ],
              },
              milestone: null,
              locked: false,
            },
          },
        },
      },
    )
    .getOnce(
      `https://api.github.local/repos/${owner}/${repo}/pulls/6/commits`,
      [{ sha: commits[0].hash }],
    )
    .postOnce(
      `https://api.github.local/repos/${owner}/${repo}/issues/3/comments`,
      { html_url: "https://github.com/successcomment-3" },
    )
    .postOnce(
      `https://api.github.local/repos/${owner}/${repo}/issues/3/labels`,
      {},
      { body: ["released"] },
    )
    .postOnce(
      `https://api.github.local/repos/${owner}/${repo}/issues/4/comments`,
      { html_url: "https://github.com/successcomment-4" },
    )
    .postOnce(
      `https://api.github.local/repos/${owner}/${repo}/issues/4/labels`,
      {},
      { body: ["released"] },
    )
    .postOnce(
      `https://api.github.local/repos/${owner}/${repo}/issues/6/comments`,
      { html_url: "https://github.com/successcomment-6" },
    )
    .postOnce(
      `https://api.github.local/repos/${owner}/${repo}/issues/6/labels`,
      {},
      { body: ["released"] },
    )
    .postOnce(
      (url, { body }) => {
        t.is(url, "https://api.github.local/graphql");
        t.regex(JSON.parse(body).query, /query getSRIssues\(/);
        return true;
      },
      {
        data: {
          repository: {
            issues: { nodes: [] },
          },
        },
      },
    )
    .getOnce(
      `https://api.github.local/search/issues?q=${encodeURIComponent(
        "in:title",
      )}+${encodeURIComponent(
        `repo:${owner}/${repo}`,
      )}+${encodeURIComponent("type:issue")}+${encodeURIComponent(
        "state:open",
      )}+${encodeURIComponent(failTitle)}`,
      { items: [] },
    );

  await success(
    pluginConfig,
    {
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
        request: { ...options.request, fetch },
      })),
    },
  );

  t.true(
    t.context.log.calledWith(
      "Added comment to issue #%d: %s",
      3,
      "https://github.com/successcomment-3",
    ),
  );
  t.true(
    t.context.log.calledWith("Added labels %O to issue #%d", ["released"], 3),
  );
  t.true(
    t.context.log.calledWith(
      "Added comment to issue #%d: %s",
      4,
      "https://github.com/successcomment-4",
    ),
  );
  t.true(
    t.context.log.calledWith("Added labels %O to issue #%d", ["released"], 4),
  );
  t.true(
    t.context.log.calledWith(
      "Added comment to PR #%d: %s",
      6,
      "https://github.com/successcomment-6",
    ),
  );
  t.true(
    t.context.log.calledWith("Added labels %O to PR #%d", ["released"], 6),
  );
  t.true(fetch.done());
});

test("Add comment and labels to PRs associated with release commits and issues closed by PR/commits comments with custom URL", async (t) => {
  const owner = "test_user";
  const repo = "test_repo";
  const env = {
    GH_URL: "https://custom-url.com",
    GH_TOKEN: "github_token",
    GH_PREFIX: "prefix",
  };
  const failTitle = "The automated release is failing 🚨";
  const pluginConfig = { failTitle };
  const prs = [
    { number: 1, __typename: "PullRequest", state: "closed" },
    { number: 2, __typename: "PullRequest", body: "Fixes #3", state: "closed" },
  ];
  const options = {
    branch: "master",
    repositoryUrl: `https://custom-url.com/${owner}/${repo}.git`,
  };
  const commits = [
    { hash: "123", message: "Commit 1 message\n\n Fix #1" },
    { hash: "456", message: "Commit 2 message" },
    {
      hash: "789",
      message: `Commit 3 message Closes https://custom-url.com/${owner}/${repo}/issues/4`,
    },
  ];
  const nextRelease = { version: "1.0.0", channel: "next" };
  const releases = [
    { name: "GitHub release", url: "https://custom-url.com/release" },
  ];

  const fetch = fetchMock
    .sandbox()
    .getOnce(`https://custom-url.com/prefix/repos/${owner}/${repo}`, {
      full_name: `${owner}/${repo}`,
    })
    .postOnce(
      (url, { body }) =>
        url === "https://custom-url.com/prefix/graphql" &&
        JSON.parse(body).query.includes("query getAssociatedPRs("),
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
            commit456: {
              oid: "456",
              associatedPullRequests: {
                pageInfo: {
                  endCursor: "NI",
                  hasNextPage: false,
                },
                nodes: [prs[1]],
              },
            },
          },
        },
      },
    )
    .postOnce(
      (url, { body }) =>
        url === "https://custom-url.com/prefix/graphql" &&
        JSON.parse(body).query.includes("query getRelatedIssues("),
      {
        data: {
          repository: {
            issue3: {
              __typename: "Issue",
              id: "I_kw",
              title: "issue title",
              body: "",
              url: "https://custom-url.com/owner/repo/issues/3",
              number: 3,
              createdAt: "2024-07-13T09:58:09Z",
              updatedAt: "2024-08-26T16:19:59Z",
              closedAt: "2024-07-13T09:58:51Z",
              comments: {
                totalCount: 12,
              },
              state: "CLOSED",
              author: {
                login: "user",
                url: "author_url",
                avatarUrl: "author_avatar_url",
                __typename: "User",
              },
              authorAssociation: "OWNER",
              activeLockReason: null,
              labels: {
                nodes: [
                  {
                    id: "label_id",
                    url: "label_url",
                    name: "label_name",
                    color: "ededed",
                    description: "this is a label description",
                    isDefault: false,
                  },
                ],
              },
              milestone: null,
              locked: false,
            },
            issue4: {
              __typename: "Issue",
              id: "I_kw",
              title: "issue title",
              body: "",
              url: "https://custom-url.com/owner/repo/issues/4",
              number: 4,
              createdAt: "2024-07-13T09:58:09Z",
              updatedAt: "2024-08-26T16:19:59Z",
              closedAt: "2024-07-13T09:58:51Z",
              comments: {
                totalCount: 12,
              },
              state: "CLOSED",
              author: {
                login: "user",
                url: "author_url",
                avatarUrl: "author_avatar_url",
                __typename: "User",
              },
              authorAssociation: "OWNER",
              activeLockReason: null,
              labels: {
                nodes: [
                  {
                    id: "label_id",
                    url: "label_url",
                    name: "label_name",
                    color: "ededed",
                    description: "this is a label description",
                    isDefault: false,
                  },
                ],
              },
              milestone: null,
              locked: false,
            },
          },
        },
      },
    )
    .getOnce(
      `https://custom-url.com/prefix/repos/${owner}/${repo}/pulls/1/commits`,
      [{ sha: commits[0].hash }],
    )
    .getOnce(
      `https://custom-url.com/prefix/repos/${owner}/${repo}/pulls/2/commits`,
      [{ sha: commits[1].hash }],
    )
    .postOnce(
      `https://custom-url.com/prefix/repos/${owner}/${repo}/issues/1/comments`,
      {
        html_url: "https://custom-url.com/successcomment-1",
      },
    )
    .postOnce(
      `https://custom-url.com/prefix/repos/${owner}/${repo}/issues/1/labels`,
      {},
      { body: ["released on @next"] },
    )
    .postOnce(
      `https://custom-url.com/prefix/repos/${owner}/${repo}/issues/2/comments`,
      {
        html_url: "https://custom-url.com/successcomment-2",
      },
    )
    .postOnce(
      `https://custom-url.com/prefix/repos/${owner}/${repo}/issues/2/labels`,
      {},
      { body: ["released on @next"] },
    )
    .postOnce(
      `https://custom-url.com/prefix/repos/${owner}/${repo}/issues/3/comments`,
      {
        html_url: "https://custom-url.com/successcomment-3",
      },
    )
    .postOnce(
      `https://custom-url.com/prefix/repos/${owner}/${repo}/issues/3/labels`,
      {},
      { body: ["released on @next"] },
    )
    .postOnce(
      `https://custom-url.com/prefix/repos/${owner}/${repo}/issues/4/comments`,
      {
        html_url: "https://custom-url.com/successcomment-4",
      },
    )
    .postOnce(
      `https://custom-url.com/prefix/repos/${owner}/${repo}/issues/4/labels`,
      {},
      { body: ["released on @next"] },
    )
    .postOnce(
      (url, { body }) => {
        t.is(url, "https://custom-url.com/prefix/graphql");
        t.regex(JSON.parse(body).query, /query getSRIssues\(/);
        return true;
      },
      {
        data: {
          repository: {
            issues: { nodes: [] },
          },
        },
      },
    )
    .getOnce(
      `https://custom-url.com/prefix/search/issues?q=${encodeURIComponent(
        "in:title",
      )}+${encodeURIComponent(`repo:${owner}/${repo}`)}+${encodeURIComponent(
        "type:issue",
      )}+${encodeURIComponent("state:open")}+${encodeURIComponent(failTitle)}`,
      { items: [] },
    );

  await success(
    pluginConfig,
    {
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
        request: { ...options.request, fetch },
      })),
    },
  );

  t.true(
    t.context.log.calledWith(
      "Added comment to PR #%d: %s",
      1,
      "https://custom-url.com/successcomment-1",
    ),
  );
  t.true(
    t.context.log.calledWith(
      "Added labels %O to PR #%d",
      ["released on @next"],
      1,
    ),
  );
  t.true(
    t.context.log.calledWith(
      "Added comment to PR #%d: %s",
      2,
      "https://custom-url.com/successcomment-2",
    ),
  );
  t.true(
    t.context.log.calledWith(
      "Added labels %O to PR #%d",
      ["released on @next"],
      2,
    ),
  );
  t.true(
    t.context.log.calledWith(
      "Added comment to issue #%d: %s",
      3,
      "https://custom-url.com/successcomment-3",
    ),
  );
  t.true(
    t.context.log.calledWith(
      "Added labels %O to issue #%d",
      ["released on @next"],
      3,
    ),
  );
  t.true(
    t.context.log.calledWith(
      "Added comment to issue #%d: %s",
      4,
      "https://custom-url.com/successcomment-4",
    ),
  );
  t.true(
    t.context.log.calledWith(
      "Added labels %O to issue #%d",
      ["released on @next"],
      4,
    ),
  );
  t.true(fetch.done());
});

test("Make multiple search queries if necessary", async (t) => {
  const owner = "test_user";
  const repo = "test_repo";
  const env = { GITHUB_TOKEN: "github_token" };
  const failTitle = "The automated release is failing 🚨";
  const pluginConfig = { failTitle };
  const prs = [
    { number: 1, __typename: "PullRequest", state: "closed" },
    { number: 2, __typename: "PullRequest", state: "closed" },
    { number: 3, __typename: "PullRequest", state: "closed" },
    { number: 4, __typename: "PullRequest", state: "closed" },
    { number: 5, __typename: "PullRequest", state: "closed" },
    { number: 6, __typename: "PullRequest", state: "closed" },
  ];
  const options = {
    branch: "master",
    repositoryUrl: `https://github.com/${owner}/${repo}.git`,
  };
  const commits = [
    { hash: repeat("a", 40), message: "Commit 1 message" },
    { hash: repeat("b", 40), message: "Commit 2 message" },
    { hash: repeat("c", 40), message: "Commit 3 message" },
    { hash: repeat("d", 40), message: "Commit 4 message" },
    { hash: repeat("e", 40), message: "Commit 5 message" },
    { hash: repeat("f", 40), message: "Commit 6 message" },
    { hash: repeat("g", 40), message: "Commit 7 message" },
  ];
  const nextRelease = { version: "1.0.0" };
  const releases = [
    { name: "GitHub release", url: "https://github.com/release" },
  ];

  const fetch = fetchMock
    .sandbox()
    .getOnce(`https://api.github.local/repos/${owner}/${repo}`, {
      full_name: `${owner}/${repo}`,
      clone_url: `https://api.github.local/${owner}/${repo}.git`,
    })
    .postOnce(
      (url, { body }) => {
        t.is(url, "https://api.github.local/graphql");
        t.regex(JSON.parse(body).query, /query getAssociatedPRs\(/);
        return true;
      },
      {
        data: {
          repository: {
            commitaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa: {
              oid: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
              associatedPullRequests: {
                pageInfo: {
                  endCursor: "NI",
                  hasNextPage: false,
                },
                nodes: [prs[0]],
              },
            },
            commitbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb: {
              oid: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
              associatedPullRequests: {
                pageInfo: {
                  endCursor: "NI",
                  hasNextPage: false,
                },
                nodes: [prs[1]],
              },
            },
            commitcccccccccccccccccccccccccccccccccccccccccc: {
              oid: "cccccccccccccccccccccccccccccccccccccccccc",
              associatedPullRequests: {
                pageInfo: {
                  endCursor: "NI",
                  hasNextPage: false,
                },
                nodes: [prs[2]],
              },
            },
            commiteeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee: {
              oid: "eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
              associatedPullRequests: {
                pageInfo: {
                  endCursor: "NI",
                  hasNextPage: false,
                },
                nodes: [prs[3]],
              },
            },
            commitffffffffffffffffffffffffffffffffffffffffff: {
              oid: "ffffffffffffffffffffffffffffffffffffffffff",
              associatedPullRequests: {
                pageInfo: {
                  endCursor: "NI",
                  hasNextPage: false,
                },
                nodes: [prs[4]],
              },
            },
            commitgggggggggggggggggggggggggggggggggggggggggg: {
              oid: "gggggggggggggggggggggggggggggggggggggggggg",
              associatedPullRequests: {
                pageInfo: {
                  endCursor: "NI",
                  hasNextPage: false,
                },
                nodes: [prs[5]],
              },
            },
          },
        },
      },
    )
    .getOnce(
      `https://api.github.local/repos/${owner}/${repo}/pulls/1/commits`,
      [{ sha: commits[0].hash }],
    )
    .getOnce(
      `https://api.github.local/repos/${owner}/${repo}/pulls/2/commits`,
      [{ sha: commits[1].hash }],
    )
    .getOnce(
      `https://api.github.local/repos/${owner}/${repo}/pulls/3/commits`,
      [{ sha: commits[2].hash }],
    )
    .getOnce(
      `https://api.github.local/repos/${owner}/${repo}/pulls/4/commits`,
      [{ sha: commits[3].hash }],
    )
    .getOnce(
      `https://api.github.local/repos/${owner}/${repo}/pulls/5/commits`,
      [{ sha: commits[4].hash }],
    )
    .getOnce(
      `https://api.github.local/repos/${owner}/${repo}/pulls/6/commits`,
      [{ sha: commits[5].hash }],
    )
    .postOnce(
      `https://api.github.local/repos/${owner}/${repo}/issues/1/comments`,
      { html_url: "https://github.com/successcomment-1" },
    )
    .postOnce(
      `https://api.github.local/repos/${owner}/${repo}/issues/1/labels`,
      {},
      {
        body: ["released"],
      },
    )
    .postOnce(
      `https://api.github.local/repos/${owner}/${repo}/issues/2/comments`,
      { html_url: "https://github.com/successcomment-2" },
    )
    .postOnce(
      `https://api.github.local/repos/${owner}/${repo}/issues/2/labels`,
      {},
      {
        body: ["released"],
      },
    )
    .postOnce(
      `https://api.github.local/repos/${owner}/${repo}/issues/3/comments`,
      { html_url: "https://github.com/successcomment-3" },
    )
    .postOnce(
      `https://api.github.local/repos/${owner}/${repo}/issues/3/labels`,
      {},
      {
        body: ["released"],
      },
    )
    .postOnce(
      `https://api.github.local/repos/${owner}/${repo}/issues/4/comments`,
      { html_url: "https://github.com/successcomment-4" },
    )
    .postOnce(
      `https://api.github.local/repos/${owner}/${repo}/issues/4/labels`,
      {},
      {
        body: ["released"],
      },
    )
    .postOnce(
      `https://api.github.local/repos/${owner}/${repo}/issues/5/comments`,
      { html_url: "https://github.com/successcomment-5" },
    )
    .postOnce(
      `https://api.github.local/repos/${owner}/${repo}/issues/5/labels`,
      {},
      {
        body: ["released"],
      },
    )
    .postOnce(
      `https://api.github.local/repos/${owner}/${repo}/issues/6/comments`,
      { html_url: "https://github.com/successcomment-6" },
    )
    .postOnce(
      `https://api.github.local/repos/${owner}/${repo}/issues/6/labels`,
      {},
      {
        body: ["released"],
      },
    )
    .postOnce(
      (url, { body }) => {
        t.is(url, "https://api.github.local/graphql");
        t.regex(JSON.parse(body).query, /query getSRIssues\(/);
        return true;
      },
      {
        data: {
          repository: {
            issues: { nodes: [] },
          },
        },
      },
    )
    .getOnce(
      `https://api.github.local/search/issues?q=${encodeURIComponent(
        "in:title",
      )}+${encodeURIComponent(`repo:${owner}/${repo}`)}+${encodeURIComponent(
        "type:issue",
      )}+${encodeURIComponent("state:open")}+${encodeURIComponent(failTitle)}`,
      { items: [] },
    );

  await success(
    pluginConfig,
    {
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
        request: { ...options.request, fetch },
      })),
    },
  );

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
  t.true(
    t.context.log.calledWith(
      "Added comment to PR #%d: %s",
      2,
      "https://github.com/successcomment-2",
    ),
  );
  t.true(
    t.context.log.calledWith("Added labels %O to PR #%d", ["released"], 2),
  );
  t.true(
    t.context.log.calledWith(
      "Added comment to PR #%d: %s",
      3,
      "https://github.com/successcomment-3",
    ),
  );
  t.true(
    t.context.log.calledWith("Added labels %O to PR #%d", ["released"], 3),
  );
  t.true(
    t.context.log.calledWith(
      "Added comment to PR #%d: %s",
      4,
      "https://github.com/successcomment-4",
    ),
  );
  t.true(
    t.context.log.calledWith("Added labels %O to PR #%d", ["released"], 4),
  );
  t.true(
    t.context.log.calledWith(
      "Added comment to PR #%d: %s",
      5,
      "https://github.com/successcomment-5",
    ),
  );
  t.true(
    t.context.log.calledWith("Added labels %O to PR #%d", ["released"], 5),
  );
  t.true(
    t.context.log.calledWith(
      "Added comment to PR #%d: %s",
      6,
      "https://github.com/successcomment-6",
    ),
  );
  t.true(
    t.context.log.calledWith("Added labels %O to PR #%d", ["released"], 6),
  );
  t.true(fetch.done());
});

test("Do not add comment and labels for unrelated PR returned by search (compare sha and merge_commit_sha)", async (t) => {
  const owner = "test_user";
  const repo = "test_repo";
  const env = { GITHUB_TOKEN: "github_token" };
  const failTitle = "The automated release is failing 🚨";
  const pluginConfig = { failTitle };
  const prs = [
    { number: 1, __typename: "PullRequest", state: "closed" },
    { number: 2, __typename: "PullRequest", state: "closed" },
  ];
  const options = {
    branch: "master",
    repositoryUrl: `https://github.com/${owner}/${repo}.git`,
  };
  const commits = [
    { hash: "123", message: "Commit 1 message" },
    { hash: "456", message: "Commit 2 message" },
  ];
  const nextRelease = { version: "1.0.0" };
  const releases = [
    { name: "GitHub release", url: "https://github.com/release" },
  ];

  const fetch = fetchMock
    .sandbox()
    .getOnce(`https://api.github.local/repos/${owner}/${repo}`, {
      full_name: `${owner}/${repo}`,
      clone_url: `https://api.github.local/${owner}/${repo}.git`,
    })
    .postOnce(
      (url, { body }) => {
        t.is(url, "https://api.github.local/graphql");
        t.regex(JSON.parse(body).query, /query getAssociatedPRs\(/);
        return true;
      },
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
            commit456: {
              oid: "456",
              associatedPullRequests: {
                pageInfo: {
                  endCursor: "NI",
                  hasNextPage: false,
                },
                nodes: [prs[1]],
              },
            },
          },
        },
      },
    )
    .getOnce(
      `https://api.github.local/repos/${owner}/${repo}/pulls/1/commits`,
      [{ sha: "rebased_sha" }],
    )
    .getOnce(`https://api.github.local/repos/${owner}/${repo}/pulls/1`, {
      merge_commit_sha: commits[0].hash,
    })
    .getOnce(
      `https://api.github.local/repos/${owner}/${repo}/pulls/2/commits`,
      [{ sha: "rebased_sha" }],
    )
    .getOnce(`https://api.github.local/repos/${owner}/${repo}/pulls/2`, {
      merge_commit_sha: "unrelated_sha",
    })
    .postOnce(
      `https://api.github.local/repos/${owner}/${repo}/issues/1/comments`,
      {
        html_url: "https://github.com/successcomment-1",
      },
    )
    .postOnce(
      `https://api.github.local/repos/${owner}/${repo}/issues/1/labels`,
      {},
      { body: ["released"] },
    )
    .postOnce(
      (url, { body }) => {
        t.is(url, "https://api.github.local/graphql");
        t.regex(JSON.parse(body).query, /query getSRIssues\(/);
        return true;
      },
      {
        data: {
          repository: {
            issues: { nodes: [] },
          },
        },
      },
    )
    .getOnce(
      `https://api.github.local/search/issues?q=${encodeURIComponent(
        "in:title",
      )}+${encodeURIComponent(`repo:${owner}/${repo}`)}+${encodeURIComponent(
        "type:issue",
      )}+${encodeURIComponent("state:open")}+${encodeURIComponent(failTitle)}`,
      { items: [] },
    );

  await success(
    pluginConfig,
    {
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
        request: { ...options.request, fetch },
      })),
    },
  );

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
  t.true(fetch.done());
});

test("Do not add comment and labels if no PR is associated with release commits", async (t) => {
  const owner = "test_user";
  const repo = "test_repo";
  const env = { GITHUB_TOKEN: "github_token" };
  const failTitle = "The automated release is failing 🚨";
  const pluginConfig = { failTitle };
  const options = {
    branch: "master",
    repositoryUrl: `https://github.com/${owner}/${repo}.git`,
  };
  const commits = [{ hash: "123", message: "Commit 1 message" }];
  const nextRelease = { version: "1.0.0" };
  const releases = [
    { name: "GitHub release", url: "https://github.com/release" },
  ];

  const fetch = fetchMock
    .sandbox()
    .getOnce(`https://api.github.local/repos/${owner}/${repo}`, {
      full_name: `${owner}/${repo}`,
      clone_url: `https://api.github.local/${owner}/${repo}.git`,
    })
    .postOnce(
      (url, { body }) => {
        t.is(url, "https://api.github.local/graphql");
        t.regex(JSON.parse(body).query, /query getAssociatedPRs\(/);
        return true;
      },
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
                nodes: [],
              },
            },
          },
        },
      },
    )
    .postOnce(
      (url, { body }) => {
        t.is(url, "https://api.github.local/graphql");
        t.regex(JSON.parse(body).query, /query getSRIssues\(/);
        return true;
      },
      {
        data: {
          repository: {
            issues: { nodes: [] },
          },
        },
      },
    )
    .getOnce(
      `https://api.github.local/search/issues?q=${encodeURIComponent(
        "in:title",
      )}+${encodeURIComponent(`repo:${owner}/${repo}`)}+${encodeURIComponent(
        "type:issue",
      )}+${encodeURIComponent("state:open")}+${encodeURIComponent(failTitle)}`,
      { items: [] },
    );

  await success(
    pluginConfig,
    {
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
        request: { ...options.request, fetch },
      })),
    },
  );

  t.true(fetch.done());
});

test("Do not add comment and labels if no commits is found for release", async (t) => {
  const owner = "test_user";
  const repo = "test_repo";
  const env = { GITHUB_TOKEN: "github_token" };
  const failTitle = "The automated release is failing 🚨";
  const pluginConfig = { failTitle };
  const options = {
    branch: "master",
    repositoryUrl: `https://github.com/${owner}/${repo}.git`,
  };
  const commits = [];
  const nextRelease = { version: "1.1.0" };
  const releases = [
    { name: "GitHub release", url: "https://github.com/release" },
  ];

  const fetch = fetchMock
    .sandbox()
    .getOnce(`https://api.github.local/repos/${owner}/${repo}`, {
      full_name: `${owner}/${repo}`,
      clone_url: `https://api.github.local/${owner}/${repo}.git`,
    })
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
      )}+${encodeURIComponent("state:open")}+${encodeURIComponent(failTitle)}`,
      { items: [] },
    );

  await success(
    pluginConfig,
    {
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
        request: { ...options.request, fetch },
      })),
    },
  );

  t.true(fetch.done());
  t.true(t.context.log.calledWith("No commits found in release"));
  t.true(
    t.context.log.calledWith("Skip commenting on issues and pull requests."),
  );
});

test("Do not add comment and labels to PR/issues from other repo", async (t) => {
  const owner = "test_user";
  const repo = "test_repo";
  const env = { GITHUB_TOKEN: "github_token" };
  const failTitle = "The automated release is failing 🚨";
  const pluginConfig = { failTitle };
  const options = {
    branch: "master",
    repositoryUrl: `https://github.com/${owner}/${repo}.git`,
  };
  const commits = [
    { hash: "123", message: "Commit 1 message\n\n Fix other/other#1" },
    { hash: "456", message: `Commit 2 message Fix ${owner}/${repo}#2` },
    { hash: "789", message: "Commit 3 message Closes other/other#3" },
  ];
  const nextRelease = { version: "1.0.0" };
  const releases = [
    { name: "GitHub release", url: "https://github.com/release" },
  ];

  const fetch = fetchMock
    .sandbox()
    .getOnce(`https://api.github.local/repos/${owner}/${repo}`, {
      full_name: `${owner}/${repo}`,
      clone_url: `https://api.github.local/${owner}/${repo}.git`,
    })
    .postOnce("https://api.github.local/graphql", {
      data: {
        repository: {
          commit123: {
            oid: "123",
            associatedPullRequests: {
              pageInfo: {
                endCursor: "NI",
                hasNextPage: false,
              },
              nodes: [],
            },
          },
          commit456: {
            oid: "456",
            associatedPullRequests: {
              pageInfo: {
                endCursor: "NI",
                hasNextPage: false,
              },
              nodes: [],
            },
          },
          commit789: {
            oid: "789",
            associatedPullRequests: {
              pageInfo: {
                endCursor: "NI",
                hasNextPage: false,
              },
              nodes: [],
            },
          },
        },
      },
    })
    .postOnce(
      (url, { body }) => {
        t.is(url, "https://api.github.local/graphql");
        t.regex(JSON.parse(body).query, /query getRelatedIssues\(/);
        return true;
      },
      {
        data: {
          repository: {
            issue2: {
              id: "I_kw",
              title: "issue title",
              body: "",
              url: "https://github.com/owner/repo/issues/14",
              number: 2,
              createdAt: "2024-07-13T09:58:09Z",
              updatedAt: "2024-08-26T16:19:59Z",
              closedAt: "2024-07-13T09:58:51Z",
              comments: {
                totalCount: 12,
              },
              state: "CLOSED",
              author: {
                login: "user",
                url: "author_url",
                avatarUrl: "author_avatar_url",
                __typename: "User",
              },
              authorAssociation: "OWNER",
              activeLockReason: null,
              labels: {
                nodes: [
                  {
                    id: "label_id",
                    url: "label_url",
                    name: "label_name",
                    color: "ededed",
                    description: "this is a label description",
                    isDefault: false,
                  },
                ],
              },
              milestone: null,
              locked: false,
            },
          },
        },
      },
    )
    .postOnce(
      `https://api.github.local/repos/${owner}/${repo}/issues/2/comments`,
      { html_url: "https://github.com/successcomment-2" },
    )
    .postOnce(
      `https://api.github.local/repos/${owner}/${repo}/issues/2/labels`,
      {},
      { body: ["released"] },
    )
    .postOnce(
      (url, { body }) => {
        t.is(url, "https://api.github.local/graphql");
        t.regex(JSON.parse(body).query, /query getSRIssues\(/);
        return true;
      },
      {
        data: {
          repository: {
            issues: { nodes: [] },
          },
        },
      },
    )
    .getOnce(
      `https://api.github.local/search/issues?q=${encodeURIComponent(
        "in:title",
      )}+${encodeURIComponent(`repo:${owner}/${repo}`)}+${encodeURIComponent(
        "type:issue",
      )}+${encodeURIComponent("state:open")}+${encodeURIComponent(failTitle)}`,
      { items: [] },
    );

  await success(
    pluginConfig,
    {
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
        request: { ...options.request, fetch },
      })),
    },
  );

  t.true(
    t.context.log.calledWith(
      "Added comment to issue #%d: %s",
      2,
      "https://github.com/successcomment-2",
    ),
  );
  t.true(
    t.context.log.calledWith("Added labels %O to issue #%d", ["released"], 2),
  );
  t.true(fetch.done());
});

test("Ignore missing and forbidden issues/PRs", async (t) => {
  const owner = "test_user";
  const repo = "test_repo";
  const env = { GITHUB_TOKEN: "github_token" };
  const failTitle = "The automated release is failing 🚨";
  const pluginConfig = { failTitle };
  const prs = [
    { number: 1, __typename: "PullRequest", state: "closed" },
    { number: 2, __typename: "PullRequest", body: "Fixes #4", state: "closed" },
    { number: 3, __typename: "PullRequest", body: "Fixes #5", state: "closed" },
  ];
  const options = {
    branch: "master",
    repositoryUrl: `https://github.com/${owner}/${repo}.git`,
  };
  const commits = [
    { hash: "123", message: "Commit 1 message\n\n Fix #1" },
    { hash: "456", message: "Commit 2 message" },
    { hash: "789", message: "Commit 3 message" },
  ];
  const nextRelease = { version: "1.0.0" };
  const releases = [
    { name: "GitHub release", url: "https://github.com/release" },
  ];

  const fetch = fetchMock
    .sandbox()
    .getOnce(`https://api.github.local/repos/${owner}/${repo}`, {
      full_name: `${owner}/${repo}`,
      clone_url: `https://api.github.local/${owner}/${repo}.git`,
    })
    .postOnce(
      (url, { body }) =>
        url === "https://api.github.local/graphql" &&
        JSON.parse(body).query.includes("query getAssociatedPRs("),
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
            commit456: {
              oid: "456",
              associatedPullRequests: {
                pageInfo: {
                  endCursor: "NI",
                  hasNextPage: false,
                },
                nodes: [prs[1]],
              },
            },
            commit789: {
              oid: "789",
              associatedPullRequests: {
                pageInfo: {
                  endCursor: "NI",
                  hasNextPage: false,
                },
                nodes: [prs[2]],
              },
            },
          },
        },
      },
    )
    .postOnce(
      (url, { body }) =>
        url === "https://api.github.local/graphql" &&
        JSON.parse(body).query.includes("query getRelatedIssues("),
      {
        data: {
          repository: {
            issue4: {
              __typename: "Issue",
              id: "I_kw",
              title: "issue title",
              body: "",
              url: "https://github.com/owner/repo/issues/4",
              number: 4,
              createdAt: "2024-07-13T09:58:09Z",
              updatedAt: "2024-08-26T16:19:59Z",
              closedAt: "2024-07-13T09:58:51Z",
              comments: {
                totalCount: 12,
              },
              state: "CLOSED",
              author: {
                login: "user",
                url: "author_url",
                avatarUrl: "author_avatar_url",
                __typename: "User",
              },
              authorAssociation: "OWNER",
              activeLockReason: null,
              labels: {
                nodes: [
                  {
                    id: "label_id",
                    url: "label_url",
                    name: "label_name",
                    color: "ededed",
                    description: "this is a label description",
                    isDefault: false,
                  },
                ],
              },
              milestone: null,
              locked: false,
            },
            issue5: {
              __typename: "Issue",
              id: "I_kw",
              title: "issue title",
              body: "",
              url: "https://github.com/owner/repo/issues/5",
              number: 5,
              createdAt: "2024-07-13T09:58:09Z",
              updatedAt: "2024-08-26T16:19:59Z",
              closedAt: "2024-07-13T09:58:51Z",
              comments: {
                totalCount: 12,
              },
              state: "CLOSED",
              author: {
                login: "user",
                url: "author_url",
                avatarUrl: "author_avatar_url",
                __typename: "User",
              },
              authorAssociation: "OWNER",
              activeLockReason: null,
              labels: {
                nodes: [
                  {
                    id: "label_id",
                    url: "label_url",
                    name: "label_name",
                    color: "ededed",
                    description: "this is a label description",
                    isDefault: false,
                  },
                ],
              },
              milestone: null,
              locked: false,
            },
            issue1: {
              __typename: "Issue",
              id: "I_kw",
              title: "issue title",
              body: "",
              url: "https://github.com/owner/repo/issues/1",
              number: 1,
              createdAt: "2024-07-13T09:58:09Z",
              updatedAt: "2024-08-26T16:19:59Z",
              closedAt: "2024-07-13T09:58:51Z",
              comments: {
                totalCount: 12,
              },
              state: "CLOSED",
              author: {
                login: "user",
                url: "author_url",
                avatarUrl: "author_avatar_url",
                __typename: "User",
              },
              authorAssociation: "OWNER",
              activeLockReason: null,
              labels: {
                nodes: [
                  {
                    id: "label_id",
                    url: "label_url",
                    name: "label_name",
                    color: "ededed",
                    description: "this is a label description",
                    isDefault: false,
                  },
                ],
              },
              milestone: null,
              locked: false,
            },
          },
        },
      },
    )
    .getOnce(
      `https://api.github.local/repos/${owner}/${repo}/pulls/1/commits`,
      [{ sha: commits[0].hash }],
    )
    .getOnce(
      `https://api.github.local/repos/${owner}/${repo}/pulls/2/commits`,
      [{ sha: commits[1].hash }],
    )
    .getOnce(
      `https://api.github.local/repos/${owner}/${repo}/pulls/3/commits`,
      [{ sha: commits[2].hash }],
    )
    .postOnce(
      `https://api.github.local/repos/${owner}/${repo}/issues/1/comments`,
      { html_url: "https://github.com/successcomment-1" },
    )
    .postOnce(
      `https://api.github.local/repos/${owner}/${repo}/issues/1/labels`,
      {},
      { body: ["released"] },
    )
    .postOnce(
      `https://api.github.local/repos/${owner}/${repo}/issues/2/comments`,
      404,
    )
    .postOnce(
      `https://api.github.local/repos/${owner}/${repo}/issues/3/comments`,
      403,
    )
    .postOnce(
      `https://api.github.local/repos/${owner}/${repo}/issues/4/comments`,
      { html_url: "https://github.com/successcomment-4" },
    )
    .postOnce(
      `https://api.github.local/repos/${owner}/${repo}/issues/4/labels`,
      {},
      { body: ["released"] },
    )
    .postOnce(
      `https://api.github.local/repos/${owner}/${repo}/issues/5/comments`,
      { html_url: "https://github.com/successcomment-5" },
    )
    .postOnce(
      `https://api.github.local/repos/${owner}/${repo}/issues/5/labels`,
      {},
      { body: ["released"] },
    )
    .postOnce(
      (url, { body }) => {
        t.is(url, "https://api.github.local/graphql");
        t.regex(JSON.parse(body).query, /query getSRIssues\(/);
        return true;
      },
      {
        data: {
          repository: {
            issues: { nodes: [] },
          },
        },
      },
    )
    .getOnce(
      `https://api.github.local/search/issues?q=${encodeURIComponent(
        "in:title",
      )}+${encodeURIComponent(`repo:${owner}/${repo}`)}+${encodeURIComponent(
        "type:issue",
      )}+${encodeURIComponent("state:open")}+${encodeURIComponent(failTitle)}`,
      { items: [] },
    );

  await success(
    pluginConfig,
    {
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
        request: { ...options.request, fetch },
      })),
    },
  );

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
  t.true(
    t.context.log.calledWith(
      "Added comment to issue #%d: %s",
      4,
      "https://github.com/successcomment-4",
    ),
  );
  t.true(
    t.context.log.calledWith("Added labels %O to issue #%d", ["released"], 4),
  );
  t.true(
    t.context.log.calledWith(
      "Added comment to issue #%d: %s",
      5,
      "https://github.com/successcomment-5",
    ),
  );
  t.true(
    t.context.log.calledWith("Added labels %O to issue #%d", ["released"], 5),
  );
  t.true(
    t.context.error.calledWith(
      "Failed to add a comment to the issue/PR #%d as it doesn't exist.",
      2,
    ),
  );
  t.true(
    t.context.error.calledWith(
      "Not allowed to add a comment to the issue/PR #%d.",
      3,
    ),
  );
  t.true(fetch.done());
});

test("Add custom comment and labels", async (t) => {
  const owner = "test_user";
  const repo = "test_repo";
  const env = { GITHUB_TOKEN: "github_token" };
  const failTitle = "The automated release is failing 🚨";
  const pluginConfig = {
    successComment: `last release: \${lastRelease.version} nextRelease: \${nextRelease.version} branch: \${branch.name} commits: \${commits.length} releases: \${releases.length} PR attribute: \${issue.prop}`,
    failTitle,
    releasedLabels: [
      "released on @<%= nextRelease.channel %>",
      "released from <%= branch.name %>",
    ],
  };
  const prs = [
    { number: 1, prop: "PR prop", __typename: "PullRequest", state: "closed" },
  ];
  const options = { repositoryUrl: `https://github.com/${owner}/${repo}.git` };
  const lastRelease = { version: "1.0.0" };
  const commits = [{ hash: "123", message: "Commit 1 message" }];
  const nextRelease = { version: "2.0.0", channel: "next" };
  const releases = [
    { name: "GitHub release", url: "https://github.com/release" },
  ];

  const fetch = fetchMock
    .sandbox()
    .getOnce(`https://api.github.local/repos/${owner}/${repo}`, {
      full_name: `${owner}/${repo}`,
      clone_url: `https://api.github.local/${owner}/${repo}.git`,
    })
    .postOnce(
      (url, { body }) => {
        t.is(url, "https://api.github.local/graphql");
        t.regex(JSON.parse(body).query, /query getAssociatedPRs\(/);
        return true;
      },
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
    .getOnce(
      `https://api.github.local/repos/${owner}/${repo}/pulls/1/commits`,
      [{ sha: commits[0].hash }],
    )
    .postOnce(
      `https://api.github.local/repos/${owner}/${repo}/issues/1/comments`,
      {
        html_url: "https://github.com/successcomment-1",
        body: `last release: ${lastRelease.version} nextRelease: ${nextRelease.version} branch: master commits: 1 releases: 1 PR attribute: PR prop`,
      },
    )
    .postOnce(
      `https://api.github.local/repos/${owner}/${repo}/issues/1/labels`,
      {},
      { body: ["released on @next", "released from master"] },
    )
    .postOnce(
      (url, { body }) => {
        t.is(url, "https://api.github.local/graphql");
        t.regex(JSON.parse(body).query, /query getSRIssues\(/);
        return true;
      },
      {
        data: {
          repository: {
            issues: { nodes: [] },
          },
        },
      },
    )
    .getOnce(
      `https://api.github.local/search/issues?q=${encodeURIComponent(
        "in:title",
      )}+${encodeURIComponent(`repo:${owner}/${repo}`)}+${encodeURIComponent(
        "type:issue",
      )}+${encodeURIComponent("state:open")}+${encodeURIComponent(failTitle)}`,
      { items: [] },
    );

  await success(
    pluginConfig,
    {
      env,
      branch: { name: "master" },
      options,
      lastRelease,
      commits,
      nextRelease,
      releases,
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
      "Added comment to PR #%d: %s",
      1,
      "https://github.com/successcomment-1",
    ),
  );
  t.true(
    t.context.log.calledWith(
      "Added labels %O to PR #%d",
      ["released on @next", "released from master"],
      1,
    ),
  );
  t.true(fetch.done());
});

test("Add custom label", async (t) => {
  const owner = "test_user";
  const repo = "test_repo";
  const env = { GITHUB_TOKEN: "github_token" };
  const failTitle = "The automated release is failing 🚨";
  const pluginConfig = { releasedLabels: ["custom label"], failTitle };
  const prs = [{ number: 1, __typename: "PullRequest", state: "closed" }];
  const options = { repositoryUrl: `https://github.com/${owner}/${repo}.git` };
  const lastRelease = { version: "1.0.0" };
  const commits = [{ hash: "123", message: "Commit 1 message" }];
  const nextRelease = { version: "2.0.0" };
  const releases = [
    { name: "GitHub release", url: "https://github.com/release" },
  ];

  const fetch = fetchMock
    .sandbox()
    .getOnce(`https://api.github.local/repos/${owner}/${repo}`, {
      full_name: `${owner}/${repo}`,
      clone_url: `https://api.github.local/${owner}/${repo}.git`,
    })
    .postOnce(
      (url, { body }) => {
        t.is(url, "https://api.github.local/graphql");
        t.regex(JSON.parse(body).query, /query getAssociatedPRs\(/);
        return true;
      },
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
    .getOnce(
      `https://api.github.local/repos/${owner}/${repo}/pulls/1/commits`,
      [{ sha: commits[0].hash }],
    )
    .postOnce(
      `https://api.github.local/repos/${owner}/${repo}/issues/1/comments`,
      { html_url: "https://github.com/successcomment-1" },
    )
    .postOnce(
      `https://api.github.local/repos/${owner}/${repo}/issues/1/labels`,
      {},
      { body: ["custom label"] },
    )
    .postOnce(
      (url, { body }) => {
        t.is(url, "https://api.github.local/graphql");
        t.regex(JSON.parse(body).query, /query getSRIssues\(/);
        return true;
      },
      {
        data: {
          repository: {
            issues: { nodes: [] },
          },
        },
      },
    )
    .getOnce(
      `https://api.github.local/search/issues?q=${encodeURIComponent(
        "in:title",
      )}+${encodeURIComponent(`repo:${owner}/${repo}`)}+${encodeURIComponent(
        "type:issue",
      )}+${encodeURIComponent("state:open")}+${encodeURIComponent(failTitle)}`,
      { items: [] },
    );

  await success(
    pluginConfig,
    {
      env,
      options,
      branch: { name: "master" },
      lastRelease,
      commits,
      nextRelease,
      releases,
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
      "Added comment to PR #%d: %s",
      1,
      "https://github.com/successcomment-1",
    ),
  );
  t.true(
    t.context.log.calledWith("Added labels %O to PR #%d", ["custom label"], 1),
  );
  t.true(fetch.done());
});

test("Comment on issue/PR without ading a label", async (t) => {
  const owner = "test_user";
  const repo = "test_repo";
  const env = { GITHUB_TOKEN: "github_token" };
  const failTitle = "The automated release is failing 🚨";
  const pluginConfig = { releasedLabels: false, failTitle };
  const prs = [{ number: 1, __typename: "PullRequest", state: "closed" }];
  const options = { repositoryUrl: `https://github.com/${owner}/${repo}.git` };
  const lastRelease = { version: "1.0.0" };
  const commits = [{ hash: "123", message: "Commit 1 message" }];
  const nextRelease = { version: "2.0.0" };
  const releases = [
    { name: "GitHub release", url: "https://github.com/release" },
  ];

  const fetch = fetchMock
    .sandbox()
    .getOnce(`https://api.github.local/repos/${owner}/${repo}`, {
      full_name: `${owner}/${repo}`,
      clone_url: `https://api.github.local/${owner}/${repo}.git`,
    })
    .postOnce(
      (url, { body }) => {
        t.is(url, "https://api.github.local/graphql");
        t.regex(JSON.parse(body).query, /query getAssociatedPRs\(/);
        return true;
      },
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
    .getOnce(
      `https://api.github.local/repos/${owner}/${repo}/pulls/1/commits`,
      [{ sha: commits[0].hash }],
    )
    .postOnce(
      `https://api.github.local/repos/${owner}/${repo}/issues/1/comments`,
      { html_url: "https://github.com/successcomment-1" },
    )
    .postOnce(
      (url, { body }) => {
        t.is(url, "https://api.github.local/graphql");
        t.regex(JSON.parse(body).query, /query getSRIssues\(/);
        return true;
      },
      {
        data: {
          repository: {
            issues: { nodes: [] },
          },
        },
      },
    )
    .getOnce(
      `https://api.github.local/search/issues?q=${encodeURIComponent(
        "in:title",
      )}+${encodeURIComponent(`repo:${owner}/${repo}`)}+${encodeURIComponent(
        "type:issue",
      )}+${encodeURIComponent("state:open")}+${encodeURIComponent(failTitle)}`,
      { items: [] },
    );

  await success(
    pluginConfig,
    {
      env,
      options,
      branch: { name: "master" },
      lastRelease,
      commits,
      nextRelease,
      releases,
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
      "Added comment to PR #%d: %s",
      1,
      "https://github.com/successcomment-1",
    ),
  );
  t.true(fetch.done());
});

test("Editing the release to include all release links at the bottom", async (t) => {
  const owner = "test_user";
  const repo = "test_repo";
  const env = { GITHUB_TOKEN: "github_token" };
  const failTitle = "The automated release is failing 🚨";
  const pluginConfig = { releasedLabels: false, addReleases: "bottom" };
  const prs = [{ number: 1, __typename: "PullRequest", state: "closed" }];
  const options = {
    repositoryUrl: `https://github.com/${owner}/${repo}.git`,
  };
  const nextRelease = {
    version: "2.0.0",
    gitTag: "v1.0.0",
    name: "v1.0.0",
    notes: "Test release note body",
  };
  const lastRelease = { version: "1.0.0" };
  const commits = [{ hash: "123", message: "Commit 1 message" }];
  const releaseUrl = `https://github.com/${owner}/${repo}/releases/${nextRelease.version}`;
  const releaseId = 1;
  const releases = [
    {
      name: "GitHub release",
      url: "https://github.com/release",
      id: releaseId,
    },
    { name: "S3", url: "s3://my-bucket/release-asset" },
    { name: "Docker: docker.io/python:slim" },
  ];

  const fetch = fetchMock
    .sandbox()
    .getOnce(`https://api.github.local/repos/${owner}/${repo}`, {
      full_name: `${owner}/${repo}`,
      clone_url: `https://api.github.local/${owner}/${repo}.git`,
    })
    .postOnce(
      (url, { body }) => {
        t.is(url, "https://api.github.local/graphql");
        t.regex(JSON.parse(body).query, /query getAssociatedPRs\(/);
        return true;
      },
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
    .getOnce(
      `https://api.github.local/repos/${owner}/${repo}/pulls/1/commits`,
      [{ sha: commits[0].hash }],
    )
    .postOnce(
      `https://api.github.local/repos/${owner}/${repo}/issues/1/comments`,
      { html_url: "https://github.com/successcomment-1" },
    )
    .postOnce(
      (url, { body }) => {
        t.is(url, "https://api.github.local/graphql");
        t.regex(JSON.parse(body).query, /query getSRIssues\(/);
        return true;
      },
      {
        data: {
          repository: {
            issues: { nodes: [] },
          },
        },
      },
    )
    .getOnce(
      `https://api.github.local/search/issues?q=${encodeURIComponent(
        "in:title",
      )}+${encodeURIComponent(`repo:${owner}/${repo}`)}+${encodeURIComponent(
        "type:issue",
      )}+${encodeURIComponent("state:open")}+${encodeURIComponent(failTitle)}`,
      { items: [] },
    )
    .patchOnce(
      `https://api.github.local/repos/${owner}/${repo}/releases/${releaseId}`,
      {
        html_url: releaseUrl,
      },
      {
        body: {
          body: nextRelease.notes.concat("\n---\n", getReleaseLinks(releases)),
        },
      },
    );

  await success(
    pluginConfig,
    {
      env,
      options,
      branch: { name: "master" },
      lastRelease,
      commits,
      nextRelease,
      releases,
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
      "Added comment to PR #%d: %s",
      1,
      "https://github.com/successcomment-1",
    ),
  );
  t.true(fetch.done());
});

test("Editing the release to include all release links at the top", async (t) => {
  const owner = "test_user";
  const repo = "test_repo";
  const env = { GITHUB_TOKEN: "github_token" };
  const failTitle = "The automated release is failing 🚨";
  const pluginConfig = { releasedLabels: false, addReleases: "top" };
  const prs = [{ number: 1, __typename: "PullRequest", state: "closed" }];
  const options = {
    repositoryUrl: `https://github.com/${owner}/${repo}.git`,
  };
  const nextRelease = {
    version: "2.0.0",
    gitTag: "v1.0.0",
    name: "v1.0.0",
    notes: "Test release note body",
  };
  const lastRelease = { version: "1.0.0" };
  const commits = [{ hash: "123", message: "Commit 1 message" }];
  const releaseUrl = `https://github.com/${owner}/${repo}/releases/${nextRelease.version}`;
  const releaseId = 1;
  const releases = [
    {
      name: "GitHub release",
      url: "https://github.com/release",
      id: releaseId,
    },
    { name: "S3", url: "s3://my-bucket/release-asset" },
    { name: "Docker: docker.io/python:slim" },
  ];

  const fetch = fetchMock
    .sandbox()
    .getOnce(`https://api.github.local/repos/${owner}/${repo}`, {
      full_name: `${owner}/${repo}`,
      clone_url: `https://api.github.local/${owner}/${repo}.git`,
    })
    .postOnce(
      (url, { body }) => {
        t.is(url, "https://api.github.local/graphql");
        t.regex(JSON.parse(body).query, /query getAssociatedPRs\(/);
        return true;
      },
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
    .getOnce(
      `https://api.github.local/repos/${owner}/${repo}/pulls/1/commits`,
      [{ sha: commits[0].hash }],
    )
    .postOnce(
      `https://api.github.local/repos/${owner}/${repo}/issues/1/comments`,
      { html_url: "https://github.com/successcomment-1" },
    )
    .postOnce(
      (url, { body }) => {
        t.is(url, "https://api.github.local/graphql");
        t.regex(JSON.parse(body).query, /query getSRIssues\(/);
        return true;
      },
      {
        data: {
          repository: {
            issues: { nodes: [] },
          },
        },
      },
    )
    .getOnce(
      `https://api.github.local/search/issues?q=${encodeURIComponent(
        "in:title",
      )}+${encodeURIComponent(`repo:${owner}/${repo}`)}+${encodeURIComponent(
        "type:issue",
      )}+${encodeURIComponent("state:open")}+${encodeURIComponent(failTitle)}`,
      { items: [] },
    )
    .patchOnce(
      `https://api.github.local/repos/${owner}/${repo}/releases/${releaseId}`,
      {
        html_url: releaseUrl,
      },
      {
        body: {
          body: getReleaseLinks(releases) + "\n---\n" + nextRelease.notes,
        },
      },
    );

  await success(
    pluginConfig,
    {
      env,
      options,
      branch: { name: "master" },
      lastRelease,
      commits,
      nextRelease,
      releases,
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
      "Added comment to PR #%d: %s",
      1,
      "https://github.com/successcomment-1",
    ),
  );
  t.true(fetch.done());
});

test("Editing the release to include all release links with no additional releases (top)", async (t) => {
  const owner = "test_user";
  const repo = "test_repo";
  const env = { GITHUB_TOKEN: "github_token" };
  const failTitle = "The automated release is failing 🚨";
  const pluginConfig = { releasedLabels: false, addReleases: "top" };
  const prs = [{ number: 1, __typename: "PullRequest", state: "closed" }];
  const options = {
    repositoryUrl: `https://github.com/${owner}/${repo}.git`,
  };
  const nextRelease = {
    version: "2.0.0",
    gitTag: "v1.0.0",
    name: "v1.0.0",
    notes: "Test release note body",
  };
  const lastRelease = { version: "1.0.0" };
  const commits = [{ hash: "123", message: "Commit 1 message" }];
  const releaseId = 1;
  const releases = [
    {
      name: "GitHub release",
      url: "https://github.com/release",
      id: releaseId,
    },
  ];

  const fetch = fetchMock
    .sandbox()
    .getOnce(`https://api.github.local/repos/${owner}/${repo}`, {
      full_name: `${owner}/${repo}`,
      clone_url: `https://api.github.local/${owner}/${repo}.git`,
    })
    .postOnce(
      (url, { body }) => {
        t.is(url, "https://api.github.local/graphql");
        t.regex(JSON.parse(body).query, /query getAssociatedPRs\(/);
        return true;
      },
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
    .getOnce(
      `https://api.github.local/repos/${owner}/${repo}/pulls/1/commits`,
      [{ sha: commits[0].hash }],
    )
    .postOnce(
      `https://api.github.local/repos/${owner}/${repo}/issues/1/comments`,
      { html_url: "https://github.com/successcomment-1" },
    )
    .postOnce(
      (url, { body }) => {
        t.is(url, "https://api.github.local/graphql");
        t.regex(JSON.parse(body).query, /query getSRIssues\(/);
        return true;
      },
      {
        data: {
          repository: {
            issues: { nodes: [] },
          },
        },
      },
    )
    .getOnce(
      `https://api.github.local/search/issues?q=${encodeURIComponent(
        "in:title",
      )}+${encodeURIComponent(`repo:${owner}/${repo}`)}+${encodeURIComponent(
        "type:issue",
      )}+${encodeURIComponent("state:open")}+${encodeURIComponent(failTitle)}`,
      { items: [] },
    );

  await success(
    pluginConfig,
    {
      env,
      options,
      branch: { name: "master" },
      lastRelease,
      commits,
      nextRelease,
      releases,
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
      "Added comment to PR #%d: %s",
      1,
      "https://github.com/successcomment-1",
    ),
  );
  t.true(fetch.done());
});

test("Editing the release to include all release links with no additional releases (bottom)", async (t) => {
  const owner = "test_user";
  const repo = "test_repo";
  const env = { GITHUB_TOKEN: "github_token" };
  const failTitle = "The automated release is failing 🚨";
  const pluginConfig = { releasedLabels: false, addReleases: "bottom" };
  const prs = [{ number: 1, __typename: "PullRequest", state: "closed" }];
  const options = {
    repositoryUrl: `https://github.com/${owner}/${repo}.git`,
  };
  const nextRelease = {
    version: "2.0.0",
    gitTag: "v1.0.0",
    name: "v1.0.0",
    notes: "Test release note body",
  };
  const lastRelease = { version: "1.0.0" };
  const commits = [{ hash: "123", message: "Commit 1 message" }];
  const releaseId = 1;
  const releases = [
    {
      name: "GitHub release",
      url: "https://github.com/release",
      id: releaseId,
    },
  ];

  const fetch = fetchMock
    .sandbox()
    .getOnce(`https://api.github.local/repos/${owner}/${repo}`, {
      full_name: `${owner}/${repo}`,
      clone_url: `https://api.github.local/${owner}/${repo}.git`,
    })
    .postOnce(
      (url, { body }) => {
        t.is(url, "https://api.github.local/graphql");
        t.regex(JSON.parse(body).query, /query getAssociatedPRs\(/);
        return true;
      },
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
    .getOnce(
      `https://api.github.local/repos/${owner}/${repo}/pulls/1/commits`,
      [{ sha: commits[0].hash }],
    )
    .postOnce(
      `https://api.github.local/repos/${owner}/${repo}/issues/1/comments`,
      { html_url: "https://github.com/successcomment-1" },
    )
    .postOnce(
      (url, { body }) => {
        t.is(url, "https://api.github.local/graphql");
        t.regex(JSON.parse(body).query, /query getSRIssues\(/);
        return true;
      },
      {
        data: {
          repository: {
            issues: { nodes: [] },
          },
        },
      },
    )
    .getOnce(
      `https://api.github.local/search/issues?q=${encodeURIComponent(
        "in:title",
      )}+${encodeURIComponent(`repo:${owner}/${repo}`)}+${encodeURIComponent(
        "type:issue",
      )}+${encodeURIComponent("state:open")}+${encodeURIComponent(failTitle)}`,
      { items: [] },
    );

  await success(
    pluginConfig,
    {
      env,
      options,
      branch: { name: "master" },
      lastRelease,
      commits,
      nextRelease,
      releases,
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
      "Added comment to PR #%d: %s",
      1,
      "https://github.com/successcomment-1",
    ),
  );
  t.true(fetch.done());
});

test("Editing the release to include all release links with no releases", async (t) => {
  const owner = "test_user";
  const repo = "test_repo";
  const env = { GITHUB_TOKEN: "github_token" };
  const failTitle = "The automated release is failing 🚨";
  const pluginConfig = { releasedLabels: false, addReleases: "bottom" };
  const prs = [{ number: 1, __typename: "PullRequest", state: "closed" }];
  const options = {
    repositoryUrl: `https://github.com/${owner}/${repo}.git`,
  };
  const nextRelease = {
    version: "2.0.0",
    gitTag: "v1.0.0",
    name: "v1.0.0",
    notes: "Test release note body",
  };
  const lastRelease = { version: "1.0.0" };
  const commits = [{ hash: "123", message: "Commit 1 message" }];
  const releases = [];

  const fetch = fetchMock
    .sandbox()
    .getOnce(`https://api.github.local/repos/${owner}/${repo}`, {
      full_name: `${owner}/${repo}`,
      clone_url: `https://api.github.local/${owner}/${repo}.git`,
    })
    .postOnce(
      (url, { body }) => {
        t.is(url, "https://api.github.local/graphql");
        t.regex(JSON.parse(body).query, /query getAssociatedPRs\(/);
        return true;
      },
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
    .getOnce(
      `https://api.github.local/repos/${owner}/${repo}/pulls/1/commits`,
      [{ sha: commits[0].hash }],
    )
    .postOnce(
      `https://api.github.local/repos/${owner}/${repo}/issues/1/comments`,
      { html_url: "https://github.com/successcomment-1" },
    )
    .postOnce(
      (url, { body }) => {
        t.is(url, "https://api.github.local/graphql");
        t.regex(JSON.parse(body).query, /query getSRIssues\(/);
        return true;
      },
      {
        data: {
          repository: {
            issues: { nodes: [] },
          },
        },
      },
    )
    .getOnce(
      `https://api.github.local/search/issues?q=${encodeURIComponent(
        "in:title",
      )}+${encodeURIComponent(`repo:${owner}/${repo}`)}+${encodeURIComponent(
        "type:issue",
      )}+${encodeURIComponent("state:open")}+${encodeURIComponent(failTitle)}`,
      { items: [] },
    );

  await success(
    pluginConfig,
    {
      env,
      options,
      branch: { name: "master" },
      lastRelease,
      commits,
      nextRelease,
      releases,
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
      "Added comment to PR #%d: %s",
      1,
      "https://github.com/successcomment-1",
    ),
  );
  t.true(fetch.done());
});

test("Editing the release with no ID in the release", async (t) => {
  const owner = "test_user";
  const repo = "test_repo";
  const env = { GITHUB_TOKEN: "github_token" };
  const failTitle = "The automated release is failing 🚨";
  const pluginConfig = { releasedLabels: false, addReleases: "bottom" };
  const prs = [{ number: 1, __typename: "PullRequest", state: "closed" }];
  const options = { repositoryUrl: `https://github.com/${owner}/${repo}.git` };
  const nextRelease = {
    version: "2.0.0",
    gitTag: "v1.0.0",
    name: "v1.0.0",
    notes: "Test release note body",
  };
  const lastRelease = { version: "1.0.0" };
  const commits = [{ hash: "123", message: "Commit 1 message" }];
  const releases = [
    { name: "GitHub release", url: "https://github.com/release" },
    { name: "S3", url: "s3://my-bucket/release-asset" },
    { name: "Docker: docker.io/python:slim" },
  ];

  const fetch = fetchMock
    .sandbox()
    .getOnce(`https://api.github.local/repos/${owner}/${repo}`, {
      full_name: `${owner}/${repo}`,
      clone_url: `https://api.github.local/${owner}/${repo}.git`,
    })
    .postOnce(
      (url, { body }) => {
        t.is(url, "https://api.github.local/graphql");
        t.regex(JSON.parse(body).query, /query getAssociatedPRs\(/);
        return true;
      },
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
    .getOnce(
      `https://api.github.local/repos/${owner}/${repo}/pulls/1/commits`,
      [{ sha: commits[0].hash }],
    )
    .postOnce(
      `https://api.github.local/repos/${owner}/${repo}/issues/1/comments`,
      { html_url: "https://github.com/successcomment-1" },
    )
    .postOnce(
      (url, { body }) => {
        t.is(url, "https://api.github.local/graphql");
        t.regex(JSON.parse(body).query, /query getSRIssues\(/);
        return true;
      },
      {
        data: {
          repository: {
            issues: { nodes: [] },
          },
        },
      },
    )
    .getOnce(
      `https://api.github.local/search/issues?q=${encodeURIComponent(
        "in:title",
      )}+${encodeURIComponent(`repo:${owner}/${repo}`)}+${encodeURIComponent(
        "type:issue",
      )}+${encodeURIComponent("state:open")}+${encodeURIComponent(failTitle)}`,
      { items: [] },
    );

  await success(
    pluginConfig,
    {
      env,
      options,
      branch: { name: "master" },
      lastRelease,
      commits,
      nextRelease,
      releases,
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
      "Added comment to PR #%d: %s",
      1,
      "https://github.com/successcomment-1",
    ),
  );
  t.true(fetch.done());
});

test("Ignore errors when adding comments and closing issues", async (t) => {
  const owner = "test_user";
  const repo = "test_repo";
  const env = { GITHUB_TOKEN: "github_token" };
  const failTitle = "The automated release is failing 🚨";
  const pluginConfig = { failTitle };
  const issues = [
    { number: 1, body: "Issue 1 body", title: failTitle },
    { number: 2, body: `Issue 2 body\n\n${ISSUE_ID}`, title: failTitle },
    { number: 3, body: `Issue 3 body\n\n${ISSUE_ID}`, title: failTitle },
  ];
  const prs = [
    { number: 1, __typename: "PullRequest", state: "closed" },
    { number: 2, __typename: "PullRequest", state: "closed" },
  ];
  const options = {
    repositoryUrl: `https://github.com/${owner}/${repo}.git`,
  };
  const commits = [
    { hash: "123", message: "Commit 1 message" },
    { hash: "456", message: "Commit 2 message" },
  ];
  const nextRelease = { version: "1.0.0" };
  const releases = [
    { name: "GitHub release", url: "https://github.com/release" },
  ];

  const fetch = fetchMock
    .sandbox()
    .getOnce(`https://api.github.local/repos/${owner}/${repo}`, {
      full_name: `${owner}/${repo}`,
      clone_url: `https://api.github.local/${owner}/${repo}.git`,
    })
    .postOnce(
      (url, { body }) => {
        t.is(url, "https://api.github.local/graphql");
        t.regex(JSON.parse(body).query, /query getAssociatedPRs\(/);
        return true;
      },
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
            commit456: {
              oid: "456",
              associatedPullRequests: {
                pageInfo: {
                  endCursor: "NI",
                  hasNextPage: false,
                },
                nodes: [prs[1]],
              },
            },
          },
        },
      },
    )
    .getOnce(
      `https://api.github.local/repos/${owner}/${repo}/pulls/1/commits`,
      [{ sha: commits[0].hash }],
    )
    .getOnce(
      `https://api.github.local/repos/${owner}/${repo}/pulls/2/commits`,
      [{ sha: commits[1].hash }],
    )
    .postOnce(
      `https://api.github.local/repos/${owner}/${repo}/issues/1/comments`,
      400,
    )
    .postOnce(
      `https://api.github.local/repos/${owner}/${repo}/issues/2/comments`,
      { html_url: "https://github.com/successcomment-2" },
    )
    .postOnce(
      `https://api.github.local/repos/${owner}/${repo}/issues/2/labels`,
      {},
      { body: ["released"] },
    )
    .postOnce(
      (url, { body }) => {
        t.is(url, "https://api.github.local/graphql");
        t.regex(JSON.parse(body).query, /query getSRIssues\(/);
        return true;
      },
      {
        data: {
          repository: {
            issues: { nodes: [] },
          },
        },
      },
    )
    .getOnce(
      `https://api.github.local/search/issues?q=${encodeURIComponent(
        "in:title",
      )}+${encodeURIComponent(`repo:${owner}/${repo}`)}+${encodeURIComponent(
        "type:issue",
      )}+${encodeURIComponent("state:open")}+${encodeURIComponent(failTitle)}`,
      { items: issues },
    )
    .patchOnce(
      `https://api.github.local/repos/${owner}/${repo}/issues/2`,
      500,
      {
        body: {
          state: "closed",
        },
      },
    )
    .patchOnce(
      `https://api.github.local/repos/${owner}/${repo}/issues/3`,
      { html_url: "https://github.com/issues/3" },
      {
        body: {
          state: "closed",
        },
      },
    );

  const {
    errors: [error1, error2],
  } = await t.throwsAsync(
    success(
      pluginConfig,
      {
        env,
        options,
        branch: { name: "master" },
        commits,
        nextRelease,
        releases,
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

  t.is(error1.status, 400);
  t.is(error2.status, 500);
  t.true(
    t.context.error.calledWith(
      "Failed to add a comment to the issue/PR #%d.",
      1,
    ),
  );
  t.true(t.context.error.calledWith("Failed to close the issue #%d.", 2));
  t.true(
    t.context.log.calledWith(
      "Added comment to PR #%d: %s",
      2,
      "https://github.com/successcomment-2",
    ),
  );
  t.true(
    t.context.log.calledWith(
      "Closed issue #%d: %s.",
      3,
      "https://github.com/issues/3",
    ),
  );
  t.true(fetch.done());
});

test("Close open issues when a release is successful", async (t) => {
  const owner = "test_user";
  const repo = "test_repo";
  const env = { GITHUB_TOKEN: "github_token" };
  const failTitle = "The automated release is failing 🚨";
  const pluginConfig = { failTitle };
  const issues = [
    { number: 1, body: "Issue 1 body", title: failTitle },
    { number: 2, body: `Issue 2 body\n\n${ISSUE_ID}`, title: failTitle },
    { number: 3, body: `Issue 3 body\n\n${ISSUE_ID}`, title: failTitle },
  ];
  const options = { repositoryUrl: `https://github.com/${owner}/${repo}.git` };
  const commits = [{ hash: "123", message: "Commit 1 message" }];
  const nextRelease = { version: "1.0.0" };
  const releases = [
    { name: "GitHub release", url: "https://github.com/release" },
  ];

  const fetch = fetchMock
    .sandbox()
    .getOnce(`https://api.github.local/repos/${owner}/${repo}`, {
      full_name: `${owner}/${repo}`,
      clone_url: `https://api.github.local/${owner}/${repo}.git`,
    })
    .postOnce(
      (url, { body }) => {
        t.is(url, "https://api.github.local/graphql");
        t.regex(JSON.parse(body).query, /query getAssociatedPRs\(/);
        return true;
      },
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
                nodes: [],
              },
            },
          },
        },
      },
    )
    .postOnce(
      (url, { body }) => {
        t.is(url, "https://api.github.local/graphql");
        t.regex(JSON.parse(body).query, /query getSRIssues\(/);
        return true;
      },
      {
        data: {
          repository: {
            issues: { nodes: issues },
          },
        },
      },
    )
    .patchOnce(
      `https://api.github.local/repos/${owner}/${repo}/issues/2`,
      { html_url: "https://github.com/issues/2" },
      {
        body: {
          state: "closed",
        },
      },
    )
    .patchOnce(
      `https://api.github.local/repos/${owner}/${repo}/issues/3`,
      { html_url: "https://github.com/issues/3" },
      {
        body: {
          state: "closed",
        },
      },
    );

  await success(
    pluginConfig,
    {
      env,
      options,
      branch: { name: "master" },
      commits,
      nextRelease,
      releases,
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
      "Closed issue #%d: %s.",
      2,
      "https://github.com/issues/2",
    ),
  );
  t.true(
    t.context.log.calledWith(
      "Closed issue #%d: %s.",
      3,
      "https://github.com/issues/3",
    ),
  );
  t.true(fetch.done());
});

test('Skip comment on on issues/PR if "successComment" is "false"', async (t) => {
  const owner = "test_user";
  const repo = "test_repo";
  const env = { GITHUB_TOKEN: "github_token" };
  const failTitle = "The automated release is failing 🚨";
  const pluginConfig = { failTitle, successComment: false };
  const options = {
    repositoryUrl: `https://github.com/${owner}/${repo}.git`,
  };
  const commits = [
    {
      hash: "123",
      message: "Commit 1 message\n\n Fix #1",
      tree: { long: "aaa" },
    },
  ];
  const nextRelease = { version: "1.0.0" };
  const releases = [
    { name: "GitHub release", url: "https://github.com/release" },
  ];

  const fetch = fetchMock
    .sandbox()
    .getOnce(`https://api.github.local/repos/${owner}/${repo}`, {
      full_name: `${owner}/${repo}`,
      clone_url: `https://api.github.local/${owner}/${repo}.git`,
    })
    .postOnce(
      (url, { body }) => {
        t.is(url, "https://api.github.local/graphql");
        t.regex(JSON.parse(body).query, /query getSRIssues\(/);
        return true;
      },
      {
        data: {
          repository: {
            issues: { nodes: [] },
          },
        },
      },
    )
    .getOnce(
      `https://api.github.local/search/issues?q=${encodeURIComponent(
        "in:title",
      )}+${encodeURIComponent(`repo:${owner}/${repo}`)}+${encodeURIComponent(
        "type:issue",
      )}+${encodeURIComponent("state:open")}+${encodeURIComponent(failTitle)}`,
      { items: [] },
    );

  await success(
    pluginConfig,
    {
      env,
      options,
      branch: { name: "master" },
      commits,
      nextRelease,
      releases,
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
    t.context.log.calledWith("Skip commenting on issues and pull requests."),
  );
  t.true(fetch.done());
});

test('Does not comment/label on issues/PR if "successCommentCondition" is "false"', async (t) => {
  const owner = "test_user";
  const repo = "test_repo";
  const env = { GITHUB_TOKEN: "github_token" };
  const failTitle = "The automated release is failing 🚨";
  const pluginConfig = { failTitle, successCommentCondition: false };
  const options = {
    repositoryUrl: `https://github.com/${owner}/${repo}.git`,
  };
  const commits = [
    {
      hash: "123",
      message: "Commit 1 message\n\n Fix #1",
      tree: { long: "aaa" },
    },
  ];
  const nextRelease = { version: "1.0.0" };
  const releases = [
    { name: "GitHub release", url: "https://github.com/release" },
  ];

  const fetch = fetchMock
    .sandbox()
    .getOnce(`https://api.github.local/repos/${owner}/${repo}`, {
      full_name: `${owner}/${repo}`,
    })
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
      )}+${encodeURIComponent("state:open")}+${encodeURIComponent(failTitle)}`,
      { items: [] },
    );

  await success(
    pluginConfig,
    {
      env,
      options,
      branch: { name: "master" },
      commits,
      nextRelease,
      releases,
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
    t.context.log.calledWith("Skip commenting on issues and pull requests."),
  );
  t.true(fetch.done());
});

test('Add comment and label to found issues/associatedPR using the "successCommentCondition": if specific label is found', async (t) => {
  const owner = "test_user";
  const repo = "test_repo";
  const env = { GITHUB_TOKEN: "github_token" };
  const failTitle = "The automated release is failing 🚨";
  const pluginConfig = {
    failTitle,
    // Issues with the label "semantic-release-relevant" will be commented and labeled
    successCommentCondition:
      "<% return issue.labels?.some((label) => { return label.name === ('semantic-release-relevant'); }); %>",
  };
  const options = {
    repositoryUrl: `https://github.com/${owner}/${repo}.git`,
  };
  const commits = [
    { hash: "123", message: "Commit 1 message" },
    { hash: "456", message: "Commit 2 message" },
  ];
  const nextRelease = { version: "1.0.0" };
  const releases = [
    { name: "GitHub release", url: "https://github.com/release" },
  ];
  const issues = [
    { number: 1, body: "Issue 1 body", title: failTitle },
    { number: 2, body: `Issue 2 body\n\n${ISSUE_ID}`, title: failTitle },
    { number: 3, body: `Issue 3 body\n\n${ISSUE_ID}`, title: failTitle },
  ];

  const prs = [
    {
      __typename: "PullRequest",
      id: "PR_kwDOMLlZj85z_R2M",
      title: "fix: will semantic-release recognize the associated issue ",
      body: "",
      url: "https://github.com/babblebey/sr-github/pull/12",
      number: 5,
      createdAt: "2024-06-30T14:43:48Z",
      updatedAt: "2024-08-26T16:19:57Z",
      closedAt: "2024-06-30T14:44:05Z",
      comments: {
        totalCount: 12,
      },
      state: "MERGED",
      author: {
        login: "babblebey",
        url: "https://github.com/babblebey",
        avatarUrl:
          "https://avatars.githubusercontent.com/u/25631971?u=f4597764b2c31478a516d97bb9ecd019b5e62ae7&v=4",
        __typename: "User",
      },
      authorAssociation: "OWNER",
      activeLockReason: null,
      labels: {
        nodes: [
          {
            id: "LA_kwDOMLlZj88AAAABp9kjcQ",
            url: "https://github.com/babblebey/sr-github/labels/released",
            name: "semantic-release-relevant",
            color: "ededed",
            description: "This issue is relevant to semantic-release",
            isDefault: false,
          },
        ],
      },
      milestone: null,
      locked: false,
      mergeable: "UNKNOWN",
      changedFiles: 1,
      mergedAt: "2024-06-30T14:44:05Z",
      isDraft: false,
      mergedBy: {
        login: "babblebey",
        avatarUrl:
          "https://avatars.githubusercontent.com/u/25631971?u=f4597764b2c31478a516d97bb9ecd019b5e62ae7&v=4",
        url: "https://github.com/babblebey",
      },
      commits: {
        totalCount: 1,
      },
    },
    {
      __typename: "PullRequest",
      id: "PR_kwDOMLlZj85z_R2M",
      title: "fix: will semantic-release recognize the associated issue ",
      body: "",
      url: "https://github.com/babblebey/sr-github/pull/12",
      number: 4,
      createdAt: "2024-06-30T14:43:48Z",
      updatedAt: "2024-08-26T16:19:57Z",
      closedAt: "2024-06-30T14:44:05Z",
      comments: {
        totalCount: 12,
      },
      state: "MERGED",
      author: {
        login: "babblebey",
        url: "https://github.com/babblebey",
        avatarUrl:
          "https://avatars.githubusercontent.com/u/25631971?u=f4597764b2c31478a516d97bb9ecd019b5e62ae7&v=4",
        __typename: "User",
      },
      authorAssociation: "OWNER",
      activeLockReason: null,
      labels: {
        nodes: [
          {
            id: "LA_kwDOMLlZj88AAAABp9kjcQ",
            url: "https://github.com/babblebey/sr-github/labels/released",
            name: "released",
            color: "ededed",
            description: "this is a label description",
            isDefault: false,
          },
        ],
      },
      milestone: null,
      locked: false,
      mergeable: "UNKNOWN",
      changedFiles: 1,
      mergedAt: "2024-06-30T14:44:05Z",
      isDraft: false,
      mergedBy: {
        login: "babblebey",
        avatarUrl:
          "https://avatars.githubusercontent.com/u/25631971?u=f4597764b2c31478a516d97bb9ecd019b5e62ae7&v=4",
        url: "https://github.com/babblebey",
      },
      commits: {
        totalCount: 1,
      },
    },
  ];

  const fetch = fetchMock
    .sandbox()
    .getOnce(`https://api.github.local/repos/${owner}/${repo}`, {
      full_name: `${owner}/${repo}`,
    })
    .postOnce(
      (url, { body }) =>
        url === "https://api.github.local/graphql" &&
        JSON.parse(body).query.includes("query getAssociatedPRs("),
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
            commit456: {
              oid: "456",
              associatedPullRequests: {
                pageInfo: {
                  endCursor: "NI",
                  hasNextPage: false,
                },
                nodes: [prs[1]],
              },
            },
          },
        },
      },
    )
    .getOnce(
      `https://api.github.local/repos/${owner}/${repo}/pulls/4/commits`,
      [{ sha: commits[0].hash }],
    )
    .getOnce(
      `https://api.github.local/repos/${owner}/${repo}/pulls/5/commits`,
      [{ sha: commits[1].hash }],
    )
    .postOnce(
      (url, { body }) =>
        url === "https://api.github.local/graphql" &&
        JSON.parse(body).query.includes("query getSRIssues("),
      {
        data: {
          repository: {
            issues: { nodes: [] },
          },
        },
      },
    )
    .getOnce(
      `https://api.github.local/search/issues?q=${encodeURIComponent(
        "in:title",
      )}+${encodeURIComponent(`repo:${owner}/${repo}`)}+${encodeURIComponent(
        "type:issue",
      )}+${encodeURIComponent("state:open")}+${encodeURIComponent(failTitle)}`,
      { items: issues },
    )
    .postOnce(
      `https://api.github.local/repos/${owner}/${repo}/issues/5/comments`,
      { html_url: "https://github.com/successcomment-5" },
    )
    .postOnce(
      `https://api.github.local/repos/${owner}/${repo}/issues/5/labels`,
      {},
      { body: ["released"] },
    )
    .patchOnce(
      `https://api.github.local/repos/${owner}/${repo}/issues/2`,
      { html_url: "https://github.com/issues/2" },
      {
        body: {
          state: "closed",
        },
      },
    )
    .patchOnce(
      `https://api.github.local/repos/${owner}/${repo}/issues/3`,
      { html_url: "https://github.com/issues/3" },
      {
        body: {
          state: "closed",
        },
      },
    );

  await success(
    pluginConfig,
    {
      env,
      options,
      branch: { name: "master" },
      commits,
      nextRelease,
      releases,
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
      "Added comment to PR #%d: %s",
      5,
      "https://github.com/successcomment-5",
    ),
  );
  t.true(
    t.context.log.calledWith("Added labels %O to PR #%d", ["released"], 5),
  );
  t.true(fetch.done());
});

test('Does not comment/label associatedPR and relatedIssues created by "Bots"', async (t) => {
  const owner = "test_user";
  const repo = "test_repo";
  const env = { GITHUB_TOKEN: "github_token" };
  const failTitle = "The automated release is failing 🚨";
  const pluginConfig = {
    failTitle,
    // Only issues or PRs not created by "Bot" will be commented and labeled
    successCommentCondition: "<% return issue.user.type !== 'Bot'; %>",
  };
  const options = {
    repositoryUrl: `https://github.com/${owner}/${repo}.git`,
  };
  const commits = [
    { hash: "123", message: "Commit 1 message" },
    { hash: "456", message: "Commit 2 message" },
  ];
  const nextRelease = { version: "1.0.0" };
  const releases = [
    { name: "GitHub release", url: "https://github.com/release" },
  ];
  const issues = [
    { number: 1, body: `Issue 1 body\n\n${ISSUE_ID}`, title: failTitle },
  ];
  const prs = [
    {
      __typename: "PullRequest",
      number: 2,
      id: "PR_kwDOMLlZj851SZzc",
      title: "pr title",
      body: "Fixes #4",
      url: "https://pr-url",
      createdAt: "2024-07-13T09:57:51Z",
      updatedAt: "2024-08-29T12:15:33Z",
      closedAt: "2024-07-13T09:58:50Z",
      comments: {
        totalCount: 23,
      },
      state: "MERGED",
      author: {
        login: "user_login",
        url: "https://user-url",
        avatarUrl: "https://avatar-url",
        __typename: "User",
      },
      authorAssociation: "OWNER",
      activeLockReason: null,
      labels: {
        nodes: [
          {
            id: "label_id",
            url: "label_url",
            name: "label_name",
            color: "ededed",
            description: "this is a label description",
            isDefault: false,
          },
        ],
      },
      milestone: null,
      locked: false,
      mergeable: "UNKNOWN",
      changedFiles: 1,
      mergedAt: "2024-07-13T09:58:50Z",
      isDraft: false,
      mergedBy: {
        login: "user",
        avatarUrl: "https://alink-to-avatar",
        url: "https://user-url",
      },
      commits: {
        totalCount: 1,
      },
    },
    {
      __typename: "PullRequest",
      number: 3,
      id: "PR_kwDOMLlZj851SZzc",
      title: "pr title",
      body: "Fixes #5",
      url: "https://pr-url",
      createdAt: "2024-07-13T09:57:51Z",
      updatedAt: "2024-08-29T12:15:33Z",
      closedAt: "2024-07-13T09:58:50Z",
      comments: {
        totalCount: 23,
      },
      state: "MERGED",
      author: {
        login: "user_login",
        url: "https://user-url",
        avatarUrl: "https://avatar-url",
        __typename: "Bot",
      },
      authorAssociation: "OWNER",
      activeLockReason: null,
      labels: {
        nodes: [
          {
            id: "label_id",
            url: "label_url",
            name: "label_name",
            color: "ededed",
            description: "this is a label description",
            isDefault: false,
          },
        ],
      },
      milestone: null,
      locked: false,
      mergeable: "UNKNOWN",
      changedFiles: 1,
      mergedAt: "2024-07-13T09:58:50Z",
      isDraft: false,
      mergedBy: {
        login: "user",
        avatarUrl: "https://alink-to-avatar",
        url: "https://user-url",
      },
      commits: {
        totalCount: 1,
      },
    },
  ];

  const fetch = fetchMock
    .sandbox()
    .getOnce(`https://api.github.local/repos/${owner}/${repo}`, {
      full_name: `${owner}/${repo}`,
    })
    .postOnce(
      (url, { body }) =>
        url === "https://api.github.local/graphql" &&
        JSON.parse(body).query.includes("query getAssociatedPRs("),
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
            commit456: {
              oid: "456",
              associatedPullRequests: {
                pageInfo: {
                  endCursor: "NI",
                  hasNextPage: false,
                },
                nodes: [prs[1]],
              },
            },
          },
        },
      },
    )
    .postOnce(
      (url, { body }) =>
        url === "https://api.github.local/graphql" &&
        JSON.parse(body).query.includes("query getRelatedIssues("),
      {
        data: {
          repository: {
            issue4: {
              __typename: "Issue",
              id: "I_kw",
              title: "issue title",
              body: "",
              url: "https://github.com/owner/repo/issues/4",
              number: 4,
              createdAt: "2024-07-13T09:58:09Z",
              updatedAt: "2024-08-26T16:19:59Z",
              closedAt: "2024-07-13T09:58:51Z",
              comments: {
                totalCount: 12,
              },
              state: "CLOSED",
              author: {
                login: "user",
                url: "author_url",
                avatarUrl: "author_avatar_url",
                __typename: "User",
              },
              authorAssociation: "OWNER",
              activeLockReason: null,
              labels: {
                nodes: [
                  {
                    id: "label_id",
                    url: "label_url",
                    name: "label_name",
                    color: "ededed",
                    description: "this is a label description",
                    isDefault: false,
                  },
                ],
              },
              milestone: null,
              locked: false,
            },
            issue5: {
              __typename: "Issue",
              id: "I_kw",
              title: "issue title",
              body: "",
              url: "https://github.com/owner/repo/issues/5",
              number: 5,
              createdAt: "2024-07-13T09:58:09Z",
              updatedAt: "2024-08-26T16:19:59Z",
              closedAt: "2024-07-13T09:58:51Z",
              comments: {
                totalCount: 12,
              },
              state: "CLOSED",
              author: {
                login: "user",
                url: "author_url",
                avatarUrl: "author_avatar_url",
                __typename: "Bot",
              },
              authorAssociation: "OWNER",
              activeLockReason: null,
              labels: {
                nodes: [
                  {
                    id: "label_id",
                    url: "label_url",
                    name: "label_name",
                    color: "ededed",
                    description: "this is a label description",
                    isDefault: false,
                  },
                ],
              },
              milestone: null,
              locked: false,
            },
          },
        },
      },
    )
    .getOnce(
      `https://api.github.local/repos/${owner}/${repo}/pulls/2/commits`,
      [{ sha: commits[0].hash }],
    )
    .getOnce(
      `https://api.github.local/repos/${owner}/${repo}/pulls/3/commits`,
      [{ sha: commits[1].hash }],
    )
    .postOnce(
      `https://api.github.local/repos/${owner}/${repo}/issues/4/comments`,
      { html_url: "https://github.com/successcomment-4" },
    )
    .postOnce(
      `https://api.github.local/repos/${owner}/${repo}/issues/4/labels`,
      {},
      { body: ["released"] },
    )
    .postOnce(
      `https://api.github.local/repos/${owner}/${repo}/issues/2/comments`,
      { html_url: "https://github.com/successcomment-2" },
    )
    .postOnce(
      `https://api.github.local/repos/${owner}/${repo}/issues/2/labels`,
      {},
      { body: ["released"] },
    )
    .postOnce(
      (url, { body }) => {
        t.is(url, "https://api.github.local/graphql");
        t.regex(JSON.parse(body).query, /query getSRIssues\(/);
        return true;
      },
      {
        data: {
          repository: {
            issues: { nodes: [] },
          },
        },
      },
    )
    .getOnce(
      `https://api.github.local/search/issues?q=${encodeURIComponent(
        "in:title",
      )}+${encodeURIComponent(`repo:${owner}/${repo}`)}+${encodeURIComponent(
        "type:issue",
      )}+${encodeURIComponent("state:open")}+${encodeURIComponent(failTitle)}`,
      { items: issues },
    )
    .patchOnce(
      `https://api.github.local/repos/${owner}/${repo}/issues/1`,
      { html_url: "https://github.com/issues/1" },
      {
        body: {
          state: "closed",
        },
      },
    );

  await success(
    pluginConfig,
    {
      env,
      options,
      branch: { name: "master" },
      commits,
      nextRelease,
      releases,
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
      "Closed issue #%d: %s.",
      1,
      "https://github.com/issues/1",
    ),
  );
  t.true(t.context.log.calledWith("Skip commenting on PR #%d.", 3));
  t.true(
    t.context.log.calledWith(
      "Added comment to issue #%d: %s",
      4,
      "https://github.com/successcomment-4",
    ),
  );
  t.true(
    t.context.log.calledWith("Added labels %O to issue #%d", ["released"], 4),
  );
  t.true(fetch.done());
});

test('Does not comment/label "associatedPR" when "successCommentCondition" disables it: Only comment on "relatedIssues"', async (t) => {
  const owner = "test_user";
  const repo = "test_repo";
  const env = { GITHUB_TOKEN: "github_token" };
  const failTitle = "The automated release is failing 🚨";
  const pluginConfig = {
    failTitle,
    // Only issues will be commented and labeled (not PRs)
    successCommentCondition: "<% return !issue.pull_request; %>",
  };
  const options = {
    repositoryUrl: `https://github.com/${owner}/${repo}.git`,
  };
  const commits = [
    { hash: "123", message: "Commit 1 message" },
    { hash: "456", message: "Commit 2 message" },
  ];
  const nextRelease = { version: "1.0.0" };
  const releases = [
    { name: "GitHub release", url: "https://github.com/release" },
  ];
  const issues = [
    { number: 1, body: `Issue 1 body\n\n${ISSUE_ID}`, title: failTitle },
    {
      number: 4,
      body: `Issue 4 body`,
      title: "Issue 4 title",
      state: "closed",
    },
  ];
  const prs = [
    { number: 2, __typename: "PullRequest", body: "Fixes #4", state: "closed" },
    { number: 3, __typename: "PullRequest", state: "closed" },
  ];

  const fetch = fetchMock
    .sandbox()
    .getOnce(`https://api.github.local/repos/${owner}/${repo}`, {
      full_name: `${owner}/${repo}`,
    })
    .postOnce(
      (url, { body }) =>
        url === "https://api.github.local/graphql" &&
        JSON.parse(body).query.includes("query getAssociatedPRs("),
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
            commit456: {
              oid: "456",
              associatedPullRequests: {
                pageInfo: {
                  endCursor: "NI",
                  hasNextPage: false,
                },
                nodes: [prs[1]],
              },
            },
          },
        },
      },
    )
    .postOnce(
      (url, { body }) =>
        url === "https://api.github.local/graphql" &&
        JSON.parse(body).query.includes("query getRelatedIssues("),
      {
        data: {
          repository: {
            issue4: {
              __typename: "Issue",
              id: "I_kw",
              title: "issue title",
              body: "",
              url: "https://github.com/owner/repo/issues/4",
              number: 4,
              createdAt: "2024-07-13T09:58:09Z",
              updatedAt: "2024-08-26T16:19:59Z",
              closedAt: "2024-07-13T09:58:51Z",
              comments: {
                totalCount: 12,
              },
              state: "CLOSED",
              author: {
                login: "user",
                url: "author_url",
                avatarUrl: "author_avatar_url",
                __typename: "User",
              },
              authorAssociation: "OWNER",
              activeLockReason: null,
              labels: {
                nodes: [
                  {
                    id: "label_id",
                    url: "label_url",
                    name: "label_name",
                    color: "ededed",
                    description: "this is a label description",
                    isDefault: false,
                  },
                ],
              },
              milestone: null,
              locked: false,
            },
          },
        },
      },
    )
    .getOnce(
      `https://api.github.local/repos/${owner}/${repo}/pulls/2/commits`,
      [{ sha: commits[0].hash }],
    )
    .getOnce(
      `https://api.github.local/repos/${owner}/${repo}/pulls/3/commits`,
      [{ sha: commits[1].hash }],
    )
    .postOnce(
      `https://api.github.local/repos/${owner}/${repo}/issues/4/comments`,
      { html_url: "https://github.com/successcomment-4" },
    )
    .postOnce(
      `https://api.github.local/repos/${owner}/${repo}/issues/4/labels`,
      {},
      { body: ["released"] },
    )
    .postOnce(
      (url, { body }) =>
        url === "https://api.github.local/graphql" &&
        JSON.parse(body).query.includes("query getSRIssues("),
      {
        data: {
          repository: {
            issues: { nodes: issues },
          },
        },
      },
    )
    .patchOnce(
      `https://api.github.local/repos/${owner}/${repo}/issues/1`,
      { html_url: "https://github.com/issues/1" },
      {
        body: {
          state: "closed",
        },
      },
    );

  await success(
    pluginConfig,
    {
      env,
      options,
      branch: { name: "master" },
      commits,
      nextRelease,
      releases,
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
      "Closed issue #%d: %s.",
      1,
      "https://github.com/issues/1",
    ),
  );
  t.true(
    t.context.log.calledWith(
      "Added comment to issue #%d: %s",
      4,
      "https://github.com/successcomment-4",
    ),
  );
  t.true(
    t.context.log.calledWith("Added labels %O to issue #%d", ["released"], 4),
  );
  t.true(fetch.done());
});

test('Skip closing issues if "failComment" is "false"', async (t) => {
  const owner = "test_user";
  const repo = "test_repo";
  const env = { GITHUB_TOKEN: "github_token" };
  const pluginConfig = { failComment: false };
  const options = { repositoryUrl: `https://github.com/${owner}/${repo}.git` };
  const commits = [{ hash: "123", message: "Commit 1 message" }];
  const nextRelease = { version: "1.0.0" };
  const releases = [
    { name: "GitHub release", url: "https://github.com/release" },
  ];

  const fetch = fetchMock
    .sandbox()
    .getOnce(`https://api.github.local/repos/${owner}/${repo}`, {
      full_name: `${owner}/${repo}`,
      clone_url: `https://api.github.local/${owner}/${repo}.git`,
    })
    .postOnce("https://api.github.local/graphql", {
      data: {
        repository: {
          commit123: {
            oid: "123",
            associatedPullRequests: {
              pageInfo: {
                endCursor: "NI",
                hasNextPage: false,
              },
              nodes: [],
            },
          },
        },
      },
    });

  await success(
    pluginConfig,
    {
      env,
      options,
      branch: { name: "master" },
      commits,
      nextRelease,
      releases,
      logger: t.context.logger,
    },
    {
      Octokit: TestOctokit.defaults((options) => ({
        ...options,
        request: { ...options.request, fetch },
      })),
    },
  );
  t.true(t.context.log.calledWith("Skip closing issue."));
  t.true(fetch.done());
});

test('Skip closing issues if "failTitle" is "false"', async (t) => {
  const owner = "test_user";
  const repo = "test_repo";
  const env = { GITHUB_TOKEN: "github_token" };
  const pluginConfig = { failTitle: false };
  const options = { repositoryUrl: `https://github.com/${owner}/${repo}.git` };
  const commits = [{ hash: "123", message: "Commit 1 message" }];
  const nextRelease = { version: "1.0.0" };
  const releases = [
    { name: "GitHub release", url: "https://github.com/release" },
  ];

  const fetch = fetchMock
    .sandbox()
    .getOnce(`https://api.github.local/repos/${owner}/${repo}`, {
      full_name: `${owner}/${repo}`,
      clone_url: `https://api.github.local/${owner}/${repo}.git`,
    })
    .postOnce("https://api.github.local/graphql", {
      data: {
        repository: {
          commit123: {
            oid: "123",
            associatedPullRequests: {
              pageInfo: {
                endCursor: "NI",
                hasNextPage: false,
              },
              nodes: [],
            },
          },
        },
      },
    });

  await success(
    pluginConfig,
    {
      env,
      options,
      branch: { name: "master" },
      commits,
      nextRelease,
      releases,
      logger: t.context.logger,
    },
    {
      Octokit: TestOctokit.defaults((options) => ({
        ...options,
        request: { ...options.request, fetch },
      })),
    },
  );
  t.true(t.context.log.calledWith("Skip closing issue."));
  t.true(fetch.done());
});

test('Skip closing issues if "failCommentCondition" is "false"', async (t) => {
  const owner = "test_user";
  const repo = "test_repo";
  const env = { GITHUB_TOKEN: "github_token" };
  const pluginConfig = { failCommentCondition: false };
  const options = { repositoryUrl: `https://github.com/${owner}/${repo}.git` };
  const commits = [{ hash: "123", message: "Commit 1 message" }];
  const nextRelease = { version: "1.0.0" };
  const releases = [
    { name: "GitHub release", url: "https://github.com/release" },
  ];

  const fetch = fetchMock
    .sandbox()
    .getOnce(`https://api.github.local/repos/${owner}/${repo}`, {
      full_name: `${owner}/${repo}`,
      clone_url: `https://api.github.local/${owner}/${repo}.git`,
    })
    .postOnce("https://api.github.local/graphql", {
      data: {
        repository: {
          commit123: {
            oid: "123",
            associatedPullRequests: {
              pageInfo: {
                endCursor: "NI",
                hasNextPage: false,
              },
              nodes: [],
            },
          },
        },
      },
    });

  await success(
    pluginConfig,
    {
      env,
      options,
      branch: { name: "master" },
      commits,
      nextRelease,
      releases,
      logger: t.context.logger,
    },
    {
      Octokit: TestOctokit.defaults((options) => ({
        ...options,
        request: { ...options.request, fetch },
      })),
    },
  );
  t.true(t.context.log.calledWith("Skip closing issue."));
  t.true(fetch.done());
});
