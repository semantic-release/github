module.exports = (githubUrl, env) => {
  githubUrl ||= 'https://api.github.com';
  const proxy = env.http_proxy || env.HTTP_PROXY || false;
  const noProxy = env.no_proxy || env.NO_PROXY;

  if (proxy && noProxy) {
    const {hostname} = new URL(githubUrl);
    for (let noProxyHost of noProxy.split(',')) {
      if (noProxyHost === '*') {
        return false;
      }

      if (noProxyHost.startsWith('.')) {
        noProxyHost = noProxyHost.slice(1);
      }

      if (hostname === noProxyHost || hostname.endsWith('.' + noProxyHost)) {
        return false;
      }
    }
  }

  return proxy;
};
