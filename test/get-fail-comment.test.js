const test = require('ava');
const SemanticReleaseError = require('@semantic-release/error');
const getfailComment = require('../lib/get-fail-comment');

test('Comment with mutiple errors', t => {
  const errors = [
    new SemanticReleaseError('Error message 1', 'ERR1', 'Error 1 details'),
    new SemanticReleaseError('Error message 2', 'ERR2', 'Error 2 details'),
    new SemanticReleaseError('Error message 3', 'ERR3', 'Error 3 details'),
  ];
  const comment = getfailComment({name: 'master'}, errors);

  t.regex(comment, /the `master` branch/);
  t.regex(
    comment,
    /---\n\n### Error message 1\n\nError 1 details\n\n---\n\n### Error message 2\n\nError 2 details\n\n---\n\n### Error message 3\n\nError 3 details\n\n---/
  );
});

test('Comment with one error', t => {
  const errors = [new SemanticReleaseError('Error message 1', 'ERR1', 'Error 1 details')];
  const comment = getfailComment({name: 'master'}, errors);

  t.regex(comment, /the `master` branch/);
  t.regex(comment, /---\n\n### Error message 1\n\nError 1 details\n\n---/);
});

test('Comment with missing error details and pluginName', t => {
  const error = new SemanticReleaseError('Error message 1', 'ERR1');
  error.pluginName = 'some-plugin';
  const errors = [error];
  const comment = getfailComment({name: 'master'}, errors);

  t.regex(comment, /the `master` branch/);
  t.regex(
    comment,
    /---\n\n### Error message 1\n\nUnfortunately this error doesn't have any additional information. Feel free to kindly ask the author of the `some-plugin` plugin to add more helpful information.\n\n---/
  );
});

test('Comment with missing error details and no pluginName', t => {
  const error = new SemanticReleaseError('Error message 1', 'ERR1');
  const errors = [error];
  const comment = getfailComment({name: 'master'}, errors);

  t.regex(comment, /the `master` branch/);
  t.regex(
    comment,
    /---\n\n### Error message 1\n\nUnfortunately this error doesn't have any additional information.\n\n---/
  );
});
