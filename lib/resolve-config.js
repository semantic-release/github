import { isNil, castArray } from "lodash-es";

export default function resolveConfig(
  {
    githubUrl,
    githubApiPathPrefix,
    proxy,
    assets,
    successComment,
    failTitle,
    failComment,
    labels,
    assignees,
    releasedLabels,
    addReleases,
    draftRelease,
  },
  { env },
) {
  return {
    githubToken: env.GH_TOKEN || env.GITHUB_TOKEN,
    githubUrl: githubUrl || env.GITHUB_API_URL || env.GH_URL || env.GITHUB_URL,
    githubApiPathPrefix:
      githubApiPathPrefix || env.GH_PREFIX || env.GITHUB_PREFIX || "",
    proxy: isNil(proxy) ? env.http_proxy || env.HTTP_PROXY || false : proxy,
    assets: assets ? castArray(assets) : assets,
    successComment,
    failTitle: isNil(failTitle)
      ? "The automated release is failing 🚨"
      : failTitle,
    failComment,
    labels: isNil(labels)
      ? ["semantic-release"]
      : labels === false
      ? false
      : castArray(labels),
    assignees: assignees ? castArray(assignees) : assignees,
    releasedLabels: isNil(releasedLabels)
      ? [
          `released<%= nextRelease.channel ? \` on @\${nextRelease.channel}\` : "" %>`,
        ]
      : releasedLabels === false
      ? false
      : castArray(releasedLabels),
    addReleases: isNil(addReleases) ? false : addReleases,
    draftRelease: isNil(draftRelease) ? false : draftRelease,
  };
}
