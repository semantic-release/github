import path from 'path';
import {escape} from 'querystring';
import test from 'ava';
import {stat} from 'fs-extra';
import nock from 'nock';
import {stub} from 'sinon';
import proxyquire from 'proxyquire';
import tempy from 'tempy';
import {authenticate, upload} from './helpers/mock-github';
import rateLimit from './helpers/rate-limit';

/* eslint camelcase: ["error", {properties: "never"}] */

const cwd = 'test/fixtures/files';
const publish = proxyquire('../lib/publish', {
  './get-client': proxyquire('../lib/get-client', {'./definitions/rate-limit': rateLimit}),
});

test.beforeEach(t => {
  // Mock logger
  t.context.log = stub();
  t.context.error = stub();
  t.context.logger = {log: t.context.log, error: t.context.error};
});

test.afterEach.always(() => {
  // Clear nock
  nock.cleanAll();
});

test.serial('Publish a release', async t => {
  const owner = 'test_user';
  const repo = 'test_repo';
  const env = {GITHUB_TOKEN: 'github_token'};
  const pluginConfig = {};
  const nextRelease = {gitTag: 'v1.0.0', name: 'v1.0.0', notes: 'Test release note body'};
  const options = {repositoryUrl: `https://github.com/${owner}/${repo}.git`};
  const releaseUrl = `https://github.com/${owner}/${repo}/releases/${nextRelease.version}`;
  const releaseId = 1;
  const uploadUri = `/api/uploads/repos/${owner}/${repo}/releases/${releaseId}/assets`;
  const uploadUrl = `https://github.com${uploadUri}{?name,label}`;

  const github = authenticate(env)
    .post(`/repos/${owner}/${repo}/releases`, {
      tag_name: nextRelease.gitTag,
      name: nextRelease.name,
      body: nextRelease.notes,
      prerelease: false,
    })
    .reply(200, {upload_url: uploadUrl, html_url: releaseUrl});

  const result = await publish(pluginConfig, {
    cwd,
    env,
    options,
    branch: {type: 'release', main: true},
    nextRelease,
    logger: t.context.logger,
  });

  t.is(result.url, releaseUrl);
  t.deepEqual(t.context.log.args[0], ['Published GitHub release: %s', releaseUrl]);
  t.true(github.isDone());
});

test.serial('Publish a release on a channel', async t => {
  const owner = 'test_user';
  const repo = 'test_repo';
  const env = {GITHUB_TOKEN: 'github_token'};
  const pluginConfig = {};
  const nextRelease = {gitTag: 'v1.0.0', name: 'v1.0.0', notes: 'Test release note body'};
  const options = {repositoryUrl: `https://github.com/${owner}/${repo}.git`};
  const releaseUrl = `https://github.com/${owner}/${repo}/releases/${nextRelease.version}`;
  const releaseId = 1;
  const uploadUri = `/api/uploads/repos/${owner}/${repo}/releases/${releaseId}/assets`;
  const uploadUrl = `https://github.com${uploadUri}{?name,label}`;

  const github = authenticate(env)
    .post(`/repos/${owner}/${repo}/releases`, {
      tag_name: nextRelease.gitTag,
      name: nextRelease.name,
      body: nextRelease.notes,
      prerelease: true,
    })
    .reply(200, {upload_url: uploadUrl, html_url: releaseUrl});

  const result = await publish(pluginConfig, {
    cwd,
    env,
    options,
    branch: {type: 'release', channel: 'next', main: false},
    nextRelease,
    logger: t.context.logger,
  });

  t.is(result.url, releaseUrl);
  t.deepEqual(t.context.log.args[0], ['Published GitHub release: %s', releaseUrl]);
  t.true(github.isDone());
});

