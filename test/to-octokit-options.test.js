import { createServer as _createServer } from "node:https";

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
