import {escape} from 'querystring';
import test from 'ava';
import {repeat} from 'lodash';
import nock from 'nock';
import {stub} from 'sinon';
import proxyquire from 'proxyquire';
import ISSUE_ID from '../lib/definitions/sr-issue-id';
import getClient from '../lib/get-client';
import {authenticate} from './helpers/mock-github';

/* eslint camelcase: ["error", {properties: "never"}] */

const success = proxyquire('../lib/success', {
  './get-client': conf =>
    getClient({
      ...conf,
      ...{retry: {retries: 3, factor: 1, minTimeout: 1, maxTimeout: 1}, limit: {search: 1, core: 1}, globalLimit: 1},
    }),
});

// Save the current process.env
const envBackup = Object.assign({}, process.env);

test.beforeEach(t => {
  // Delete env variables in case they are on the machine running the tests
  delete process.env.GH_TOKEN;
  delete process.env.GITHUB_TOKEN;
  delete process.env.GH_URL;
  delete process.env.GITHUB_URL;
  delete process.env.GH_PREFIX;
  delete process.env.GITHUB_PREFIX;
  // Mock logger
  t.context.log = stub();
  t.context.error = stub();
  t.context.logger = {log: t.context.log, error: t.context.error};
});

test.afterEach.always(() => {
  // Restore process.env
  process.env = envBackup;
  // Clear nock
  nock.cleanAll();
});

test.serial('Add comment to PRs associated with release commits and issues closed by PR/commits comments', async t => {
  const owner = 'test_user';
  const repo = 'test_repo';
  process.env.GITHUB_TOKEN = 'github_token';
  const failTitle = 'The automated release is failing 🚨';
  const pluginConfig = {failTitle};
  const prs = [{number: 1, pull_request: {}}, {number: 2, pull_request: {}, body: 'Fixes #3'}];
  const options = {branch: 'master', repositoryUrl: `https://github.com/${owner}/${repo}.git`};
  const commits = [
    {hash: '123', message: 'Commit 1 message\n\n Fix #1'},
    {hash: '456', message: 'Commit 2 message'},
    {hash: '789', message: 'Commit 3 message Closes #4'},
  ];
  const nextRelease = {version: '1.0.0'};
  const releases = [{name: 'GitHub release', url: 'https://github.com/release'}];
  const github = authenticate()
    .get(
      `/search/issues?q=${escape(`repo:${owner}/${repo}`)}+${escape('type:pr')}+${commits
        .map(commit => commit.hash)
        .join('+')}`
    )
    .reply(200, {items: prs})
    .post(`/repos/${owner}/${repo}/issues/1/comments`, {body: /This PR is included/})
    .reply(200, {html_url: 'https://github.com/successcomment-1'})
    .post(`/repos/${owner}/${repo}/issues/2/comments`, {body: /This PR is included/})
    .reply(200, {html_url: 'https://github.com/successcomment-2'})
    .post(`/repos/${owner}/${repo}/issues/3/comments`, {body: /This issue has been resolved/})
    .reply(200, {html_url: 'https://github.com/successcomment-3'})
    .post(`/repos/${owner}/${repo}/issues/4/comments`, {body: /This issue has been resolved/})
    .reply(200, {html_url: 'https://github.com/successcomment-4'})
    .get(
      `/search/issues?q=${escape('in:title')}+${escape(`repo:${owner}/${repo}`)}+${escape('type:issue')}+${escape(
        'state:open'
      )}+${escape(failTitle)}`
    )
    .reply(200, {items: []});

  await success(pluginConfig, {options, commits, nextRelease, releases, logger: t.context.logger});

  t.true(t.context.log.calledWith('Added comment to issue #%d: %s', 1, 'https://github.com/successcomment-1'));
  t.true(t.context.log.calledWith('Added comment to issue #%d: %s', 2, 'https://github.com/successcomment-2'));
  t.true(t.context.log.calledWith('Added comment to issue #%d: %s', 3, 'https://github.com/successcomment-3'));
  t.true(t.context.log.calledWith('Added comment to issue #%d: %s', 4, 'https://github.com/successcomment-4'));
  t.true(github.isDone());
});

