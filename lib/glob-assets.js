const {basename} = require('path');
const {isPlainObject, castArray, uniqWith} = require('lodash');
const pReduce = require('p-reduce');
const globby = require('globby');
const debug = require('debug')('semantic-release:github');

module.exports = async assets =>
  uniqWith(
    (await pReduce(
      assets,
      async (result, asset) => {
        // Wrap single glob definition in Array
        const glob = castArray(isPlainObject(asset) ? asset.path : asset);
        // Skip solo negated pattern (avoid to include every non js file with `!**/*.js`)
        if (glob.length <= 1 && glob[0].startsWith('!')) {
          debug(
            'skipping the negated glob %o as its alone in its group and would retrieve a large amount of files ',
            glob[0]
          );
          return result;
        }
        const globbed = await globby(glob, {expandDirectories: true, gitignore: false, dot: true});
        if (isPlainObject(asset)) {
          if (globbed.length > 1) {
            // If asset is an Object with a glob the `path` property that resolve to multiple files,
            // Output an Object definition for each file matched and set each one with:
            // - `path` of the matched file
            // - `name` based on the actual file name (to avoid assets with duplicate `name`)
            // - other properties of the original asset definition
            return [...result, ...globbed.map(file => Object.assign({}, asset, {path: file, name: basename(file)}))];
          }
          // If asset is an Object, output an Object definition with:
          // - `path` of the matched file if there is one, or the original `path` definition (will be considered as a missing file)
          // - other properties of the original asset definition
          return [...result, Object.assign({}, asset, {path: globbed[0] || asset.path})];
        }
        if (globbed.length > 0) {
          // If asset is a String definition, output each files matched
          return [...result, ...globbed];
        }
        // If asset is a String definition but no match is found, output the elements of the original glob (each one will be considered as a missing file)
        return [...result, ...glob];
      },
      []
      // Sort with Object first, to prioritize Object definition over Strings in dedup
    )).sort(asset => !isPlainObject(asset)),
    // Compare `path` property if Object definition, value itself if String
    (a, b) => (isPlainObject(a) ? a.path : a) === (isPlainObject(b) ? b.path : b)
  );
