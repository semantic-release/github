import test from 'ava';
import nock from 'nock';
import {stub} from 'sinon';
import SemanticReleaseError from '@semantic-release/error';
import verify from '../lib/verify';
import {authenticate} from './helpers/mock-github';

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

test.serial('Verify package, token and repository access', async t => {
  const owner = 'test_user';
  const repo = 'test_repo';
  process.env.GH_TOKEN = 'github_token';
  const assets = [{path: 'lib/file.js'}, 'file.js'];
  const github = authenticate()
    .get(`/repos/${owner}/${repo}`)
    .reply(200, {permissions: {push: true}});

  await t.notThrows(
    verify({assets}, {repositoryUrl: `git+https://othertesturl.com/${owner}/${repo}.git`}, t.context.logger)
  );
  t.true(github.isDone());
});

test.serial('Verify package, token and repository access and custom URL with prefix', async t => {
  const owner = 'test_user';
  const repo = 'test_repo';
  process.env.GH_TOKEN = 'github_token';
  const githubUrl = 'https://othertesturl.com:9090';
  const githubApiPathPrefix = 'prefix';
  const github = authenticate({githubUrl, githubApiPathPrefix})
    .get(`/repos/${owner}/${repo}`)
    .reply(200, {permissions: {push: true}});

  await t.notThrows(
    verify(
      {githubUrl, githubApiPathPrefix},
      {repositoryUrl: `git@othertesturl.com:${owner}/${repo}.git`},
      t.context.logger
    )
  );

  t.true(github.isDone());
  t.deepEqual(t.context.log.args[0], ['Verify GitHub authentication (%s)', 'https://othertesturl.com:9090/prefix']);
});

test.serial('Verify package, token and repository access and custom URL without prefix', async t => {
  const owner = 'test_user';
  const repo = 'test_repo';
  process.env.GH_TOKEN = 'github_token';
  const githubUrl = 'https://othertesturl.com:9090';
  const github = authenticate({githubUrl})
    .get(`/repos/${owner}/${repo}`)
    .reply(200, {permissions: {push: true}});

  await t.notThrows(
    verify({githubUrl}, {repositoryUrl: `git@othertesturl.com:${owner}/${repo}.git`}, t.context.logger)
  );

  t.true(github.isDone());
  t.deepEqual(t.context.log.args[0], ['Verify GitHub authentication (%s)', 'https://othertesturl.com:9090']);
});

test.serial('Verify package, token and repository with environment variables', async t => {
  const owner = 'test_user';
  const repo = 'test_repo';
  process.env.GH_URL = 'https://othertesturl.com:443';
  process.env.GH_TOKEN = 'github_token';
  process.env.GH_PREFIX = 'prefix';
  const github = authenticate()
    .get(`/repos/${owner}/${repo}`)
    .reply(200, {permissions: {push: true}});

  await t.notThrows(verify({}, {repositoryUrl: `git@othertesturl.com:${owner}/${repo}.git`}, t.context.logger));

  t.true(github.isDone());
  t.deepEqual(t.context.log.args[0], ['Verify GitHub authentication (%s)', 'https://othertesturl.com:443/prefix']);
});

test.serial('Verify package, token and repository access with alternative environment varialbes', async t => {
  const owner = 'test_user';
  const repo = 'test_repo';
  process.env.GITHUB_URL = 'https://othertesturl.com:443';
  process.env.GITHUB_TOKEN = 'github_token';
  process.env.GITHUB_PREFIX = 'prefix';

  const github = authenticate()
    .get(`/repos/${owner}/${repo}`)
    .reply(200, {permissions: {push: true}});

  await t.notThrows(verify({}, {repositoryUrl: `git@othertesturl.com:${owner}/${repo}.git`}, t.context.logger));
  t.true(github.isDone());
});

test.serial('Throw SemanticReleaseError if "assets" option is not a String or an Array of Objects', async t => {
  process.env.GITHUB_TOKEN = 'github_token';
  const assets = 42;

  const error = await t.throws(
    verify({assets}, {repositoryUrl: 'https://github.com/semantic-release/github.git'}, t.context.logger)
  );

  t.true(error instanceof SemanticReleaseError);
  t.is(error.code, 'EINVALIDASSETS');
});

test.serial('Throw SemanticReleaseError if "assets" option is an Array with invalid elements', async t => {
  process.env.GITHUB_TOKEN = 'github_token';
  const assets = ['file.js', 42];

  const error = await t.throws(
    verify({assets}, {repositoryUrl: 'https://github.com/semantic-release/github.git'}, t.context.logger)
  );

  t.true(error instanceof SemanticReleaseError);
  t.is(error.code, 'EINVALIDASSETS');
});

test.serial('Verify "assets" is a String', async t => {
  const owner = 'test_user';
  const repo = 'test_repo';
  process.env.GITHUB_TOKEN = 'github_token';
  const assets = 'file2.js';
  const github = authenticate()
    .get(`/repos/${owner}/${repo}`)
    .reply(200, {permissions: {push: true}});

  await t.notThrows(verify({assets}, {repositoryUrl: `git@othertesturl.com:${owner}/${repo}.git`}, t.context.logger));

  t.true(github.isDone());
});

test.serial('Verify "assets" is an Object with a path property', async t => {
  const owner = 'test_user';
  const repo = 'test_repo';
  process.env.GITHUB_TOKEN = 'github_token';
  const assets = {path: 'file2.js'};
  const github = authenticate()
    .get(`/repos/${owner}/${repo}`)
    .reply(200, {permissions: {push: true}});

  await t.notThrows(verify({assets}, {repositoryUrl: `git@othertesturl.com:${owner}/${repo}.git`}, t.context.logger));

  t.true(github.isDone());
});

