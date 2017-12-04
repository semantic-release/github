import {escape} from 'querystring';
import test from 'ava';
import {stat} from 'fs-extra';
import nock from 'nock';
import {stub} from 'sinon';
import tempy from 'tempy';
import publish from '../lib/publish';
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

test.serial('Publish a release', async t => {
  const owner = 'test_user';
  const repo = 'test_repo';
  process.env.GITHUB_TOKEN = 'github_token';
  const pluginConfig = {};
  const nextRelease = {version: '1.0.0', gitHead: '123', gitTag: 'v1.0.0', notes: 'Test release note body'};
  const options = {branch: 'master', repositoryUrl: `https://github.com/${owner}/${repo}.git`};
  const releaseUrl = `https://github.com/${owner}/${repo}/releases/${nextRelease.version}`;
  const releaseId = 1;
  const uploadUri = `/api/uploads/repos/${owner}/${repo}/releases/${releaseId}/assets`;
  const uploadUrl = `https://github.com${uploadUri}{?name,label}`;

  const github = authenticate()
    .get(`/repos/${owner}/${repo}/git/refs/tags/${nextRelease.gitTag}`)
    .reply(404)
    .post(`/repos/${owner}/${repo}/git/refs`, {ref: `refs/tags/${nextRelease.gitTag}`, sha: nextRelease.gitHead})
    .reply({})
    .post(`/repos/${owner}/${repo}/releases`, {
      tag_name: nextRelease.gitTag,
      target_commitish: options.branch,
      name: nextRelease.gitTag,
      body: nextRelease.notes,
    })
    .reply(200, {upload_url: uploadUrl, html_url: releaseUrl});

  await publish(pluginConfig, options, nextRelease, t.context.logger);

  t.deepEqual(t.context.log.args[0], ['Published Github release: %s', releaseUrl]);
  t.true(github.isDone());
});

test.serial('Publish a release with an existing tag', async t => {
  const owner = 'test_user';
  const repo = 'test_repo';
  process.env.GITHUB_TOKEN = 'github_token';
  const pluginConfig = {};
  const nextRelease = {version: '1.0.0', gitHead: '123', gitTag: 'v1.0.0', notes: 'Test release note body'};
  const options = {branch: 'master', repositoryUrl: `https://github.com/${owner}/${repo}.git`};
  const releaseUrl = `https://github.com/${owner}/${repo}/releases/${nextRelease.version}`;
  const releaseId = 1;
  const uploadUri = `/api/uploads/repos/${owner}/${repo}/releases/${releaseId}/assets`;
  const uploadUrl = `https://github.com${uploadUri}{?name,label}`;

  const github = authenticate({})
    .get(`/repos/${owner}/${repo}/git/refs/tags/${nextRelease.gitTag}`)
    .reply({ref: `refs/tags/${nextRelease.gitTag}`, object: {sha: 'e23a1bd8d7240c1eb3287374956042ffbcadca84'}})
    .post(`/repos/${owner}/${repo}/releases`, {
      tag_name: nextRelease.gitTag,
      target_commitish: options.branch,
      name: nextRelease.gitTag,
      body: nextRelease.notes,
    })
    .reply(200, {upload_url: uploadUrl, html_url: releaseUrl});

  await publish(pluginConfig, options, nextRelease, t.context.logger);

  t.deepEqual(t.context.log.args[0], ['Published Github release: %s', releaseUrl]);
  t.true(github.isDone());
});

test.serial('Publish a release with one asset', async t => {
  const owner = 'test_user';
  const repo = 'test_repo';
  process.env.GH_TOKEN = 'github_token';
  const pluginConfig = {
    assets: [['test/fixtures/**', '!**/*.txt'], {path: 'test/fixtures/.dotfile', label: 'A dotfile with no ext'}],
  };
  const nextRelease = {version: '1.0.0', gitHead: '123', gitTag: 'v1.0.0', notes: 'Test release note body'};
  const options = {branch: 'master', repositoryUrl: `https://github.com/${owner}/${repo}.git`};
  const releaseUrl = `https://github.com/${owner}/${repo}/releases/${nextRelease.version}`;
  const assetUrl = `https://github.com/${owner}/${repo}/releases/download/${nextRelease.version}/.dotfile`;
  const releaseId = 1;
  const uploadUri = `/api/uploads/repos/${owner}/${repo}/releases/${releaseId}/assets`;
  const uploadUrl = `https://github.com${uploadUri}{?name,label}`;

  const github = authenticate()
    .get(`/repos/${owner}/${repo}/git/refs/tags/${nextRelease.gitTag}`)
    .reply(404)
    .post(`/repos/${owner}/${repo}/git/refs`, {ref: `refs/tags/${nextRelease.gitTag}`, sha: nextRelease.gitHead})
    .reply({})
    .post(`/repos/${owner}/${repo}/releases`, {
      tag_name: nextRelease.gitTag,
      target_commitish: options.branch,
      name: nextRelease.gitTag,
      body: nextRelease.notes,
    })
    .reply(200, {upload_url: uploadUrl, html_url: releaseUrl});

  const githubUpload = upload({
    uploadUrl: 'https://github.com',
    contentLength: (await stat('test/fixtures/.dotfile')).size,
  })
    .post(`${uploadUri}?name=${escape('.dotfile')}&label=${escape('A dotfile with no ext')}`)
    .reply(200, {browser_download_url: assetUrl});

  await publish(pluginConfig, options, nextRelease, t.context.logger);

  t.deepEqual(t.context.log.args[0], ['Published Github release: %s', releaseUrl]);
  t.deepEqual(t.context.log.args[1], ['Published file %s', assetUrl]);
  t.true(github.isDone());
  t.true(githubUpload.isDone());
});

