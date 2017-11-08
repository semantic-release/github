# @semantic-release/github

Set of [semantic-release](https://github.com/semantic-release/semantic-release) plugins for publishing a [Github release](https://help.github.com/articles/about-releases).

[![Travis](https://img.shields.io/travis/semantic-release/github.svg)](https://travis-ci.org/semantic-release/github)
[![Codecov](https://img.shields.io/codecov/c/github/semantic-release/github.svg)](https://codecov.io/gh/semantic-release/github)
[![Greenkeeper badge](https://badges.greenkeeper.io/semantic-release/github.svg)](https://greenkeeper.io/)

## verifyConditions

Verify the presence and the validity of the `githubToken` (set via option or environment variable).

### Options

| Option                | Description                                               | Default                                                |
| --------------------- | --------------------------------------------------------- | ------------------------------------------------------ |
| `githubToken`         | **Required.** The token used to authenticate with GitHub. | `process.env.GH_TOKEN` or `process.env.GITHUB_TOKEN`   |
| `githubUrl`           | The GitHub Enterprise endpoint.                           | `process.env.GH_URL` or `process.env.GITHUB_URL`       |
| `githubApiPathPrefix` | The GitHub Enterprise API prefix.                         | `process.env.GH_PREFIX` or `process.env.GITHUB_PREFIX` |

## publish

Publish a [Github release](https://help.github.com/articles/about-releases).

### Options

| Option                | Description                                               | Default                                                |
| --------------------- | --------------------------------------------------------- | ------------------------------------------------------ |
| `githubToken`         | **Required.** The token used to authenticate with GitHub. | `process.env.GH_TOKEN` or `process.env.GITHUB_TOKEN`   |
| `githubUrl`           | The GitHub Enterprise endpoint.                           | `process.env.GH_URL` or `process.env.GITHUB_URL`       |
| `githubApiPathPrefix` | The GitHub Enterprise API prefix.                         | `process.env.GH_PREFIX` or `process.env.GITHUB_PREFIX` |
| `assets`              | An array of files to upload to the release.               | - 

#### assets option

Each element of the array can be a path to the file or an `object` with the properties:

| Property | Description                                                              | Default                              |
| -------- | ------------------------------------------------------------------------ | ------------------------------------ |
| `path`   | **Required.** The file path to upload relative to the project directory. | -                                    |
| `name`   | The name of the downloadable file on the Github release.                 | File name extracted from the `path`. |
| `label`  | Short description of the file displayed on the Github release.           | -                                    |

## Configuration

The plugins are used by default by [semantic-release](https://github.com/semantic-release/semantic-release) so no specific configuration is requiered if `githubToken`, `githubUrl` and `githubApiPathPrefix` are set via environment variable.

Each individual plugin can be disabled, replaced or used with other plugins in the `package.json`:
```json
{
  "release": {
    "verifyConditions": ["@semantic-release/github", "verify-other-condition"],
    "getLastRelease": "custom-get-last-release",
    "publish": [
      "custom-publish",
      {
        "path": "@semantic-release/github",
        "assets": [
          {"path": "dist/asset.min.css", "label": "CSS distribution"},
          {"path": "dist/asset.min.js", "label": "JS distribution"}
        ]
      }
    ]
  }
}
```

The same configuration for Github Enterprise:
```json
{
  "release": {
    "verifyConditions": [
      {
        "path": "@semantic-release/github",
        "githubUrl": "https://my-ghe.com",
        "githubApiPathPrefix": "/api-prefix"
      },
      "verify-other-condition"
    ],
    "getLastRelease": "custom-get-last-release",
    "publish": [
      "custom-publish",
      {
        "path": "@semantic-release/github",
        "githubUrl": "https://my-ghe.com",
        "githubApiPathPrefix": "/api-prefix",
        "assets": [
          {"path": "dist/asset.min.css", "label": "CSS distribution"},
          {"path": "dist/asset.min.js", "label": "JS distribution"}
        ]
      }
    ]
  }
}
```
