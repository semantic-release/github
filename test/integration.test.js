import {escape} from 'querystring';
import test from 'ava';
import {stat} from 'fs-extra';
import nock from 'nock';
import {stub} from 'sinon';
import clearModule from 'clear-module';
import SemanticReleaseError from '@semantic-release/error';
import {authenticate, upload} from './helpers/mock-github';

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
  // Clear npm cache to refresh the module state
  clearModule('..');
  t.context.m = require('..');
  // Stub the logger
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

test.serial('Verify GitHub auth', async t => {
  process.env.GITHUB_TOKEN = 'github_token';
  const owner = 'test_user';
  const repo = 'test_repo';
  const options = {repositoryUrl: `git+https://othertesturl.com/${owner}/${repo}.git`};
  const github = authenticate()
    .get(`/repos/${owner}/${repo}`)
    .reply(200, {permissions: {push: true}});

  await t.notThrows(t.context.m.verifyConditions({}, {options, logger: t.context.logger}));

  t.true(github.isDone());
});

test.serial('Verify GitHub auth with publish options', async t => {
  process.env.GITHUB_TOKEN = 'github_token';
  const owner = 'test_user';
  const repo = 'test_repo';
  const options = {
    publish: {path: '@semantic-release/github'},
    repositoryUrl: `git+https://othertesturl.com/${owner}/${repo}.git`,
  };
  const github = authenticate()
    .get(`/repos/${owner}/${repo}`)
    .reply(200, {permissions: {push: true}});

  await t.notThrows(t.context.m.verifyConditions({}, {options, logger: t.context.logger}));

  t.true(github.isDone());
});

test.serial('Verify GitHub auth and assets config', async t => {
  process.env.GH_TOKEN = 'github_token';
  const owner = 'test_user';
  const repo = 'test_repo';
  const assets = [
    {path: 'lib/file.js'},
    'file.js',
    ['dist/**'],
    ['dist/**', '!dist/*.js'],
    {path: ['dist/**', '!dist/*.js']},
  ];
  const options = {
    publish: [{path: '@semantic-release/npm'}],
    repositoryUrl: `git+https://othertesturl.com/${owner}/${repo}.git`,
  };
  const github = authenticate()
    .get(`/repos/${owner}/${repo}`)
    .reply(200, {permissions: {push: true}});

  await t.notThrows(t.context.m.verifyConditions({assets}, {options, logger: t.context.logger}));

  t.true(github.isDone());
});

test.serial('Throw SemanticReleaseError if invalid config', async t => {
  const assets = [{wrongProperty: 'lib/file.js'}];
  const successComment = 42;
  const failComment = 42;
  const failTitle = 42;
  const labels = 42;
  const assignees = 42;
  const options = {
    publish: [
      {path: '@semantic-release/npm'},
      {path: '@semantic-release/github', assets, successComment, failComment, failTitle, labels, assignees},
    ],
    repositoryUrl: 'invalid_url',
  };

  const errors = [...(await t.throws(t.context.m.verifyConditions({}, {options, logger: t.context.logger})))];

  t.is(errors[0].name, 'SemanticReleaseError');
  t.is(errors[0].code, 'EINVALIDASSETS');
  t.is(errors[1].name, 'SemanticReleaseError');
  t.is(errors[1].code, 'EINVALIDSUCCESSCOMMENT');
  t.is(errors[2].name, 'SemanticReleaseError');
  t.is(errors[2].code, 'EINVALIDFAILTITLE');
  t.is(errors[3].name, 'SemanticReleaseError');
  t.is(errors[3].code, 'EINVALIDFAILCOMMENT');
  t.is(errors[4].name, 'SemanticReleaseError');
  t.is(errors[4].code, 'EINVALIDLABELS');
  t.is(errors[5].name, 'SemanticReleaseError');
  t.is(errors[5].code, 'EINVALIDASSIGNEES');
  t.is(errors[6].name, 'SemanticReleaseError');
  t.is(errors[6].code, 'EINVALIDGITHUBURL');
  t.is(errors[7].name, 'SemanticReleaseError');
  t.is(errors[7].code, 'ENOGHTOKEN');
});

