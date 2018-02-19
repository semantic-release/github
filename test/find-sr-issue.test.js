import {escape} from 'querystring';
import test from 'ava';
import nock from 'nock';
import {stub} from 'sinon';
import ISSUE_ID from '../lib/definitions/sr-issue-id';
import findSRIssues from '../lib/find-sr-issues';
import getClient from '../lib/get-client';
import {authenticate} from './helpers/mock-github';

/* eslint camelcase: ["error", {properties: "never"}] */

// Save the current process.env
const envBackup = Object.assign({}, process.env);
const githubToken = 'github_token';
const client = getClient({
  githubToken,
  retry: {retries: 3, factor: 2, minTimeout: 1, maxTimeout: 1},
  globalLimit: 1,
  limit: {search: 1, core: 1},
});

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

test.serial('Filter out issues without ID', async t => {
  const owner = 'test_user';
  const repo = 'test_repo';
  const githubToken = 'github_token';
  const title = 'The automated release is failing 🚨';
  const issues = [
    {number: 1, body: 'Issue 1 body', title},
    {number: 2, body: `Issue 2 body\n\n${ISSUE_ID}`, title},
    {number: 3, body: `Issue 3 body\n\n${ISSUE_ID}`, title},
  ];
  const github = authenticate({githubToken})
    .get(
      `/search/issues?q=${escape('in:title')}+${escape(`repo:${owner}/${repo}`)}+${escape('type:issue')}+${escape(
        'state:open'
      )}+${escape(title)}`
    )
    .reply(200, {items: issues});

  const srIssues = await findSRIssues(client, title, owner, repo);

  t.deepEqual(srIssues, [
    {number: 2, body: 'Issue 2 body\n\n<!-- semantic-release:github -->', title},
    {number: 3, body: 'Issue 3 body\n\n<!-- semantic-release:github -->', title},
  ]);

  t.true(github.isDone());
});

test.serial('Return empty array if not issues found', async t => {
  const owner = 'test_user';
  const repo = 'test_repo';
  const githubToken = 'github_token';
  const title = 'The automated release is failing 🚨';
  const issues = [];
  const github = authenticate({githubToken})
    .get(
      `/search/issues?q=${escape('in:title')}+${escape(`repo:${owner}/${repo}`)}+${escape('type:issue')}+${escape(
        'state:open'
      )}+${escape(title)}`
    )
    .reply(200, {items: issues});

  const srIssues = await findSRIssues(client, title, owner, repo);

  t.deepEqual(srIssues, []);

  t.true(github.isDone());
});

test.serial('Return empty array if not issues has matching ID', async t => {
  const owner = 'test_user';
  const repo = 'test_repo';
  const githubToken = 'github_token';
  const title = 'The automated release is failing 🚨';
  const issues = [{number: 1, body: 'Issue 1 body', title}, {number: 2, body: 'Issue 2 body', title}];
  const github = authenticate({githubToken})
    .get(
      `/search/issues?q=${escape('in:title')}+${escape(`repo:${owner}/${repo}`)}+${escape('type:issue')}+${escape(
        'state:open'
      )}+${escape(title)}`
    )
    .reply(200, {items: issues});

  const srIssues = await findSRIssues(client, title, owner, repo);

  t.deepEqual(srIssues, []);
  t.true(github.isDone());
});

test.serial('Retries 4 times', async t => {
  const owner = 'test_user';
  const repo = 'test_repo';
  const title = 'The automated release is failing :rotating_light:';
  const github = authenticate({githubToken})
    .get(
      `/search/issues?q=${escape('in:title')}+${escape(`repo:${owner}/${repo}`)}+${escape('type:issue')}+${escape(
        'state:open'
      )}+${escape(title)}`
    )
    .times(4)
    .reply(422);

  const error = await t.throws(findSRIssues(client, title, owner, repo));

  t.is(error.code, 422);
  t.true(github.isDone());
});

test.serial('Do not retry on 401 error', async t => {
  const owner = 'test_user';
  const repo = 'test_repo';
  const title = 'The automated release is failing :rotating_light:';
  const github = authenticate({githubToken})
    .get(
      `/search/issues?q=${escape('in:title')}+${escape(`repo:${owner}/${repo}`)}+${escape('type:issue')}+${escape(
        'state:open'
      )}+${escape(title)}`
    )
    .reply(401);

  const error = await t.throws(findSRIssues(client, title, owner, repo));

  t.is(error.code, 401);
  t.true(github.isDone());
});