test.serial('Make multiple search queries if necessary', async t => {
  const owner = 'test_user';
  const repo = 'test_repo';
  process.env.GITHUB_TOKEN = 'github_token';
  const failTitle = 'The automated release is failing 🚨';
  const pluginConfig = {failTitle};
  const prs = [
    {number: 1, pull_request: {}},
    {number: 2, pull_request: {}},
    {number: 3, pull_request: {}},
    {number: 4, pull_request: {}},
    {number: 5, pull_request: {}},
    {number: 6, pull_request: {}},
  ];
  const options = {branch: 'master', repositoryUrl: `https://github.com/${owner}/${repo}.git`};
  const commits = [
    {hash: repeat('a', 40), message: 'Commit 1 message'},
    {hash: repeat('b', 40), message: 'Commit 2 message'},
    {hash: repeat('c', 40), message: 'Commit 3 message'},
    {hash: repeat('d', 40), message: 'Commit 4 message'},
    {hash: repeat('e', 40), message: 'Commit 5 message'},
    {hash: repeat('f', 40), message: 'Commit 6 message'},
  ];
  const nextRelease = {version: '1.0.0'};
  const releases = [{name: 'GitHub release', url: 'https://github.com/release'}];
  const github = authenticate()
    .get(
      `/search/issues?q=${escape(`repo:${owner}/${repo}`)}+${escape('type:pr')}+${commits[0].hash}+${commits[1].hash}+${
        commits[2].hash
      }+${commits[3].hash}+${commits[4].hash}`
    )
    .reply(200, {items: [prs[0], prs[1], prs[2], prs[3], prs[4]]})
    .get(`/search/issues?q=${escape(`repo:${owner}/${repo}`)}+${escape('type:pr')}+${commits[5].hash}`)
    .reply(200, {items: [prs[5]]})
    .post(`/repos/${owner}/${repo}/issues/1/comments`, {body: /This PR is included/})
    .reply(200, {html_url: 'https://github.com/successcomment-1'})
    .post(`/repos/${owner}/${repo}/issues/2/comments`, {body: /This PR is included/})
    .reply(200, {html_url: 'https://github.com/successcomment-2'})
    .post(`/repos/${owner}/${repo}/issues/3/comments`, {body: /This PR is included/})
    .reply(200, {html_url: 'https://github.com/successcomment-3'})
    .post(`/repos/${owner}/${repo}/issues/4/comments`, {body: /This PR is included/})
    .reply(200, {html_url: 'https://github.com/successcomment-4'})
    .post(`/repos/${owner}/${repo}/issues/5/comments`, {body: /This PR is included/})
    .reply(200, {html_url: 'https://github.com/successcomment-5'})
    .post(`/repos/${owner}/${repo}/issues/6/comments`, {body: /This PR is included/})
    .reply(200, {html_url: 'https://github.com/successcomment-6'})
    .get(
      `/search/issues?q=${escape('in:title')}+${escape(`repo:${owner}/${repo}`)}+${escape('type:issue')}+${escape(
        'state:open'
      )}+${escape(failTitle)}`
    )
    .reply(200, {items: []});

  await success(pluginConfig, {options, commits, nextRelease, releases, logger: t.context.logger});

  t.true(t.context.log.calledWith('Added comment to issue #%d: %s', 1, 'https://github.com/successcomment-1'));
  t.true(t.context.log.calledWith('Added comment to issue #%d: %s', 2, 'https://github.com/successcomment-2'));
  t.true(t.context.log.calledWith('Added comment to issue #%d: %s', 3, 'https://github.com/successcomment-3'));
  t.true(t.context.log.calledWith('Added comment to issue #%d: %s', 4, 'https://github.com/successcomment-4'));
  t.true(t.context.log.calledWith('Added comment to issue #%d: %s', 5, 'https://github.com/successcomment-5'));
  t.true(t.context.log.calledWith('Added comment to issue #%d: %s', 6, 'https://github.com/successcomment-6'));
  t.true(github.isDone());
});