test.serial('Publish a release with an array of assets', async t => {
  const owner = 'test_user';
  const repo = 'test_repo';
  process.env.GH_TOKEN = 'github_token';
  const assets = [
    'test/fixtures/upload.txt',
    {path: ['test/fixtures/*.txt', '!**/*_other.txt'], name: 'upload_file_name.txt'},
    {path: ['test/fixtures/*.txt'], name: 'other_file.txt', label: 'Other File'},
  ];
  const nextRelease = {version: '1.0.0', gitHead: '123', gitTag: 'v1.0.0', notes: 'Test release note body'};
  const options = {branch: 'master', repositoryUrl: `https://github.com/${owner}/${repo}.git`};
  const releaseUrl = `https://github.com/${owner}/${repo}/releases/${nextRelease.version}`;
  const assetUrl = `https://github.com/${owner}/${repo}/releases/download/${nextRelease.version}/upload.txt`;
  const otherAssetUrl = `https://github.com/${owner}/${repo}/releases/download/${nextRelease.version}/other_file.txt`;
  const releaseId = 1;
  const uploadUri = `/api/uploads/repos/${owner}/${repo}/releases/${releaseId}/assets`;
  const uploadUrl = `https://github.com${uploadUri}{?name,label}`;
  const github = authenticate()
    .get(`/repos/${owner}/${repo}`)
    .reply(200, {permissions: {push: true}})
    .post(`/repos/${owner}/${repo}/releases`, {
      tag_name: nextRelease.gitTag,
      target_commitish: options.branch,
      name: nextRelease.gitTag,
      body: nextRelease.notes,
    })
    .reply(200, {upload_url: uploadUrl, html_url: releaseUrl});
  const githubUpload1 = upload({
    uploadUrl: 'https://github.com',
    contentLength: (await stat('test/fixtures/upload.txt')).size,
  })
    .post(`${uploadUri}?name=${escape('upload_file_name.txt')}`)
    .reply(200, {browser_download_url: assetUrl});
  const githubUpload2 = upload({
    uploadUrl: 'https://github.com',
    contentLength: (await stat('test/fixtures/upload_other.txt')).size,
  })
    .post(`${uploadUri}?name=${escape('upload_other.txt')}&label=${escape('Other File')}`)
    .reply(200, {browser_download_url: otherAssetUrl});

  const result = await t.context.m.publish({assets}, {nextRelease, options, logger: t.context.logger});

  t.is(result.url, releaseUrl);
  t.deepEqual(t.context.log.args[0], ['Verify GitHub authentication']);
  t.deepEqual(t.context.log.args[1], ['Published GitHub release: %s', releaseUrl]);
  t.true(t.context.log.calledWith('Published file %s', otherAssetUrl));
  t.true(t.context.log.calledWith('Published file %s', assetUrl));
  t.true(github.isDone());
  t.true(githubUpload1.isDone());
  t.true(githubUpload2.isDone());
});

test.serial('Comment on PR included in the releases', async t => {
  const owner = 'test_user';
  const repo = 'test_repo';
  process.env.GH_TOKEN = 'github_token';
  const failTitle = 'The automated release is failing 🚨';
  const prs = [{number: 1, pull_request: {}}];
  const options = {branch: 'master', repositoryUrl: `https://github.com/${owner}/${repo}.git`};
  const commits = [{hash: '123', message: 'Commit 1 message'}];
  const nextRelease = {version: '1.0.0'};
  const releases = [{name: 'GitHub release', url: 'https://github.com/release'}];
  const github = authenticate()
    .get(`/repos/${owner}/${repo}`)
    .reply(200, {permissions: {push: true}})
    .get(
      `/search/issues?q=${escape(`repo:${owner}/${repo}`)}+${escape('type:pr')}+${escape('is:merged')}+${commits
        .map(commit => commit.hash)
        .join('+')}`
    )
    .reply(200, {items: prs})
    .get(`/repos/${owner}/${repo}/pulls/1/commits`)
    .reply(200, [{sha: commits[0].hash}])
    .get(`/repos/${owner}/${repo}/issues/1`)
    .reply(200, {state: 'closed'})
    .post(`/repos/${owner}/${repo}/issues/1/comments`, {body: /This PR is included/})
    .reply(200, {html_url: 'https://github.com/successcomment-1'})
    .get(
      `/search/issues?q=${escape('in:title')}+${escape(`repo:${owner}/${repo}`)}+${escape('type:issue')}+${escape(
        'state:open'
      )}+${escape(failTitle)}`
    )
    .reply(200, {items: []});

  await t.context.m.success({failTitle}, {options, commits, nextRelease, releases, logger: t.context.logger});

  t.deepEqual(t.context.log.args[0], ['Verify GitHub authentication']);
  t.true(t.context.log.calledWith('Added comment to issue #%d: %s', 1, 'https://github.com/successcomment-1'));
  t.true(github.isDone());
});

