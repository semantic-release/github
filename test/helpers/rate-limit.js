export const RETRY_CONF = {
  retries: 3,
  factor: 1,
  minTimeout: 1,
  maxTimeout: 1,
};

export const RATE_LIMITS = { search: 1, core: { read: 1, write: 1 } };

export const GLOBAL_RATE_LIMIT = 1;
