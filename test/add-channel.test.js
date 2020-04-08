const test = require('ava');
const nock = require('nock');
const {stub} = require('sinon');
const proxyquire = require('proxyquire');
const {authenticate} = require('./helpers/mock-github');
const rateLimit = require('./helpers/rate-limit');

/* eslint camelcase: ["error", {properties: "never"}] */

const addChannel = proxyquire('../lib/add-channel', {
  './get-client': proxyquire('../lib/get-client', {'./definitions/rate-limit': rateLimit}),
});

test.beforeEach((t) => {
  // Mock logger
  t.context.log = stub();
  t.context.error = stub();
  t.context.logger = {log: t.context.log, error: t.context.error};
});

test.afterEach.always(() => {
  // Clear nock
  nock.cleanAll();
});

test.serial('Update a release', async (t) => {
  const owner = 'test_user';
  const repo = 'test_repo';
  const env = {GITHUB_TOKEN: 'github_token'};
  const pluginConfig = {};
  const nextRelease = {gitTag: 'v1.0.0', name: 'v1.0.0', notes: 'Test release note body'};
  const options = {repositoryUrl: `https://github.com/${owner}/${repo}.git`};
  const releaseUrl = `https://github.com/${owner}/${repo}/releases/${nextRelease.version}`;
  const releaseId = 1;

  const github = authenticate(env)
    .get(`/repos/${owner}/${repo}/releases/tags/${nextRelease.gitTag}`)
    .reply(200, {id: releaseId})
    .patch(`/repos/${owner}/${repo}/releases/${releaseId}`, {
      tag_name: nextRelease.gitTag,
      name: nextRelease.name,
      prerelease: false,
    })
    .reply(200, {html_url: releaseUrl});

  const result = await addChannel(pluginConfig, {
    env,
    options,
    branch: {type: 'release', main: true},
    nextRelease,
    logger: t.context.logger,
  });

  t.is(result.url, releaseUrl);
  t.deepEqual(t.context.log.args[0], ['Updated GitHub release: %s', releaseUrl]);
  t.true(github.isDone());
});

test.serial('Update a maintenance release', async (t) => {
  const owner = 'test_user';
  const repo = 'test_repo';
  const env = {GITHUB_TOKEN: 'github_token'};
  const pluginConfig = {};
  const nextRelease = {gitTag: 'v1.0.0', channel: '1.x', name: 'v1.0.0', notes: 'Test release note body'};
  const options = {repositoryUrl: `https://github.com/${owner}/${repo}.git`};
  const releaseUrl = `https://github.com/${owner}/${repo}/releases/${nextRelease.version}`;
  const releaseId = 1;

  const github = authenticate(env)
    .get(`/repos/${owner}/${repo}/releases/tags/${nextRelease.gitTag}`)
    .reply(200, {id: releaseId})
    .patch(`/repos/${owner}/${repo}/releases/${releaseId}`, {
      tag_name: nextRelease.gitTag,
      name: nextRelease.name,
      prerelease: false,
    })
    .reply(200, {html_url: releaseUrl});

  const result = await addChannel(pluginConfig, {
    env,
    options,
    branch: {type: 'maintenance', channel: '1.x', main: false},
    nextRelease,
    logger: t.context.logger,
  });

  t.is(result.url, releaseUrl);
  t.deepEqual(t.context.log.args[0], ['Updated GitHub release: %s', releaseUrl]);
  t.true(github.isDone());
});

test.serial('Update a prerelease', async (t) => {
  const owner = 'test_user';
  const repo = 'test_repo';
  const env = {GITHUB_TOKEN: 'github_token'};
  const pluginConfig = {};
  const nextRelease = {gitTag: 'v1.0.0', name: 'v1.0.0', notes: 'Test release note body'};
  const options = {repositoryUrl: `https://github.com/${owner}/${repo}.git`};
  const releaseUrl = `https://github.com/${owner}/${repo}/releases/${nextRelease.version}`;
  const releaseId = 1;

  const github = authenticate(env)
    .get(`/repos/${owner}/${repo}/releases/tags/${nextRelease.gitTag}`)
    .reply(200, {id: releaseId})
    .patch(`/repos/${owner}/${repo}/releases/${releaseId}`, {
      tag_name: nextRelease.gitTag,
      name: nextRelease.name,
      prerelease: false,
    })
    .reply(200, {html_url: releaseUrl});

  const result = await addChannel(pluginConfig, {
    env,
    options,
    branch: {type: 'maintenance', channel: '1.x', main: false},
    nextRelease,
    logger: t.context.logger,
  });

  t.is(result.url, releaseUrl);
  t.deepEqual(t.context.log.args[0], ['Updated GitHub release: %s', releaseUrl]);
  t.true(github.isDone());
});

