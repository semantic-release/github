const {basename, extname, resolve} = require('path');
const {stat, readFile} = require('fs-extra');
const {isPlainObject} = require('lodash');
const parseGithubUrl = require('parse-github-url');
const mime = require('mime');
const debug = require('debug')('semantic-release:github');
const {RELEASE_NAME} = require('./definitions/constants');
const globAssets = require('./glob-assets.js');
const resolveConfig = require('./resolve-config');
const getClient = require('./get-client');
const isPrerelease = require('./is-prerelease');

module.exports = async (pluginConfig, context) => {
  const {
    cwd,
    options: {repositoryUrl},
    branch,
    nextRelease: {name, gitTag, notes},
    logger,
  } = context;
  const {githubToken, githubUrl, githubApiPathPrefix, proxy, assets} = resolveConfig(pluginConfig, context);
  const {name: repo, owner} = parseGithubUrl(repositoryUrl);
  const github = getClient({githubToken, githubUrl, githubApiPathPrefix, proxy});
  const release = {owner, repo, tag_name: gitTag, name, body: notes, prerelease: isPrerelease(branch)}; // eslint-disable-line camelcase

  debug('release object: %O', release);

  const {
    data: {html_url: url, upload_url: uploadUrl},
  } = await github.repos.createRelease(release);
  logger.log('Published GitHub release: %s', url);

  if (assets && assets.length > 0) {
    const globbedAssets = await globAssets(context, assets);
    debug('globed assets: %o', globbedAssets);

    await Promise.all(
      globbedAssets.map(async asset => {
        const filePath = isPlainObject(asset) ? asset.path : asset;
        let file;

        try {
          file = await stat(resolve(cwd, filePath));
        } catch (error) {
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
          file: await readFile(resolve(cwd, filePath)),
          name: fileName,
          headers: {
            'content-type': mime.getType(extname(fileName)) || 'text/plain',
            'content-length': file.size,
          },
        };

        debug('file path: %o', filePath);
        debug('file name: %o', fileName);

        if (isPlainObject(asset) && asset.label) {
          upload.label = asset.label;
        }

        const {
          data: {browser_download_url: downloadUrl},
        } = await github.repos.uploadReleaseAsset(upload);
        logger.log('Published file %s', downloadUrl);
      })
    );
  }

  return {url, name: RELEASE_NAME};
};
