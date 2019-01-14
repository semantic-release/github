const parseGithubUrl = require('parse-github-url');
const debug = require('debug')('semantic-release:github');
const {RELEASE_NAME} = require('./definitions/constants');
const resolveConfig = require('./resolve-config');
const getClient = require('./get-client');
const isPrerelease = require('./is-prerelease');

/* eslint-disable camelcase */

module.exports = async (pluginConfig, context) => {
  const {
    options: {repositoryUrl},
    branch,
    currentRelease: {gitTag: currentGitTag, channel: currentChannel},
    nextRelease: {name, gitTag, notes},
    logger,
  } = context;
  const {githubToken, githubUrl, githubApiPathPrefix, proxy} = resolveConfig(pluginConfig, context);
  const {name: repo, owner} = parseGithubUrl(repositoryUrl);
  const github = getClient({githubToken, githubUrl, githubApiPathPrefix, proxy});
  let release_id;

  const release = {owner, repo, name, prerelease: isPrerelease(branch)};

  debug('release owner: %o', release.owner);
  debug('release repo: %o', release.repo);
  debug('release tag_name: %o', release.tag_name);
  debug('release name: %o', release.name);
  debug('release prerelease: %o', release.prerelease);

  try {
    ({
      data: {id: release_id},
    } = await github.repos.getReleaseByTag({owner, repo, tag: currentGitTag}));
  } catch (error) {
    if (error.status === 404) {
      logger.log('There is no release for tag %s, creating a new one', currentGitTag);

      debug('release tag_name: %o', gitTag);

      const {
        data: {html_url: url},
      } = await github.repos.createRelease({...release, body: notes, tag_name: gitTag});

      logger.log('Published GitHub release: %s', url);
      return {url, name: RELEASE_NAME};
    }

    throw error;
  }

  const tag_name = currentChannel ? gitTag : undefined;

  debug('release release_id: %o', release_id);
  debug('release tag_name: %o', tag_name);

  const {
    data: {html_url: url},
  } = await github.repos.updateRelease({...release, release_id, tag_name});

  logger.log('Updated GitHub release: %s', url);

  return {url, name: RELEASE_NAME};
};

/* eslint-enable camelcase */
