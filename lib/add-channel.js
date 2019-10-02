const parseGithubUrl = require('parse-github-url');
const debug = require('debug')('semantic-release:github');
const {RELEASE_NAME} = require('./definitions/constants');
const resolveConfig = require('./resolve-config');
const getClient = require('./get-client');
const isPrerelease = require('./is-prerelease');

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
  let releaseId;

  const release = {owner, repo, name, prerelease: isPrerelease(branch)};

  debug('release owner: %o', release.owner);
  debug('release repo: %o', release.repo);
  debug('release tag_name: %o', release.tag_name);
  debug('release name: %o', release.name);
  debug('release prerelease: %o', release.prerelease);

  try {
    ({
      data: {id: releaseId},
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

  const tagName = currentChannel ? gitTag : undefined;

  debug('release release_id: %o', releaseId);
  debug('release tag_name: %o', tagName);

  const {
    data: {html_url: url},
  } = await github.repos.updateRelease({...release, release_id: releaseId, tag_name: tagName});

  logger.log('Updated GitHub release: %s', url);

  return {url, name: RELEASE_NAME};
};
