import test from 'ava';
import globAssets from '../lib/glob-assets';

test('Retrieve file from single path', async t => {
  const globbedAssets = await globAssets(['test/fixtures/files/upload.txt']);

  t.deepEqual(globbedAssets, ['test/fixtures/files/upload.txt']);
});

test('Retrieve multiple files from path', async t => {
  const globbedAssets = (await globAssets([
    'test/fixtures/files/upload.txt',
    'test/fixtures/files/upload_other.txt',
  ])).sort();

  t.deepEqual(globbedAssets, ['test/fixtures/files/upload_other.txt', 'test/fixtures/files/upload.txt'].sort());
});

test('Include missing files as defined, using Object definition', async t => {
  const globbedAssets = (await globAssets([
    'test/fixtures/files/upload.txt',
    {path: 'test/fixtures/files/miss*.txt', label: 'Missing'},
  ])).sort();

  t.deepEqual(
    globbedAssets,
    ['test/fixtures/files/upload.txt', {path: 'test/fixtures/files/miss*.txt', label: 'Missing'}].sort()
  );
});

test('Retrieve multiple files from Object', async t => {
  const globbedAssets = (await globAssets([
    {path: 'test/fixtures/files/upload.txt', name: 'upload_name', label: 'Upload label'},
    'test/fixtures/files/upload_other.txt',
  ])).sort();

  t.deepEqual(
    globbedAssets,
    [
      {path: 'test/fixtures/files/upload.txt', name: 'upload_name', label: 'Upload label'},
      'test/fixtures/files/upload_other.txt',
    ].sort()
  );
});

test('Retrieve multiple files without duplicates', async t => {
  const globbedAssets = (await globAssets([
    'test/fixtures/files/upload_other.txt',
    'test/fixtures/files/upload.txt',
    'test/fixtures/files/upload_other.txt',
    'test/fixtures/files/upload.txt',
    'test/fixtures/files/upload.txt',
    'test/fixtures/files/upload_other.txt',
  ])).sort();

  t.deepEqual(globbedAssets, ['test/fixtures/files/upload_other.txt', 'test/fixtures/files/upload.txt'].sort());
});

test('Favor Object over String values when removing duplicates', async t => {
  const globbedAssets = (await globAssets([
    'test/fixtures/files/upload_other.txt',
    'test/fixtures/files/upload.txt',
    {path: 'test/fixtures/files/upload.txt', name: 'upload_name'},
    'test/fixtures/files/upload.txt',
    {path: 'test/fixtures/files/upload_other.txt', name: 'upload_other_name'},
    'test/fixtures/files/upload.txt',
    'test/fixtures/files/upload_other.txt',
  ])).sort();
  t.deepEqual(
    globbedAssets,
    [
      {path: 'test/fixtures/files/upload.txt', name: 'upload_name'},
      {path: 'test/fixtures/files/upload_other.txt', name: 'upload_other_name'},
    ].sort()
  );
});

test('Retrieve file from single glob', async t => {
  const globbedAssets = await globAssets(['test/fixtures/files/upload.*']);

  t.deepEqual(globbedAssets, ['test/fixtures/files/upload.txt']);
});

test('Retrieve multiple files from single glob', async t => {
  const globbedAssets = (await globAssets(['test/fixtures/files/*.txt'])).sort();

  t.deepEqual(globbedAssets, ['test/fixtures/files/upload_other.txt', 'test/fixtures/files/upload.txt'].sort());
});

test('Accept glob array with one value', async t => {
  const globbedAssets = (await globAssets([
    ['test/fixtures/files/*load.txt'],
    ['test/fixtures/files/*_other.txt'],
  ])).sort();

  t.deepEqual(globbedAssets, ['test/fixtures/files/upload_other.txt', 'test/fixtures/files/upload.txt'].sort());
});

test('Include globs that resolve to no files as defined', async t => {
  const globbedAssets = (await globAssets([
    ['test/fixtures/files/upload.txt', '!test/fixtures/files/upload.txt'],
  ])).sort();

  t.deepEqual(globbedAssets, ['!test/fixtures/files/upload.txt', 'test/fixtures/files/upload.txt'].sort());
});

test('Accept glob array with one value for missing files', async t => {
  const globbedAssets = (await globAssets([
    ['test/fixtures/files/*missing.txt'],
    ['test/fixtures/files/*_other.txt'],
  ])).sort();

  t.deepEqual(globbedAssets, ['test/fixtures/files/upload_other.txt', 'test/fixtures/files/*missing.txt'].sort());
});

test('Replace name by filename for Object that match multiple files', async t => {
  const globbedAssets = (await globAssets([
    {path: 'test/fixtures/files/*.txt', name: 'upload_name', label: 'Upload label'},
  ])).sort();

  t.deepEqual(
    globbedAssets,
    [
      {path: 'test/fixtures/files/upload.txt', name: 'upload.txt', label: 'Upload label'},
      {path: 'test/fixtures/files/upload_other.txt', name: 'upload_other.txt', label: 'Upload label'},
    ].sort()
  );
});

test('Include dotfiles', async t => {
  const globbedAssets = await globAssets(['test/fixtures/files/.dot*']);

  t.deepEqual(globbedAssets, ['test/fixtures/files/.dotfile']);
});

test('Ingnore single negated glob', async t => {
  const globbedAssets = await globAssets(['!test/fixtures/files/*.txt']);

  t.deepEqual(globbedAssets, []);
});

test('Ingnore single negated glob in Object', async t => {
  const globbedAssets = await globAssets([{path: '!test/fixtures/files/*.txt'}]);

  t.deepEqual(globbedAssets, []);
});

test('Accept negated globs', async t => {
  const globbedAssets = await globAssets([['test/fixtures/files/*.txt', '!**/*_other.txt']]);

  t.deepEqual(globbedAssets, ['test/fixtures/files/upload.txt']);
});

test('Expand directories', async t => {
  const globbedAssets = (await globAssets([['test/fixtures/files']])).sort();

  t.deepEqual(
    globbedAssets,
    ['test/fixtures/files/upload_other.txt', 'test/fixtures/files/upload.txt', 'test/fixtures/files/.dotfile'].sort()
  );
});

test('Include empty directory as defined', async t => {
  const globbedAssets = await globAssets([['test/empty']]);

  t.deepEqual(globbedAssets, ['test/empty']);
});
