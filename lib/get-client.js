const url = require('url');
const {memoize, get} = require('lodash');
const Octokit = require('@octokit/rest');
const pRetry = require('p-retry');
const Bottleneck = require('bottleneck');
const urljoin = require('url-join');
const HttpProxyAgent = require('http-proxy-agent');
const HttpsProxyAgent = require('https-proxy-agent');

const GH_ROUTES = require('@octokit/rest/lib/routes');
const {RETRY_CONF, RATE_LIMITS, GLOBAL_RATE_LIMIT} = require('./definitions/rate-limit');

/**
 * Http error codes for which to not retry.
 */
const SKIP_RETRY_CODES = [400, 401, 403];

/**
 * Create or retrieve the throttler function for a given rate limit group.
 *
 * @param {Array} rate The rate limit group.
 * @param {String} limit The rate limits per API endpoints.
 * @param {Bottleneck} globalThrottler The global throttler.
 *
 * @return {Bottleneck} The throller function for the given rate limit group.
 */
const getThrottler = memoize((rate, globalThrottler) =>
  new Bottleneck({minTime: get(RATE_LIMITS, rate)}).chain(globalThrottler)
);

/**
 * Determine if a call to a client function will trigger a read (`GET`) or a write (`POST`, `PATCH`, etc...) request.
 *
 * @param {String} endpoint The client API enpoint (for example the endpoint for a call to `github.repos.get` is `repos`).
 * @param {String} command The client API command (for example the command for a call to `github.repos.get` is `get`).
 *
 * @return {String} `write` or `read` if there is rate limit configuration for this `endpoint` and `command`, `undefined` otherwise.
 */
const getAccess = (endpoint, command) => {
  const method = GH_ROUTES[endpoint] && GH_ROUTES[endpoint][command] && GH_ROUTES[endpoint][command].method;
  const access = method && method === 'GET' ? 'read' : 'write';
  return RATE_LIMITS[endpoint][access] && access;
};

/**
 * Get the limiter identifier associated with a client API call.
 *
 * @param {String} endpoint The client API enpoint (for example the endpoint for a call to `github.repos.get` is `repos`).
 * @param {String} command The client API command (for example the command for a call to `github.repos.get` is `get`).
 *
 * @return {String} A string identifying the limiter to use for this `endpoint` and `command` (e.g. `search` or `core.write`).
 */
const getLimitKey = (endpoint, command) => {
  return endpoint
    ? [endpoint, RATE_LIMITS[endpoint] && getAccess(endpoint, command)].filter(Boolean).join('.')
    : RATE_LIMITS[command]
      ? command
      : 'core';
};

/**
 * Create a`handler` for a `Proxy` wrapping an Octokit instance to:
 * - Recursively wrap the child objects of the Octokit instance in a `Proxy`
 * - Throttle and retry the Octokit instance functions
 *
 * @param {Throttler} globalThrottler The throller function for the global rate limit.
 * @param {String} limitKey The key to find the limit rate for the  API endpoint and method.
 *
 * @return {Function} The `handler` for a `Proxy` wrapping an Octokit instance.
 */
const handler = (globalThrottler, limitKey) => ({
  /**
   * If the target has the property as own, determine the rate limit based on the property name and recursively wrap the value in a `Proxy`. Otherwise returns the property value.
   *
   * @param {Object} target The target object.
   * @param {String} name The name of the property to get.
   * @param {Any} receiver The `Proxy` object.
   *
   * @return {Any} The property value or a `Proxy` of the property value.
   */
  get: (target, name, receiver) =>
    Reflect.apply(Object.prototype.hasOwnProperty, target, [name])
      ? new Proxy(target[name], handler(globalThrottler, getLimitKey(limitKey, name)))
      : Reflect.get(target, name, receiver),

  /**
   * Create a throlled version of the called function tehn call it and retry it if the call fails with certain error code.
   *
   * @param {Function} func The target function.
   * @param {Any} that The this argument for the call.
   * @param {Array} args The list of arguments for the call.
   *
   * @return {Promise<Any>} The result of the function called.
   */
  apply: (func, that, args) => {
    const throttler = getThrottler(limitKey, globalThrottler);
    return pRetry(async () => {
      try {
        return await throttler.wrap(func)(...args);
      } catch (err) {
        if (SKIP_RETRY_CODES.includes(err.code)) {
          throw new pRetry.AbortError(err);
        }
        throw err;
      }
    }, RETRY_CONF);
  },
});

module.exports = ({githubToken, githubUrl, githubApiPathPrefix, proxy} = {}) => {
  const baseUrl = githubUrl && urljoin(githubUrl, githubApiPathPrefix);
  const github = new Octokit({
    baseUrl,
    agent: proxy
      ? baseUrl && url.parse(baseUrl).protocol.replace(':', '') === 'http'
        ? new HttpProxyAgent(proxy)
        : new HttpsProxyAgent(proxy)
      : undefined,
  });
  github.authenticate({type: 'token', token: githubToken});
  return new Proxy(github, handler(new Bottleneck({minTime: GLOBAL_RATE_LIMIT})));
};