test.serial('Verify "assets" is an Array of Object with a path property', async t => {
  const owner = 'test_user';
  const repo = 'test_repo';
  process.env.GITHUB_TOKEN = 'github_token';
  const assets = [{path: 'file1.js'}, {path: 'file2.js'}];
  const github = authenticate()
    .get(`/repos/${owner}/${repo}`)
    .reply(200, {permissions: {push: true}});

  await t.notThrows(verify({assets}, {repositoryUrl: `git@othertesturl.com:${owner}/${repo}.git`}, t.context.logger));

  t.true(github.isDone());
});

test.serial('Verify "assets" is an Array of glob Arrays', async t => {
  const owner = 'test_user';
  const repo = 'test_repo';
  process.env.GITHUB_TOKEN = 'github_token';
  const assets = [['dist/**', '!**/*.js'], 'file2.js'];
  const github = authenticate()
    .get(`/repos/${owner}/${repo}`)
    .reply(200, {permissions: {push: true}});

  await t.notThrows(verify({assets}, {repositoryUrl: `git@othertesturl.com:${owner}/${repo}.git`}, t.context.logger));

  t.true(github.isDone());
});

test.serial('Verify "assets" is an Array of Object with a glob Arrays in path property', async t => {
  const owner = 'test_user';
  const repo = 'test_repo';
  process.env.GITHUB_TOKEN = 'github_token';
  const assets = [{path: ['dist/**', '!**/*.js']}, {path: 'file2.js'}];
  const github = authenticate()
    .get(`/repos/${owner}/${repo}`)
    .reply(200, {permissions: {push: true}});

  await t.notThrows(verify({assets}, {repositoryUrl: `git@othertesturl.com:${owner}/${repo}.git`}, t.context.logger));

  t.true(github.isDone());
});

test.serial('Throw SemanticReleaseError if "assets" option is an Object missing the "path" property', async t => {
  process.env.GITHUB_TOKEN = 'github_token';
  const assets = {name: 'file.js'};

  const error = await t.throws(
    verify({assets}, {repositoryUrl: 'https://github.com/semantic-release/github.git'}, t.context.logger)
  );

  t.true(error instanceof SemanticReleaseError);
  t.is(error.code, 'EINVALIDASSETS');
});

test.serial(
  'Throw SemanticReleaseError if "assets" option is an Array with objects missing the "path" property',
  async t => {
    process.env.GITHUB_TOKEN = 'github_token';
    const assets = [{path: 'lib/file.js'}, {name: 'file.js'}];

    const error = await t.throws(
      verify({assets}, {repositoryUrl: 'https://github.com/semantic-release/github.git'}, t.context.logger)
    );

    t.true(error instanceof SemanticReleaseError);
    t.is(error.code, 'EINVALIDASSETS');
  }
);

test.serial('Throw SemanticReleaseError for missing github token', async t => {
  const error = await t.throws(
    verify({}, {repositoryUrl: 'https://github.com/semantic-release/github.git'}, t.context.logger)
  );

  t.true(error instanceof SemanticReleaseError);
  t.is(error.code, 'ENOGHTOKEN');
});

test.serial('Throw SemanticReleaseError for invalid token', async t => {
  const owner = 'test_user';
  const repo = 'test_repo';
  process.env.GITHUB_TOKEN = 'github_token';
  const github = authenticate()
    .get(`/repos/${owner}/${repo}`)
    .reply(401);

  const error = await t.throws(
    verify({}, {repositoryUrl: `https://github.com:${owner}/${repo}.git`}, t.context.logger)
  );

  t.true(error instanceof SemanticReleaseError);
  t.is(error.code, 'EINVALIDGHTOKEN');
  t.true(github.isDone());
});

test.serial('Throw SemanticReleaseError for invalid repositoryUrl', async t => {
  process.env.GITHUB_TOKEN = 'github_token';

  const error = await t.throws(verify({}, {repositoryUrl: 'invalid_url'}, t.context.logger));

  t.true(error instanceof SemanticReleaseError);
  t.is(error.code, 'EINVALIDGITURL');
});

test.serial("Throw SemanticReleaseError if token doesn't have the push permission on the repository", async t => {
  const owner = 'test_user';
  const repo = 'test_repo';
  process.env.GITHUB_TOKEN = 'github_token';
  const github = authenticate()
    .get(`/repos/${owner}/${repo}`)
    .reply(200, {permissions: {push: false}});

  const error = await t.throws(
    verify({}, {repositoryUrl: `https://github.com:${owner}/${repo}.git`}, t.context.logger)
  );

  t.true(error instanceof SemanticReleaseError);
  t.is(error.code, 'EGHNOPERMISSION');
  t.true(github.isDone());
});

test.serial("Throw SemanticReleaseError if the repository doesn't exist", async t => {
  const owner = 'test_user';
  const repo = 'test_repo';
  process.env.GITHUB_TOKEN = 'github_token';
  const github = authenticate()
    .get(`/repos/${owner}/${repo}`)
    .reply(404);

  const error = await t.throws(
    verify({}, {repositoryUrl: `https://github.com:${owner}/${repo}.git`}, t.context.logger)
  );

  t.true(error instanceof SemanticReleaseError);
  t.is(error.code, 'EMISSINGREPO');
  t.true(github.isDone());
});

test.serial('Throw error if github return any other errors', async t => {
  const owner = 'test_user';
  const repo = 'test_repo';
  process.env.GITHUB_TOKEN = 'github_token';
  const github = authenticate()
    .get(`/repos/${owner}/${repo}`)
    .reply(500);

  const error = await t.throws(
    verify({}, {repositoryUrl: `https://github.com:${owner}/${repo}.git`}, t.context.logger)
  );

  t.is(error.code, 500);
  t.true(github.isDone());
});
