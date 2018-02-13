import test from 'ava';
import globAssets from '../lib/glob-assets';

test('Retrieve file from single path', async t => {
  const globbedAssets = await globAssets(['test/fixtures/upload.txt']);

  t.deepEqual(globbedAssets, ['test/fixtures/upload.txt']);
});

test('Retrieve multiple files from path', async t => {
  const globbedAssets = await globAssets(['test/fixtures/upload.txt', 'test/fixtures/upload_other.txt']);

  t.deepEqual(globbedAssets, ['test/fixtures/upload_other.txt', 'test/fixtures/upload.txt']);
});

test('Include missing files as defined, using Object definition', async t => {
  const globbedAssets = await globAssets([
    'test/fixtures/upload.txt',
    {path: 'test/fixtures/miss*.txt', label: 'Missing'},
  ]);

  t.deepEqual(globbedAssets, [{path: 'test/fixtures/miss*.txt', label: 'Missing'}, 'test/fixtures/upload.txt']);
});

test('Retrieve multiple files from Object', async t => {
  const globbedAssets = await globAssets([
    {path: 'test/fixtures/upload.txt', name: 'upload_name', label: 'Upload label'},
    'test/fixtures/upload_other.txt',
  ]);

  t.deepEqual(globbedAssets, [
    {path: 'test/fixtures/upload.txt', name: 'upload_name', label: 'Upload label'},
    'test/fixtures/upload_other.txt',
  ]);
});

test('Retrieve multiple files without duplicates', async t => {
  const globbedAssets = await globAssets([
    'test/fixtures/upload_other.txt',
    'test/fixtures/upload.txt',
    'test/fixtures/upload_other.txt',
    'test/fixtures/upload.txt',
    'test/fixtures/upload.txt',
    'test/fixtures/upload_other.txt',
  ]);

  t.deepEqual(globbedAssets, ['test/fixtures/upload_other.txt', 'test/fixtures/upload.txt']);
});

test('Favor Object over String values when removing duplicates', async t => {
  const globbedAssets = await globAssets([
    'test/fixtures/upload_other.txt',
    'test/fixtures/upload.txt',
    {path: 'test/fixtures/upload.txt', name: 'upload_name'},
    'test/fixtures/upload.txt',
    {path: 'test/fixtures/upload_other.txt', name: 'upload_other_name'},
    'test/fixtures/upload.txt',
    'test/fixtures/upload_other.txt',
  ]);
  t.deepEqual(globbedAssets, [
    {path: 'test/fixtures/upload.txt', name: 'upload_name'},
    {path: 'test/fixtures/upload_other.txt', name: 'upload_other_name'},
  ]);
});

test('Retrieve file from single glob', async t => {
  const globbedAssets = await globAssets(['test/fixtures/upload.*']);

  t.deepEqual(globbedAssets, ['test/fixtures/upload.txt']);
});

test('Retrieve multiple files from single glob', async t => {
  const globbedAssets = await globAssets(['test/fixtures/*.txt']);

  t.deepEqual(globbedAssets, ['test/fixtures/upload_other.txt', 'test/fixtures/upload.txt']);
});

test('Accept glob array with one value', async t => {
  const globbedAssets = await globAssets([['test/fixtures/*load.txt'], ['test/fixtures/*_other.txt']]);

  t.deepEqual(globbedAssets, ['test/fixtures/upload_other.txt', 'test/fixtures/upload.txt']);
});

test('Include globs that resolve to no files as defined', async t => {
  const globbedAssets = await globAssets([['test/fixtures/upload.txt', '!test/fixtures/upload.txt']]);

  t.deepEqual(globbedAssets, ['!test/fixtures/upload.txt', 'test/fixtures/upload.txt']);
});

test('Accept glob array with one value for missing files', async t => {
  const globbedAssets = await globAssets([['test/fixtures/*missing.txt'], ['test/fixtures/*_other.txt']]);

  t.deepEqual(globbedAssets, ['test/fixtures/upload_other.txt', 'test/fixtures/*missing.txt']);
});

test('Replace name by filename for Object that match multiple files', async t => {
  const globbedAssets = await globAssets([{path: 'test/fixtures/*.txt', name: 'upload_name', label: 'Upload label'}]);

  t.deepEqual(globbedAssets, [
    {path: 'test/fixtures/upload.txt', name: 'upload.txt', label: 'Upload label'},
    {path: 'test/fixtures/upload_other.txt', name: 'upload_other.txt', label: 'Upload label'},
  ]);
});

test('Include dotfiles', async t => {
  const globbedAssets = await globAssets(['test/fixtures/.dot*']);

  t.deepEqual(globbedAssets, ['test/fixtures/.dotfile']);
});

test('Ingnore single negated glob', async t => {
  const globbedAssets = await globAssets(['!test/fixtures/*.txt']);

  t.deepEqual(globbedAssets, []);
});

test('Ingnore single negated glob in Object', async t => {
  const globbedAssets = await globAssets([{path: '!test/fixtures/*.txt'}]);

  t.deepEqual(globbedAssets, []);
});

test('Accept negated globs', async t => {
  const globbedAssets = await globAssets([['test/fixtures/*.txt', '!**/*_other.txt']]);

  t.deepEqual(globbedAssets, ['test/fixtures/upload.txt']);
});

test('Expand directories', async t => {
  const globbedAssets = await globAssets([['test/fixtures']]);

  t.deepEqual(globbedAssets, ['test/fixtures/upload_other.txt', 'test/fixtures/upload.txt', 'test/fixtures/.dotfile']);
});

test('Include empty directory as defined', async t => {
  const globbedAssets = await globAssets([['test/empty']]);

  t.deepEqual(globbedAssets, ['test/empty']);
});
