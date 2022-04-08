/**
 * Default exponential backoff configuration for retries.
 */
const RETRY_CONF = {
  retries: 3,
  retryAfterBaseValue: 1000,
  doNotRetry: [400, 401, 403],
};

module.exports = {RETRY_CONF};
