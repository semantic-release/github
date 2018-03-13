import test from 'ava';
import nock from 'nock';
import {stub} from 'sinon';
import proxyquire from 'proxyquire';
import getClient from '../lib/get-client';
import {authenticate} from './helpers/mock-github';

// Save the current process.env
const envBackup = Object.assign({}, process.env);

const verify = proxyquire('../lib/verify', {
  './get-client': conf =>
    getClient({
      ...conf,
      ...{retry: {retries: 3, factor: 1, minTimeout: 1, maxTimeout: 1}, limit: {search: 1, core: 1}, globalLimit: 1},
    }),
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

test.serial('Verify package, token and repository access', async t => {
  const owner = 'test_user';
  const repo = 'test_repo';
  process.env.GH_TOKEN = 'github_token';
  const assets = [{path: 'lib/file.js'}, 'file.js'];
  const successComment = 'Test comment';
  const failTitle = 'Test title';
  const failComment = 'Test comment';
  const labels = ['semantic-release'];
  const github = authenticate()
    .get(`/repos/${owner}/${repo}`)
    .reply(200, {permissions: {push: true}});

  await t.notThrows(
    verify(
      {assets, successComment, failTitle, failComment, labels},
      {options: {repositoryUrl: `git+https://othertesturl.com/${owner}/${repo}.git`}, logger: t.context.logger}
    )
  );
  t.true(github.isDone());
});

test.serial(
  'Verify package, token and repository access with "asset", "successComment", "failTitle", "failComment" and "label" set to "false"',
  async t => {
    const owner = 'test_user';
    const repo = 'test_repo';
    process.env.GH_TOKEN = 'github_token';
    const assets = false;
    const successComment = false;
    const failTitle = false;
    const failComment = false;
    const labels = false;
    const github = authenticate()
      .get(`/repos/${owner}/${repo}`)
      .reply(200, {permissions: {push: true}});

    await t.notThrows(
      verify(
        {assets, successComment, failTitle, failComment, labels},
        {options: {repositoryUrl: `git+https://othertesturl.com/${owner}/${repo}.git`}, logger: t.context.logger}
      )
    );
    t.true(github.isDone());
  }
);

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
      {options: {repositoryUrl: `git@othertesturl.com:${owner}/${repo}.git`}, logger: t.context.logger}
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
    verify(
      {githubUrl},
      {options: {repositoryUrl: `git@othertesturl.com:${owner}/${repo}.git`}, logger: t.context.logger}
    )
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

  await t.notThrows(
    verify({}, {options: {repositoryUrl: `git@othertesturl.com:${owner}/${repo}.git`}, logger: t.context.logger})
  );

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

  await t.notThrows(
    verify({}, {options: {repositoryUrl: `git@othertesturl.com:${owner}/${repo}.git`}, logger: t.context.logger})
  );
  t.true(github.isDone());
});

test.serial('Verify "assets" is a String', async t => {
  const owner = 'test_user';
  const repo = 'test_repo';
  process.env.GITHUB_TOKEN = 'github_token';
  const assets = 'file2.js';
  const github = authenticate()
    .get(`/repos/${owner}/${repo}`)
    .reply(200, {permissions: {push: true}});

  await t.notThrows(
    verify({assets}, {options: {repositoryUrl: `git@othertesturl.com:${owner}/${repo}.git`}, logger: t.context.logger})
  );

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

  await t.notThrows(
    verify({assets}, {options: {repositoryUrl: `git@othertesturl.com:${owner}/${repo}.git`}, logger: t.context.logger})
  );

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

  await t.notThrows(
    verify({assets}, {options: {repositoryUrl: `git@othertesturl.com:${owner}/${repo}.git`}, logger: t.context.logger})
  );

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

  await t.notThrows(
    verify({assets}, {options: {repositoryUrl: `git@othertesturl.com:${owner}/${repo}.git`}, logger: t.context.logger})
  );

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

  await t.notThrows(
    verify({assets}, {options: {repositoryUrl: `git@othertesturl.com:${owner}/${repo}.git`}, logger: t.context.logger})
  );

  t.true(github.isDone());
});