test.serial('Update a release with a custom github url', async (t) => {
  const owner = 'test_user';
  const repo = 'test_repo';
  const env = {GH_URL: 'https://othertesturl.com:443', GH_TOKEN: 'github_token', GH_PREFIX: 'prefix'};
  const pluginConfig = {};
  const nextRelease = {gitTag: 'v1.0.0', name: 'v1.0.0', notes: 'Test release note body'};
  const options = {repositoryUrl: `${env.GH_URL}/${owner}/${repo}.git`};
  const releaseUrl = `${env.GH_URL}/${owner}/${repo}/releases/${nextRelease.version}`;
  const releaseId = 1;

  const github = authenticate(env)
    .get(`/repos/${owner}/${repo}/releases/tags/${nextRelease.gitTag}`)
    .reply(200, {id: releaseId})
    .patch(`/repos/${owner}/${repo}/releases/${releaseId}`, {
      tag_name: nextRelease.gitTag,
      name: nextRelease.name,
      prerelease: false,
    })
    .reply(200, {html_url: releaseUrl});

  const result = await addChannel(pluginConfig, {
    env,
    options,
    branch: {type: 'release', main: true},
    nextRelease,
    logger: t.context.logger,
  });

  t.is(result.url, releaseUrl);
  t.deepEqual(t.context.log.args[0], ['Updated GitHub release: %s', releaseUrl]);
  t.true(github.isDone());
});

test.serial('Update a release, retrying 4 times', async (t) => {
  const owner = 'test_user';
  const repo = 'test_repo';
  const env = {GITHUB_TOKEN: 'github_token'};
  const pluginConfig = {};
  const nextRelease = {gitTag: 'v1.0.0', name: 'v1.0.0', notes: 'Test release note body'};
  const options = {repositoryUrl: `https://github.com/${owner}/${repo}.git`};
  const releaseUrl = `https://github.com/${owner}/${repo}/releases/${nextRelease.version}`;
  const releaseId = 1;

  const github = authenticate(env)
    .get(`/repos/${owner}/${repo}/releases/tags/${nextRelease.gitTag}`)
    .times(3)
    .reply(404)
    .get(`/repos/${owner}/${repo}/releases/tags/${nextRelease.gitTag}`)
    .reply(200, {id: releaseId})
    .patch(`/repos/${owner}/${repo}/releases/${releaseId}`, {
      tag_name: nextRelease.gitTag,
      name: nextRelease.name,
      prerelease: false,
    })
    .times(3)
    .reply(500)
    .patch(`/repos/${owner}/${repo}/releases/${releaseId}`, {
      tag_name: nextRelease.gitTag,
      name: nextRelease.name,
      prerelease: false,
    })
    .reply(200, {html_url: releaseUrl});

  const result = await addChannel(pluginConfig, {
    env,
    options,
    branch: {type: 'release', main: true},
    nextRelease,
    logger: t.context.logger,
  });

  t.is(result.url, releaseUrl);
  t.deepEqual(t.context.log.args[0], ['Updated GitHub release: %s', releaseUrl]);
  t.true(github.isDone());
});

