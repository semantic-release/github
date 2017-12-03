const {basename, extname} = require('path');
const {parse} = require('url');
const {stat, readFile} = require('fs-extra');
const {isPlainObject} = require('lodash');
const parseGithubUrl = require('parse-github-url');
const GitHubApi = require('github');
const pReduce = require('p-reduce');
const mime = require('mime');
const debug = require('debug')('semantic-release:github');
const globAssets = require('./glob-assets.js');
const resolveConfig = require('./resolve-config');

module.exports = async (pluginConfig, {branch, repositoryUrl}, {version, gitHead, gitTag, notes}, logger) => {
  const {githubToken, githubUrl, githubApiPathPrefix, assets} = resolveConfig(pluginConfig);
  const {name: repo, owner} = parseGithubUrl(repositoryUrl);
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

  try {
    // Test if the tag already exists
    await github.gitdata.getReference({owner, repo, ref: `tags/${gitTag}`});
    debug('The git tag %o already exists', gitTag);
  } catch (err) {
    // If the error is 404, the tag doesn't exist, otherwise it's an error
    if (err.code !== 404) {
      throw err;
    }
    debug('Create git tag %o with commit %o', gitTag, gitHead);
    await github.gitdata.createReference({owner, repo, ref, sha: gitHead});
  }

  const {data: {html_url: htmlUrl, upload_url: uploadUrl}} = await github.repos.createRelease(release);
  logger.log('Published Github release: %s', htmlUrl);

  if (assets && assets.length > 0) {
    const globbedAssets = await globAssets(assets);
    debug('globed assets: %o', globbedAssets);
    // Make requests serially to avoid hitting the rate limit (https://developer.github.com/v3/guides/best-practices-for-integrators/#dealing-with-abuse-rate-limits)
    await pReduce(globbedAssets, async (_, asset) => {
      const filePath = isPlainObject(asset) ? asset.path : asset;
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
      const upload = {
        owner,
        repo,
        url: uploadUrl,
        file: await readFile(filePath),
        contentType: mime.getType(extname(fileName)) || 'text/plain',
        contentLength: file.size,
        name: fileName,
      };

      debug('file path: %o', filePath);
      debug('file name: %o', fileName);

      if (isPlainObject(asset) && asset.label) {
        upload.label = asset.label;
      }

      const {data: {browser_download_url: downloadUrl}} = await github.repos.uploadAsset(upload);
      logger.log('Published file %s', downloadUrl);
    });
  }
};