test.serial('Do not add comment if no PR is associated with release commits', async t => {
  const owner = 'test_user';
  const repo = 'test_repo';
  process.env.GITHUB_TOKEN = 'github_token';
  const failTitle = 'The automated release is failing 🚨';
  const pluginConfig = {failTitle};
  const options = {branch: 'master', repositoryUrl: `https://github.com/${owner}/${repo}.git`};
  const commits = [{hash: '123', message: 'Commit 1 message'}];
  const nextRelease = {version: '1.0.0'};
  const releases = [{name: 'GitHub release', url: 'https://github.com/release'}];
  const github = authenticate()
    .get(
      `/search/issues?q=${escape(`repo:${owner}/${repo}`)}+${escape('type:pr')}+${commits
        .map(commit => commit.hash)
        .join('+')}`
    )
    .reply(200, {items: []})
    .get(
      `/search/issues?q=${escape('in:title')}+${escape(`repo:${owner}/${repo}`)}+${escape('type:issue')}+${escape(
        'state:open'
      )}+${escape(failTitle)}`
    )
    .reply(200, {items: []});

  await success(pluginConfig, {options, commits, nextRelease, releases, logger: t.context.logger});

  t.true(github.isDone());
});

test.serial('Add custom comment', async t => {
  const owner = 'test_user';
  const repo = 'test_repo';
  process.env.GITHUB_TOKEN = 'github_token';
  const failTitle = 'The automated release is failing 🚨';
  const pluginConfig = {
    successComment: `last release: \${lastRelease.version} nextRelease: \${nextRelease.version} branch: \${branch} commits: \${commits.length} releases: \${releases.length} PR attribute: \${issue.prop}`,
    failTitle,
  };
  const prs = [{number: 1, prop: 'PR prop', pull_request: {}}];
  const options = {branch: 'master', repositoryUrl: `https://github.com/${owner}/${repo}.git`};
  const lastRelease = {version: '1.0.0'};
  const commits = [{hash: '123', message: 'Commit 1 message'}];
  const nextRelease = {version: '2.0.0'};
  const releases = [{name: 'GitHub release', url: 'https://github.com/release'}];
  const github = authenticate()
    .get(
      `/search/issues?q=${escape(`repo:${owner}/${repo}`)}+${escape('type:pr')}+${commits
        .map(commit => commit.hash)
        .join('+')}`
    )
    .reply(200, {items: prs})
    .post(`/repos/${owner}/${repo}/issues/1/comments`, {
      body: /last release: 1\.0\.0 nextRelease: 2\.0\.0 branch: master commits: 1 releases: 1 PR attribute: PR prop/,
    })
    .reply(200, {html_url: 'https://github.com/successcomment-1'})
    .get(
      `/search/issues?q=${escape('in:title')}+${escape(`repo:${owner}/${repo}`)}+${escape('type:issue')}+${escape(
        'state:open'
      )}+${escape(failTitle)}`
    )
    .reply(200, {items: []});

  await success(pluginConfig, {options, lastRelease, commits, nextRelease, releases, logger: t.context.logger});

  t.true(github.isDone());
});