test.serial('Verify "labels" is a String', async t => {
  const owner = 'test_user';
  const repo = 'test_repo';
  process.env.GITHUB_TOKEN = 'github_token';
  const labels = 'semantic-release';
  const github = authenticate()
    .get(`/repos/${owner}/${repo}`)
    .reply(200, {permissions: {push: true}});

  await t.notThrows(
    verify({labels}, {options: {repositoryUrl: `git@othertesturl.com:${owner}/${repo}.git`}, logger: t.context.logger})
  );

  t.true(github.isDone());
});

test.serial('Verify "assignees" is a String', async t => {
  const owner = 'test_user';
  const repo = 'test_repo';
  process.env.GITHUB_TOKEN = 'github_token';
  const assignees = 'user';
  const github = authenticate()
    .get(`/repos/${owner}/${repo}`)
    .reply(200, {permissions: {push: true}});

  await t.notThrows(
    verify(
      {assignees},
      {options: {repositoryUrl: `git@othertesturl.com:${owner}/${repo}.git`}, logger: t.context.logger}
    )
  );

  t.true(github.isDone());
});

test.serial('Throw SemanticReleaseError for missing github token', async t => {
  const [error] = await t.throws(
    verify({}, {options: {repositoryUrl: 'https://github.com/semantic-release/github.git'}, logger: t.context.logger})
  );

  t.is(error.name, 'SemanticReleaseError');
  t.is(error.code, 'ENOGHTOKEN');
});

test.serial('Throw SemanticReleaseError for invalid token', async t => {
  const owner = 'test_user';
  const repo = 'test_repo';
  process.env.GITHUB_TOKEN = 'github_token';
  const github = authenticate()
    .get(`/repos/${owner}/${repo}`)
    .reply(401);

  const [error] = await t.throws(
    verify({}, {options: {repositoryUrl: `https://github.com/${owner}/${repo}.git`}, logger: t.context.logger})
  );

  t.is(error.name, 'SemanticReleaseError');
  t.is(error.code, 'EINVALIDGHTOKEN');
  t.true(github.isDone());
});

test.serial('Throw SemanticReleaseError for invalid repositoryUrl', async t => {
  process.env.GITHUB_TOKEN = 'github_token';

  const [error] = await t.throws(verify({}, {options: {repositoryUrl: 'invalid_url'}, logger: t.context.logger}));

  t.is(error.name, 'SemanticReleaseError');
  t.is(error.code, 'EINVALIDGITHUBURL');
});

test.serial("Throw SemanticReleaseError if token doesn't have the push permission on the repository", async t => {
  const owner = 'test_user';
  const repo = 'test_repo';
  process.env.GITHUB_TOKEN = 'github_token';
  const github = authenticate()
    .get(`/repos/${owner}/${repo}`)
    .reply(200, {permissions: {push: false}});

  const [error] = await t.throws(
    verify({}, {options: {repositoryUrl: `https://github.com/${owner}/${repo}.git`}, logger: t.context.logger})
  );

  t.is(error.name, 'SemanticReleaseError');
  t.is(error.code, 'EGHNOPERMISSION');
  t.true(github.isDone());
});

test.serial("Throw SemanticReleaseError if the repository doesn't exist", async t => {
  const owner = 'test_user';
  const repo = 'test_repo';
  process.env.GITHUB_TOKEN = 'github_token';
  const github = authenticate()
    .get(`/repos/${owner}/${repo}`)
    .times(4)
    .reply(404);

  const [error] = await t.throws(
    verify({}, {options: {repositoryUrl: `https://github.com/${owner}/${repo}.git`}, logger: t.context.logger})
  );

  t.is(error.name, 'SemanticReleaseError');
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
    verify({}, {options: {repositoryUrl: `https://github.com/${owner}/${repo}.git`}, logger: t.context.logger})
  );

  t.is(error.code, 500);
  t.true(github.isDone());
});

test.serial('Throw SemanticReleaseError if "assets" option is not a String or an Array of Objects', async t => {
  process.env.GITHUB_TOKEN = 'github_token';
  const assets = 42;

  const [error] = await t.throws(
    verify(
      {assets},
      {options: {repositoryUrl: 'https://github.com/semantic-release/github.git'}, logger: t.context.logger}
    )
  );

  t.is(error.name, 'SemanticReleaseError');
  t.is(error.code, 'EINVALIDASSETS');
});

