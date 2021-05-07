const path = require('path');
const http = require('http');
const https = require('https');
const {promisify} = require('util');
const {readFile} = require('fs-extra');
const test = require('ava');
const {inRange} = require('lodash');
const {stub, spy} = require('sinon');
const proxyquire = require('proxyquire');
const Proxy = require('proxy');
const serverDestroy = require('server-destroy');
const {Octokit} = require('@octokit/rest');
const rateLimit = require('./helpers/rate-limit');

const getClient = proxyquire('../lib/get-client', {'./definitions/rate-limit': rateLimit});

process.env.NODE_TLS_REJECT_UNAUTHORIZED = 0;

test.serial('Use a http proxy', async (t) => {
  const server = http.createServer();
  await promisify(server.listen).bind(server)();
  const serverPort = server.address().port;
  serverDestroy(server);
  const proxy = new Proxy();
  await promisify(proxy.listen).bind(proxy)();
  const proxyPort = proxy.address().port;
  serverDestroy(proxy);

  const proxyHandler = spy();
  const serverHandler = spy((request, response) => {
    response.end();
  });
  proxy.on('request', proxyHandler);
  server.on('request', serverHandler);

  const github = getClient({
    githubToken: 'github_token',
    githubUrl: `http://localhost:${serverPort}`,
    githubApiPathPrefix: '',
    proxy: `http://localhost:${proxyPort}`,
  });

  await github.repos.get({repo: 'repo', owner: 'owner'});

  t.is(proxyHandler.args[0][0].headers.accept, 'application/vnd.github.v3+json');
  t.is(serverHandler.args[0][0].headers.accept, 'application/vnd.github.v3+json');
  t.regex(serverHandler.args[0][0].headers.via, /proxy/);
  t.truthy(serverHandler.args[0][0].headers['x-forwarded-for']);

  await promisify(proxy.destroy).bind(proxy)();
  await promisify(server.destroy).bind(server)();
});

test.serial('Use a https proxy', async (t) => {
  const server = https.createServer({
    key: await readFile(path.join(__dirname, '/fixtures/ssl/ssl-cert-snakeoil.key')),
    cert: await readFile(path.join(__dirname, '/fixtures/ssl/ssl-cert-snakeoil.pem')),
  });
  await promisify(server.listen).bind(server)();
  const serverPort = server.address().port;
  serverDestroy(server);
  const proxy = new Proxy();
  await promisify(proxy.listen).bind(proxy)();
  const proxyPort = proxy.address().port;
  serverDestroy(proxy);

  const proxyHandler = spy();
  const serverHandler = spy((request, response) => {
    response.end();
  });
  proxy.on('connect', proxyHandler);
  server.on('request', serverHandler);

  const github = getClient({
    githubToken: 'github_token',
    githubUrl: `https://localhost:${serverPort}`,
    githubApiPathPrefix: '',
    proxy: {host: 'localhost', port: proxyPort, headers: {foo: 'bar'}},
  });

  await github.repos.get({repo: 'repo', owner: 'owner'});

  t.is(proxyHandler.args[0][0].url, `localhost:${serverPort}`);
  t.is(proxyHandler.args[0][0].headers.foo, 'bar');
  t.is(serverHandler.args[0][0].headers.accept, 'application/vnd.github.v3+json');

  await promisify(proxy.destroy).bind(proxy)();
  await promisify(server.destroy).bind(server)();
});

test.serial('Do not use a proxy if set to false', async (t) => {
  const server = http.createServer();
  await promisify(server.listen).bind(server)();
  const serverPort = server.address().port;
  serverDestroy(server);

  const serverHandler = spy((request, response) => {
    response.end();
  });
  server.on('request', serverHandler);

  const github = getClient({
    githubToken: 'github_token',
    githubUrl: `http://localhost:${serverPort}`,
    githubApiPathPrefix: '',
    proxy: false,
  });

  await github.repos.get({repo: 'repo', owner: 'owner'});

  t.is(serverHandler.args[0][0].headers.accept, 'application/vnd.github.v3+json');
  t.falsy(serverHandler.args[0][0].headers.via);
  t.falsy(serverHandler.args[0][0].headers['x-forwarded-for']);

  await promisify(server.destroy).bind(server)();
});

