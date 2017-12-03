# @semantic-release/github

Set of [semantic-release](https://github.com/semantic-release/semantic-release) plugins for publishing a [Github release](https://help.github.com/articles/about-releases).

[![Travis](https://img.shields.io/travis/semantic-release/github.svg)](https://travis-ci.org/semantic-release/github)
[![Codecov](https://img.shields.io/codecov/c/github/semantic-release/github.svg)](https://codecov.io/gh/semantic-release/github)
[![Greenkeeper badge](https://badges.greenkeeper.io/semantic-release/github.svg)](https://greenkeeper.io/)

## verifyConditions

Verify the presence and the validity of the `githubToken` (set via option or environment variable) and the `assets` option configuration.

## publish

Publish a [Github release](https://help.github.com/articles/about-releases), optionnaly uploading files.

## Configuration

### Github Repository authentication

The `Github` authentication configuration is **required** and can be set via [environment variables](#environment-variables).

Only the [personal token](https://help.github.com/articles/creating-a-personal-access-token-for-the-command-line) authentication is supported.

### Environment variables

| Variable                       | Description                                               |
| ------------------------------ | ----------------------------------------------------------|
| `GH_TOKEN` or `GITHUB_TOKEN`   | **Required.** The token used to authenticate with GitHub. |
| `GH_URL` or `GITHUB_URL`       | The GitHub Enterprise endpoint.                           |
| `GH_PREFIX` or `GITHUB_PREFIX` | The GitHub Enterprise API prefix.                         |

### Options

| Option                | Description                                                        | Default                                              |
| --------------------- | ------------------------------------------------------------------ | ---------------------------------------------------- |
| `githubToken`         | **Required.** The token used to authenticate with GitHub.          | `GH_TOKEN` or `GITHUB_TOKEN` environment variable.   |
| `githubUrl`           | The GitHub Enterprise endpoint.                                    | `GH_URL` or `GITHUB_URL` environment variable.       |
| `githubApiPathPrefix` | The GitHub Enterprise API prefix.                                  | `GH_PREFIX` or `GITHUB_PREFIX` environment variable. |
| `assets`              | An array of files to upload to the release. See [assets](#assets). | -                                                    |

#### `assets`

Can be a [glob](https://github.com/isaacs/node-glob#glob-primer) or and `Array` of [globs](https://github.com/isaacs/node-glob#glob-primer) and `Object`s with the following properties

| Property | Description                                                                                              | Default                              |
| -------- | -------------------------------------------------------------------------------------------------------- | ------------------------------------ |
| `path`   | **Required.** A [glob](https://github.com/isaacs/node-glob#glob-primer) to identify the files to upload. | -                                    |
| `name`   | The name of the downloadable file on the Github release.                                                 | File name extracted from the `path`. |
| `label`  | Short description of the file displayed on the Github release.                                           | -                                    |

Each entry in the `assets` `Array` is globbed individually. A [glob](https://github.com/isaacs/node-glob#glob-primer) can be a `String` (`"dist/**/*.js"` or `"dist/mylib.js"`) or an `Array` of `String`s that will be globbed together (`["dist/**", "!**/*.css"]`).

If a directory is configured, all the files under this directory and its children will be included.

Files can be included enven if they have a match in `.gitignore`.

##### `assets` examples

`'dist/*.js'`: include all the `js` files in the `dist` directory, but not in its sub-directories.

`[['dist', '!**/*.css']]`: include all the files in the `dist` directory and its sub-directories excluding the `css` files.

`[{path: 'dist/MyLibrary.js', label: 'MyLibrary JS distribution'}, {path: 'dist/MyLibrary.css', label: 'MyLibrary CSS distribution'}]`: include the `dist/MyLibrary.js` and `dist/MyLibrary.css` files, and label them `MyLibrary JS distribution` and `MyLibrary CSS distribution` in the Github release.

`[['dist/**/*.{js,css}', '!**/*.min.*'], {path: 'build/MyLibrary.zip', label: 'MyLibrary'}]`: include all the `js` and `css` files in the `dist` directory and its sub-directories excluding the minified version, plus the `build/MyLibrary.zip` file and label it `MyLibrary` in the Github release.

### Usage

The plugins are used by default by [semantic-release](https://github.com/semantic-release/semantic-release) so no specific configuration is requiered if `githubToken`, `githubUrl` and `githubApiPathPrefix` are set via environment variable.

Each individual plugin can be disabled, replaced or used with other plugins in the `package.json`:

```json
{
  "release": {
    "verifyConditions": ["@semantic-release/github", "@semantic-release/npm", "verify-other-condition"],
    "getLastRelease": "@semantic-release/npm",
    "publish": ["@semantic-release/npm", "@semantic-release/github", "other-publish"]
  }
}
```

Options can be set within the plugin definition in the `semantic-release` configuration file:

```json
{
  "release": {
    "verifyConditions": [
      "@semantic-release/npm",
      {
        "path": "@semantic-release/github",
        "githubUrl": "https://my-ghe.com",
        "githubApiPathPrefix": "/api-prefix"
      },
      "verify-other-condition"
    ],
    "publish": [
      "@semantic-release/npm",
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
