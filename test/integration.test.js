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
  clearModule('../index');
  t.context.m = require('../index');
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
    publish: [{path: '@semantic-release/npm'}, {path: '@semantic-release/github', assets}],
    repositoryUrl: `git+https://othertesturl.com/${owner}/${repo}.git`,
  };
  const github = authenticate()
    .get(`/repos/${owner}/${repo}`)
    .reply(200, {permissions: {push: true}});

  await t.notThrows(t.context.m.verifyConditions({}, {options, logger: t.context.logger}));

  t.true(github.isDone());
});

test.serial('Throw SemanticReleaseError if invalid config', async t => {
  process.env.GH_TOKEN = 'github_token';
  const owner = 'test_user';
  const repo = 'test_repo';
  const assets = [{wrongProperty: 'lib/file.js'}];
  const options = {
    publish: [{path: '@semantic-release/npm'}, {path: '@semantic-release/github', assets}],
    repositoryUrl: `git+https://othertesturl.com/${owner}/${repo}.git`,
  };

  const error = await t.throws(t.context.m.verifyConditions({}, {options, logger: t.context.logger}));

  t.true(error instanceof SemanticReleaseError);
  t.is(error.code, 'EINVALIDASSETS');
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

  await t.context.m.publish({assets}, {nextRelease, options, logger: t.context.logger});

  t.deepEqual(t.context.log.args[0], ['Verify GitHub authentication']);
  t.deepEqual(t.context.log.args[1], ['Published GitHub release: %s', releaseUrl]);
  t.deepEqual(t.context.log.args[2], ['Published file %s', assetUrl]);
  t.deepEqual(t.context.log.args[3], ['Published file %s', otherAssetUrl]);
  t.true(github.isDone());
  t.true(githubUpload1.isDone());
  t.true(githubUpload2.isDone());
});

test.serial('Verify GitHub auth and release', async t => {
  process.env.GH_TOKEN = 'github_token';
  const owner = 'test_user';
  const repo = 'test_repo';
  const assets = [
    'test/fixtures/upload.txt',
    {path: 'test/fixtures/upload_other.txt', name: 'other_file.txt', label: 'Other File'},
  ];
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

  t.deepEqual(t.context.log.args[0], ['Verify GitHub authentication']);
  t.deepEqual(t.context.log.args[1], ['Published GitHub release: %s', releaseUrl]);
  t.deepEqual(t.context.log.args[2], ['Published file %s', otherAssetUrl]);
  t.deepEqual(t.context.log.args[3], ['Published file %s', assetUrl]);
  t.true(github.isDone());
  t.true(githubUpload1.isDone());
  t.true(githubUpload2.isDone());
});