test.serial('Open a new issue with the list of errors', async t => {
  const owner = 'test_user';
  const repo = 'test_repo';
  process.env.GITHUB_TOKEN = 'github_token';
  const failTitle = 'The automated release is failing 🚨';
  const options = {branch: 'master', repositoryUrl: `https://github.com/${owner}/${repo}.git`};
  const errors = [
    new SemanticReleaseError('Error message 1', 'ERR1', 'Error 1 details'),
    new SemanticReleaseError('Error message 2', 'ERR2', 'Error 2 details'),
    new SemanticReleaseError('Error message 3', 'ERR3', 'Error 3 details'),
  ];
  const github = authenticate()
    .get(`/repos/${owner}/${repo}`)
    .reply(200, {permissions: {push: true}})
    .get(
      `/search/issues?q=${escape('in:title')}+${escape(`repo:${owner}/${repo}`)}+${escape('type:issue')}+${escape(
        'state:open'
      )}+${escape(failTitle)}`
    )
    .reply(200, {items: []})
    .post(`/repos/${owner}/${repo}/issues`, {
      title: failTitle,
      body: /---\n\n### Error message 1\n\nError 1 details\n\n---\n\n### Error message 2\n\nError 2 details\n\n---\n\n### Error message 3\n\nError 3 details\n\n---/,
      labels: ['semantic-release'],
    })
    .reply(200, {html_url: 'https://github.com/issues/1', number: 1});

  await t.context.m.fail({failTitle}, {options, errors, logger: t.context.logger});

  t.deepEqual(t.context.log.args[0], ['Verify GitHub authentication']);
  t.true(t.context.log.calledWith('Created issue #%d: %s.', 1, 'https://github.com/issues/1'));
  t.true(github.isDone());
});

