/* istanbul ignore file */

// If maintaining @octokit/core and the separate plugins gets to cumbersome
// then the `octokit` package can be used which has all these plugins included.
// However the `octokit` package has a lot of other things we don't care about.
// We use only the bits we need to minimize the size of the package.
import { Octokit } from "@octokit/core";
import { paginateRest } from "@octokit/plugin-paginate-rest";
import { retry } from "@octokit/plugin-retry";
import { throttling } from "@octokit/plugin-throttling";

import { RETRY_CONF } from "./definitions/retry";
import { THROTTLE_CONF } from "./definitions/throttle";

const onRetry = (retryAfter, options, octokit, retryCount) => {
  octokit.log.warn(
    `Request quota exhausted for request ${options.method} ${options.url}`
  );

  if (retryCount <= RETRY_CONF.retries) {
    octokit.log.debug(`Will retry after ${retryAfter}.`);
    return true;
  }
};

const SemanticReleaseOctokit = Octokit.plugin(
  paginateRest,
  retry,
  throttling
).defaults({
  userAgent: `@semantic-release/github`,
  retry: RETRY_CONF,
  throttle: {
    ...THROTTLE_CONF,
    onRateLimit: onRetry,
    onSecondaryRateLimit: onRetry,
  },
});

export default SemanticReleaseOctokit;