test.serial('Publish a prerelease', async t => {
  const owner = 'test_user';
  const repo = 'test_repo';
  const env = {GITHUB_TOKEN: 'github_token'};
  const pluginConfig = {};
  const nextRelease = {gitTag: 'v1.0.0', name: 'v1.0.0', notes: 'Test release note body'};
  const options = {repositoryUrl: `https://github.com/${owner}/${repo}.git`};
  const releaseUrl = `https://github.com/${owner}/${repo}/releases/${nextRelease.version}`;
  const releaseId = 1;
  const uploadUri = `/api/uploads/repos/${owner}/${repo}/releases/${releaseId}/assets`;
  const uploadUrl = `https://github.com${uploadUri}{?name,label}`;

  const github = authenticate(env)
    .post(`/repos/${owner}/${repo}/releases`, {
      tag_name: nextRelease.gitTag,
      name: nextRelease.name,
      body: nextRelease.notes,
      prerelease: true,
    })
    .reply(200, {upload_url: uploadUrl, html_url: releaseUrl});

  const result = await publish(pluginConfig, {
    cwd,
    env,
    options,
    branch: {type: 'prerelease', channel: 'beta'},
    nextRelease,
    logger: t.context.logger,
  });

  t.is(result.url, releaseUrl);
  t.deepEqual(t.context.log.args[0], ['Published GitHub release: %s', releaseUrl]);
  t.true(github.isDone());
});

test.serial('Publish a maintenance release', async t => {
  const owner = 'test_user';
  const repo = 'test_repo';
  const env = {GITHUB_TOKEN: 'github_token'};
  const pluginConfig = {};
  const nextRelease = {gitTag: 'v1.0.0', name: 'v1.0.0', notes: 'Test release note body'};
  const options = {repositoryUrl: `https://github.com/${owner}/${repo}.git`};
  const releaseUrl = `https://github.com/${owner}/${repo}/releases/${nextRelease.version}`;
  const releaseId = 1;
  const uploadUri = `/api/uploads/repos/${owner}/${repo}/releases/${releaseId}/assets`;
  const uploadUrl = `https://github.com${uploadUri}{?name,label}`;

  const github = authenticate(env)
    .post(`/repos/${owner}/${repo}/releases`, {
      tag_name: nextRelease.gitTag,
      name: nextRelease.name,
      body: nextRelease.notes,
      prerelease: false,
    })
    .reply(200, {upload_url: uploadUrl, html_url: releaseUrl, id: releaseId});

  const result = await publish(pluginConfig, {
    cwd,
    env,
    options,
    branch: {type: 'maintenance', channel: '1.x', main: false},
    nextRelease,
    logger: t.context.logger,
  });

  t.is(result.url, releaseUrl);
  t.deepEqual(t.context.log.args[0], ['Published GitHub release: %s', releaseUrl]);
  t.true(github.isDone());
});

test.serial('Publish a release, retrying 4 times', async t => {
  const owner = 'test_user';
  const repo = 'test_repo';
  const env = {GITHUB_TOKEN: 'github_token'};
  const pluginConfig = {};
  const nextRelease = {gitTag: 'v1.0.0', name: 'v1.0.0', notes: 'Test release note body'};
  const options = {repositoryUrl: `https://github.com/${owner}/${repo}.git`};
  const releaseUrl = `https://github.com/${owner}/${repo}/releases/${nextRelease.version}`;
  const releaseId = 1;
  const uploadUri = `/api/uploads/repos/${owner}/${repo}/releases/${releaseId}/assets`;
  const uploadUrl = `https://github.com${uploadUri}{?name,label}`;

  const github = authenticate(env)
    .post(`/repos/${owner}/${repo}/releases`, {
      tag_name: nextRelease.gitTag,
      name: nextRelease.gitTag,
      body: nextRelease.notes,
      prerelease: false,
    })
    .times(3)
    .reply(404)
    .post(`/repos/${owner}/${repo}/releases`, {
      tag_name: nextRelease.gitTag,
      name: nextRelease.name,
      body: nextRelease.notes,
      prerelease: false,
    })
    .reply(200, {upload_url: uploadUrl, html_url: releaseUrl, id: releaseId});

  const result = await publish(pluginConfig, {
    cwd,
    env,
    options,
    branch: {type: 'release', main: true},
    nextRelease,
    logger: t.context.logger,
  });

  t.is(result.url, releaseUrl);
  t.deepEqual(t.context.log.args[0], ['Published GitHub release: %s', releaseUrl]);
  t.true(github.isDone());
});