test('Use the global throttler for all endpoints', async (t) => {
  const rate = 150;

  const octokit = new Octokit();
  octokit.hook.wrap('request', () => Date.now());
  const github = proxyquire('../lib/get-client', {
    '@octokit/rest': {Octokit: stub().returns(octokit)},
    './definitions/rate-limit': {RATE_LIMITS: {search: 1, core: 1}, GLOBAL_RATE_LIMIT: rate},
  })({githubToken: 'token'});

  /* eslint-disable unicorn/prevent-abbreviations */

  const a = await github.repos.createRelease();
  const b = await github.issues.createComment();
  const c = await github.repos.createRelease();
  const d = await github.issues.createComment();
  const e = await github.search.issuesAndPullRequests();
  const f = await github.search.issuesAndPullRequests();

  // `issues.createComment` should be called `rate` ms after `repos.createRelease`
  t.true(inRange(b - a, rate - 50, rate + 50));
  // `repos.createRelease` should be called `rate` ms after `issues.createComment`
  t.true(inRange(c - b, rate - 50, rate + 50));
  // `issues.createComment` should be called `rate` ms after `repos.createRelease`
  t.true(inRange(d - c, rate - 50, rate + 50));
  // `search.issuesAndPullRequests` should be called `rate` ms after `issues.createComment`
  t.true(inRange(e - d, rate - 50, rate + 50));
  // `search.issuesAndPullRequests` should be called `rate` ms after `search.issuesAndPullRequests`
  t.true(inRange(f - e, rate - 50, rate + 50));

  /* eslint-enable unicorn/prevent-abbreviations */
});

test('Use the same throttler for endpoints in the same rate limit group', async (t) => {
  const searchRate = 300;
  const coreRate = 150;

  const octokit = new Octokit();
  octokit.hook.wrap('request', () => Date.now());
  const github = proxyquire('../lib/get-client', {
    '@octokit/rest': {Octokit: stub().returns(octokit)},
    './definitions/rate-limit': {RATE_LIMITS: {search: searchRate, core: coreRate}, GLOBAL_RATE_LIMIT: 1},
  })({githubToken: 'token'});

  /* eslint-disable unicorn/prevent-abbreviations */

  const a = await github.repos.createRelease();
  const b = await github.issues.createComment();
  const c = await github.repos.createRelease();
  const d = await github.issues.createComment();
  const e = await github.search.issuesAndPullRequests();
  const f = await github.search.issuesAndPullRequests();

  // `issues.createComment` should be called `coreRate` ms after `repos.createRelease`
  t.true(inRange(b - a, coreRate - 50, coreRate + 50));
  // `repos.createRelease` should be called `coreRate` ms after `issues.createComment`
  t.true(inRange(c - b, coreRate - 50, coreRate + 50));
  // `issues.createComment` should be called `coreRate` ms after `repos.createRelease`
  t.true(inRange(d - c, coreRate - 50, coreRate + 50));

  // The first search should be called immediately as it uses a different throttler
  t.true(inRange(e - d, -50, 50));
  // The second search should be called only after `searchRate` ms
  t.true(inRange(f - e, searchRate - 50, searchRate + 50));

  /* eslint-enable unicorn/prevent-abbreviations */
});

test('Use different throttler for read and write endpoints', async (t) => {
  const writeRate = 300;
  const readRate = 150;

  const octokit = new Octokit();
  octokit.hook.wrap('request', () => Date.now());
  const github = proxyquire('../lib/get-client', {
    '@octokit/rest': {Octokit: stub().returns(octokit)},
    './definitions/rate-limit': {RATE_LIMITS: {core: {write: writeRate, read: readRate}}, GLOBAL_RATE_LIMIT: 1},
  })({githubToken: 'token'});

  const a = await github.repos.get();
  const b = await github.repos.get();
  const c = await github.repos.createRelease();
  const d = await github.repos.createRelease();

  // `repos.get` should be called `readRate` ms after `repos.get`
  t.true(inRange(b - a, readRate - 50, readRate + 50));
  // `repos.createRelease` should be called `coreRate` ms after `repos.createRelease`
  t.true(inRange(d - c, writeRate - 50, writeRate + 50));
});

test('Use the same throttler when retrying', async (t) => {
  const coreRate = 200;
  const request = stub().callsFake(async () => {
    const err = new Error();
    err.time = Date.now();
    err.status = 404;
    throw err;
  });
  const octokit = new Octokit();
  octokit.hook.wrap('request', request);
  const github = proxyquire('../lib/get-client', {
    '@octokit/rest': {Octokit: stub().returns(octokit)},
    './definitions/rate-limit': {
      RETRY_CONF: {retries: 3, factor: 1, minTimeout: 1},
      RATE_LIMITS: {core: coreRate},
      GLOBAL_RATE_LIMIT: 1,
    },
  })({githubToken: 'token'});

  await t.throwsAsync(github.repos.createRelease());
  const {time: a} = await t.throwsAsync(request.getCall(0).returnValue);
  const {time: b} = await t.throwsAsync(request.getCall(1).returnValue);
  const {time: c} = await t.throwsAsync(request.getCall(2).returnValue);
  const {time: d} = await t.throwsAsync(request.getCall(3).returnValue);

  // Each retry should be done after `coreRate` ms
  t.true(inRange(b - a, coreRate - 50, coreRate + 50));
  t.true(inRange(c - b, coreRate - 50, coreRate + 50));
  t.true(inRange(d - c, coreRate - 50, coreRate + 50));
});