test.serial('Verify, release and notify success', async t => {
  process.env.GH_TOKEN = 'github_token';
  const owner = 'test_user';
  const repo = 'test_repo';
  const assets = [
    'test/fixtures/upload.txt',
    {path: 'test/fixtures/upload_other.txt', name: 'other_file.txt', label: 'Other File'},
  ];
  const failTitle = 'The automated release is failing 🚨';
  const options = {
    publish: [{path: '@semantic-release/npm'}, {path: '@semantic-release/github', assets}],
    branch: 'master',
    repositoryUrl: `https://github.com/${owner}/${repo}.git`,
  };
  const nextRelease = {version: '1.0.0', gitHead: '123', gitTag: 'v1.0.0', notes: 'Test release note body'};
  const releaseUrl = `https://github.com/${owner}/${repo}/releases/${nextRelease.version}`;
  const assetUrl = `https://github.com/${owner}/${repo}/releases/download/${nextRelease.version}/upload.txt`;
  const otherAssetUrl = `https://github.com/${owner}/${repo}/releases/download/${nextRelease.version}/other_file.txt`;
  const releaseId = 1;
  const uploadUri = `/api/uploads/repos/${owner}/${repo}/releases/${releaseId}/assets`;
  const uploadUrl = `https://github.com${uploadUri}{?name,label}`;
  const prs = [{number: 1, pull_request: {}}];
  const commits = [{hash: '123', message: 'Commit 1 message'}];
  const github = authenticate()
    .get(`/repos/${owner}/${repo}`)
    .reply(200, {permissions: {push: true}})
    .post(`/repos/${owner}/${repo}/releases`, {
      tag_name: nextRelease.gitTag,
      target_commitish: options.branch,
      name: nextRelease.gitTag,
      body: nextRelease.notes,
    })
    .reply(200, {upload_url: uploadUrl, html_url: releaseUrl})
    .get(
      `/search/issues?q=${escape(`repo:${owner}/${repo}`)}+${escape('type:pr')}+${escape('is:merged')}+${commits
        .map(commit => commit.hash)
        .join('+')}`
    )
    .reply(200, {items: prs})
    .get(`/repos/${owner}/${repo}/pulls/1/commits`)
    .reply(200, [{sha: commits[0].hash}])
    .get(`/repos/${owner}/${repo}/issues/1`)
    .reply(200, {state: 'closed'})
    .post(`/repos/${owner}/${repo}/issues/1/comments`, {body: /This PR is included/})
    .reply(200, {html_url: 'https://github.com/successcomment-1'})
    .get(
      `/search/issues?q=${escape('in:title')}+${escape(`repo:${owner}/${repo}`)}+${escape('type:issue')}+${escape(
        'state:open'
      )}+${escape(failTitle)}`
    )
    .reply(200, {items: []});
  const githubUpload1 = upload({
    uploadUrl: 'https://github.com',
    contentLength: (await stat('test/fixtures/upload.txt')).size,
  })
    .post(`${uploadUri}?name=${escape('upload.txt')}`)
    .reply(200, {browser_download_url: assetUrl});
  const githubUpload2 = upload({
    uploadUrl: 'https://github.com',
    contentLength: (await stat('test/fixtures/upload_other.txt')).size,
  })
    .post(`${uploadUri}?name=${escape('other_file.txt')}&label=${escape('Other File')}`)
    .reply(200, {browser_download_url: otherAssetUrl});

  await t.notThrows(t.context.m.verifyConditions({}, {options, logger: t.context.logger}));
  await t.context.m.publish({assets}, {nextRelease, options, logger: t.context.logger});
  await t.context.m.success(
    {assets, failTitle},
    {nextRelease, options, commits, releases: [], logger: t.context.logger}
  );

  t.deepEqual(t.context.log.args[0], ['Verify GitHub authentication']);
  t.deepEqual(t.context.log.args[1], ['Published GitHub release: %s', releaseUrl]);
  t.true(t.context.log.calledWith('Published file %s', otherAssetUrl));
  t.true(t.context.log.calledWith('Published file %s', assetUrl));
  t.true(github.isDone());
  t.true(githubUpload1.isDone());
  t.true(githubUpload2.isDone());
});

test.serial('Verify and notify failure', async t => {
  const owner = 'test_user';
  const repo = 'test_repo';
  process.env.GITHUB_TOKEN = 'github_token';
  const failTitle = 'The automated release is failing 🚨';
  const options = {branch: 'master', repositoryUrl: `https://github.com/${owner}/${repo}.git`};
  const errors = [
    new SemanticReleaseError('Error message 1', 'ERR1', 'Error 1 details'),
    new SemanticReleaseError('Error message 2', 'ERR2', 'Error 2 details'),
    new SemanticReleaseError('Error message 3', 'ERR3', 'Error 3 details'),
  ];
  const github = authenticate()
    .get(`/repos/${owner}/${repo}`)
    .reply(200, {permissions: {push: true}})
    .get(
      `/search/issues?q=${escape('in:title')}+${escape(`repo:${owner}/${repo}`)}+${escape('type:issue')}+${escape(
        'state:open'
      )}+${escape(failTitle)}`
    )
    .reply(200, {items: []})
    .post(`/repos/${owner}/${repo}/issues`, {
      title: failTitle,
      body: /---\n\n### Error message 1\n\nError 1 details\n\n---\n\n### Error message 2\n\nError 2 details\n\n---\n\n### Error message 3\n\nError 3 details\n\n---/,
      labels: ['semantic-release'],
    })
    .reply(200, {html_url: 'https://github.com/issues/1', number: 1});

  await t.notThrows(t.context.m.verifyConditions({}, {options, logger: t.context.logger}));
  await t.context.m.fail({failTitle}, {options, errors, logger: t.context.logger});

  t.deepEqual(t.context.log.args[0], ['Verify GitHub authentication']);
  t.true(t.context.log.calledWith('Created issue #%d: %s.', 1, 'https://github.com/issues/1'));
  t.true(github.isDone());
});
