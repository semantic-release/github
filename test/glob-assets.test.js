import test from 'ava';
import {ensureDir} from 'fs-extra';
import {isPlainObject, sortBy} from 'lodash';
import globAssets from '../lib/glob-assets';

const cwd = 'test/fixtures/files';
const sortAssets = assets => sortBy(assets, asset => (isPlainObject(asset) ? asset.path : asset));


test('Retrieve file from single path', async t => {
  const globbedAssets = await globAssets({cwd}, ['upload.txt']);

  t.deepEqual(globbedAssets, ['upload.txt']);
});

test('Retrieve multiple files from path', async t => {
  const globbedAssets = await globAssets({cwd}, ['upload.txt', 'upload_other.txt']);

  t.deepEqual(sortAssets(globbedAssets), sortAssets(['upload_other.txt', 'upload.txt']));
});

test('Include missing files as defined, using Object definition', async t => {
  const globbedAssets = await globAssets({cwd}, ['upload.txt', {path: 'miss*.txt', label: 'Missing'}]);

  t.deepEqual(sortAssets(globbedAssets), sortAssets(['upload.txt', {path: 'miss*.txt', label: 'Missing'}]));
});

test('Retrieve multiple files from Object', async t => {
  const globbedAssets = await globAssets({cwd}, [
    {path: 'upload.txt', name: 'upload_name', label: 'Upload label'},
    'upload_other.txt',
  ]);

  t.deepEqual(
    sortAssets(globbedAssets),
    sortAssets([{path: 'upload.txt', name: 'upload_name', label: 'Upload label'}, 'upload_other.txt'])
  );
});

test('Retrieve multiple files without duplicates', async t => {
  const globbedAssets = await globAssets({cwd}, [
    'upload_other.txt',
    'upload.txt',
    'upload_other.txt',
    'upload.txt',
    'upload.txt',
    'upload_other.txt',
  ]);

  t.deepEqual(sortAssets(globbedAssets), sortAssets(['upload_other.txt', 'upload.txt']));
});

test('Favor Object over String values when removing duplicates', async t => {
  const globbedAssets = await globAssets({cwd}, [
    'upload_other.txt',
    'upload.txt',
    {path: 'upload.txt', name: 'upload_name'},
    'upload.txt',
    {path: 'upload_other.txt', name: 'upload_other_name'},
    'upload.txt',
    'upload_other.txt',
  ]);

  t.deepEqual(
    sortAssets(globbedAssets),
    sortAssets([{path: 'upload.txt', name: 'upload_name'}, {path: 'upload_other.txt', name: 'upload_other_name'}])
  );
});

test('Retrieve file from single glob', async t => {
  const globbedAssets = await globAssets({cwd}, ['upload.*']);

  t.deepEqual(globbedAssets, ['upload.txt']);
});

test('Retrieve multiple files from single glob', async t => {
  const globbedAssets = await globAssets({cwd}, ['*.txt']);

  t.deepEqual(sortAssets(globbedAssets), sortAssets(['upload_other.txt', 'upload.txt']));
});

test('Accept glob array with one value', async t => {
  const globbedAssets = await globAssets({cwd}, [['*load.txt'], ['*_other.txt']]);

  t.deepEqual(sortAssets(globbedAssets), sortAssets(['upload_other.txt', 'upload.txt']));
});

test('Include globs that resolve to no files as defined', async t => {
  const globbedAssets = await globAssets({cwd}, [['upload.txt', '!upload.txt']]);

  t.deepEqual(sortAssets(globbedAssets), sortAssets(['!upload.txt', 'upload.txt']));
});

test('Accept glob array with one value for missing files', async t => {
  const globbedAssets = await globAssets({cwd}, [['*missing.txt'], ['*_other.txt']]);

  t.deepEqual(sortAssets(globbedAssets), sortAssets(['upload_other.txt', '*missing.txt']));
});

test('Replace name by filename for Object that match multiple files', async t => {
  const globbedAssets = await globAssets({cwd}, [{path: '*.txt', name: 'upload_name', label: 'Upload label'}]);

  t.deepEqual(
    sortAssets(globbedAssets),
    sortAssets([
      {path: 'upload.txt', name: 'upload.txt', label: 'Upload label'},
      {path: 'upload_other.txt', name: 'upload_other.txt', label: 'Upload label'},
    ])
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
  const globbedAssets = await globAssets({cwd}, [['.']]);

  t.deepEqual(sortAssets(globbedAssets), sortAssets(['upload_other.txt', 'upload.txt', '.dotfile']));
});

test('Include empty directory as defined', async t => {
  await ensureDir(path.resolve(cwd, 'empty'));
  const globbedAssets = await globAssets({cwd}, [['empty']]);

  t.deepEqual(globbedAssets, ['empty']);
});
