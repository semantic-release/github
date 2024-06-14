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
  t.context.logger = { log: t.context.log, error: t.context.error };
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
    { number: 1, pull_request: {}, state: "closed" },
    { number: 2, pull_request: {}, body: "Fixes #3", state: "closed" },
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
    })
    .postOnce("https://api.github.local/graphql", {
      data: {
        repository: {
          commit1: {
            associatedPullRequests: {
              nodes: [
                prs[0],
              ],
            },
          },
          commit2: {
            associatedPullRequests: {
              nodes: [
                prs[1],
              ],
            },
          },
        },
      },
    })
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
      "Added comment to issue #%d: %s",
      1,
      "https://github.com/successcomment-1",
    ),
  );
  t.true(
    t.context.log.calledWith("Added labels %O to issue #%d", ["released"], 1),
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
    { number: 1, pull_request: {}, state: "closed" },
    { number: 2, pull_request: {}, body: "Fixes #3", state: "closed" },
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
    .postOnce("https://custom-url.com/prefix/graphql", {
      data: {
        repository: {
          commit1: {
            associatedPullRequests: {
              nodes: [
                prs[0],
              ],
            },
          },
          commit2: {
            associatedPullRequests: {
              nodes: [
                prs[1],
              ],
            },
          },
        },
      },
    })
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
      "Added comment to issue #%d: %s",
      1,
      "https://custom-url.com/successcomment-1",
    ),
  );
  t.true(
    t.context.log.calledWith(
      "Added labels %O to issue #%d",
      ["released on @next"],
      1,
    ),
  );
  t.true(
    t.context.log.calledWith(
      "Added comment to issue #%d: %s",
      2,
      "https://custom-url.com/successcomment-2",
    ),
  );
  t.true(
    t.context.log.calledWith(
      "Added labels %O to issue #%d",
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
    { number: 1, pull_request: {}, state: "closed" },
    { number: 2, pull_request: {}, state: "closed" },
    { number: 3, pull_request: {}, state: "closed" },
    { number: 4, pull_request: {}, state: "closed" },
    { number: 5, pull_request: {}, state: "closed" },
    { number: 6, pull_request: {}, state: "closed" },
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
    })
    .getOnce(
      `https://api.github.local/search/issues?q=${encodeURIComponent(
        `repo:${owner}/${repo}`,
      )}+${encodeURIComponent("type:pr")}+${encodeURIComponent("is:merged")}+${
        commits[0].hash
      }+${commits[1].hash}+${commits[2].hash}+${commits[3].hash}+${
        commits[4].hash
      }`,
      { items: [prs[0], prs[1], prs[2], prs[3], prs[4]] },
    )
    // .postOnce("https://api.github.local/graphql", {
    //   data: {
    //     repository: {
    //       commit1: {
    //         associatedPullRequests: {
    //           nodes: [
    //             prs[0],
    //           ],
    //         },
    //       },
    //       commit2: {
    //         associatedPullRequests: {
    //           nodes: [
    //             prs[1],
    //           ],
    //         },
    //       },
    //       commit3: {
    //         associatedPullRequests: {
    //           nodes: [
    //             prs[2],
    //           ],
    //         },
    //       },
    //       commit4: {
    //         associatedPullRequests: {
    //           nodes: [
    //             prs[3],
    //           ],
    //         },
    //       },
    //       commit5: {
    //         associatedPullRequests: {
    //           nodes: [
    //             prs[4],
    //           ],
    //         },
    //       },
    //     },
    //   },
    // })
    .getOnce(
      `https://api.github.local/search/issues?q=${encodeURIComponent(
        `repo:${owner}/${repo}`,
      )}+${encodeURIComponent("type:pr")}+${encodeURIComponent("is:merged")}+${
        commits[5].hash
      }+${commits[6].hash}`,
      { items: [prs[5], prs[1]] },
    )
    // .postOnce("https://api.github.local/graphql", {
    //   data: {
    //     repository: {
    //       commit1: {
    //         associatedPullRequests: {
    //           nodes: [
    //             prs[5],
    //           ],
    //         },
    //       },
    //       commit2: {
    //         associatedPullRequests: {
    //           nodes: [
    //             prs[1],
    //           ],
    //         },
    //       }
    //     },
    //   },
    // }, { overwriteRoutes: true })
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
      1,
      "https://github.com/successcomment-1",
    ),
  );
  t.true(
    t.context.log.calledWith("Added labels %O to issue #%d", ["released"], 1),
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
      "Added comment to issue #%d: %s",
      5,
      "https://github.com/successcomment-5",
    ),
  );
  t.true(
    t.context.log.calledWith("Added labels %O to issue #%d", ["released"], 5),
  );
  t.true(
    t.context.log.calledWith(
      "Added comment to issue #%d: %s",
      6,
      "https://github.com/successcomment-6",
    ),
  );
  t.true(
    t.context.log.calledWith("Added labels %O to issue #%d", ["released"], 6),
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
    { number: 1, pull_request: {}, state: "closed" },
    { number: 2, pull_request: {}, state: "closed" },
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
    })
    .postOnce("https://api.github.local/graphql", {
      data: {
        repository: {
          commit1: {
            associatedPullRequests: {
              nodes: [
                prs[0],
              ],
            },
          },
          commit2: {
            associatedPullRequests: {
              nodes: [
                prs[1],
              ],
            },
          }
        },
      },
    })
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
      1,
      "https://github.com/successcomment-1",
    ),
  );
  t.true(
    t.context.log.calledWith("Added labels %O to issue #%d", ["released"], 1),
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
    })
    .postOnce("https://api.github.local/graphql", {
      data: {
        repository: {
          commit123: {
            associatedPullRequests: {
              nodes: [],
            },
          }
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
    })
    .postOnce("https://api.github.local/graphql", {
      data: {
        repository: {
          commit123: {
            associatedPullRequests: {
              nodes: [],
            },
          },
          commit456: {
            associatedPullRequests: {
              nodes: [],
            },
          },
          commit789: {
            associatedPullRequests: {
              nodes: [],
            },
          }
        },
      },
    })
    .postOnce(
      `https://api.github.local/repos/${owner}/${repo}/issues/2/comments`,
      { html_url: "https://github.com/successcomment-2" },
    )
    .postOnce(
      `https://api.github.local/repos/${owner}/${repo}/issues/2/labels`,
      {},
      { body: ["released"] },
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
    { number: 1, pull_request: {}, state: "closed" },
    { number: 2, pull_request: {}, body: "Fixes #4", state: "closed" },
    { number: 3, pull_request: {}, body: "Fixes #5", state: "closed" },
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
    })
    .getOnce(
      `https://api.github.local/search/issues?q=${encodeURIComponent(
        `repo:${owner}/${repo}`,
      )}+${encodeURIComponent("type:pr")}+${encodeURIComponent(
        "is:merged",
      )}+${commits.map((commit) => commit.hash).join("+")}`,
      { items: prs },
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
      1,
      "https://github.com/successcomment-1",
    ),
  );
  t.true(
    t.context.log.calledWith("Added labels %O to issue #%d", ["released"], 1),
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
      "Failed to add a comment to the issue #%d as it doesn't exist.",
      2,
    ),
  );
  t.true(
    t.context.error.calledWith(
      "Not allowed to add a comment to the issue #%d.",
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
    { number: 1, prop: "PR prop", pull_request: {}, state: "closed" },
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
    })
    .getOnce(
      `https://api.github.local/search/issues?q=${encodeURIComponent(
        `repo:${owner}/${repo}`,
      )}+${encodeURIComponent("type:pr")}+${encodeURIComponent(
        "is:merged",
      )}+${commits.map((commit) => commit.hash).join("+")}`,
      { items: prs },
    )
    .getOnce(
      `https://api.github.local/repos/${owner}/${repo}/pulls/1/commits`,
      [{ sha: commits[0].hash }],
    )
    .postOnce(
      `https://api.github.local/repos/${owner}/${repo}/issues/1/comments`,
      { html_url: "https://github.com/successcomment-1" },
      {
        body: {
          body: `last release: ${lastRelease.version} nextRelease: ${nextRelease.version} branch: master commits: 1 releases: 1 PR attribute: PR prop`,
        },
      },
    )
    .postOnce(
      `https://api.github.local/repos/${owner}/${repo}/issues/1/labels`,
      {},
      { body: ["released on @next", "released from master"] },
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
      "Added comment to issue #%d: %s",
      1,
      "https://github.com/successcomment-1",
    ),
  );
  t.true(
    t.context.log.calledWith(
      "Added labels %O to issue #%d",
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
  const prs = [{ number: 1, pull_request: {}, state: "closed" }];
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
    })
    .getOnce(
      `https://api.github.local/search/issues?q=${encodeURIComponent(
        `repo:${owner}/${repo}`,
      )}+${encodeURIComponent("type:pr")}+${encodeURIComponent(
        "is:merged",
      )}+${commits.map((commit) => commit.hash).join("+")}`,
      { items: prs },
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
      "Added comment to issue #%d: %s",
      1,
      "https://github.com/successcomment-1",
    ),
  );
  t.true(
    t.context.log.calledWith(
      "Added labels %O to issue #%d",
      ["custom label"],
      1,
    ),
  );
  t.true(fetch.done());
});