test.serial('Throw SemanticReleaseError if "assets" option is an Array with invalid elements', async t => {
  process.env.GITHUB_TOKEN = 'github_token';
  const assets = ['file.js', 42];

  const [error] = await t.throws(
    verify(
      {assets},
      {options: {repositoryUrl: 'https://github.com/semantic-release/github.git'}, logger: t.context.logger}
    )
  );

  t.is(error.name, 'SemanticReleaseError');
  t.is(error.code, 'EINVALIDASSETS');
});

test.serial('Throw SemanticReleaseError if "assets" option is an Object missing the "path" property', async t => {
  process.env.GITHUB_TOKEN = 'github_token';
  const assets = {name: 'file.js'};

  const [error] = await t.throws(
    verify(
      {assets},
      {options: {repositoryUrl: 'https://github.com/semantic-release/github.git'}, logger: t.context.logger}
    )
  );

  t.is(error.name, 'SemanticReleaseError');
  t.is(error.code, 'EINVALIDASSETS');
});

test.serial(
  'Throw SemanticReleaseError if "assets" option is an Array with objects missing the "path" property',
  async t => {
    process.env.GITHUB_TOKEN = 'github_token';
    const assets = [{path: 'lib/file.js'}, {name: 'file.js'}];

    const [error] = await t.throws(
      verify(
        {assets},
        {options: {repositoryUrl: 'https://github.com/semantic-release/github.git'}, logger: t.context.logger}
      )
    );

    t.is(error.name, 'SemanticReleaseError');
    t.is(error.code, 'EINVALIDASSETS');
  }
);

test('Throw SemanticReleaseError if "successComment" option is not a String', async t => {
  const successComment = 42;
  const [error] = await t.throws(
    verify(
      {successComment},
      {options: {repositoryUrl: 'https://github.com/semantic-release/github.git'}, logger: t.context.logger}
    )
  );

  t.is(error.name, 'SemanticReleaseError');
  t.is(error.code, 'EINVALIDSUCCESSCOMMENT');
});

test('Throw SemanticReleaseError if "successComment" option is an empty String', async t => {
  const successComment = '';
  const [error] = await t.throws(
    verify(
      {successComment},
      {options: {repositoryUrl: 'https://github.com/semantic-release/github.git'}, logger: t.context.logger}
    )
  );

  t.is(error.name, 'SemanticReleaseError');
  t.is(error.code, 'EINVALIDSUCCESSCOMMENT');
});

test('Throw SemanticReleaseError if "successComment" option is a whitespace String', async t => {
  const successComment = '  \n \r ';
  const [error] = await t.throws(
    verify(
      {successComment},
      {options: {repositoryUrl: 'https://github.com/semantic-release/github.git'}, logger: t.context.logger}
    )
  );

  t.is(error.name, 'SemanticReleaseError');
  t.is(error.code, 'EINVALIDSUCCESSCOMMENT');
});

test('Throw SemanticReleaseError if "failTitle" option is not a String', async t => {
  const failTitle = 42;
  const [error] = await t.throws(
    verify(
      {failTitle},
      {options: {repositoryUrl: 'https://github.com/semantic-release/github.git'}, logger: t.context.logger}
    )
  );

  t.is(error.name, 'SemanticReleaseError');
  t.is(error.code, 'EINVALIDFAILTITLE');
});

test('Throw SemanticReleaseError if "failTitle" option is an empty String', async t => {
  const failTitle = '';
  const [error] = await t.throws(
    verify(
      {failTitle},
      {options: {repositoryUrl: 'https://github.com/semantic-release/github.git'}, logger: t.context.logger}
    )
  );

  t.is(error.name, 'SemanticReleaseError');
  t.is(error.code, 'EINVALIDFAILTITLE');
});

test('Throw SemanticReleaseError if "failTitle" option is a whitespace String', async t => {
  const failTitle = '  \n \r ';
  const [error] = await t.throws(
    verify(
      {failTitle},
      {options: {repositoryUrl: 'https://github.com/semantic-release/github.git'}, logger: t.context.logger}
    )
  );

  t.is(error.name, 'SemanticReleaseError');
  t.is(error.code, 'EINVALIDFAILTITLE');
});