test.serial('Publish a release with one asset', async t => {
  const owner = 'test_user';
  const repo = 'test_repo';
  const env = {GITHUB_TOKEN: 'github_token'};
  const pluginConfig = {
    assets: [['**', '!**/*.txt'], {path: '.dotfile', label: 'A dotfile with no ext'}],
  };
  const nextRelease = {gitTag: 'v1.0.0', name: 'v1.0.0', notes: 'Test release note body'};
  const options = {repositoryUrl: `https://github.com/${owner}/${repo}.git`};
  const untaggedReleaseUrl = `https://github.com/${owner}/${repo}/releases/untagged-123`;
  const releaseUrl = `https://github.com/${owner}/${repo}/releases/${nextRelease.version}`;
  const assetUrl = `https://github.com/${owner}/${repo}/releases/download/${nextRelease.version}/.dotfile`;
  const releaseId = 1;
  const uploadUri = `/api/uploads/repos/${owner}/${repo}/releases/${releaseId}/assets`;
  const uploadUrl = `https://github.com${uploadUri}{?name,label}`;

  const github = authenticate(env)
    .post(`/repos/${owner}/${repo}/releases`, {
      tag_name: nextRelease.gitTag,
      name: nextRelease.name,
      body: nextRelease.notes,
      draft: true,
      prerelease: false,
    })
    .reply(200, {upload_url: uploadUrl, html_url: untaggedReleaseUrl, id: releaseId})
    .patch(`/repos/${owner}/${repo}/releases/${releaseId}`, {draft: false})
    .reply(200, {upload_url: uploadUrl, html_url: releaseUrl});

  const githubUpload = upload(env, {
    uploadUrl: 'https://github.com',
    contentLength: (await stat(path.resolve(cwd, '.dotfile'))).size,
  })
    .post(`${uploadUri}?name=${escape('.dotfile')}&label=${escape('A dotfile with no ext')}`)
    .reply(200, {browser_download_url: assetUrl});

  const result = await publish(pluginConfig, {
    cwd,
    env,
    options,
    branch: {type: 'release', main: true},
    nextRelease,
    logger: t.context.logger,
  });

  t.is(result.url, releaseUrl);
  t.true(t.context.log.calledWith('Published GitHub release: %s', releaseUrl));
  t.true(t.context.log.calledWith('Published file %s', assetUrl));
  t.true(github.isDone());
  t.true(githubUpload.isDone());
});

test.serial('Publish a release with one asset and custom github url', async t => {
  const owner = 'test_user';
  const repo = 'test_repo';
  const env = {GH_URL: 'https://othertesturl.com:443', GH_TOKEN: 'github_token', GH_PREFIX: 'prefix'};
  const pluginConfig = {
    assets: [['*.txt', '!**/*_other.txt'], {path: ['*.txt', '!**/*_other.txt'], label: 'A text file'}, 'upload.txt'],
  };
  const nextRelease = {gitTag: 'v1.0.0', name: 'v1.0.0', notes: 'Test release note body'};
  const options = {repositoryUrl: `https://github.com/${owner}/${repo}.git`};
  const untaggedReleaseUrl = `${env.GH_URL}/${owner}/${repo}/releases/untagged-123`;
  const releaseUrl = `${env.GH_URL}/${owner}/${repo}/releases/${nextRelease.version}`;
  const assetUrl = `${env.GH_URL}/${owner}/${repo}/releases/download/${nextRelease.version}/upload.txt`;
  const releaseId = 1;
  const uploadUri = `/api/uploads/repos/${owner}/${repo}/releases/${releaseId}/assets`;
  const uploadUrl = `${env.GH_URL}${uploadUri}{?name,label}`;

  const github = authenticate(env, {})
    .post(`/repos/${owner}/${repo}/releases`, {
      tag_name: nextRelease.gitTag,
      name: nextRelease.name,
      body: nextRelease.notes,
      draft: true,
      prerelease: false,
    })
    .reply(200, {upload_url: uploadUrl, html_url: untaggedReleaseUrl, id: releaseId})
    .patch(`/repos/${owner}/${repo}/releases/${releaseId}`, {draft: false})
    .reply(200, {upload_url: uploadUrl, html_url: releaseUrl});

  const githubUpload = upload(env, {
    uploadUrl: env.GH_URL,
    contentLength: (await stat(path.resolve(cwd, 'upload.txt'))).size,
  })
    .post(`${uploadUri}?name=${escape('upload.txt')}&label=${escape('A text file')}`)
    .reply(200, {browser_download_url: assetUrl});

  const result = await publish(pluginConfig, {
    cwd,
    env,
    options,
    branch: {type: 'release', main: true},
    nextRelease,
    logger: t.context.logger,
  });

  t.is(result.url, releaseUrl);
  t.true(t.context.log.calledWith('Published GitHub release: %s', releaseUrl));
  t.true(t.context.log.calledWith('Published file %s', assetUrl));
  t.true(github.isDone());
  t.true(githubUpload.isDone());
});

