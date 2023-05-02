const test = require('ava');
const resolveProxy = require('../lib/resolve-proxy');

test('Resolve proxy with no proxy configuration', (t) => {
  t.is(resolveProxy(undefined, {}), false);
});

test('Resolve proxy with no exclusions', (t) => {
  t.is(resolveProxy(undefined, {http_proxy: 'proxy.example.com'}), 'proxy.example.com');
});

test('Resolve proxy with no matching exclusion', (t) => {
  t.is(
    resolveProxy(undefined, {
      http_proxy: 'proxy.example.com',
      no_proxy: 'notapi.github.com,.example.org,example.net',
    }),
    'proxy.example.com'
  );
});

test('Resolve proxy with matching exclusion', (t) => {
  t.is(resolveProxy(undefined, {http_proxy: 'proxy.example.com', no_proxy: 'github.com'}), false);
});

test('Resolve proxy with matching exclusion (leading .)', (t) => {
  t.is(resolveProxy(undefined, {http_proxy: 'proxy.example.com', no_proxy: '.github.com'}), false);
});

test('Resolve proxy with global exclusion', (t) => {
  t.is(resolveProxy(undefined, {http_proxy: 'proxy.example.com', no_proxy: '*'}), false);
});

test('Resolve proxy with matching GitHub Enterprise exclusion', (t) => {
  t.is(
    resolveProxy('https://github.example.com/api/v3', {http_proxy: 'proxy.example.com', no_proxy: 'example.com'}),
    false
  );
});

test('Resolve proxy with uppercase environment variables', (t) => {
  t.is(resolveProxy(undefined, {HTTP_PROXY: 'proxy.example.com', NO_PROXY: 'github.com'}), false);
  t.is(
    resolveProxy(undefined, {HTTP_PROXY: 'proxy.example.com', NO_PROXY: 'subdomain.github.com'}),
    'proxy.example.com'
  );
});
