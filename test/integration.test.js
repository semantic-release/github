import {promisify} from 'util';
import {escape} from 'querystring';
import test from 'ava';
import {stub, match} from 'sinon';
import clearModule from 'clear-module';
import {authenticate, upload} from './helpers/mock-github';
import SemanticReleaseError from '@semantic-release/error';

test.beforeEach(async t => {
  // Save the current process.env
  t.context.env = Object.assign({}, process.env);
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

test.afterEach.always(async t => {
  // Restore process.env
  process.env = Object.assign({}, t.context.env);
});

test.serial('Verify Github auth', async t => {
  process.env.GITHUB_TOKEN = 'github_token';
  const owner = 'test_user';
  const repo = 'test_repo';
  const options = {};
  const pkg = {name: 'package-name', repository: {url: `git+https://othertesturl.com/${owner}/${repo}.git`}};

  const github = authenticate({githubToken: process.env.GITHUB_TOKEN})
    .get(`/repos/${owner}/${repo}`)
    .reply(200, {permissions: {push: true}});

  await t.notThrows(promisify(t.context.m.verifyConditions)({}, {pkg, options}));

  t.true(github.isDone());
});

test.serial('Verify Github auth with publish options', async t => {
  process.env.GITHUB_TOKEN = 'github_token';
  const owner = 'test_user';
  const repo = 'test_repo';
  const options = {publish: {path: '@semantic-release/github'}};
  const pkg = {name: 'package-name', repository: {url: `git+https://othertesturl.com/${owner}/${repo}.git`}};

  const github = authenticate({githubToken: process.env.GITHUB_TOKEN})
    .get(`/repos/${owner}/${repo}`)
    .reply(200, {permissions: {push: true}});

  await t.notThrows(promisify(t.context.m.verifyConditions)({}, {pkg, options}));

  t.true(github.isDone());
});

test.serial('Verify Github auth and assets config', async t => {
  process.env.GH_TOKEN = 'github_token';
  const owner = 'test_user';
  const repo = 'test_repo';
  const assets = [{path: 'lib/file.js'}, 'file.js'];
  const options = {publish: [{path: '@semantic-release/npm'}, {path: '@semantic-release/github', assets}]};
  const pkg = {name: 'package-name', repository: {url: `git+https://othertesturl.com/${owner}/${repo}.git`}};

  const github = authenticate({githubToken: process.env.GH_TOKEN})
    .get(`/repos/${owner}/${repo}`)
    .reply(200, {permissions: {push: true}});

  await t.notThrows(promisify(t.context.m.verifyConditions)({}, {pkg, options}));

  t.true(github.isDone());
});

test.serial('Throw SemanticReleaseError if invalid config', async t => {
  process.env.GH_TOKEN = 'github_token';
  const owner = 'test_user';
  const repo = 'test_repo';
  const assets = [{wrongProperty: 'lib/file.js'}];
  const options = {publish: [{path: '@semantic-release/npm'}, {path: '@semantic-release/github', assets}]};
  const pkg = {name: 'package-name', repository: {url: `git+https://othertesturl.com/${owner}/${repo}.git`}};

  const error = await t.throws(promisify(t.context.m.verifyConditions)({}, {pkg, options}));

  t.true(error instanceof SemanticReleaseError);
  t.is(error.code, 'EINVALIDASSETS');
});

test.serial('Publish a release with an array of assets', async t => {
  const owner = 'test_user';
  const repo = 'test_repo';
  const githubToken = 'github_token';
  const assets = [
    'test/fixtures/upload.txt',
    {path: 'test/fixtures/upload_other.txt', name: 'other_file.txt', label: 'Other File'},
  ];
  const nextRelease = {version: '1.0.0', gitHead: '123', gitTag: 'v1.0.0', notes: 'Test release note body'};
  const options = {branch: 'master'};
  const pkg = {name: 'package-name', repository: {url: `https://github.com/${owner}/${repo}.git`}};
  const releaseUrl = `https://github.com/${owner}/${repo}/releases/${nextRelease.version}`;
  const assetUrl = `https://github.com/${owner}/${repo}/releases/download/${nextRelease.version}/upload.txt`;
  const otherAssetUrl = `https://github.com/${owner}/${repo}/releases/download/${nextRelease.version}/other_file.txt`;
  const releaseId = 1;

  const github = authenticate({githubToken})
    .get(`/repos/${owner}/${repo}`)
    .reply(200, {permissions: {push: true}})
    .post(`/repos/${owner}/${repo}/releases`, {
      tag_name: nextRelease.gitTag,
      target_commitish: options.branch,
      name: nextRelease.gitTag,
      body: nextRelease.notes,
    })
    .reply(200, {html_url: releaseUrl, id: releaseId})
    .post(`/repos/${owner}/${repo}/git/refs`, {ref: `refs/tags/${nextRelease.gitTag}`, sha: nextRelease.gitHead})
    .reply({});

  const githubUpload = upload({githubToken})
    .post(
      `/repos/${owner}/${repo}/releases/${releaseId}/assets?filePath=${escape(
        'test/fixtures/upload.txt'
      )}&name=${escape('upload.txt')}`
    )
    .reply(200, {browser_download_url: assetUrl})
    .post(
      `/repos/${owner}/${repo}/releases/${releaseId}/assets?filePath=${escape(
        'test/fixtures/upload_other.txt'
      )}&name=${escape('other_file.txt')}&label=${escape('Other File')}`
    )
    .reply(200, {browser_download_url: otherAssetUrl});

  await promisify(t.context.m.publish)({githubToken, assets}, {pkg, nextRelease, options, logger: t.context.logger});

  t.true(t.context.log.calledWith(match.string, releaseUrl));
  t.true(t.context.log.calledWith(match.string, assetUrl));
  t.true(t.context.log.calledWith(match.string, otherAssetUrl));
  t.true(github.isDone());
  t.true(githubUpload.isDone());
});

test.serial('Verify Github auth and release', async t => {
  process.env.GH_TOKEN = 'github_token';
  const owner = 'test_user';
  const repo = 'test_repo';
  const assets = [
    'test/fixtures/upload.txt',
    {path: 'test/fixtures/upload_other.txt', name: 'other_file.txt', label: 'Other File'},
  ];
  const pkg = {name: 'package-name', repository: {url: `https://github.com/${owner}/${repo}.git`}};
  const options = {
    publish: [{path: '@semantic-release/npm'}, {path: '@semantic-release/github', assets}],
    branch: 'master',
  };
  const nextRelease = {version: '1.0.0', gitHead: '123', gitTag: 'v1.0.0', notes: 'Test release note body'};
  const releaseUrl = `https://github.com/${owner}/${repo}/releases/${nextRelease.version}`;
  const assetUrl = `https://github.com/${owner}/${repo}/releases/download/${nextRelease.version}/upload.txt`;
  const otherAssetUrl = `https://github.com/${owner}/${repo}/releases/download/${nextRelease.version}/other_file.txt`;
  const releaseId = 1;

  const github = authenticate({githubToken: process.env.GH_TOKEN})
    .get(`/repos/${owner}/${repo}`)
    .reply(200, {permissions: {push: true}})
    .post(`/repos/${owner}/${repo}/releases`, {
      tag_name: nextRelease.gitTag,
      target_commitish: options.branch,
      name: nextRelease.gitTag,
      body: nextRelease.notes,
    })
    .reply(200, {html_url: releaseUrl, id: releaseId})
    .post(`/repos/${owner}/${repo}/git/refs`, {ref: `refs/tags/${nextRelease.gitTag}`, sha: nextRelease.gitHead})
    .reply({});

  const githubUpload = upload({githubToken: process.env.GH_TOKEN})
    .post(
      `/repos/${owner}/${repo}/releases/${releaseId}/assets?filePath=${escape(
        'test/fixtures/upload.txt'
      )}&name=${escape('upload.txt')}`
    )
    .reply(200, {browser_download_url: assetUrl})
    .post(
      `/repos/${owner}/${repo}/releases/${releaseId}/assets?filePath=${escape(
        'test/fixtures/upload_other.txt'
      )}&name=${escape('other_file.txt')}&label=${escape('Other File')}`
    )
    .reply(200, {browser_download_url: otherAssetUrl});

  await t.notThrows(promisify(t.context.m.verifyConditions)({}, {pkg, options}));
  await promisify(t.context.m.publish)({assets}, {pkg, nextRelease, options, logger: t.context.logger});

  t.true(t.context.log.calledWith(match.string, releaseUrl));
  t.true(t.context.log.calledWith(match.string, assetUrl));
  t.true(t.context.log.calledWith(match.string, otherAssetUrl));
  t.true(github.isDone());
  t.true(githubUpload.isDone());
});