test("Comment on issue/PR without ading a label", async (t) => {
  const owner = "test_user";
  const repo = "test_repo";
  const env = { GITHUB_TOKEN: "github_token" };
  const failTitle = "The automated release is failing 🚨";
  const pluginConfig = { releasedLabels: false, failTitle };
  const prs = [{ number: 1, pull_request: {}, state: "closed" }];
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
    })
    .getOnce(
      `https://api.github.local/search/issues?q=${encodeURIComponent(
        `repo:${owner}/${repo}`,
      )}+${encodeURIComponent("type:pr")}+${encodeURIComponent(
        "is:merged",
      )}+${commits.map((commit) => commit.hash).join("+")}`,
      { items: prs },
    )
    .getOnce(
      `https://api.github.local/repos/${owner}/${repo}/pulls/1/commits`,
      [{ sha: commits[0].hash }],
    )
    .postOnce(
      `https://api.github.local/repos/${owner}/${repo}/issues/1/comments`,
      { html_url: "https://github.com/successcomment-1" },
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
      "Added comment to issue #%d: %s",
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
  const prs = [{ number: 1, pull_request: {}, state: "closed" }];
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
    })
    .getOnce(
      `https://api.github.local/search/issues?q=${encodeURIComponent(
        `repo:${owner}/${repo}`,
      )}+${encodeURIComponent("type:pr")}+${encodeURIComponent(
        "is:merged",
      )}+${commits.map((commit) => commit.hash).join("+")}`,
      { items: prs },
    )
    .getOnce(
      `https://api.github.local/repos/${owner}/${repo}/pulls/1/commits`,
      [{ sha: commits[0].hash }],
    )
    .postOnce(
      `https://api.github.local/repos/${owner}/${repo}/issues/1/comments`,
      { html_url: "https://github.com/successcomment-1" },
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
      "Added comment to issue #%d: %s",
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
  const prs = [{ number: 1, pull_request: {}, state: "closed" }];
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
    })
    .getOnce(
      `https://api.github.local/search/issues?q=${encodeURIComponent(
        `repo:${owner}/${repo}`,
      )}+${encodeURIComponent("type:pr")}+${encodeURIComponent(
        "is:merged",
      )}+${commits.map((commit) => commit.hash).join("+")}`,
      { items: prs },
    )
    .getOnce(
      `https://api.github.local/repos/${owner}/${repo}/pulls/1/commits`,
      [{ sha: commits[0].hash }],
    )
    .postOnce(
      `https://api.github.local/repos/${owner}/${repo}/issues/1/comments`,
      { html_url: "https://github.com/successcomment-1" },
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
      "Added comment to issue #%d: %s",
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
  const prs = [{ number: 1, pull_request: {}, state: "closed" }];
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
    })
    .getOnce(
      `https://api.github.local/search/issues?q=${encodeURIComponent(
        `repo:${owner}/${repo}`,
      )}+${encodeURIComponent("type:pr")}+${encodeURIComponent(
        "is:merged",
      )}+${commits.map((commit) => commit.hash).join("+")}`,
      { items: prs },
    )
    .getOnce(
      `https://api.github.local/repos/${owner}/${repo}/pulls/1/commits`,
      [{ sha: commits[0].hash }],
    )
    .postOnce(
      `https://api.github.local/repos/${owner}/${repo}/issues/1/comments`,
      { html_url: "https://github.com/successcomment-1" },
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
      "Added comment to issue #%d: %s",
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
  const prs = [{ number: 1, pull_request: {}, state: "closed" }];
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
    })
    .getOnce(
      `https://api.github.local/search/issues?q=${encodeURIComponent(
        `repo:${owner}/${repo}`,
      )}+${encodeURIComponent("type:pr")}+${encodeURIComponent(
        "is:merged",
      )}+${commits.map((commit) => commit.hash).join("+")}`,
      { items: prs },
    )
    .getOnce(
      `https://api.github.local/repos/${owner}/${repo}/pulls/1/commits`,
      [{ sha: commits[0].hash }],
    )
    .postOnce(
      `https://api.github.local/repos/${owner}/${repo}/issues/1/comments`,
      { html_url: "https://github.com/successcomment-1" },
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
      "Added comment to issue #%d: %s",
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
  const prs = [{ number: 1, pull_request: {}, state: "closed" }];
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
    })
    .getOnce(
      `https://api.github.local/search/issues?q=${encodeURIComponent(
        `repo:${owner}/${repo}`,
      )}+${encodeURIComponent("type:pr")}+${encodeURIComponent(
        "is:merged",
      )}+${commits.map((commit) => commit.hash).join("+")}`,
      { items: prs },
    )
    .getOnce(
      `https://api.github.local/repos/${owner}/${repo}/pulls/1/commits`,
      [{ sha: commits[0].hash }],
    )
    .postOnce(
      `https://api.github.local/repos/${owner}/${repo}/issues/1/comments`,
      { html_url: "https://github.com/successcomment-1" },
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
      "Added comment to issue #%d: %s",
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
  const prs = [{ number: 1, pull_request: {}, state: "closed" }];
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
    })
    .getOnce(
      `https://api.github.local/search/issues?q=${encodeURIComponent(
        `repo:${owner}/${repo}`,
      )}+${encodeURIComponent("type:pr")}+${encodeURIComponent(
        "is:merged",
      )}+${commits.map((commit) => commit.hash).join("+")}`,
      { items: prs },
    )
    .getOnce(
      `https://api.github.local/repos/${owner}/${repo}/pulls/1/commits`,
      [{ sha: commits[0].hash }],
    )
    .postOnce(
      `https://api.github.local/repos/${owner}/${repo}/issues/1/comments`,
      { html_url: "https://github.com/successcomment-1" },
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
      "Added comment to issue #%d: %s",
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
    { number: 1, pull_request: {}, state: "closed" },
    { number: 2, pull_request: {}, state: "closed" },
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
    })
    .getOnce(
      `https://api.github.local/search/issues?q=${encodeURIComponent(
        `repo:${owner}/${repo}`,
      )}+${encodeURIComponent("type:pr")}+${encodeURIComponent(
        "is:merged",
      )}+${commits.map((commit) => commit.hash).join("+")}`,
      { items: prs },
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
    t.context.error.calledWith("Failed to add a comment to the issue #%d.", 1),
  );
  t.true(t.context.error.calledWith("Failed to close the issue #%d.", 2));
  t.true(
    t.context.log.calledWith(
      "Added comment to issue #%d: %s",
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
    })
    .getOnce(
      `https://api.github.local/search/issues?q=${encodeURIComponent(
        `repo:${owner}/${repo}`,
      )}+${encodeURIComponent("type:pr")}+${encodeURIComponent(
        "is:merged",
      )}+${commits.map((commit) => commit.hash).join("+")}`,
      { items: [] },
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

test('Skip commention on issues/PR if "successComment" is "false"', async (t) => {
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
    })
    .getOnce(
      `https://api.github.local/search/issues?q=${encodeURIComponent(
        `repo:${owner}/${repo}`,
      )}+${encodeURIComponent("type:pr")}+${encodeURIComponent(
        "is:merged",
      )}+${commits.map((commit) => commit.hash).join("+")}`,
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
    })
    .getOnce(
      `https://api.github.local/search/issues?q=${encodeURIComponent(
        `repo:${owner}/${repo}`,
      )}+${encodeURIComponent("type:pr")}+${encodeURIComponent(
        "is:merged",
      )}+${commits.map((commit) => commit.hash).join("+")}`,
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
  t.true(t.context.log.calledWith("Skip closing issue."));
  t.true(fetch.done());
});
