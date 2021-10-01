import test from 'ava';
import getSuccessComment from '../lib/get-success-comment';

const HOME_URL = 'https://github.com/semantic-release/semantic-release';

test('Comment for issue with multiple releases', (t) => {
  const issue = {number: 1};
  const releaseInfos = [
    {name: 'GitHub release', url: 'https://github.com/release'},
    {name: 'npm release', url: 'https://npm.com/release'},
  ];
  const nextRelease = {version: '1.0.0'};
  const comment = getSuccessComment(issue, releaseInfos, nextRelease);

  t.is(
    comment,
    `:tada: This issue has been resolved in version 1.0.0 :tada:

The release is available on:
- [GitHub release](https://github.com/release)
- [npm release](https://npm.com/release)

Your **[semantic-release](${HOME_URL})** bot :package::rocket:`
  );
});

test('Comment for PR with multiple releases', (t) => {
  const issue = {number: 1, pull_request: {}};
  const releaseInfos = [
    {name: 'GitHub release', url: 'https://github.com/release'},
    {name: 'npm release', url: 'https://npm.com/release'},
  ];
  const nextRelease = {version: '1.0.0'};
  const comment = getSuccessComment(issue, releaseInfos, nextRelease);

  t.is(
    comment,
    `:tada: This PR is included in version 1.0.0 :tada:

The release is available on:
- [GitHub release](https://github.com/release)
- [npm release](https://npm.com/release)

Your **[semantic-release](${HOME_URL})** bot :package::rocket:`
  );
});

test('Comment with missing release URL', (t) => {
  const issue = {number: 1};
  const releaseInfos = [{name: 'GitHub release', url: 'https://github.com/release'}, {name: 'npm release'}];
  const nextRelease = {version: '1.0.0'};
  const comment = getSuccessComment(issue, releaseInfos, nextRelease);

  t.is(
    comment,
    `:tada: This issue has been resolved in version 1.0.0 :tada:

The release is available on:
- [GitHub release](https://github.com/release)
- \`npm release\`

Your **[semantic-release](${HOME_URL})** bot :package::rocket:`
  );
});

test('Comment with one release', (t) => {
  const issue = {number: 1};
  const releaseInfos = [{name: 'GitHub release', url: 'https://github.com/release'}];
  const nextRelease = {version: '1.0.0'};
  const comment = getSuccessComment(issue, releaseInfos, nextRelease);

  t.is(
    comment,
    `:tada: This issue has been resolved in version 1.0.0 :tada:

The release is available on [GitHub release](https://github.com/release)

Your **[semantic-release](${HOME_URL})** bot :package::rocket:`
  );
});

test('Comment with no release object', (t) => {
  const issue = {number: 1};
  const releaseInfos = [];
  const nextRelease = {version: '1.0.0'};
  const comment = getSuccessComment(issue, releaseInfos, nextRelease);

  t.is(
    comment,
    `:tada: This issue has been resolved in version 1.0.0 :tada:

Your **[semantic-release](${HOME_URL})** bot :package::rocket:`
  );
});
