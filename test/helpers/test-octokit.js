const {Octokit} = require('@octokit/core');
const {paginateRest} = require('@octokit/plugin-paginate-rest');

const debugPlugin = (octokit) => {
  octokit.hook.wrap('request', (request, options) => {
    const {method, url, ...rest} = options;
    if (process.env.DEBUG) {
      console.log('DEBUG: %s %s with', method, url, rest);
    }

    return request(options);
  });
};

const TestOctokit = Octokit.plugin(paginateRest, debugPlugin).defaults({
  userAgent: 'test',
  auth: 'github_token',
});

module.exports = {TestOctokit};
