/* istanbul ignore file */

// If maintaining @octokit/core and the separate plugins gets to cumbersome
// then the `octokit` package can be used which has all these plugins included.
// However the `octokit` package has a lot of other things we don't care about.
// We use only the bits we need to minimize the size of the package.
const {Octokit} = require('@octokit/core');
const {paginateRest} = require('@octokit/plugin-paginate-rest');
const {retry} = require('@octokit/plugin-retry');
const {throttling} = require('@octokit/plugin-throttling');

const {RETRY_CONF} = require('./definitions/retry');
const {THROTTLE_CONF} = require('./definitions/throttle');
const {version} = require('../package.json');

const onRetry = (retryAfter, options, octokit, retryCount) => {
  octokit.log.warn(`Request quota exhausted for request ${options.method} ${options.url}`);

  if (retryCount <= RETRY_CONF.retries) {
    octokit.log.debug(`Will retry after ${retryAfter}.`);
    return true;
  }
};

const SemanticReleaseOctokit = Octokit.plugin(paginateRest, retry, throttling).defaults({
  userAgent: `@semantic-release/github v${version}`,
  retry: RETRY_CONF,
  throttle: {
    ...THROTTLE_CONF,
    onRateLimit: onRetry,
    onSecondaryRateLimit: onRetry,
  },
});

module.exports = SemanticReleaseOctokit;
