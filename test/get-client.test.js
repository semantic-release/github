import test from 'ava';
import {isFunction, isPlainObject, inRange} from 'lodash';
import {stub} from 'sinon';
import proxyquire from 'proxyquire';
import getClient from '../lib/get-client';

test('Wrap Octokit in a proxy', t => {
  const github = getClient({githubToken: 'github_token'});

  t.true(Object.prototype.hasOwnProperty.call(github, 'repos'));
  t.true(isPlainObject(github.repos));
  t.true(Object.prototype.hasOwnProperty.call(github.repos, 'createRelease'));
  t.true(isFunction(github.repos.createRelease));

  t.true(Object.prototype.hasOwnProperty.call(github, 'search'));
  t.true(isPlainObject(github.search));
  t.true(Object.prototype.hasOwnProperty.call(github.search, 'issues'));
  t.true(isFunction(github.search.issues));

  t.falsy(github.unknown);
});

test('Use the same throttler for endpoints in the same rate limit group', async t => {
  const createRelease = stub().callsFake(async () => Date.now());
  const createComment = stub().callsFake(async () => Date.now());
  const issues = stub().callsFake(async () => Date.now());
  const octokit = {repos: {createRelease}, issues: {createComment}, search: {issues}, authenticate: stub()};
  const searchRate = 300;
  const coreRate = 150;
  const github = proxyquire('../lib/get-client', {'@octokit/rest': stub().returns(octokit)})({
    limit: {search: [1, searchRate], core: [1, coreRate]},
  });

  const a = await github.repos.createRelease();
  const b = await github.issues.createComment();
  const c = await github.repos.createRelease();
  const d = await github.issues.createComment();
  const e = await github.search.issues();
  const f = await github.search.issues();

  // `issues.createComment` should be called `coreRate` ms after `repos.createRelease`
  t.true(inRange(b - a, coreRate - 50, coreRate + 50));
  // `repos.createRelease` should be called `coreRate` ms after `issues.createComment`
  t.true(inRange(c - b, coreRate - 50, coreRate + 50));
  // `issues.createComment` should be called `coreRate` ms after `repos.createRelease`
  t.true(inRange(d - c, coreRate - 50, coreRate + 50));

  // The first search should be called immediatly as it uses a different throttler
  t.true(inRange(e - d, -50, 50));
  // The second search should be called only after `searchRate` ms
  t.true(inRange(f - e, searchRate - 50, searchRate + 50));
});

test('Use the same throttler when retrying', async t => {
  const createRelease = stub().callsFake(async () => {
    const err = new Error();
    err.time = Date.now();
    err.code = 404;
    throw err;
  });

  const octokit = {repos: {createRelease}, authenticate: stub()};
  const coreRate = 200;
  const github = proxyquire('../lib/get-client', {'@octokit/rest': stub().returns(octokit)})({
    limit: {core: [1, coreRate]},
    retry: {retries: 3, factor: 1, minTimeout: 1},
  });

  await t.throws(github.repos.createRelease());
  t.is(createRelease.callCount, 4);

  const {time: a} = await t.throws(createRelease.getCall(0).returnValue);
  const {time: b} = await t.throws(createRelease.getCall(1).returnValue);
  const {time: c} = await t.throws(createRelease.getCall(2).returnValue);
  const {time: d} = await t.throws(createRelease.getCall(3).returnValue);

  // Each retry should be done after `coreRate` ms
  t.true(inRange(b - a, coreRate - 50, coreRate + 50));
  t.true(inRange(c - b, coreRate - 50, coreRate + 50));
  t.true(inRange(d - c, coreRate - 50, coreRate + 50));
});
