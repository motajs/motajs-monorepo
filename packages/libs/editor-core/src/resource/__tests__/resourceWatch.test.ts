import { FC } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { createCoreHarness, FakeFileSystem } from '../../__tests__/fixtures';
import { EditorCore } from '../../core';
import { EditorFileChangeKind } from '../../fs';
import { logger } from '../../log';
import { IEditorPanel } from '../../panel/types';
import { ResourceSystem } from '../resourceSystem';

// 变化流是异步投递的：等一轮宏任务，让 handleFileChange 的 Promise 链全部结算
function flush(): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
}

// 声明新通道的面板：只记录收到的路径与种类
class ChangePanel implements IEditorPanel {
  readonly id: string;

  readonly changes: Array<{ readonly identifier: string; readonly kind: EditorFileChangeKind }> = [];

  updateResourceCount = 0;

  private readonly component: FC = () => null;

  constructor(id: string) {
    this.id = id;
  }

  async initialize(): Promise<void> {}

  async dispose(): Promise<void> {}

  render(): FC {
    return this.component;
  }

  async onFocus(): Promise<void> {}

  async onBlur(): Promise<void> {}

  async onSwitchIn(): Promise<void> {}

  async onSwitchOut(): Promise<void> {}

  async onResourceChange(identifier: string, kind: EditorFileChangeKind): Promise<void> {
    this.changes.push({ identifier, kind });
  }

  async onUpdateResource(): Promise<void> {
    this.updateResourceCount += 1;
  }

  async undo(): Promise<void> {}

  async redo(): Promise<void> {}
}

// 只声明旧通道的面板：记录预读回来的内容
class LegacyPanel implements IEditorPanel {
  readonly id: string;

  updateResourceCount = 0;

  lastUpdateData?: unknown;

  private readonly component: FC = () => null;

  constructor(id: string) {
    this.id = id;
  }

  async initialize(): Promise<void> {}

  async dispose(): Promise<void> {}

  render(): FC {
    return this.component;
  }

  async onFocus(): Promise<void> {}

  async onBlur(): Promise<void> {}

  async onSwitchIn(): Promise<void> {}

  async onSwitchOut(): Promise<void> {}

  async onUpdateResource<T>(identifier: string, data: T): Promise<void> {
    this.updateResourceCount += 1;
    this.lastUpdateData = data;
  }

  async undo(): Promise<void> {}

  async redo(): Promise<void> {}
}

// 把一个面板类型注册进外壳并打开成活动面板
async function openPanel(core: EditorCore, panel: IEditorPanel): Promise<void> {
  core.shellSystem.registerPanelType({ id: panel.id, name: panel.id, icon: null, create: () => panel });

  const tabId = core.shellSystem.listTabs()[0].id;

  await core.shellSystem.openPanelInTab(tabId, panel.id);
}

