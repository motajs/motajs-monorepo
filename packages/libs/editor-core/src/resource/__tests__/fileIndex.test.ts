import { describe, expect, test } from 'vitest';
import { FakeFileSystem } from '../../__tests__/fixtures';
import { EditorEntryKind } from '../../fs';
import { FileIndex } from '../fileIndex';

describe('FileIndex 初始化全扫', () => {
  // 递归全扫多层目录，目录与文件都进索引，父目录可直接列出
  test('初始化递归全扫多层目录', async () => {
    const fs = new FakeFileSystem();

    fs.seed('src/main.ts', 'a');
    fs.seed('src/nested/deep.ts', 'b');
    fs.seed('readme.md', 'c');

    const index = new FileIndex();

    await index.initialize(fs, []);

    expect(
      index
        .list('')
        .map((entry) => entry.name)
        .sort(),
    ).toEqual(['readme.md', 'src']);
    expect(index.has('src/main.ts')).toBe(true);
    expect(index.has('src/nested/deep.ts')).toBe(true);
    expect(
      index
        .list('src')
        .map((entry) => entry.name)
        .sort(),
    ).toEqual(['main.ts', 'nested']);
    expect(index.list('src/nested')).toEqual([
      { path: 'src/nested/deep.ts', name: 'deep.ts', kind: EditorEntryKind.File },
    ]);
  });

  // 忽略模式按条目名命中（含 `*` 通配），命中即跳过对应目录 / 文件
  test('忽略模式按名命中并支持通配', async () => {
    const fs = new FakeFileSystem();

    fs.seed('node_modules/pkg/index.js', 'a');
    fs.seed('src/main.ts', 'b');
    fs.seed('src/main.test.ts', 'c');

    const index = new FileIndex();

    await index.initialize(fs, ['node_modules', '*.test.ts']);

    expect(index.has('node_modules')).toBe(false);
    expect(index.has('node_modules/pkg/index.js')).toBe(false);
    expect(index.has('src/main.test.ts')).toBe(false);
    expect(index.has('src/main.ts')).toBe(true);
    expect(index.list('').map((entry) => entry.name)).toEqual(['src']);
  });
});

describe('FileIndex 增量更新', () => {
  // insert 后目录树出现新条目，父目录可见
  test('insert 增量加入文件并保证父目录可见', async () => {
    const fs = new FakeFileSystem();

    fs.seed('src/main.ts', 'a');

    const index = new FileIndex();

    await index.initialize(fs, []);
    index.insert('src/new.json', EditorEntryKind.File);

    expect(index.has('src/new.json')).toBe(true);
    expect(
      index
        .list('src')
        .map((entry) => entry.name)
        .sort(),
    ).toEqual(['main.ts', 'new.json']);
  });

  // remove 后条目及其子树整体消失
  test('remove 移除条目与子树', async () => {
    const fs = new FakeFileSystem();

    fs.seed('src/nested/deep.ts', 'a');

    const index = new FileIndex();

    await index.initialize(fs, []);
    index.remove('src');

    expect(index.has('src')).toBe(false);
    expect(index.has('src/nested')).toBe(false);
    expect(index.has('src/nested/deep.ts')).toBe(false);
    expect(index.list('')).toEqual([]);
  });

  // move 后旧路径消失、新路径出现且子树保留
  test('move 搬迁条目并保留子树', async () => {
    const fs = new FakeFileSystem();

    fs.seed('old/deep/file.ts', 'a');

    const index = new FileIndex();

    await index.initialize(fs, []);
    index.move('old', 'new');

    expect(index.has('old')).toBe(false);
    expect(index.has('old/deep/file.ts')).toBe(false);
    expect(index.has('new')).toBe(true);
    expect(index.has('new/deep')).toBe(true);
    expect(index.has('new/deep/file.ts')).toBe(true);
    expect(index.list('new')).toEqual([{ path: 'new/deep', name: 'deep', kind: EditorEntryKind.Directory }]);
  });
});
