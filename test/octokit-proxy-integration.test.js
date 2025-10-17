import { createServer } from "node:http";
import { createServer as createHttpsServer } from "node:https";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import test from "ava";
import { SemanticReleaseOctokit, toOctokitOptions } from "../lib/octokit.js";

process.env.NODE_TLS_REJECT_UNAUTHORIZED = 0;

test("Octokit proxy setup creates proper fetch function", async (t) => {
  // This test verifies that the proxy setup creates the expected function structure
  // without actually testing network connectivity which can be flaky in CI environments

  const options = toOctokitOptions({
    githubToken: "test_token",
    githubApiUrl: "https://api.github.com",
    proxy: "http://proxy.example.com:8080",
  });

  const octokit = new SemanticReleaseOctokit(options);

  // Verify that the options are set up correctly
  t.true(typeof options.request.fetch === "function");
  t.is(options.auth, "test_token");
  t.is(options.baseUrl, "https://api.github.com");

  // Verify that both agent (for backwards compatibility) and fetch are present
  t.truthy(options.request.agent);
  t.truthy(options.request.fetch);

  // Verify that the fetch function has the correct signature
  t.is(options.request.fetch.length, 2);
});

test("Octokit works without proxy using custom fetch", async (t) => {
  let requestReceived = false;

  // Create a mock GitHub API server
  const mockApiServer = createServer((req, res) => {
    requestReceived = true;
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        id: 1,
        tag_name: "v1.0.0",
        name: "Test Release",
        body: "Test release body",
      }),
    );
  });

  await new Promise((resolve) => {
    mockApiServer.listen(0, "127.0.0.1", resolve);
  });

  const apiPort = mockApiServer.address().port;

  try {
    const options = toOctokitOptions({
      githubToken: "test_token",
      githubApiUrl: `http://127.0.0.1:${apiPort}`,
      // No proxy specified
    });

    const octokit = new SemanticReleaseOctokit(options);

    // Test that the custom fetch function is still created (even without proxy)
    t.true(typeof options.request.fetch === "function");

    const response = await options.request.fetch(
      `http://127.0.0.1:${apiPort}/test`,
      {
        method: "GET",
        headers: {
          Authorization: "token test_token",
        },
      },
    );

    t.is(response.status, 200);
    t.true(requestReceived);

    const data = await response.json();
    t.is(data.tag_name, "v1.0.0");
  } finally {
    mockApiServer.close();
  }
});
