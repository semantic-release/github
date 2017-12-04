import nock from 'nock';

/**
 * Retun a `nock` object setup to respond to a github authentication request. Other expectation and responses can be chained.
 *
 * @param {String} [githubToken=process.env.GH_TOKEN || process.env.GITHUB_TOKEN || 'GH_TOKEN'] The github token to return in the authentication response.
 * @param {String} [githubUrl=process.env.GH_URL || process.env.GITHUB_URL || 'https://api.github.com'] The url on which to intercept http requests.
 * @param {String} [githubApiPathPrefix=process.env.GH_PREFIX || process.env.GITHUB_PREFIX || ''] The GitHub Enterprise API prefix.
 * @return {Object} A `nock` object ready to respond to a github authentication request.
 */
export function authenticate({
  githubToken = process.env.GH_TOKEN || process.env.GITHUB_TOKEN || 'GH_TOKEN',
  githubUrl = process.env.GH_URL || process.env.GITHUB_URL || 'https://api.github.com',
  githubApiPathPrefix = process.env.GH_PREFIX || process.env.GITHUB_PREFIX || '',
} = {}) {
  return nock(`${githubUrl}/${githubApiPathPrefix}`, {reqheaders: {Authorization: `token ${githubToken}`}});
}

/**
 * Retun a `nock` object setup to respond to a github release upload request. Other expectation and responses can be chained.
 *
 * @param {String} [githubToken=process.env.GH_TOKEN || process.env.GITHUB_TOKEN || 'GH_TOKEN'] The github token to return in the authentication response.
 * @param {String} [uploadUrl] The url on which to intercept http requests.
 * @return {Object} A `nock` object ready to respond to a github file upload request.
 */
export function upload({
  githubToken = process.env.GH_TOKEN || process.env.GITHUB_TOKEN || 'GH_TOKEN',
  uploadUrl,
  contentType = 'text/plain',
  contentLength,
} = {}) {
  return nock(uploadUrl, {
    reqheaders: {Authorization: `token ${githubToken}`, 'content-type': contentType, 'content-length': contentLength},
  });
}
