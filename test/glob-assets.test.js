import test from 'ava';
import globAssets from '../lib/glob-assets';

const cwd = 'test/fixtures/files';

test('Retrieve file from single path', async t => {
  const globbedAssets = await globAssets({cwd}, ['upload.txt']);

  t.deepEqual(globbedAssets, ['upload.txt']);
});

test('Retrieve multiple files from path', async t => {
  const globbedAssets = (await globAssets({cwd}, ['upload.txt', 'upload_other.txt'])).sort();

  t.deepEqual(globbedAssets, ['upload_other.txt', 'upload.txt'].sort());
});

test('Include missing files as defined, using Object definition', async t => {
  const globbedAssets = (await globAssets({cwd}, ['upload.txt', {path: 'miss*.txt', label: 'Missing'}])).sort();

  t.deepEqual(globbedAssets, ['upload.txt', {path: 'miss*.txt', label: 'Missing'}].sort());
});

test('Retrieve multiple files from Object', async t => {
  const globbedAssets = (await globAssets({cwd}, [
    {path: 'upload.txt', name: 'upload_name', label: 'Upload label'},
    'upload_other.txt',
  ])).sort();

  t.deepEqual(
    globbedAssets,
    [{path: 'upload.txt', name: 'upload_name', label: 'Upload label'}, 'upload_other.txt'].sort()
  );
});

test('Retrieve multiple files without duplicates', async t => {
  const globbedAssets = (await globAssets({cwd}, [
    'upload_other.txt',
    'upload.txt',
    'upload_other.txt',
    'upload.txt',
    'upload.txt',
    'upload_other.txt',
  ])).sort();

  t.deepEqual(globbedAssets, ['upload_other.txt', 'upload.txt'].sort());
});

test('Favor Object over String values when removing duplicates', async t => {
  const globbedAssets = (await globAssets({cwd}, [
    'upload_other.txt',
    'upload.txt',
    {path: 'upload.txt', name: 'upload_name'},
    'upload.txt',
    {path: 'upload_other.txt', name: 'upload_other_name'},
    'upload.txt',
    'upload_other.txt',
  ])).sort();
  t.deepEqual(
    globbedAssets,
    [{path: 'upload.txt', name: 'upload_name'}, {path: 'upload_other.txt', name: 'upload_other_name'}].sort()
  );
});

test('Retrieve file from single glob', async t => {
  const globbedAssets = await globAssets({cwd}, ['upload.*']);

  t.deepEqual(globbedAssets, ['upload.txt']);
});

test('Retrieve multiple files from single glob', async t => {
  const globbedAssets = (await globAssets({cwd}, ['*.txt'])).sort();

  t.deepEqual(globbedAssets, ['upload_other.txt', 'upload.txt'].sort());
});

test('Accept glob array with one value', async t => {
  const globbedAssets = (await globAssets({cwd}, [['*load.txt'], ['*_other.txt']])).sort();

  t.deepEqual(globbedAssets, ['upload_other.txt', 'upload.txt'].sort());
});

test('Include globs that resolve to no files as defined', async t => {
  const globbedAssets = (await globAssets({cwd}, [['upload.txt', '!upload.txt']])).sort();

  t.deepEqual(globbedAssets, ['!upload.txt', 'upload.txt'].sort());
});

test('Accept glob array with one value for missing files', async t => {
  const globbedAssets = (await globAssets({cwd}, [['*missing.txt'], ['*_other.txt']])).sort();

  t.deepEqual(globbedAssets, ['upload_other.txt', '*missing.txt'].sort());
});

test('Replace name by filename for Object that match multiple files', async t => {
  const globbedAssets = (await globAssets({cwd}, [{path: '*.txt', name: 'upload_name', label: 'Upload label'}])).sort();

  t.deepEqual(
    globbedAssets,
    [
      {path: 'upload.txt', name: 'upload.txt', label: 'Upload label'},
      {path: 'upload_other.txt', name: 'upload_other.txt', label: 'Upload label'},
    ].sort()
  );
});

test('Include dotfiles', async t => {
  const globbedAssets = await globAssets({cwd}, ['.dot*']);

  t.deepEqual(globbedAssets, ['.dotfile']);
});

test('Ingnore single negated glob', async t => {
  const globbedAssets = await globAssets({cwd}, ['!*.txt']);

  t.deepEqual(globbedAssets, []);
});

test('Ingnore single negated glob in Object', async t => {
  const globbedAssets = await globAssets({cwd}, [{path: '!*.txt'}]);

  t.deepEqual(globbedAssets, []);
});

test('Accept negated globs', async t => {
  const globbedAssets = await globAssets({cwd}, [['*.txt', '!**/*_other.txt']]);

  t.deepEqual(globbedAssets, ['upload.txt']);
});

test('Expand directories', async t => {
  const globbedAssets = (await globAssets({cwd}, [['.']])).sort();

  t.deepEqual(globbedAssets, ['upload_other.txt', 'upload.txt', '.dotfile'].sort());
});

test('Include empty directory as defined', async t => {
  const globbedAssets = await globAssets({cwd}, [['test/empty']]);

  t.deepEqual(globbedAssets, ['test/empty']);
});
