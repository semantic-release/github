import test from 'ava';
import nock from 'nock';
import SemanticReleaseError from '@semantic-release/error';
import verify from '../lib/verify';
import {authenticate} from './helpers/mock-github';

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
});

test.afterEach.always(t => {
  // Restore process.env
  process.env = Object.assign({}, t.context.env);
  // Clear nock
  nock.cleanAll();
});

test.serial('Verify package, token and repository access', async t => {
  const owner = 'test_user';
  const repo = 'test_repo';
  const githubToken = 'github_token';
  const assets = [{path: 'lib/file.js'}, 'file.js'];

  const github = authenticate({githubToken})
    .get(`/repos/${owner}/${repo}`)
    .reply(200, {permissions: {push: true}});

  await t.notThrows(
    verify(
      {githubToken, assets},
      {name: 'package-name', repository: {url: `git+https://othertesturl.com/${owner}/${repo}.git`}}
    )
  );
  t.true(github.isDone());
});

test.serial('Verify package, token and repository access and custom URL', async t => {
  const owner = 'test_user';
  const repo = 'test_repo';
  const githubUrl = 'https://othertesturl.com:443';
  const githubToken = 'github_token';
  const githubApiPathPrefix = 'prefix';

  const github = authenticate({githubUrl, githubToken, githubApiPathPrefix})
    .get(`/repos/${owner}/${repo}`)
    .reply(200, {permissions: {push: true}});

  await t.notThrows(
    verify(
      {githubUrl, githubToken, githubApiPathPrefix},
      {name: 'package-name', repository: {url: `git@othertesturl.com:${owner}/${repo}.git`}}
    )
  );
  t.true(github.isDone());
});

test.serial('Verify package, token and repository with environment varialbes', async t => {
  const owner = 'test_user';
  const repo = 'test_repo';
  process.env.GH_URL = 'https://othertesturl.com:443';
  process.env.GH_TOKEN = 'github_token';
  process.env.GH_PREFIX = 'prefix';

  const github = authenticate({
    githubUrl: process.env.GH_URL,
    githubToken: process.env.GH_TOKEN,
    githubApiPathPrefix: process.env.GH_PREFIX,
  })
    .get(`/repos/${owner}/${repo}`)
    .reply(200, {permissions: {push: true}});

  await t.notThrows(
    verify(
      {githubUrl: process.env.GH_URL, githubApiPathPrefix: process.env.GH_PREFIX},
      {name: 'package-name', repository: {url: `git@othertesturl.com:${owner}/${repo}.git`}}
    )
  );
  t.true(github.isDone());
});

test.serial('Verify package, token and repository access with alternative environment varialbes', async t => {
  const owner = 'test_user';
  const repo = 'test_repo';
  process.env.GITHUB_URL = 'https://othertesturl.com:443';
  process.env.GITHUB_TOKEN = 'github_token';
  process.env.GITHUB_PREFIX = 'prefix';

  const github = authenticate({
    githubUrl: process.env.GITHUB_URL,
    githubToken: process.env.GITHUB_TOKEN,
    githubApiPathPrefix: process.env.GITHUB_PREFIX,
  })
    .get(`/repos/${owner}/${repo}`)
    .reply(200, {permissions: {push: true}});

  await t.notThrows(
    verify(
      {githubUrl: process.env.GITHUB_URL, githubApiPathPrefix: process.env.GITHUB_PREFIX},
      {name: 'package-name', repository: {url: `git@othertesturl.com:${owner}/${repo}.git`}}
    )
  );
  t.true(github.isDone());
});

test.serial('Throw SemanticReleaseError for missing package name', async t => {
  const error = await t.throws(verify({}, {repository: {url: 'http://github.com/whats/up.git'}}));

  t.true(error instanceof SemanticReleaseError);
  t.is(error.code, 'ENOPKGNAME');
});

test.serial('Throw SemanticReleaseError for missing repository', async t => {
  const error = await t.throws(verify({}, {name: 'package'}));

  t.true(error instanceof SemanticReleaseError);
  t.is(error.code, 'ENOPKGREPO');
});

test.serial('Throw SemanticReleaseError for missing repository url', async t => {
  const error = await t.throws(verify({}, {name: 'package', repository: {}}));

  t.true(error instanceof SemanticReleaseError);
  t.is(error.code, 'ENOPKGREPO');
});

