/**
 * Default exponential backoff configuration for retries.
 */
const RETRY_CONF = {
  // By default, Octokit does not retry on 404s.
  // But we want to retry on 404s to account for replication lag.
  doNotRetry: [400, 401, 403, 422],
};

module.exports = {RETRY_CONF};
