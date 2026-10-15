import { describe, expect, test, vi } from 'vitest';
import { FakeFileSystem } from '../../__tests__/fixtures';
import { EditorEntryKind } from '../../fs';
import { logger } from '../../log';
import { ResourceSystem } from '../resourceSystem';

const PATH = 'tables/demo.json';

describe('ResourceSystem 路径化读写', () => {
  // 按路径读委托后端，写后底层 fs 内容更新，再次读取拿到新值
  test('readContent / writeContent 委托注入 fs 并写后更新', async () => {
    const fs = new FakeFileSystem();

    fs.seed(PATH, 'v1');

    const system = new ResourceSystem();

    await system.initialize(fs);

    const resource = await system.requestResource(PATH);

    expect(resource).not.toBeNull();
    expect(await resource?.request()).toBe('v1');

    await resource?.write('v2');

    expect(await fs.readFile(PATH)).toBe('v2');
    expect(await resource?.request()).toBe('v2');
  });

  // 未在 fs 中预置的路径，createResource 委托后端写入并返回可用句柄
  test('createResource 委托后端写入并返回可用句柄', async () => {
    const fs = new FakeFileSystem();
    const system = new ResourceSystem();

    await system.initialize(fs);

    const resource = await system.createResource(PATH, 'created');

    expect(resource).not.toBeNull();
    expect(await fs.readFile(PATH)).toBe('created');
    expect(await resource?.request()).toBe('created');
  });

  // deleteResource 委托后端删除，删除后该路径不可再读
  test('deleteResource 委托后端删除', async () => {
    const fs = new FakeFileSystem();

    fs.seed(PATH, 'v1');

    const system = new ResourceSystem();

    await system.initialize(fs);
    await system.deleteResource(PATH);

    await expect(fs.readFile(PATH)).rejects.toThrow();
  });

  // moveResource 委托后端移动，源路径消失、目标路径可读
  test('moveResource 委托后端移动', async () => {
    const fs = new FakeFileSystem();

    fs.seed(PATH, 'v1');

    const system = new ResourceSystem();

    await system.initialize(fs);
    await system.moveResource(PATH, 'tables/renamed.json');

    await expect(fs.readFile(PATH)).rejects.toThrow();
    expect(await fs.readFile('tables/renamed.json')).toBe('v1');
  });

  // listDirectory 委托后端，把带类型的目录条目补全为完整路径的 IFileEntry
  test('listDirectory 委托后端并补全完整路径', async () => {
    const fs = new FakeFileSystem();

    fs.seed('tables/demo.json', 'v1');
    fs.seed('tables/nested/deep.json', 'v2');

    const system = new ResourceSystem();

    await system.initialize(fs);

    const entries = await system.listDirectory('tables');
    const byName = new Map(entries.map((entry) => [entry.name, entry]));

    expect(byName.get('demo.json')?.path).toBe('tables/demo.json');
    expect(byName.get('demo.json')?.kind).toBe(EditorEntryKind.File);
    expect(byName.get('nested')?.kind).toBe(EditorEntryKind.Directory);
  });
});

describe('ResourceSystem 未初始化守卫', () => {
  // 未初始化时各访问方法记 system.notInitialized 并返回空值，不抛穿
  test('未初始化时返回空值并记日志', async () => {
    const system = new ResourceSystem();
    const errorSpy = vi.spyOn(logger, 'error');

    expect(await system.requestResource(PATH)).toBeNull();
    expect(await system.readContent(PATH)).toBeUndefined();
    expect(await system.createResource(PATH, 'x')).toBeNull();
    expect(await system.deleteResource(PATH)).toBeUndefined();
    expect(await system.moveResource(PATH, 'tables/other.json')).toBeUndefined();
    expect(await system.listDirectory('')).toEqual([]);

    expect(errorSpy).toHaveBeenCalledWith('system.notInitialized', 'Resource');
    errorSpy.mockRestore();
  });
});

describe('ResourceSystem 更新广播', () => {
  // updateResource 以路径广播 onUpdateResource；资源系统上不存在列表更新钩子
  test('updateResource 以路径广播且无列表钩子', async () => {
    const fs = new FakeFileSystem();

    fs.seed(PATH, 'v1');

    const system = new ResourceSystem();

    await system.initialize(fs);

    const received: string[] = [];

    system.addHook({
      onUpdateResource: async (id) => {
        received.push(id);
      },
    });

    await system.updateResource(PATH);

    expect(received).toEqual([PATH]);
    expect('updateResourceList' in system).toBe(false);
  });
});

describe('ResourceSystem 钩子隔离', () => {
  // 单个钩子同步抛错时不中断广播，其余钩子仍收到通知，失败经 logger 以钩子失败 id 记录
  test('updateResource 单个钩子同步失败不影响其余钩子', async () => {
    const fs = new FakeFileSystem();

    fs.seed(PATH, 'v1');

    const system = new ResourceSystem();

    await system.initialize(fs);

    const received: string[] = [];

    system.addHook({
      onUpdateResource: () => {
        throw new Error('hook boom');
      },
    });
    system.addHook({
      onUpdateResource: async (id) => {
        received.push(id);
      },
    });

    const errorSpy = vi.spyOn(logger, 'error');

    await expect(system.updateResource(PATH)).resolves.toBeUndefined();

    expect(received).toEqual([PATH]);
    expect(errorSpy).toHaveBeenCalledWith('resource.hookFailed', expect.stringContaining('hook boom'));

    errorSpy.mockRestore();
  });

  // 单个钩子返回被拒绝的 Promise 时同样被隔离，其余钩子仍收到通知，失败经 logger 记录
  test('updateResource 单个钩子异步失败不影响其余钩子', async () => {
    const fs = new FakeFileSystem();

    fs.seed(PATH, 'v1');

    const system = new ResourceSystem();

    await system.initialize(fs);

    const received: string[] = [];

    system.addHook({
      onUpdateResource: async () => {
        throw new Error('async boom');
      },
    });
    system.addHook({
      onUpdateResource: async (id) => {
        received.push(id);
      },
    });

    const errorSpy = vi.spyOn(logger, 'error');

    await expect(system.updateResource(PATH)).resolves.toBeUndefined();

    expect(received).toEqual([PATH]);
    expect(errorSpy).toHaveBeenCalledWith('resource.hookFailed', expect.stringContaining('async boom'));

    errorSpy.mockRestore();
  });
});

describe('ResourceSystem 释放', () => {
  // dispose 清空后端引用后，requestResource 命中未初始化守卫返回 null 并记日志
  test('dispose 后拒绝访问并返回 null', async () => {
    const fs = new FakeFileSystem();

    fs.seed(PATH, 'v1');

    const system = new ResourceSystem();

    await system.initialize(fs);

    expect(await system.requestResource(PATH)).not.toBeNull();

    await system.dispose();

    const errorSpy = vi.spyOn(logger, 'error');

    expect(await system.requestResource(PATH)).toBeNull();
    expect(errorSpy).toHaveBeenCalledWith('system.notInitialized', 'Resource');

    errorSpy.mockRestore();
  });
});