test.serial('Throw SemanticReleaseError if "assets" option is not a string or an array of objects', async t => {
  const githubToken = 'github_token';
  const assets = 42;
  const error = await t.throws(
    verify(
      {githubToken, assets},
      {name: 'package', repository: {url: 'https://github.com/semantic-release/github.git'}}
    )
  );

  t.true(error instanceof SemanticReleaseError);
  t.is(error.code, 'EINVALIDASSETS');
});

test.serial('Throw SemanticReleaseError if "assets" option is an Array with invalid elements', async t => {
  const githubToken = 'github_token';
  const assets = ['file.js', 42];
  const error = await t.throws(
    verify(
      {githubToken, assets},
      {name: 'package', repository: {url: 'https://github.com/semantic-release/github.git'}}
    )
  );

  t.true(error instanceof SemanticReleaseError);
  t.is(error.code, 'EINVALIDASSETS');
});

test.serial('Throw SemanticReleaseError if "assets" option is an Object missing the "path" property', async t => {
  const githubToken = 'github_token';
  const assets = {name: 'file.js'};
  const error = await t.throws(
    verify(
      {githubToken, assets},
      {name: 'package', repository: {url: 'https://github.com/semantic-release/github.git'}}
    )
  );

  t.true(error instanceof SemanticReleaseError);
  t.is(error.code, 'EINVALIDASSETS');
});

test.serial(
  'Throw SemanticReleaseError if "assets" option is an Array with objects missing the "path" property',
  async t => {
    const githubToken = 'github_token';
    const assets = [{path: 'lib/file.js'}, {name: 'file.js'}];
    const error = await t.throws(
      verify(
        {githubToken, assets},
        {name: 'package', repository: {url: 'https://github.com/semantic-release/github.git'}}
      )
    );

    t.true(error instanceof SemanticReleaseError);
    t.is(error.code, 'EINVALIDASSETS');
  }
);

test.serial('Throw SemanticReleaseError for missing github token', async t => {
  const error = await t.throws(
    verify({}, {name: 'package', repository: {url: 'https://github.com/semantic-release/github.git'}})
  );

  t.true(error instanceof SemanticReleaseError);
  t.is(error.code, 'ENOGHTOKEN');
});

test.serial('Throw SemanticReleaseError for invalid token', async t => {
  const owner = 'test_user';
  const repo = 'test_repo';
  const githubToken = 'github_token';

  const github = authenticate({githubToken})
    .get(`/repos/${owner}/${repo}`)
    .reply(401);

  const error = await t.throws(
    verify({githubToken}, {name: 'package-name', repository: {url: `https://github.com:${owner}/${repo}.git`}})
  );

  t.true(error instanceof SemanticReleaseError);
  t.is(error.code, 'EINVALIDGHTOKEN');
  t.true(github.isDone());
});

test.serial("Throw SemanticReleaseError if token doesn't have the push permission on the repository", async t => {
  const owner = 'test_user';
  const repo = 'test_repo';
  const githubToken = 'github_token';

  const github = authenticate({githubToken})
    .get(`/repos/${owner}/${repo}`)
    .reply(200, {permissions: {push: false}});

  const error = await t.throws(
    verify({githubToken}, {name: 'package-name', repository: {url: `https://github.com:${owner}/${repo}.git`}})
  );

  t.true(error instanceof SemanticReleaseError);
  t.is(error.code, 'EGHNOPERMISSION');
  t.true(github.isDone());
});

test.serial("Throw SemanticReleaseError if the repository doesn't exist", async t => {
  const owner = 'test_user';
  const repo = 'test_repo';
  const githubToken = 'github_token';

  const github = authenticate({githubToken})
    .get(`/repos/${owner}/${repo}`)
    .reply(404);

  const error = await t.throws(
    verify({githubToken}, {name: 'package-name', repository: {url: `https://github.com:${owner}/${repo}.git`}})
  );

  t.true(error instanceof SemanticReleaseError);
  t.is(error.code, 'EMISSINGREPO');
  t.true(github.isDone());
});

test.serial('Throw error if github return any other errors', async t => {
  const owner = 'test_user';
  const repo = 'test_repo';
  const githubToken = 'github_token';

  const github = authenticate({githubToken})
    .get(`/repos/${owner}/${repo}`)
    .reply(500);

  const error = await t.throws(
    verify({githubToken}, {name: 'package-name', repository: {url: `https://github.com:${owner}/${repo}.git`}})
  );

  t.is(error.code, 500);
  t.true(github.isDone());
});
