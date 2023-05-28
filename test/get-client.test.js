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

const __dirname = dirname(fileURLToPath(import.meta.url));

const getClient = (await import("../lib/get-client.js")).default;

process.env.NODE_TLS_REJECT_UNAUTHORIZED = 0;

test.serial("Use a http proxy", async (t) => {
  const server = createServer();
  await promisify(server.listen).bind(server)();
  const serverPort = server.address().port;
  serverDestroy(server);
  const proxy = new Proxy();
  await promisify(proxy.listen).bind(proxy)();
  const proxyPort = proxy.address().port;
  serverDestroy(proxy);

  const proxyHandler = sinon.spy();
  const serverHandler = sinon.spy((request, response) => {
    response.end();
  });
  proxy.on("request", proxyHandler);
  server.on("request", serverHandler);

  const github = getClient({
    githubToken: "github_token",
    githubUrl: `http://localhost:${serverPort}`,
    githubApiPathPrefix: "",
    proxy: `http://localhost:${proxyPort}`,
  });

  await github.request("GET /repos/{owner}/{repo}", {
    repo: "repo",
    owner: "owner",
  });

  t.is(
    proxyHandler.args[0][0].headers.accept,
    "application/vnd.github.v3+json"
  );
  t.is(
    serverHandler.args[0][0].headers.accept,
    "application/vnd.github.v3+json"
  );
  t.regex(serverHandler.args[0][0].headers.via, /proxy/);
  t.truthy(serverHandler.args[0][0].headers["x-forwarded-for"]);

  await promisify(proxy.destroy).bind(proxy)();
  await promisify(server.destroy).bind(server)();
});

test.serial("Use a https proxy", async (t) => {
  const server = _createServer({
    key: await readFile(join(__dirname, "/fixtures/ssl/ssl-cert-snakeoil.key")),
    cert: await readFile(
      join(__dirname, "/fixtures/ssl/ssl-cert-snakeoil.pem")
    ),
  });
  await promisify(server.listen).bind(server)();
  const serverPort = server.address().port;
  serverDestroy(server);
  const proxy = new Proxy();
  await promisify(proxy.listen).bind(proxy)();
  const proxyPort = proxy.address().port;
  serverDestroy(proxy);

  const proxyHandler = sinon.spy();
  const serverHandler = sinon.spy((request, response) => {
    response.end();
  });
  proxy.on("connect", proxyHandler);
  server.on("request", serverHandler);

  const github = getClient({
    githubToken: "github_token",
    githubUrl: `https://localhost:${serverPort}`,
    githubApiPathPrefix: "",
    proxy: { host: "localhost", port: proxyPort, headers: { foo: "bar" } },
  });

  await github.request("GET /repos/{owner}/{repo}", {
    repo: "repo",
    owner: "owner",
  });

  t.is(proxyHandler.args[0][0].url, `localhost:${serverPort}`);
  t.is(proxyHandler.args[0][0].headers.foo, "bar");
  t.is(
    serverHandler.args[0][0].headers.accept,
    "application/vnd.github.v3+json"
  );

  await promisify(proxy.destroy).bind(proxy)();
  await promisify(server.destroy).bind(server)();
});

test.serial("Do not use a proxy if set to false", async (t) => {
  const server = createServer();
  await promisify(server.listen).bind(server)();
  const serverPort = server.address().port;
  serverDestroy(server);

  const serverHandler = sinon.spy((request, response) => {
    response.end();
  });
  server.on("request", serverHandler);

  const github = getClient({
    githubToken: "github_token",
    githubUrl: `http://localhost:${serverPort}`,
    githubApiPathPrefix: "",
    proxy: false,
  });

  await github.request("GET /repos/{owner}/{repo}", {
    repo: "repo",
    owner: "owner",
  });

  t.is(
    serverHandler.args[0][0].headers.accept,
    "application/vnd.github.v3+json"
  );
  t.falsy(serverHandler.args[0][0].headers.via);
  t.falsy(serverHandler.args[0][0].headers["x-forwarded-for"]);

  await promisify(server.destroy).bind(server)();
});
