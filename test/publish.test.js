import {escape} from 'querystring';
import test from 'ava';
import nock from 'nock';
import {stub, match} from 'sinon';
import publish from '../lib/publish';
import {authenticate, upload} from './helpers/mock-github';

/* eslint camelcase: ["error", {properties: "never"}] */

test.beforeEach(t => {
  // Save the current process.env
  t.context.env = Object.assign({}, process.env);
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

test.afterEach.always(t => {
  // Restore process.env
  process.env = Object.assign({}, t.context.env);
  // Clear nock
  nock.cleanAll();
});

test.serial('Publish a release', async t => {
  const owner = 'test_user';
  const repo = 'test_repo';
  const githubToken = 'github_token';
  const pluginConfig = {githubToken};
  const nextRelease = {version: '1.0.0', gitHead: '123', gitTag: 'v1.0.0', notes: 'Test release note body'};
  const options = {branch: 'master'};
  const pkg = {repository: {url: `https://github.com/${owner}/${repo}.git`}};
  const releaseUrl = `https://github.com/${owner}/${repo}/releases/${nextRelease.version}`;

  const github = authenticate({githubToken})
    .post(`/repos/${owner}/${repo}/releases`, {
      tag_name: nextRelease.gitTag,
      target_commitish: options.branch,
      name: nextRelease.gitTag,
      body: nextRelease.notes,
    })
    .reply(200, {html_url: releaseUrl})
    .post(`/repos/${owner}/${repo}/git/refs`, {ref: `refs/tags/${nextRelease.gitTag}`, sha: nextRelease.gitHead})
    .reply({});

  await publish(pluginConfig, options, pkg, nextRelease, t.context.logger);

  t.true(t.context.log.calledWith(match.string, releaseUrl));
  t.true(github.isDone());
});

test.serial('Publish a release with one asset', async t => {
  const owner = 'test_user';
  const repo = 'test_repo';
  process.env.GH_URL = 'https://othertesturl.com:443';
  process.env.GH_TOKEN = 'github_token';
  process.env.GH_PREFIX = 'prefix';
  const pluginConfig = {assets: 'test/fixtures/upload.txt'};
  const nextRelease = {version: '1.0.0', gitHead: '123', gitTag: 'v1.0.0', notes: 'Test release note body'};
  const options = {branch: 'master'};
  const pkg = {repository: {url: `https://github.com/${owner}/${repo}.git`}};
  const releaseUrl = `https://github.com/${owner}/${repo}/releases/${nextRelease.version}`;
  const assetUrl = `https://github.com/${owner}/${repo}/releases/download/${nextRelease.version}/upload.txt`;
  const releaseId = 1;

  const github = authenticate({
    githubUrl: process.env.GH_URL,
    githubToken: process.env.GH_TOKEN,
    githubApiPathPrefix: process.env.GH_PREFIX,
  })
    .post(`/repos/${owner}/${repo}/releases`, {
      tag_name: nextRelease.gitTag,
      target_commitish: options.branch,
      name: nextRelease.gitTag,
      body: nextRelease.notes,
    })
    .reply(200, {html_url: releaseUrl, id: releaseId})
    .post(`/repos/${owner}/${repo}/git/refs`, {ref: `refs/tags/${nextRelease.gitTag}`, sha: nextRelease.gitHead})
    .reply({});

  const githubUpload = upload({githubUrl: process.env.GH_URL, githubToken: process.env.GH_TOKEN})
    .post(
      `/repos/${owner}/${repo}/releases/${releaseId}/assets?filePath=${escape(
        'test/fixtures/upload.txt'
      )}&name=${escape('upload.txt')}`
    )
    .reply(200, {browser_download_url: assetUrl});

  await publish(pluginConfig, options, pkg, nextRelease, t.context.logger);

  t.true(t.context.log.calledWith(match.string, releaseUrl));
  t.true(t.context.log.calledWith(match.string, assetUrl));
  t.true(github.isDone());
  t.true(githubUpload.isDone());
});

test.serial('Publish a release with one asset and custom github url', async t => {
  const owner = 'test_user';
  const repo = 'test_repo';
  process.env.GITHUB_URL = 'https://othertesturl.com:443';
  process.env.GITHUB_TOKEN = 'github_token';
  process.env.GITHUB_PREFIX = 'prefix';
  const assets = 'test/fixtures/upload.txt';
  const pluginConfig = {githubUrl: process.env.GITHUB_URL, githubApiPathPrefix: process.env.GITHUB_PREFIX, assets};
  const nextRelease = {version: '1.0.0', gitHead: '123', gitTag: 'v1.0.0', notes: 'Test release note body'};
  const options = {branch: 'master'};
  const pkg = {repository: {url: `https://github.com/${owner}/${repo}.git`}};
  const releaseUrl = `https://github.com/${owner}/${repo}/releases/${nextRelease.version}`;
  const assetUrl = `https://github.com/${owner}/${repo}/releases/download/${nextRelease.version}/upload.txt`;
  const releaseId = 1;

  const github = authenticate({
    githubToken: process.env.GITHUB_TOKEN,
    githubUrl: process.env.GITHUB_URL,
    githubApiPathPrefix: process.env.GITHUB_PREFIX,
  })
    .post(`/repos/${owner}/${repo}/releases`, {
      tag_name: nextRelease.gitTag,
      target_commitish: options.branch,
      name: nextRelease.gitTag,
      body: nextRelease.notes,
    })
    .reply(200, {html_url: releaseUrl, id: releaseId})
    .post(`/repos/${owner}/${repo}/git/refs`, {ref: `refs/tags/${nextRelease.gitTag}`, sha: nextRelease.gitHead})
    .reply({});

  const githubUpload = upload({githubToken: process.env.GITHUB_TOKEN, githubUrl: process.env.GITHUB_URL})
    .post(
      `/repos/${owner}/${repo}/releases/${releaseId}/assets?filePath=${escape(
        'test/fixtures/upload.txt'
      )}&name=${escape('upload.txt')}`
    )
    .reply(200, {browser_download_url: assetUrl});

  await publish(pluginConfig, options, pkg, nextRelease, t.context.logger);

  t.true(t.context.log.calledWith(match.string, releaseUrl));
  t.true(t.context.log.calledWith(match.string, assetUrl));
  t.true(github.isDone());
  t.true(githubUpload.isDone());
});

test.serial('Publish a release with an array of assets', async t => {
  const owner = 'test_user';
  const repo = 'test_repo';
  const githubToken = 'github_token';
  const pluginConfig = {
    githubToken,
    assets: [
      'test/fixtures/upload.txt',
      {path: 'test/fixtures/upload_other.txt', name: 'other_file.txt', label: 'Other File'},
    ],
  };
  const nextRelease = {version: '1.0.0', gitHead: '123', gitTag: 'v1.0.0', notes: 'Test release note body'};
  const options = {branch: 'master'};
  const pkg = {repository: {url: `https://github.com/${owner}/${repo}.git`}};
  const releaseUrl = `https://github.com/${owner}/${repo}/releases/${nextRelease.version}`;
  const assetUrl = `https://github.com/${owner}/${repo}/releases/download/${nextRelease.version}/upload.txt`;
  const otherAssetUrl = `https://github.com/${owner}/${repo}/releases/download/${nextRelease.version}/other_file.txt`;
  const releaseId = 1;

  const github = authenticate({githubToken})
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

  await publish(pluginConfig, options, pkg, nextRelease, t.context.logger);

  t.true(t.context.log.calledWith(match.string, releaseUrl));
  t.true(t.context.log.calledWith(match.string, assetUrl));
  t.true(t.context.log.calledWith(match.string, otherAssetUrl));
  t.true(github.isDone());
  t.true(githubUpload.isDone());
});

test.serial('Publish a release with an array of misconfigured assets', async t => {
  const owner = 'test_user';
  const repo = 'test_repo';
  const githubToken = 'github_token';
  const pluginConfig = {
    githubToken,
    assets: ['test/fixtures', {path: 'test/fixtures/missing.txt', name: 'missing.txt', label: 'Missing File'}],
  };
  const nextRelease = {version: '1.0.0', gitHead: '123', gitTag: 'v1.0.0', notes: 'Test release note body'};
  const options = {branch: 'master'};
  const pkg = {repository: {url: `https://github.com/${owner}/${repo}.git`}};
  const releaseUrl = `https://github.com/${owner}/${repo}/releases/${nextRelease.version}`;
  const releaseId = 1;

  const github = authenticate({githubToken})
    .post(`/repos/${owner}/${repo}/releases`, {
      tag_name: nextRelease.gitTag,
      target_commitish: options.branch,
      name: nextRelease.gitTag,
      body: nextRelease.notes,
    })
    .reply(200, {html_url: releaseUrl, id: releaseId})
    .post(`/repos/${owner}/${repo}/git/refs`, {ref: `refs/tags/${nextRelease.gitTag}`, sha: nextRelease.gitHead})
    .reply({});

  await publish(pluginConfig, options, pkg, nextRelease, t.context.logger);

  t.true(t.context.log.calledWith(match.string, releaseUrl));
  t.true(t.context.error.calledWith(match.string, 'test/fixtures/missing.txt'));
  t.true(t.context.error.calledWith(match.string, 'test/fixtures'));
  t.true(github.isDone());
});