test.serial('Create the new release if current one is missing', async (t) => {
  const owner = 'test_user';
  const repo = 'test_repo';
  const env = {GITHUB_TOKEN: 'github_token'};
  const pluginConfig = {};
  const nextRelease = {gitTag: 'v1.0.0', name: 'v1.0.0', notes: 'Test release note body'};
  const options = {repositoryUrl: `https://github.com/${owner}/${repo}.git`};
  const releaseUrl = `https://github.com/${owner}/${repo}/releases/${nextRelease.version}`;

  const github = authenticate(env)
    .get(`/repos/${owner}/${repo}/releases/tags/${nextRelease.gitTag}`)
    .times(4)
    .reply(404)
    .post(`/repos/${owner}/${repo}/releases`, {
      tag_name: nextRelease.gitTag,
      name: nextRelease.name,
      body: nextRelease.notes,
      prerelease: false,
    })
    .reply(200, {html_url: releaseUrl});

  const result = await addChannel(pluginConfig, {
    env,
    options,
    branch: {type: 'release', main: true},
    nextRelease,
    logger: t.context.logger,
  });

  t.is(result.url, releaseUrl);
  t.deepEqual(t.context.log.args[0], ['There is no release for tag %s, creating a new one', nextRelease.gitTag]);
  t.deepEqual(t.context.log.args[1], ['Published GitHub release: %s', releaseUrl]);
  t.true(github.isDone());
});

test.serial('Throw error if cannot read current release', async (t) => {
  const owner = 'test_user';
  const repo = 'test_repo';
  const env = {GITHUB_TOKEN: 'github_token'};
  const pluginConfig = {};
  const nextRelease = {gitTag: 'v1.0.0', name: 'v1.0.0', notes: 'Test release note body'};
  const options = {repositoryUrl: `https://github.com/${owner}/${repo}.git`};

  const github = authenticate(env)
    .get(`/repos/${owner}/${repo}/releases/tags/${nextRelease.gitTag}`)
    .times(4)
    .reply(500);

  const error = await t.throwsAsync(
    addChannel(pluginConfig, {
      env,
      options,
      branch: {type: 'release', main: true},
      nextRelease,
      logger: t.context.logger,
    })
  );

  t.is(error.status, 500);
  t.true(github.isDone());
});

test.serial('Throw error if cannot create missing current release', async (t) => {
  const owner = 'test_user';
  const repo = 'test_repo';
  const env = {GITHUB_TOKEN: 'github_token'};
  const pluginConfig = {};
  const nextRelease = {gitTag: 'v1.0.0', name: 'v1.0.0', notes: 'Test release note body'};
  const options = {repositoryUrl: `https://github.com/${owner}/${repo}.git`};

  const github = authenticate(env)
    .get(`/repos/${owner}/${repo}/releases/tags/${nextRelease.gitTag}`)
    .times(4)
    .reply(404)
    .post(`/repos/${owner}/${repo}/releases`, {
      tag_name: nextRelease.gitTag,
      name: nextRelease.name,
      body: nextRelease.notes,
      prerelease: false,
    })
    .times(4)
    .reply(500);

  const error = await t.throwsAsync(
    addChannel(pluginConfig, {
      env,
      options,
      branch: {type: 'release', main: true},
      nextRelease,
      logger: t.context.logger,
    })
  );

  t.is(error.status, 500);
  t.true(github.isDone());
});

test.serial('Throw error if cannot update release', async (t) => {
  const owner = 'test_user';
  const repo = 'test_repo';
  const env = {GITHUB_TOKEN: 'github_token'};
  const pluginConfig = {};
  const nextRelease = {gitTag: 'v1.0.0', name: 'v1.0.0', notes: 'Test release note body'};
  const options = {repositoryUrl: `https://github.com/${owner}/${repo}.git`};
  const releaseId = 1;

  const github = authenticate(env)
    .get(`/repos/${owner}/${repo}/releases/tags/${nextRelease.gitTag}`)
    .reply(200, {id: releaseId})
    .patch(`/repos/${owner}/${repo}/releases/${releaseId}`, {
      tag_name: nextRelease.gitTag,
      name: nextRelease.name,
      prerelease: false,
    })
    .times(4)
    .reply(404);

  const error = await t.throwsAsync(
    addChannel(pluginConfig, {
      env,
      options,
      branch: {type: 'release', main: true},
      nextRelease,
      logger: t.context.logger,
    })
  );

  t.is(error.status, 404);
  t.true(github.isDone());
});
