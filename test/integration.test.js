const path = require('path');
const {escape} = require('querystring');
const test = require('ava');
const {stat} = require('fs-extra');
const nock = require('nock');
const {stub} = require('sinon');
const proxyquire = require('proxyquire');
const clearModule = require('clear-module');
const SemanticReleaseError = require('@semantic-release/error');
const {authenticate, upload} = require('./helpers/mock-github');
const rateLimit = require('./helpers/rate-limit');

const cwd = 'test/fixtures/files';
const client = proxyquire('../lib/get-client', {'./definitions/rate-limit': rateLimit});

test.beforeEach((t) => {
  // Clear npm cache to refresh the module state
  clearModule('..');
  t.context.m = proxyquire('..', {
    './lib/verify': proxyquire('../lib/verify', {'./get-client': client}),
    './lib/publish': proxyquire('../lib/publish', {'./get-client': client}),
    './lib/success': proxyquire('../lib/success', {'./get-client': client}),
    './lib/fail': proxyquire('../lib/fail', {'./get-client': client}),
  });
  // Stub the logger
  t.context.log = stub();
  t.context.error = stub();
  t.context.logger = {log: t.context.log, error: t.context.error};
});

test.afterEach.always(() => {
  // Clear nock
  nock.cleanAll();
});

test.serial('Verify GitHub auth', async (t) => {
  const owner = 'test_user';
  const repo = 'test_repo';
  const env = {GITHUB_TOKEN: 'github_token'};
  const options = {repositoryUrl: `git+https://othertesturl.com/${owner}/${repo}.git`};
  const github = authenticate(env)
    .get(`/repos/${owner}/${repo}`)
    .reply(200, {permissions: {push: true}});

  await t.notThrowsAsync(t.context.m.verifyConditions({}, {cwd, env, options, logger: t.context.logger}));

  t.true(github.isDone());
});

test.serial('Verify GitHub auth with publish options', async (t) => {
  const owner = 'test_user';
  const repo = 'test_repo';
  const env = {GITHUB_TOKEN: 'github_token'};
  const options = {
    publish: {path: '@semantic-release/github'},
    repositoryUrl: `git+https://othertesturl.com/${owner}/${repo}.git`,
  };
  const github = authenticate(env)
    .get(`/repos/${owner}/${repo}`)
    .reply(200, {permissions: {push: true}});

  await t.notThrowsAsync(t.context.m.verifyConditions({}, {cwd, env, options, logger: t.context.logger}));

  t.true(github.isDone());
});

test.serial('Verify GitHub auth and assets config', async (t) => {
  const owner = 'test_user';
  const repo = 'test_repo';
  const env = {GITHUB_TOKEN: 'github_token'};
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
  const github = authenticate(env)
    .get(`/repos/${owner}/${repo}`)
    .reply(200, {permissions: {push: true}});

  await t.notThrowsAsync(t.context.m.verifyConditions({assets}, {cwd, env, options, logger: t.context.logger}));

  t.true(github.isDone());
});

