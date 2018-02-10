import {escape} from 'querystring';
import test from 'ava';
import nock from 'nock';
import {stub} from 'sinon';
import ISSUE_ID from '../lib/definitions/sr-issue-id';
import success from '../lib/success';
import {authenticate} from './helpers/mock-github';

/* eslint camelcase: ["error", {properties: "never"}] */

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
  const failTitle = 'The automated release is failing :rotating_light:';
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
      `/search/issues?q=${commits.map(commit => commit.hash).join('+')}+${escape(`repo:${owner}/${repo}`)}+${escape(
        'type:pr'
      )}`
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
      `/search/issues?q=${escape(`title:${failTitle}`)}+${escape(`repo:${owner}/${repo}`)}+${escape(
        'type:issue'
      )}+${escape('state:open')}`
    )
    .reply(200, {items: []});

  await success(pluginConfig, {options, commits, nextRelease, releases, logger: t.context.logger});

  t.deepEqual(t.context.log.args[0], ['Added comment to issue #%d: %s', 1, 'https://github.com/successcomment-1']);
  t.deepEqual(t.context.log.args[1], ['Added comment to issue #%d: %s', 2, 'https://github.com/successcomment-2']);
  t.deepEqual(t.context.log.args[2], ['Added comment to issue #%d: %s', 3, 'https://github.com/successcomment-3']);
  t.deepEqual(t.context.log.args[3], ['Added comment to issue #%d: %s', 4, 'https://github.com/successcomment-4']);
  t.true(github.isDone());
});

test.serial('Do not add comment if no PR is associated with release commits', async t => {
  const owner = 'test_user';
  const repo = 'test_repo';
  process.env.GITHUB_TOKEN = 'github_token';
  const failTitle = 'The automated release is failing :rotating_light:';
  const pluginConfig = {failTitle};
  const options = {branch: 'master', repositoryUrl: `https://github.com/${owner}/${repo}.git`};
  const commits = [{hash: '123', message: 'Commit 1 message'}];
  const nextRelease = {version: '1.0.0'};
  const releases = [{name: 'GitHub release', url: 'https://github.com/release'}];
  const github = authenticate()
    .get(
      `/search/issues?q=${commits.map(commit => commit.hash).join('+')}+${escape(`repo:${owner}/${repo}`)}+${escape(
        'type:pr'
      )}`
    )
    .reply(200, {items: []})
    .get(
      `/search/issues?q=${escape(`title:${failTitle}`)}+${escape(`repo:${owner}/${repo}`)}+${escape(
        'type:issue'
      )}+${escape('state:open')}`
    )
    .reply(200, {items: []});

  await success(pluginConfig, {options, commits, nextRelease, releases, logger: t.context.logger});

  t.true(github.isDone());
});

test.serial('Add custom comment', async t => {
  const owner = 'test_user';
  const repo = 'test_repo';
  process.env.GITHUB_TOKEN = 'github_token';
  const failTitle = 'The automated release is failing :rotating_light:';
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
      `/search/issues?q=${commits.map(commit => commit.hash).join('+')}+${escape(`repo:${owner}/${repo}`)}+${escape(
        'type:pr'
      )}`
    )
    .reply(200, {items: prs})
    .post(`/repos/${owner}/${repo}/issues/1/comments`, {
      body: /last release: 1\.0\.0 nextRelease: 2\.0\.0 branch: master commits: 1 releases: 1 PR attribute: PR prop/,
    })
    .reply(200, {html_url: 'https://github.com/successcomment-1'})
    .get(
      `/search/issues?q=${escape(`title:${failTitle}`)}+${escape(`repo:${owner}/${repo}`)}+${escape(
        'type:issue'
      )}+${escape('state:open')}`
    )
    .reply(200, {items: []});

  await success(pluginConfig, {options, lastRelease, commits, nextRelease, releases, logger: t.context.logger});

  t.true(github.isDone());
});

test.serial('Ignore errors when adding comments and closing issues', async t => {
  const owner = 'test_user';
  const repo = 'test_repo';
  process.env.GITHUB_TOKEN = 'github_token';
  const failTitle = 'The automated release is failing :rotating_light:';
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
      `/search/issues?q=${commits.map(commit => commit.hash).join('+')}+${escape(`repo:${owner}/${repo}`)}+${escape(
        'type:pr'
      )}`
    )
    .reply(200, {items: prs})
    .post(`/repos/${owner}/${repo}/issues/1/comments`, {body: /This PR is included/})
    .reply(404, {})
    .post(`/repos/${owner}/${repo}/issues/2/comments`, {body: /This PR is included/})
    .reply(200, {html_url: 'https://github.com/successcomment-2'})
    .get(
      `/search/issues?q=${escape(`title:${failTitle}`)}+${escape(`repo:${owner}/${repo}`)}+${escape(
        'type:issue'
      )}+${escape('state:open')}`
    )
    .reply(200, {items: issues})
    .patch(`/repos/${owner}/${repo}/issues/2`, {state: 'closed'})
    .reply(500)
    .patch(`/repos/${owner}/${repo}/issues/3`, {state: 'closed'})
    .reply(200, {html_url: 'https://github.com/issues/3'});

  const [error1, error2] = await t.throws(
    success(pluginConfig, {options, commits, nextRelease, releases, logger: t.context.logger})
  );

  t.is(error1.code, 404);
  t.is(error2.code, 500);
  t.deepEqual(t.context.error.args[0], ['Failed to add a comment to the issue #%d.', 1]);
  t.deepEqual(t.context.error.args[1], ['Failed to close the issue #%d.', 2]);
  t.deepEqual(t.context.log.args[0], ['Added comment to issue #%d: %s', 2, 'https://github.com/successcomment-2']);
  t.deepEqual(t.context.log.args[1], ['Closed issue #%d: %s.', 3, 'https://github.com/issues/3']);
  t.true(github.isDone());
});

test.serial('Close open issues when a release is successful', async t => {
  const owner = 'test_user';
  const repo = 'test_repo';
  process.env.GITHUB_TOKEN = 'github_token';
  const failTitle = 'The automated release is failing :rotating_light:';
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
      `/search/issues?q=${commits.map(commit => commit.hash).join('+')}+${escape(`repo:${owner}/${repo}`)}+${escape(
        'type:pr'
      )}`
    )
    .reply(200, {items: []})
    .get(
      `/search/issues?q=${escape(`title:${failTitle}`)}+${escape(`repo:${owner}/${repo}`)}+${escape(
        'type:issue'
      )}+${escape('state:open')}`
    )
    .reply(200, {items: issues})
    .patch(`/repos/${owner}/${repo}/issues/2`, {state: 'closed'})
    .reply(200, {html_url: 'https://github.com/issues/2'})
    .patch(`/repos/${owner}/${repo}/issues/3`, {state: 'closed'})
    .reply(200, {html_url: 'https://github.com/issues/3'});

  await success(pluginConfig, {options, commits, nextRelease, releases, logger: t.context.logger});

  t.deepEqual(t.context.log.args[0], ['Closed issue #%d: %s.', 2, 'https://github.com/issues/2']);
  t.deepEqual(t.context.log.args[1], ['Closed issue #%d: %s.', 3, 'https://github.com/issues/3']);
  t.true(github.isDone());
});
