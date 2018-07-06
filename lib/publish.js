const {basename, extname} = require('path');
const {stat, readFile} = require('fs-extra');
const {isPlainObject} = require('lodash');
const parseGithubUrl = require('parse-github-url');
const mime = require('mime');
const debug = require('debug')('semantic-release:github');
const globAssets = require('./glob-assets.js');
const resolveConfig = require('./resolve-config');
const getClient = require('./get-client');

module.exports = async (pluginConfig, {options: {branch, repositoryUrl}, nextRelease: {gitTag, notes}, logger}) => {
  const {githubToken, githubUrl, githubApiPathPrefix, proxy, assets} = resolveConfig(pluginConfig);
  const {name: repo, owner} = parseGithubUrl(repositoryUrl);
  const github = getClient({githubToken, githubUrl, githubApiPathPrefix, proxy});
  const release = {owner, repo, tag_name: gitTag, name: gitTag, target_commitish: branch, body: notes}; // eslint-disable-line camelcase

  debug('release owner: %o', owner);
  debug('release repo: %o', repo);
  debug('release name: %o', gitTag);
  debug('release branch: %o', branch);

  const {
    data: {html_url: url, upload_url: uploadUrl},
  } = await github.repos.createRelease(release);
  logger.log('Published GitHub release: %s', url);

  if (assets && assets.length > 0) {
    const globbedAssets = await globAssets(assets);
    debug('globed assets: %o', globbedAssets);

    await Promise.all(
      globbedAssets.map(async asset => {
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

        const {
          data: {browser_download_url: downloadUrl},
        } = await github.repos.uploadAsset(upload);
        logger.log('Published file %s', downloadUrl);
      })
    );
  }

  return {url, name: 'GitHub release'};
};
