const test = require('ava');
const {repeat} = require('lodash');
const getSearchQueries = require('../lib/get-search-queries');

test('Generate queries of 256 characters maximum', (t) => {
  const commits = [
    repeat('a', 40),
    repeat('b', 40),
    repeat('c', 40),
    repeat('d', 40),
    repeat('e', 40),
    repeat('f', 40),
  ];

  t.deepEqual(getSearchQueries(repeat('0', 51), commits), [
    `${repeat('0', 51)}+${commits[0]}+${commits[1]}+${commits[2]}+${commits[3]}+${commits[4]}`,
    `${repeat('0', 51)}+${commits[5]}`,
  ]);

  t.deepEqual(getSearchQueries(repeat('0', 52), commits), [
    `${repeat('0', 52)}+${commits[0]}+${commits[1]}+${commits[2]}+${commits[3]}`,
    `${repeat('0', 52)}+${commits[4]}+${commits[5]}`,
  ]);
});

test('Generate one query if it is less tahn 256 characters', (t) => {
  const commits = [repeat('a', 40), repeat('b', 40)];

  t.deepEqual(getSearchQueries(repeat('0', 20), commits), [`${repeat('0', 20)}+${commits[0]}+${commits[1]}`]);
});

test('Return emty Array if there is no commits', (t) => {
  t.deepEqual(getSearchQueries('base', []), []);
});
