import { join, dirname } from "node:path";
import { createServer } from "node:http";
import { createServer as _createServer } from "node:https";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { readFile } from "node:fs/promises";

import Proxy from "proxy";
import serverDestroy from "server-destroy";
import sinon from "sinon";
import test from "ava";
import { HttpProxyAgent } from "http-proxy-agent";
import { HttpsProxyAgent } from "https-proxy-agent";
import nodeFetch from "node-fetch";

const __dirname = dirname(fileURLToPath(import.meta.url));

import { toOctokitOptions } from "../lib/octokit.js";

process.env.NODE_TLS_REJECT_UNAUTHORIZED = 0;

test.serial("Use a http proxy", async (t) => {
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

test.serial("Use a https proxy", async (t) => {
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

test.serial("Do not use a proxy if set to false", async (t) => {
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
