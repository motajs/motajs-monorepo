import { FC } from 'react';
import { describe, expect, it, vi } from 'vitest';
import {
  EditorCore,
  Hookable,
  HookController,
  IEditorPanel,
  IEditorPanelContext,
  IUndoContext,
  IUndoable,
  logger,
  ResourceSystem,
  ShellSystem,
  UndoSystem,
} from '../index';
import { FakeFileSystem, createCoreHarness } from './fixtures';

// 测试用的最小面板，记录生命周期与资源更新回调
class FakePanel implements IEditorPanel {
  readonly id: string;

  initializeCount = 0;

  disposeCount = 0;

  updateResourceCount = 0;

  lastUpdateData?: unknown;

  private readonly component: FC = () => null;

  constructor(id: string) {
    this.id = id;
  }

  async initialize(): Promise<void> {
    this.initializeCount += 1;
  }

  async dispose(): Promise<void> {
    this.disposeCount += 1;
  }

  render(): FC {
    return this.component;
  }

  async onFocus(): Promise<void> {
    return;
  }

  async onBlur(): Promise<void> {
    return;
  }

  async onSwitchIn(): Promise<void> {
    return;
  }

  async onSwitchOut(): Promise<void> {
    return;
  }

  async onUpdateResource<T>(id: string, data: T): Promise<void> {
    this.updateResourceCount += 1;
    this.lastUpdateData = data;
  }

  async undo<T>(context: IUndoContext<T>): Promise<void> {
    return;
  }

  async redo<T>(context: IUndoContext<T>): Promise<void> {
    return;
  }
}

// 测试用的最小撤回对象，记录 undo/redo 调用次数
class FakeUndoable implements IUndoable {
  undoCount = 0;

  redoCount = 0;

  async undo<T>(context: IUndoContext<T>): Promise<void> {
    this.undoCount += 1;
  }

  async redo<T>(context: IUndoContext<T>): Promise<void> {
    this.redoCount += 1;
  }
}

describe('EditorCore 组装', () => {
  // 构造 EditorCore 后 version 为字面量 0.1.0，三个系统字段均已实例化
  it('构造后 version 与三系统字段就绪', () => {
    const core = new EditorCore();

    expect(core.version).toBe('0.1.0');
    expect(core.undoSystem).toBeDefined();
    expect(core.resourceSystem).toBeDefined();
    expect(core.shellSystem).toBeDefined();
  });

  // initialize 下发注入且不抛错，随后经外壳系统注册类型并打开面板、经资源系统按路径广播更新
  it('initialize 下发注入并驱动面板与资源系统', async () => {
    const fs = new FakeFileSystem();

    fs.seed('tables/demo.json', 'v1');

    const core = await createCoreHarness(fs);
    const panel = new FakePanel('panel-a');

    core.shellSystem.registerPanelType({ id: 'panel-a', name: '面板 A', icon: null, create: () => panel });

    const tabId = core.shellSystem.listTabs()[0].id;

    await core.shellSystem.openPanelInTab(tabId, 'panel-a');

    expect(core.shellSystem.listTabs()[0].typeId).toBe('panel-a');

    await core.resourceSystem.updateResource('tables/demo.json');

    expect(panel.updateResourceCount).toBe(1);
    expect(panel.lastUpdateData).toBe('v1');
  });
});

describe('EditorCore 初始化生命周期', () => {
  // 连续 initialize 第二次被拒：记 warn 且不重复下发注入，资源仍读首个文件系统
  it('重复 initialize 只生效一次并记 warn', async () => {
    const fs = new FakeFileSystem();

    fs.seed('tables/demo.json', 'v1');

    const core = await createCoreHarness(fs);
    const warnSpy = vi.spyOn(logger, 'warn');
    const second = new FakeFileSystem();

    second.seed('tables/demo.json', 'v2');

    await core.initialize({ fs: second, maxUndoStep: 100 });

    expect(warnSpy).toHaveBeenCalledWith('core.duplicateInitialize');

    const value = await core.resourceSystem.readContent('tables/demo.json');

    expect(value).toBe('v1');
    warnSpy.mockRestore();
  });

  // dispose 之后再 initialize 被拒：记 error 且资源保持未注入
  it('dispose 后 initialize 被拒并记 error', async () => {
    const fs = new FakeFileSystem();

    fs.seed('tables/demo.json', 'v1');

    const core = await createCoreHarness(fs);

    await core.dispose();

    const errorSpy = vi.spyOn(logger, 'error');
    const second = new FakeFileSystem();

    second.seed('tables/demo.json', 'v2');

    await core.initialize({ fs: second, maxUndoStep: 100 });

    expect(errorSpy).toHaveBeenCalledWith('core.initializeAfterDispose');

    const resource = await core.resourceSystem.requestResource('tables/demo.json');

    expect(resource).toBeNull();
    errorSpy.mockRestore();
  });
});

describe('EditorCore 释放', () => {
  // dispose 逆序释放后：当前面板清空、面板被释放、资源释放后访问被拒、撤回栈清空
  it('dispose 后三系统状态复位', async () => {
    const fs = new FakeFileSystem();

    fs.seed('tables/demo.json', 'v1');

    const core = await createCoreHarness(fs);
    const contexts: IEditorPanelContext[] = [];
    const panel = new FakePanel('panel-a');

    core.shellSystem.registerPanelType({
      id: 'panel-a',
      name: '面板 A',
      icon: null,
      create: (param) => {
        contexts.push(param.context);
        return panel;
      },
    });

    const tabId = core.shellSystem.listTabs()[0].id;

    await core.shellSystem.openPanelInTab(tabId, 'panel-a');

    const undoable = new FakeUndoable();

    core.undoSystem.addUndoContext(undoable, { type: 1, data: 'x' });
    await contexts[0].requestResource('tables/demo.json');

    await core.dispose();

    expect(core.shellSystem.listTabs().length).toBe(0);
    expect(panel.disposeCount).toBe(1);

    const afterDispose = await contexts[0].requestResource('tables/demo.json');

    expect(afterDispose).toBeNull();

    await core.undoSystem.undo();

    expect(undoable.undoCount).toBe(0);
  });
});

describe('包根公开面', () => {
  // 包根导出 EditorCore、三系统类与 Hook 基类，均可从 '.' 导入
  it('从包根可导入 EditorCore、三系统类与 Hook 基类', () => {
    expect(EditorCore).toBeDefined();
    expect(UndoSystem).toBeDefined();
    expect(ResourceSystem).toBeDefined();
    expect(ShellSystem).toBeDefined();
    expect(Hookable).toBeDefined();
    expect(HookController).toBeDefined();
  });
});
