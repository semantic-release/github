const BottleneckLight = require('bottleneck/light');

/**
 * Default exponential backoff configuration for retries.
 */
const THROTTLE_CONF = {
  retryAfterBaseValue: 1,
  minimumSecondaryRateRetryAfter: 1,
  global: new BottleneckLight.Group({
    id: 'octokit-global',
    maxConcurrent: 1,
    minTime: 1,
  }),
  search: new BottleneckLight.Group({
    id: 'octokit-search',
    maxConcurrent: 1,
    minTime: 1,
  }),
  write: new BottleneckLight.Group({
    id: 'octokit-write',
    maxConcurrent: 1,
    minTime: 1,
  }),
  notifications: new BottleneckLight.Group({
    id: 'octokit-notifications',
    maxConcurrent: 1,
    minTime: 1,
  }),
};

module.exports = {THROTTLE_CONF};
