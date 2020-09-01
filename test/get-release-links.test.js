const test = require('ava');
const getReleaseLinks = require('../lib/get-release-links');
const {RELEASE_NAME} = require('../lib/definitions/constants');

test('Comment for release with multiple releases', (t) => {
  const releaseInfos = [
    {name: RELEASE_NAME, url: 'https://github.com/release'},
    {name: 'Http release', url: 'https://release.com/release'},
    {name: 'npm release', url: 'https://npm.com/release'},
  ];
  const comment = getReleaseLinks(releaseInfos);

  t.is(
    comment,
    `This release is also available on:
- [Http release](https://release.com/release)
- [npm release](https://npm.com/release)`
  );
});

test('Release with missing release URL', (t) => {
  const releaseInfos = [
    {name: RELEASE_NAME, url: 'https://github.com/release'},
    {name: 'Http release', url: 'https://release.com/release'},
    {name: 'npm release'},
  ];
  const comment = getReleaseLinks(releaseInfos);

  t.is(
    comment,
    `This release is also available on:
- [Http release](https://release.com/release)
- \`npm release\``
  );
});

test('Release with one release', (t) => {
  const releaseInfos = [
    {name: RELEASE_NAME, url: 'https://github.com/release'},
    {name: 'Http release', url: 'https://release.com/release'},
  ];
  const comment = getReleaseLinks(releaseInfos);

  t.is(
    comment,
    `This release is also available on:
- [Http release](https://release.com/release)`
  );
});

test('Release with non http releases', (t) => {
  const releaseInfos = [{name: 'S3', url: 's3://my-bucket/release-asset'}];
  const comment = getReleaseLinks(releaseInfos);

  t.is(
    comment,
    `This release is also available on:
- S3: \`s3://my-bucket/release-asset\``
  );
});

test('Release with only github release', (t) => {
  const releaseInfos = [{name: RELEASE_NAME, url: 'https://github.com/release'}];
  const comment = getReleaseLinks(releaseInfos);

  t.is(comment, '');
});

test('Comment with no release object', (t) => {
  const releaseInfos = [];
  const comment = getReleaseLinks(releaseInfos);

  t.is(comment, '');
});