test.serial('Publish a release with an array of missing assets', async t => {
  const owner = 'test_user';
  const repo = 'test_repo';
  const env = {GITHUB_TOKEN: 'github_token'};
  const emptyDirectory = tempy.directory();
  const pluginConfig = {assets: [emptyDirectory, {path: 'missing.txt', name: 'missing.txt'}]};
  const nextRelease = {gitTag: 'v1.0.0', name: 'v1.0.0', notes: 'Test release note body'};
  const options = {repositoryUrl: `https://github.com/${owner}/${repo}.git`};
  const untaggedReleaseUrl = `https://github.com/${owner}/${repo}/releases/untagged-123`;
  const releaseUrl = `https://github.com/${owner}/${repo}/releases/${nextRelease.version}`;
  const releaseId = 1;
  const uploadUri = `/api/uploads/repos/${owner}/${repo}/releases/${releaseId}/assets`;
  const uploadUrl = `https://github.com${uploadUri}{?name,label}`;

  const github = authenticate(env)
    .post(`/repos/${owner}/${repo}/releases`, {
      tag_name: nextRelease.gitTag,
      name: nextRelease.name,
      body: nextRelease.notes,
      draft: true,
      prerelease: false,
    })
    .reply(200, {upload_url: uploadUrl, html_url: untaggedReleaseUrl, id: releaseId})
    .patch(`/repos/${owner}/${repo}/releases/${releaseId}`, {draft: false})
    .reply(200, {html_url: releaseUrl});

  const result = await publish(pluginConfig, {
    cwd,
    env,
    options,
    branch: {type: 'release', main: true},
    nextRelease,
    logger: t.context.logger,
  });

  t.is(result.url, releaseUrl);
  t.true(t.context.log.calledWith('Published GitHub release: %s', releaseUrl));
  t.true(t.context.error.calledWith('The asset %s cannot be read, and will be ignored.', 'missing.txt'));
  t.true(t.context.error.calledWith('The asset %s is not a file, and will be ignored.', emptyDirectory));
  t.true(github.isDone());
});

test.serial('Throw error without retries for 400 error', async t => {
  const owner = 'test_user';
  const repo = 'test_repo';
  const env = {GITHUB_TOKEN: 'github_token'};
  const pluginConfig = {};
  const nextRelease = {gitTag: 'v1.0.0', name: 'v1.0.0', notes: 'Test release note body'};
  const options = {repositoryUrl: `https://github.com/${owner}/${repo}.git`};

  const github = authenticate(env)
    .post(`/repos/${owner}/${repo}/releases`, {
      tag_name: nextRelease.gitTag,
      name: nextRelease.name,
      body: nextRelease.notes,
      prerelease: false,
    })
    .reply(404)
    .post(`/repos/${owner}/${repo}/releases`, {
      tag_name: nextRelease.gitTag,
      name: nextRelease.gitTag,
      body: nextRelease.notes,
      prerelease: false,
    })
    .reply(400);

  const error = await t.throwsAsync(
    publish(pluginConfig, {
      cwd,
      env,
      options,
      branch: {type: 'release', main: true},
      nextRelease,
      logger: t.context.logger,
    })
  );

  t.is(error.status, 400);
  t.true(github.isDone());
});