test('Throw SemanticReleaseError if "failComment" option is not a String', async t => {
  const failComment = 42;
  const [error] = await t.throws(
    verify(
      {failComment},
      {options: {repositoryUrl: 'https://github.com/semantic-release/github.git'}, logger: t.context.logger}
    )
  );

  t.is(error.name, 'SemanticReleaseError');
  t.is(error.code, 'EINVALIDFAILCOMMENT');
});

test('Throw SemanticReleaseError if "failComment" option is an empty String', async t => {
  const failComment = '';
  const [error] = await t.throws(
    verify(
      {failComment},
      {options: {repositoryUrl: 'https://github.com/semantic-release/github.git'}, logger: t.context.logger}
    )
  );

  t.is(error.name, 'SemanticReleaseError');
  t.is(error.code, 'EINVALIDFAILCOMMENT');
});

test('Throw SemanticReleaseError if "failComment" option is a whitespace String', async t => {
  const failComment = '  \n \r ';
  const [error] = await t.throws(
    verify(
      {failComment},
      {options: {repositoryUrl: 'https://github.com/semantic-release/github.git'}, logger: t.context.logger}
    )
  );

  t.is(error.name, 'SemanticReleaseError');
  t.is(error.code, 'EINVALIDFAILCOMMENT');
});

test.serial('Throw SemanticReleaseError if "labels" option is not a String or an Array of String', async t => {
  process.env.GITHUB_TOKEN = 'github_token';
  const labels = 42;

  const [error] = await t.throws(
    verify(
      {labels},
      {options: {repositoryUrl: 'https://github.com/semantic-release/github.git'}, logger: t.context.logger}
    )
  );

  t.is(error.name, 'SemanticReleaseError');
  t.is(error.code, 'EINVALIDLABELS');
});

test.serial('Throw SemanticReleaseError if "labels" option is an Array with invalid elements', async t => {
  process.env.GITHUB_TOKEN = 'github_token';
  const labels = ['label1', 42];

  const [error] = await t.throws(
    verify(
      {labels},
      {options: {repositoryUrl: 'https://github.com/semantic-release/github.git'}, logger: t.context.logger}
    )
  );

  t.is(error.name, 'SemanticReleaseError');
  t.is(error.code, 'EINVALIDLABELS');
});

test('Throw SemanticReleaseError if "labels" option is a whitespace String', async t => {
  const labels = '  \n \r ';
  const [error] = await t.throws(
    verify(
      {labels},
      {options: {repositoryUrl: 'https://github.com/semantic-release/github.git'}, logger: t.context.logger}
    )
  );

  t.is(error.name, 'SemanticReleaseError');
  t.is(error.code, 'EINVALIDLABELS');
});

test.serial('Throw SemanticReleaseError if "assignees" option is not a String or an Array of String', async t => {
  process.env.GITHUB_TOKEN = 'github_token';
  const assignees = 42;

  const [error] = await t.throws(
    verify(
      {assignees},
      {options: {repositoryUrl: 'https://github.com/semantic-release/github.git'}, logger: t.context.logger}
    )
  );

  t.is(error.name, 'SemanticReleaseError');
  t.is(error.code, 'EINVALIDASSIGNEES');
});

test.serial('Throw SemanticReleaseError if "assignees" option is an Array with invalid elements', async t => {
  process.env.GITHUB_TOKEN = 'github_token';
  const assignees = ['user', 42];

  const [error] = await t.throws(
    verify(
      {assignees},
      {options: {repositoryUrl: 'https://github.com/semantic-release/github.git'}, logger: t.context.logger}
    )
  );

  t.is(error.name, 'SemanticReleaseError');
  t.is(error.code, 'EINVALIDASSIGNEES');
});

test('Throw SemanticReleaseError if "assignees" option is a whitespace String', async t => {
  const assignees = '  \n \r ';
  const [error] = await t.throws(
    verify(
      {assignees},
      {options: {repositoryUrl: 'https://github.com/semantic-release/github.git'}, logger: t.context.logger}
    )
  );

  t.is(error.name, 'SemanticReleaseError');
  t.is(error.code, 'EINVALIDASSIGNEES');
});
