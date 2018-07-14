const RETRY_CONF = {retries: 3, factor: 1, minTimeout: 1, maxTimeout: 1};

const RATE_LIMITS = {search: 1, core: {read: 1, write: 1}};

const GLOBAL_RATE_LIMIT = 1;

export default {RETRY_CONF, RATE_LIMITS, GLOBAL_RATE_LIMIT};