test.serial('Ignore errors when adding comments and closing issues', async t => {
  const owner = 'test_user';
  const repo = 'test_repo';
  process.env.GITHUB_TOKEN = 'github_token';
  const failTitle = 'The automated release is failing 🚨';
  const pluginConfig = {failTitle};
  const issues = [
    {number: 1, body: 'Issue 1 body', title: failTitle},
    {number: 2, body: `Issue 2 body\n\n${ISSUE_ID}`, title: failTitle},
    {number: 3, body: `Issue 3 body\n\n${ISSUE_ID}`, title: failTitle},
  ];
  const prs = [{number: 1, pull_request: {}}, {number: 2, pull_request: {}}];
  const options = {branch: 'master', repositoryUrl: `https://github.com/${owner}/${repo}.git`};
  const commits = [{hash: '123', message: 'Commit 1 message'}];
  const nextRelease = {version: '1.0.0'};
  const releases = [{name: 'GitHub release', url: 'https://github.com/release'}];
  const github = authenticate()
    .get(
      `/search/issues?q=${escape(`repo:${owner}/${repo}`)}+${escape('type:pr')}+${commits
        .map(commit => commit.hash)
        .join('+')}`
    )
    .reply(200, {items: prs})
    .post(`/repos/${owner}/${repo}/issues/1/comments`, {body: /This PR is included/})
    .times(4)
    .reply(404, {})
    .post(`/repos/${owner}/${repo}/issues/2/comments`, {body: /This PR is included/})
    .reply(200, {html_url: 'https://github.com/successcomment-2'})
    .get(
      `/search/issues?q=${escape('in:title')}+${escape(`repo:${owner}/${repo}`)}+${escape('type:issue')}+${escape(
        'state:open'
      )}+${escape(failTitle)}`
    )
    .reply(200, {items: issues})
    .patch(`/repos/${owner}/${repo}/issues/2`, {state: 'closed'})
    .times(4)
    .reply(500)
    .patch(`/repos/${owner}/${repo}/issues/3`, {state: 'closed'})
    .reply(200, {html_url: 'https://github.com/issues/3'});

  const [error1, error2] = await t.throws(
    success(pluginConfig, {options, commits, nextRelease, releases, logger: t.context.logger})
  );

  t.is(error1.code, 404);
  t.is(error2.code, 500);
  t.true(t.context.error.calledWith('Failed to add a comment to the issue #%d.', 1));
  t.true(t.context.error.calledWith('Failed to close the issue #%d.', 2));
  t.true(t.context.log.calledWith('Added comment to issue #%d: %s', 2, 'https://github.com/successcomment-2'));
  t.true(t.context.log.calledWith('Closed issue #%d: %s.', 3, 'https://github.com/issues/3'));
  t.true(github.isDone());
});

test.serial('Close open issues when a release is successful', async t => {
  const owner = 'test_user';
  const repo = 'test_repo';
  process.env.GITHUB_TOKEN = 'github_token';
  const failTitle = 'The automated release is failing 🚨';
  const pluginConfig = {failTitle};
  const issues = [
    {number: 1, body: 'Issue 1 body', title: failTitle},
    {number: 2, body: `Issue 2 body\n\n${ISSUE_ID}`, title: failTitle},
    {number: 3, body: `Issue 3 body\n\n${ISSUE_ID}`, title: failTitle},
  ];
  const options = {branch: 'master', repositoryUrl: `https://github.com/${owner}/${repo}.git`};
  const commits = [{hash: '123', message: 'Commit 1 message'}];
  const nextRelease = {version: '1.0.0'};
  const releases = [{name: 'GitHub release', url: 'https://github.com/release'}];
  const github = authenticate()
    .get(
      `/search/issues?q=${escape(`repo:${owner}/${repo}`)}+${escape('type:pr')}+${commits
        .map(commit => commit.hash)
        .join('+')}`
    )
    .reply(200, {items: []})
    .get(
      `/search/issues?q=${escape('in:title')}+${escape(`repo:${owner}/${repo}`)}+${escape('type:issue')}+${escape(
        'state:open'
      )}+${escape(failTitle)}`
    )
    .reply(200, {items: issues})
    .patch(`/repos/${owner}/${repo}/issues/2`, {state: 'closed'})
    .reply(200, {html_url: 'https://github.com/issues/2'})
    .patch(`/repos/${owner}/${repo}/issues/3`, {state: 'closed'})
    .reply(200, {html_url: 'https://github.com/issues/3'});

  await success(pluginConfig, {options, commits, nextRelease, releases, logger: t.context.logger});
  t.true(t.context.log.calledWith('Closed issue #%d: %s.', 2, 'https://github.com/issues/2'));
  t.true(t.context.log.calledWith('Closed issue #%d: %s.', 3, 'https://github.com/issues/3'));
  t.true(github.isDone());
});
