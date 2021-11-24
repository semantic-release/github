import nock from "nock";

/**
 * Return a `nock` object setup to respond to a github authentication request. Other expectation and responses can be chained.
 *
 * @param {Object} [env={}] Environment variables.
 * @param {String} [githubToken=env.GH_TOKEN || env.GITHUB_TOKEN || 'GH_TOKEN'] The github token to return in the authentication response.
 * @param {String} [githubUrl=env.GITHUB_API_URL || env.GH_URL || env.GITHUB_URL || 'https://api.github.com'] The url on which to intercept http requests.
 * @param {String} [githubApiPathPrefix=env.GH_PREFIX || env.GITHUB_PREFIX || ''] The GitHub Enterprise API prefix.
 * @return {Object} A `nock` object ready to respond to a github authentication request.
 */
export function authenticate(
  env = {},
  {
    githubToken = env.GH_TOKEN || env.GITHUB_TOKEN || "GH_TOKEN",
    githubUrl = env.GITHUB_API_URL ||
      env.GH_URL ||
      env.GITHUB_URL ||
      "https://api.github.com",
    githubApiPathPrefix = env.GH_PREFIX || env.GITHUB_PREFIX || "",
  } = {}
) {
  return nock(`${githubUrl}/${githubApiPathPrefix}`, {
    reqheaders: { Authorization: `token ${githubToken}` },
  });
}

/**
 * Return a `nock` object setup to respond to a github release upload request. Other expectation and responses can be chained.
 *
 * @param {Object} [env={}] Environment variables.
 * @param {String} [githubToken=env.GH_TOKEN || env.GITHUB_TOKEN || 'GH_TOKEN'] The github token to return in the authentication response.
 * @param {String} [uploadUrl] The url on which to intercept http requests.
 * @return {Object} A `nock` object ready to respond to a github file upload request.
 */
export function upload(
  env = {},
  {
    githubToken = env.GH_TOKEN || env.GITHUB_TOKEN || "GH_TOKEN",
    uploadUrl,
    contentType = "text/plain",
    contentLength,
  } = {}
) {
  return nock(uploadUrl, {
    reqheaders: {
      Authorization: `token ${githubToken}`,
      "content-type": contentType,
      "content-length": contentLength,
    },
  });
}