test.serial('Throw SemanticReleaseError if invalid config', async (t) => {
  const env = {};
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

  const errors = [
    ...(await t.throwsAsync(t.context.m.verifyConditions({}, {cwd, env, options, logger: t.context.logger}))),
  ];

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

test.serial('Publish a release with an array of assets', async (t) => {
  const owner = 'test_user';
  const repo = 'test_repo';
  const env = {GITHUB_TOKEN: 'github_token'};
  const assets = [
    {path: ['upload.txt'], name: 'upload_file_name.txt'},
    {path: ['upload_other.txt'], name: 'other_file.txt', label: 'Other File'},
  ];
  const nextRelease = {gitTag: 'v1.0.0', name: 'v1.0.0', notes: 'Test release note body'};
  const options = {repositoryUrl: `https://github.com/${owner}/${repo}.git`};
  const releaseUrl = `https://github.com/${owner}/${repo}/releases/${nextRelease.version}`;
  const assetUrl = `https://github.com/${owner}/${repo}/releases/download/${nextRelease.version}/upload.txt`;
  const otherAssetUrl = `https://github.com/${owner}/${repo}/releases/download/${nextRelease.version}/other_file.txt`;
  const releaseId = 1;
  const uploadUri = `/api/uploads/repos/${owner}/${repo}/releases/${releaseId}/assets`;
  const uploadUrl = `https://github.com${uploadUri}{?name,label}`;
  const github = authenticate(env)
    .get(`/repos/${owner}/${repo}`)
    .reply(200, {permissions: {push: true}})
    .post(`/repos/${owner}/${repo}/releases`, {
      tag_name: nextRelease.gitTag,
      name: nextRelease.name,
      body: nextRelease.notes,
      draft: true,
      prerelease: false,
    })
    .reply(200, {upload_url: uploadUrl, html_url: releaseUrl, id: releaseId})
    .patch(`/repos/${owner}/${repo}/releases/${releaseId}`, {draft: false})
    .reply(200, {html_url: releaseUrl});
  const githubUpload1 = upload(env, {
    uploadUrl: 'https://github.com',
    contentLength: (await stat(path.resolve(cwd, 'upload.txt'))).size,
  })
    .post(`${uploadUri}?name=${escape('upload_file_name.txt')}`)
    .reply(200, {browser_download_url: assetUrl});
  const githubUpload2 = upload(env, {
    uploadUrl: 'https://github.com',
    contentLength: (await stat(path.resolve(cwd, 'upload_other.txt'))).size,
  })
    .post(`${uploadUri}?name=${escape('other_file.txt')}&label=${escape('Other File')}`)
    .reply(200, {browser_download_url: otherAssetUrl});

  const result = await t.context.m.publish(
    {assets},
    {cwd, env, options, branch: {type: 'release', main: true}, nextRelease, logger: t.context.logger}
  );

  t.is(result.url, releaseUrl);
  t.deepEqual(t.context.log.args[0], ['Verify GitHub authentication']);
  t.true(t.context.log.calledWith('Published file %s', otherAssetUrl));
  t.true(t.context.log.calledWith('Published file %s', assetUrl));
  t.true(t.context.log.calledWith('Published GitHub release: %s', releaseUrl));
  t.true(github.isDone());
  t.true(githubUpload1.isDone());
  t.true(githubUpload2.isDone());
});

test.serial('Publish a release with release information in assets', async (t) => {
  const owner = 'test_user';
  const repo = 'test_repo';
  const env = {GITHUB_TOKEN: 'github_token'};
  const assets = [
    {
      path: ['upload.txt'],
      name: `file_with_release_\${nextRelease.gitTag}_in_filename.txt`,
      label: `File with release \${nextRelease.gitTag} in label`,
    },
  ];
  const nextRelease = {gitTag: 'v1.0.0', name: 'v1.0.0', notes: 'Test release note body'};
  const options = {repositoryUrl: `https://github.com/${owner}/${repo}.git`};
  const releaseUrl = `https://github.com/${owner}/${repo}/releases/${nextRelease.version}`;
  const assetUrl = `https://github.com/${owner}/${repo}/releases/download/${nextRelease.version}/file_with_release_v1.0.0_in_filename.txt`;
  const releaseId = 1;
  const uploadUri = `/api/uploads/repos/${owner}/${repo}/releases/${releaseId}/assets`;
  const uploadUrl = `https://github.com${uploadUri}{?name,label}`;
  const github = authenticate(env)
    .get(`/repos/${owner}/${repo}`)
    .reply(200, {permissions: {push: true}})
    .post(`/repos/${owner}/${repo}/releases`, {
      tag_name: nextRelease.gitTag,
      target_commitish: options.branch,
      name: nextRelease.gitTag,
      body: nextRelease.notes,
      prerelease: true,
      draft: true,
    })
    .reply(200, {upload_url: uploadUrl, html_url: releaseUrl, id: releaseId})
    .patch(`/repos/${owner}/${repo}/releases/${releaseId}`, {
      draft: false,
    })
    .reply(200, {html_url: releaseUrl});
  const githubUpload = upload(env, {
    uploadUrl: 'https://github.com',
    contentLength: (await stat(path.resolve(cwd, 'upload.txt'))).size,
  })
    .post(
      `${uploadUri}?name=${escape('file_with_release_v1.0.0_in_filename.txt')}&label=${escape(
        'File with release v1.0.0 in label'
      )}`
    )
    .reply(200, {browser_download_url: assetUrl});

  const result = await t.context.m.publish(
    {assets},
    {cwd, env, options, branch: {type: 'release'}, nextRelease, logger: t.context.logger}
  );

  t.is(result.url, releaseUrl);
  t.deepEqual(t.context.log.args[0], ['Verify GitHub authentication']);
  t.true(t.context.log.calledWith('Published file %s', assetUrl));
  t.true(t.context.log.calledWith('Published GitHub release: %s', releaseUrl));
  t.true(github.isDone());
  t.true(githubUpload.isDone());
});

test.serial('Update a release', async (t) => {
  const owner = 'test_user';
  const repo = 'test_repo';
  const env = {GITHUB_TOKEN: 'github_token'};
  const nextRelease = {gitTag: 'v1.0.0', name: 'v1.0.0', notes: 'Test release note body'};
  const options = {repositoryUrl: `https://github.com/${owner}/${repo}.git`};
  const releaseUrl = `https://github.com/${owner}/${repo}/releases/${nextRelease.version}`;
  const releaseId = 1;

  const github = authenticate(env)
    .get(`/repos/${owner}/${repo}`)
    .reply(200, {permissions: {push: true}})
    .get(`/repos/${owner}/${repo}/releases/tags/${nextRelease.gitTag}`)
    .reply(200, {id: releaseId})
    .patch(`/repos/${owner}/${repo}/releases/${releaseId}`, {
      tag_name: nextRelease.gitTag,
      name: nextRelease.name,
      prerelease: false,
    })
    .reply(200, {html_url: releaseUrl});

  const result = await t.context.m.addChannel(
    {},
    {cwd, env, options, branch: {type: 'release', main: true}, nextRelease, logger: t.context.logger}
  );

  t.is(result.url, releaseUrl);
  t.deepEqual(t.context.log.args[0], ['Verify GitHub authentication']);
  t.deepEqual(t.context.log.args[1], ['Updated GitHub release: %s', releaseUrl]);
  t.true(github.isDone());
});

test.serial('Comment and add labels on PR included in the releases', async (t) => {
  const owner = 'test_user';
  const repo = 'test_repo';
  const env = {GITHUB_TOKEN: 'github_token'};
  const failTitle = 'The automated release is failing 🚨';
  const prs = [{number: 1, pull_request: {}, state: 'closed'}];
  const options = {repositoryUrl: `https://github.com/${owner}/${repo}.git`};
  const commits = [{hash: '123', message: 'Commit 1 message'}];
  const nextRelease = {version: '1.0.0'};
  const releases = [{name: 'GitHub release', url: 'https://github.com/release'}];
  const github = authenticate(env)
    .get(`/repos/${owner}/${repo}`)
    .reply(200, {permissions: {push: true}})
    .get(`/repos/${owner}/${repo}`)
    .reply(200, {full_name: `${owner}/${repo}`})
    .get(
      `/search/issues?q=${escape(`repo:${owner}/${repo}`)}+${escape('type:pr')}+${escape('is:merged')}+${commits
        .map((commit) => commit.hash)
        .join('+')}`
    )
    .reply(200, {items: prs})
    .get(`/repos/${owner}/${repo}/pulls/1/commits`)
    .reply(200, [{sha: commits[0].hash}])
    .post(`/repos/${owner}/${repo}/issues/1/comments`, {body: /This PR is included/})
    .reply(200, {html_url: 'https://github.com/successcomment-1'})
    .post(`/repos/${owner}/${repo}/issues/1/labels`, '["released"]')
    .reply(200, {})
    .get(
      `/search/issues?q=${escape('in:title')}+${escape(`repo:${owner}/${repo}`)}+${escape('type:issue')}+${escape(
        'state:open'
      )}+${escape(failTitle)}`
    )
    .reply(200, {items: []});

  await t.context.m.success({failTitle}, {cwd, env, options, commits, nextRelease, releases, logger: t.context.logger});

  t.deepEqual(t.context.log.args[0], ['Verify GitHub authentication']);
  t.true(t.context.log.calledWith('Added comment to issue #%d: %s', 1, 'https://github.com/successcomment-1'));
  t.true(t.context.log.calledWith('Added labels %O to issue #%d', ['released'], 1));
  t.true(github.isDone());
});

test.serial('Open a new issue with the list of errors', async (t) => {
  const owner = 'test_user';
  const repo = 'test_repo';
  const env = {GITHUB_TOKEN: 'github_token'};
  const failTitle = 'The automated release is failing 🚨';
  const options = {repositoryUrl: `https://github.com/${owner}/${repo}.git`};
  const errors = [
    new SemanticReleaseError('Error message 1', 'ERR1', 'Error 1 details'),
    new SemanticReleaseError('Error message 2', 'ERR2', 'Error 2 details'),
    new SemanticReleaseError('Error message 3', 'ERR3', 'Error 3 details'),
  ];
  const github = authenticate(env)
    .get(`/repos/${owner}/${repo}`)
    .reply(200, {permissions: {push: true}})
    .get(`/repos/${owner}/${repo}`)
    .reply(200, {full_name: `${owner}/${repo}`})
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

  await t.context.m.fail({failTitle}, {cwd, env, options, branch: {name: 'master'}, errors, logger: t.context.logger});

  t.deepEqual(t.context.log.args[0], ['Verify GitHub authentication']);
  t.true(t.context.log.calledWith('Created issue #%d: %s.', 1, 'https://github.com/issues/1'));
  t.true(github.isDone());
});

test.serial('Verify, release and notify success', async (t) => {
  const owner = 'test_user';
  const repo = 'test_repo';
  const env = {GITHUB_TOKEN: 'github_token'};
  const assets = ['upload.txt', {path: 'upload_other.txt', name: 'other_file.txt', label: 'Other File'}];
  const failTitle = 'The automated release is failing 🚨';
  const options = {
    publish: [{path: '@semantic-release/npm'}, {path: '@semantic-release/github', assets}],
    repositoryUrl: `https://github.com/${owner}/${repo}.git`,
  };
  const nextRelease = {gitTag: 'v1.0.0', name: 'v1.0.0', notes: 'Test release note body'};
  const releaseUrl = `https://github.com/${owner}/${repo}/releases/${nextRelease.version}`;
  const assetUrl = `https://github.com/${owner}/${repo}/releases/download/${nextRelease.version}/upload.txt`;
  const otherAssetUrl = `https://github.com/${owner}/${repo}/releases/download/${nextRelease.version}/other_file.txt`;
  const releaseId = 1;
  const uploadUri = `/api/uploads/repos/${owner}/${repo}/releases/${releaseId}/assets`;
  const uploadUrl = `https://github.com${uploadUri}{?name,label}`;
  const prs = [{number: 1, pull_request: {}, state: 'closed'}];
  const commits = [{hash: '123', message: 'Commit 1 message'}];
  const github = authenticate(env)
    .get(`/repos/${owner}/${repo}`)
    .reply(200, {permissions: {push: true}})
    .post(`/repos/${owner}/${repo}/releases`, {
      tag_name: nextRelease.gitTag,
      name: nextRelease.name,
      body: nextRelease.notes,
      draft: true,
      prerelease: false,
    })
    .reply(200, {upload_url: uploadUrl, html_url: releaseUrl, id: releaseId})
    .patch(`/repos/${owner}/${repo}/releases/${releaseId}`, {draft: false})
    .reply(200, {html_url: releaseUrl})
    .get(`/repos/${owner}/${repo}`)
    .reply(200, {full_name: `${owner}/${repo}`})
    .get(
      `/search/issues?q=${escape(`repo:${owner}/${repo}`)}+${escape('type:pr')}+${escape('is:merged')}+${commits
        .map((commit) => commit.hash)
        .join('+')}`
    )
    .reply(200, {items: prs})
    .get(`/repos/${owner}/${repo}/pulls/1/commits`)
    .reply(200, [{sha: commits[0].hash}])
    .post(`/repos/${owner}/${repo}/issues/1/comments`, {body: /This PR is included/})
    .reply(200, {html_url: 'https://github.com/successcomment-1'})
    .post(`/repos/${owner}/${repo}/issues/1/labels`, '["released"]')
    .reply(200, {})
    .get(
      `/search/issues?q=${escape('in:title')}+${escape(`repo:${owner}/${repo}`)}+${escape('type:issue')}+${escape(
        'state:open'
      )}+${escape(failTitle)}`
    )
    .reply(200, {items: []});
  const githubUpload1 = upload(env, {
    uploadUrl: 'https://github.com',
    contentLength: (await stat(path.resolve(cwd, 'upload.txt'))).size,
  })
    .post(`${uploadUri}?name=${escape('upload.txt')}`)
    .reply(200, {browser_download_url: assetUrl});
  const githubUpload2 = upload(env, {
    uploadUrl: 'https://github.com',
    contentLength: (await stat(path.resolve(cwd, 'upload_other.txt'))).size,
  })
    .post(`${uploadUri}?name=${escape('other_file.txt')}&label=${escape('Other File')}`)
    .reply(200, {browser_download_url: otherAssetUrl});

  await t.notThrowsAsync(t.context.m.verifyConditions({}, {cwd, env, options, logger: t.context.logger}));
  await t.context.m.publish(
    {assets},
    {cwd, env, options, branch: {type: 'release', main: true}, nextRelease, logger: t.context.logger}
  );
  await t.context.m.success(
    {assets, failTitle},
    {cwd, env, options, nextRelease, commits, releases: [], logger: t.context.logger}
  );

  t.deepEqual(t.context.log.args[0], ['Verify GitHub authentication']);
  t.true(t.context.log.calledWith('Published file %s', otherAssetUrl));
  t.true(t.context.log.calledWith('Published file %s', assetUrl));
  t.true(t.context.log.calledWith('Published GitHub release: %s', releaseUrl));
  t.true(github.isDone());
  t.true(githubUpload1.isDone());
  t.true(githubUpload2.isDone());
});

test.serial('Verify, update release and notify success', async (t) => {
  const owner = 'test_user';
  const repo = 'test_repo';
  const env = {GITHUB_TOKEN: 'github_token'};
  const failTitle = 'The automated release is failing 🚨';
  const options = {
    publish: [{path: '@semantic-release/npm'}, {path: '@semantic-release/github'}],
    repositoryUrl: `https://github.com/${owner}/${repo}.git`,
  };
  const nextRelease = {gitTag: 'v1.0.0', name: 'v1.0.0', notes: 'Test release note body'};
  const releaseUrl = `https://github.com/${owner}/${repo}/releases/${nextRelease.version}`;
  const releaseId = 1;
  const prs = [{number: 1, pull_request: {}, state: 'closed'}];
  const commits = [{hash: '123', message: 'Commit 1 message', tree: {long: 'aaa'}}];
  const github = authenticate(env)
    .get(`/repos/${owner}/${repo}`)
    .reply(200, {permissions: {push: true}})
    .get(`/repos/${owner}/${repo}/releases/tags/${nextRelease.gitTag}`)
    .reply(200, {id: releaseId})
    .patch(`/repos/${owner}/${repo}/releases/${releaseId}`, {
      tag_name: nextRelease.gitTag,
      name: nextRelease.name,
      prerelease: false,
    })
    .reply(200, {html_url: releaseUrl})
    .get(`/repos/${owner}/${repo}`)
    .reply(200, {full_name: `${owner}/${repo}`})
    .get(
      `/search/issues?q=${escape(`repo:${owner}/${repo}`)}+${escape('type:pr')}+${escape('is:merged')}+${commits
        .map((commit) => commit.hash)
        .join('+')}`
    )
    .reply(200, {items: prs})
    .get(`/repos/${owner}/${repo}/pulls/1/commits`)
    .reply(200, [{sha: commits[0].hash}])
    .post(`/repos/${owner}/${repo}/issues/1/comments`, {body: /This PR is included/})
    .reply(200, {html_url: 'https://github.com/successcomment-1'})
    .post(`/repos/${owner}/${repo}/issues/1/labels`, '["released"]')
    .reply(200, {})
    .get(
      `/search/issues?q=${escape('in:title')}+${escape(`repo:${owner}/${repo}`)}+${escape('type:issue')}+${escape(
        'state:open'
      )}+${escape(failTitle)}`
    )
    .reply(200, {items: []});

  await t.notThrowsAsync(t.context.m.verifyConditions({}, {cwd, env, options, logger: t.context.logger}));
  await t.context.m.addChannel(
    {},
    {cwd, env, branch: {type: 'release', main: true}, nextRelease, options, logger: t.context.logger}
  );
  await t.context.m.success(
    {failTitle},
    {cwd, env, options, nextRelease, commits, releases: [], logger: t.context.logger}
  );

  t.deepEqual(t.context.log.args[0], ['Verify GitHub authentication']);
  t.deepEqual(t.context.log.args[1], ['Updated GitHub release: %s', releaseUrl]);
  t.true(github.isDone());
});

test.serial('Verify and notify failure', async (t) => {
  const owner = 'test_user';
  const repo = 'test_repo';
  const env = {GITHUB_TOKEN: 'github_token'};
  const failTitle = 'The automated release is failing 🚨';
  const options = {repositoryUrl: `https://github.com/${owner}/${repo}.git`};
  const errors = [
    new SemanticReleaseError('Error message 1', 'ERR1', 'Error 1 details'),
    new SemanticReleaseError('Error message 2', 'ERR2', 'Error 2 details'),
    new SemanticReleaseError('Error message 3', 'ERR3', 'Error 3 details'),
  ];
  const github = authenticate(env)
    .get(`/repos/${owner}/${repo}`)
    .reply(200, {permissions: {push: true}})
    .get(`/repos/${owner}/${repo}`)
    .reply(200, {full_name: `${owner}/${repo}`})
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

  await t.notThrowsAsync(t.context.m.verifyConditions({}, {cwd, env, options, logger: t.context.logger}));
  await t.context.m.fail({failTitle}, {cwd, env, options, branch: {name: 'master'}, errors, logger: t.context.logger});

  t.deepEqual(t.context.log.args[0], ['Verify GitHub authentication']);
  t.true(t.context.log.calledWith('Created issue #%d: %s.', 1, 'https://github.com/issues/1'));
  t.true(github.isDone());
});