test.serial('Publish a release with one asset and custom github url', async t => {
  const owner = 'test_user';
  const repo = 'test_repo';
  process.env.GH_URL = 'https://othertesturl.com:443';
  process.env.GH_TOKEN = 'github_token';
  process.env.GH_PREFIX = 'prefix';
  const pluginConfig = {
    assets: [
      ['test/fixtures/*.txt', '!**/*_other.txt'],
      {path: ['test/fixtures/*.txt', '!**/*_other.txt'], label: 'A text file'},
      'test/fixtures/upload.txt',
    ],
  };
  const nextRelease = {version: '1.0.0', gitHead: '123', gitTag: 'v1.0.0', notes: 'Test release note body'};
  const options = {branch: 'master', repositoryUrl: `https://github.com/${owner}/${repo}.git`};
  const releaseUrl = `${process.env.GH_URL}/${owner}/${repo}/releases/${nextRelease.version}`;
  const assetUrl = `${process.env.GH_URL}/${owner}/${repo}/releases/download/${nextRelease.version}/upload.txt`;
  const releaseId = 1;
  const uploadUri = `/api/uploads/repos/${owner}/${repo}/releases/${releaseId}/assets`;
  const uploadUrl = `${process.env.GH_URL}${uploadUri}{?name,label}`;

  const github = authenticate({
    githubUrl: process.env.GH_URL,
    githubApiPathPrefix: process.env.GH_PREFIX,
  })
    .get(`/repos/${owner}/${repo}/git/refs/tags/${nextRelease.gitTag}`)
    .reply(404)
    .post(`/repos/${owner}/${repo}/git/refs`, {ref: `refs/tags/${nextRelease.gitTag}`, sha: nextRelease.gitHead})
    .reply({})
    .post(`/repos/${owner}/${repo}/releases`, {
      tag_name: nextRelease.gitTag,
      target_commitish: options.branch,
      name: nextRelease.gitTag,
      body: nextRelease.notes,
    })
    .reply(200, {upload_url: uploadUrl, html_url: releaseUrl});

  const githubUpload = upload({
    uploadUrl: process.env.GH_URL,
    contentLength: (await stat('test/fixtures/upload.txt')).size,
  })
    .post(`${uploadUri}?name=${escape('upload.txt')}&label=${escape('A text file')}`)
    .reply(200, {browser_download_url: assetUrl});

  await publish(pluginConfig, options, nextRelease, t.context.logger);

  t.deepEqual(t.context.log.args[0], ['Published Github release: %s', releaseUrl]);
  t.deepEqual(t.context.log.args[1], ['Published file %s', assetUrl]);
  t.true(github.isDone());
  t.true(githubUpload.isDone());
});

test.serial('Publish a release with an array of missing assets', async t => {
  const owner = 'test_user';
  const repo = 'test_repo';
  process.env.GITHUB_TOKEN = 'github_token';
  const emptyDirectory = tempy.directory();
  const pluginConfig = {assets: [emptyDirectory, {path: 'test/fixtures/missing.txt', name: 'missing.txt'}]};
  const nextRelease = {version: '1.0.0', gitHead: '123', gitTag: 'v1.0.0', notes: 'Test release note body'};
  const options = {branch: 'master', repositoryUrl: `https://github.com/${owner}/${repo}.git`};
  const releaseUrl = `https://github.com/${owner}/${repo}/releases/${nextRelease.version}`;
  const releaseId = 1;
  const uploadUri = `/api/uploads/repos/${owner}/${repo}/releases/${releaseId}/assets`;
  const uploadUrl = `https://github.com${uploadUri}{?name,label}`;

  const github = authenticate()
    .get(`/repos/${owner}/${repo}/git/refs/tags/${nextRelease.gitTag}`)
    .reply(404)
    .post(`/repos/${owner}/${repo}/git/refs`, {ref: `refs/tags/${nextRelease.gitTag}`, sha: nextRelease.gitHead})
    .reply({})
    .post(`/repos/${owner}/${repo}/releases`, {
      tag_name: nextRelease.gitTag,
      target_commitish: options.branch,
      name: nextRelease.gitTag,
      body: nextRelease.notes,
    })
    .reply(200, {upload_url: uploadUrl, html_url: releaseUrl});

  await publish(pluginConfig, options, nextRelease, t.context.logger);

  t.deepEqual(t.context.log.args[0], ['Published Github release: %s', releaseUrl]);
  t.deepEqual(t.context.error.args[0], [
    'The asset %s cannot be read, and will be ignored.',
    'test/fixtures/missing.txt',
  ]);
  t.deepEqual(t.context.error.args[1], ['The asset %s is not a file, and will be ignored.', emptyDirectory]);
  t.true(github.isDone());
});

test.serial('Throw Error if get tag call return an error other than 404', async t => {
  const owner = 'test_user';
  const repo = 'test_repo';
  process.env.GITHUB_TOKEN = 'github_token';
  const pluginConfig = {};
  const nextRelease = {version: '1.0.0', gitHead: '123', gitTag: 'v1.0.0', notes: 'Test release note body'};
  const options = {branch: 'master', repositoryUrl: `https://github.com/${owner}/${repo}.git`};

  const github = authenticate()
    .get(`/repos/${owner}/${repo}/git/refs/tags/${nextRelease.gitTag}`)
    .reply(500);

  const error = await t.throws(publish(pluginConfig, options, nextRelease, t.context.logger), Error);

  t.is(error.code, 500);
  t.true(github.isDone());
});
