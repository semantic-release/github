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