describe('ResourceSystem 变化流订阅', () => {
  // Add 事件让新文件与其各级父目录一起进入索引
  it('Add 事件把新文件与父目录插入索引', async () => {
    const fs = new FakeFileSystem();

    fs.seed('tables/existing.json', '{}');

    const system = new ResourceSystem();

    await system.initialize(fs);

    fs.emit({ path: 'assets/deep/icon.png', kind: EditorFileChangeKind.Add });
    await flush();

    expect((await system.listDirectory('')).map((entry) => entry.name).sort()).toEqual([
      'assets',
      'tables',
    ]);
    expect((await system.listDirectory('assets')).map((entry) => entry.name)).toEqual(['deep']);
    expect((await system.listDirectory('assets/deep')).map((entry) => entry.name)).toEqual(['icon.png']);
  });

  // Change 事件让缓存失效，下次读取回源拿到新内容
  it('Change 事件使缓存失效并回源', async () => {
    const fs = new FakeFileSystem();

    fs.seed('tables/demo.json', 'v1');

    const system = new ResourceSystem();

    await system.initialize(fs);

    expect(await system.readContent('tables/demo.json')).toBe('v1');

    await fs.writeFile('tables/demo.json', 'v2');
    fs.emit({ path: 'tables/demo.json', kind: EditorFileChangeKind.Change });
    await flush();

    expect(await system.readContent('tables/demo.json')).toBe('v2');
  });

  // Delete 事件摘索引并清缓存，不预读、不抛错
  it('Delete 事件摘除索引并清缓存且不抛错', async () => {
    const fs = new FakeFileSystem();

    fs.seed('tables/demo.json', 'v1');

    const system = new ResourceSystem();

    await system.initialize(fs);

    expect(await system.readContent('tables/demo.json')).toBe('v1');

    await fs.deleteFile('tables/demo.json');
    fs.emit({ path: 'tables/demo.json', kind: EditorFileChangeKind.Delete });
    await flush();

    expect(await system.listDirectory('tables')).toEqual([]);
    await expect(system.readContent('tables/demo.json')).rejects.toThrow();
  });

  // dispose 退订后事件不再送达任何钩子
  it('dispose 退订后事件不再通知钩子', async () => {
    const fs = new FakeFileSystem();

    fs.seed('tables/demo.json', 'v1');

    const system = new ResourceSystem();

    await system.initialize(fs);

    const received: string[] = [];

    system.addHook({
      onResourceChange: async (identifier) => {
        received.push(identifier);
      },
    });

    await system.dispose();
    fs.emit({ path: 'tables/demo.json', kind: EditorFileChangeKind.Change });
    await flush();

    expect(received).toEqual([]);
  });

  // 重复 initialize 只保留一条订阅，一次事件只通知一次
  it('重复 initialize 不叠加订阅', async () => {
    const fs = new FakeFileSystem();

    fs.seed('tables/demo.json', 'v1');

    const system = new ResourceSystem();

    await system.initialize(fs);
    await system.initialize(fs);

    const received: string[] = [];

    system.addHook({
      onResourceChange: async (identifier) => {
        received.push(identifier);
      },
    });

    fs.emit({ path: 'tables/demo.json', kind: EditorFileChangeKind.Change });
    await flush();

    expect(received).toEqual(['tables/demo.json']);
  });

  // 空串、绝对路径、`..` 段、反斜杠、盘符路径一律拒绝并记日志，索引保持不变
  it('非法变化路径被拒绝并记日志', async () => {
    const fs = new FakeFileSystem();

    fs.seed('tables/demo.json', 'v1');

    const system = new ResourceSystem();

    await system.initialize(fs);

    const errorSpy = vi.spyOn(logger, 'error');
    const invalid = ['', '/abs/file.json', 'tables/../secret.json', 'tables\\demo.json', 'C:/abs/file.json'];

    for (const path of invalid) fs.emit({ path, kind: EditorFileChangeKind.Add });

    await flush();

    expect(errorSpy).toHaveBeenCalledTimes(invalid.length);
    expect(errorSpy).toHaveBeenCalledWith('resource.invalidChangePath', expect.any(String));
    expect((await system.listDirectory('')).map((entry) => entry.name)).toEqual(['tables']);
    expect((await system.listDirectory('tables')).map((entry) => entry.name)).toEqual(['demo.json']);

    errorSpy.mockRestore();
  });

  // 点开头路径照常收录，索引不因隐藏约定而丢弃 .editor
  it('点开头路径继续进索引', async () => {
    const fs = new FakeFileSystem();

    fs.seed('tables/demo.json', 'v1');

    const system = new ResourceSystem();

    await system.initialize(fs);

    fs.emit({ path: '.editor/map-tiles.json', kind: EditorFileChangeKind.Add });
    await flush();

    expect((await system.listDirectory('.editor')).map((entry) => entry.name)).toEqual(['map-tiles.json']);
  });
});

describe('ShellPanelHooks 变化转发分支', () => {
  // 声明 onResourceChange 的面板只收到路径与种类，读路径抛错也不影响通知
  it('新面板只收到路径与种类且不预读', async () => {
    const fs = new FakeFileSystem();

    fs.seed('tables/demo.json', 'v1');
    fs.failing.add('tables/demo.json');

    const core = await createCoreHarness(fs);
    const panel = new ChangePanel('panel-new');

    await openPanel(core, panel);

    const errorSpy = vi.spyOn(logger, 'error');

    fs.emit({ path: 'tables/demo.json', kind: EditorFileChangeKind.Change });
    await flush();

    expect(panel.changes).toEqual([{ identifier: 'tables/demo.json', kind: EditorFileChangeKind.Change }]);
    expect(panel.updateResourceCount).toBe(0);
    expect(errorSpy).not.toHaveBeenCalledWith('resource.hookFailed', expect.any(String));

    errorSpy.mockRestore();
  });

  // 未声明 onResourceChange 的旧面板仍走预读通道收到 onUpdateResource 的内容
  it('旧面板仍走预读通道收到内容', async () => {
    const fs = new FakeFileSystem();

    fs.seed('tables/demo.json', 'v1');

    const core = await createCoreHarness(fs);
    const panel = new LegacyPanel('panel-legacy');

    await openPanel(core, panel);

    fs.emit({ path: 'tables/demo.json', kind: EditorFileChangeKind.Change });
    await flush();

    expect(panel.updateResourceCount).toBe(1);
    expect(panel.lastUpdateData).toBe('v1');
  });
});
