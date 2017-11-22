const {basename} = require('path');
const {parse} = require('url');
const {stat} = require('fs-extra');
const gitUrlParse = require('git-url-parse');
const GitHubApi = require('github');
const pEachSeries = require('p-each-series');
const debug = require('debug')('semantic-release:publish-github');
const resolveConfig = require('./resolve-config');

module.exports = async (pluginConfig, {branch}, {repository}, {version, gitHead, gitTag, notes}, logger) => {
  const {githubToken, githubUrl, githubApiPathPrefix, assets} = resolveConfig(pluginConfig);
  const {name: repo, owner} = gitUrlParse(repository.url);
  let {port, protocol, hostname: host} = githubUrl ? parse(githubUrl) : {};
  protocol = (protocol || '').split(':')[0] || null;

  const github = new GitHubApi({port, protocol, host, pathPrefix: githubApiPathPrefix});
  github.authenticate({type: 'token', token: githubToken});

  const release = {owner, repo, tag_name: gitTag, name: gitTag, target_commitish: branch, body: notes}; // eslint-disable-line camelcase
  debug('release owner: %o', owner);
  debug('release repo: %o', repo);
  debug('release name: %o', gitTag);
  debug('release branch: %o', branch);
  const ref = `refs/tags/${gitTag}`;

  debug('Create git tag %o with commit %o', ref, gitHead);
  await github.gitdata.createReference({owner, repo, ref, sha: gitHead});
  const {data: {id, html_url}} = await github.repos.createRelease(release); // eslint-disable-line camelcase
  logger.log('Published Github release: %s', html_url);

  if (assets && assets.length > 0) {
    // Make requests serially to avoid hitting the rate limit (https://developer.github.com/v3/guides/best-practices-for-integrators/#dealing-with-abuse-rate-limits)
    await pEachSeries(assets, async asset => {
      const filePath = typeof asset === 'object' ? asset.path : asset;
      let file;
      try {
        file = await stat(filePath);
      } catch (err) {
        logger.error('The asset %s cannot be read, and will be ignored.', filePath);
        return;
      }
      if (!file || !file.isFile()) {
        logger.error('The asset %s is not a file, and will be ignored.', filePath);
        return;
      }
      const fileName = asset.name || basename(filePath);
      const upload = {owner, repo, id, filePath, name: fileName};
      debug('file path: %o', filePath);
      debug('file name: %o', fileName);
      if (asset.label) {
        upload.label = asset.label;
      }

      const {data: {browser_download_url}} = await github.repos.uploadAsset(upload); // eslint-disable-line camelcase
      logger.log('Published file %s', browser_download_url);
    });
  }
};
