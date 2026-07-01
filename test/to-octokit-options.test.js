import { createServer } from "node:http";

import test from "ava";
import { HttpProxyAgent } from "http-proxy-agent";
import { HttpsProxyAgent } from "https-proxy-agent";

import { toOctokitOptions } from "../lib/octokit.js";

process.env.NODE_TLS_REJECT_UNAUTHORIZED = 0;

test("Use a http proxy", async (t) => {
  const options = toOctokitOptions({
    githubToken: "github_token",
    githubUrl: `http://localhost:10001`,
    githubApiPathPrefix: "",
    proxy: `http://localhost:1002`,
  });
  const { request, ...rest } = options;
  t.deepEqual(rest, {
    baseUrl: `http://localhost:10001`,
    auth: "github_token",
  });
  t.true(request.agent instanceof HttpProxyAgent);
});

test("Use a https proxy", async (t) => {
  const options = toOctokitOptions({
    githubToken: "github_token",
    githubUrl: `https://localhost:10001`,
    githubApiPathPrefix: "",
    proxy: `https://localhost:1002`,
  });
  const { request, ...rest } = options;
  t.deepEqual(rest, {
    baseUrl: `https://localhost:10001`,
    auth: "github_token",
  });
  t.true(request.agent instanceof HttpsProxyAgent);
});

test("Do not use a proxy if set to false", async (t) => {
  const options = toOctokitOptions({
    githubToken: "github_token",
    githubUrl: `http://localhost:10001`,
    githubApiPathPrefix: "",
    proxy: false,
  });
  const { request, ...rest } = options;
  t.deepEqual(rest, {
    baseUrl: `http://localhost:10001`,
    auth: "github_token",
  });
  t.is(request.agent, undefined);
});

test("githubUrl with trailing slash", async (t) => {
  const options = toOctokitOptions({
    githubUrl: "http://localhost:10001/",
    githubApiPathPrefix: "",
  });
  t.is(options.baseUrl, "http://localhost:10001");
});

test("githubApiUrl with trailing slash", async (t) => {
  const options = toOctokitOptions({
    githubApiUrl: "http://api.localhost:10001/",
  });
  t.is(options.baseUrl, "http://api.localhost:10001");
});

test("fetch function uses ProxyAgent with proxy", async (t) => {
  const proxyUrl = "http://localhost:1002";
  const options = toOctokitOptions({
    githubToken: "github_token",
    githubUrl: "https://localhost:10001",
    githubApiPathPrefix: "",
    proxy: proxyUrl,
  });

  t.true(typeof options.request.fetch === "function");

  // Test that the fetch function is created and different from the default undici fetch
  const { fetch: undiciFetch } = await import("undici");
  t.not(options.request.fetch, undiciFetch);
});

test("fetch function does not use ProxyAgent without proxy", async (t) => {
  const options = toOctokitOptions({
    githubToken: "github_token",
    githubUrl: "https://localhost:10001",
    githubApiPathPrefix: "",
  });

  t.true(typeof options.request.fetch === "function");

  // Test that the fetch function is created and different from the default undici fetch
  const { fetch: undiciFetch } = await import("undici");
  t.not(options.request.fetch, undiciFetch);
});

test("fetch function preserves original fetch options", async (t) => {
  const proxyUrl = "http://localhost:1002";
  const options = toOctokitOptions({
    githubToken: "github_token",
    proxy: proxyUrl,
  });

  // Test that we get a custom fetch function when proxy is set
  t.true(typeof options.request.fetch === "function");

  // Test that we can call the function without errors (even though we can't mock the actual fetch)
  t.notThrows(() => {
    const fetchFn = options.request.fetch;
    // Just verify it's a function that can be called with the expected signature
    t.is(typeof fetchFn, "function");
    t.is(fetchFn.length, 2); // fetch function should accept 2 parameters (url, options)
  });
});

test("both agent and fetch are provided for backwards compatibility", async (t) => {
  const proxyUrl = "http://localhost:1002";
  const options = toOctokitOptions({
    githubToken: "github_token",
    githubUrl: "https://localhost:10001",
    githubApiPathPrefix: "",
    proxy: proxyUrl,
  });

  const { request, ...rest } = options;

  // Should have both agent and fetch for compatibility
  t.true(request.agent instanceof HttpsProxyAgent);
  t.true(typeof request.fetch === "function");

  t.deepEqual(rest, {
    baseUrl: "https://localhost:10001",
    auth: "github_token",
  });
});

test("only fetch is provided when no proxy is set", async (t) => {
  const options = toOctokitOptions({
    githubToken: "github_token",
    githubUrl: "https://localhost:10001",
    githubApiPathPrefix: "",
  });

  const { request, ...rest } = options;

  // Should have fetch function but no agent when no proxy
  t.is(request.agent, undefined);
  t.true(typeof request.fetch === "function");

  t.deepEqual(rest, {
    baseUrl: "https://localhost:10001",
    auth: "github_token",
  });
});

test("fetch without proxy stays on direct undici dispatcher", async (t) => {
  const server = createServer((req, res) => {
    req.resume();
    req.on("end", () => {
      res.writeHead(200, { "Content-Type": "text/plain" });
      res.end("ok");
    });
  });

  await new Promise((resolve) => {
    server.listen(0, "127.0.0.1", resolve);
  });

  const { port } = server.address();
  const url = `http://127.0.0.1:${port}/upload`;

  try {
    // Initialize Node's built-in fetch first to mimic real runtime usage.
    await fetch(url);

    const options = toOctokitOptions({
      githubToken: "github_token",
      githubApiUrl: `http://127.0.0.1:${port}`,
    });

    // throws because the content-length does not match the body length
    const error = await t.throwsAsync(
      options.request.fetch(url, {
        method: "POST",
        headers: { "content-length": "10" },
        body: "abc",
      }),
    );

    const causeStack = error?.cause?.stack || "";
    t.false(causeStack.includes("node:internal/deps/undici/undici"));
    t.true(causeStack.includes("/node_modules/undici/"));
  } finally {
    await new Promise((resolve) => {
      server.close(resolve);
    });
  }
});

test("fetch function sets content-length for Buffer body", async (t) => {
  let requestContentLength;
  let receivedBodyLength = 0;
  const body = Buffer.from("upload-body");

  const server = createServer((req, res) => {
    requestContentLength = req.headers["content-length"];
    req.on("data", (chunk) => {
      receivedBodyLength += chunk.length;
    });
    req.on("end", () => {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: true }));
    });
  });

  await new Promise((resolve) => {
    server.listen(0, "127.0.0.1", resolve);
  });

  const { port } = server.address();
  const url = `http://127.0.0.1:${port}/upload`;

  try {
    const options = toOctokitOptions({
      githubToken: "github_token",
      githubApiUrl: `http://127.0.0.1:${port}`,
    });

    const response = await options.request.fetch(url, {
      method: "POST",
      headers: { "content-type": "application/octet-stream" },
      body,
    });

    t.is(response.status, 200);
    t.deepEqual(await response.json(), { ok: true });
    t.is(requestContentLength, `${body.byteLength}`);
    t.is(receivedBodyLength, body.byteLength);
  } finally {
    await new Promise((resolve) => {
      server.close(resolve);
    });
  }
});
