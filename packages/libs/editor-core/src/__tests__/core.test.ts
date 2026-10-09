import { FC } from 'react';
import { describe, expect, it, vi } from 'vitest';
import {
  EditorCore,
  Hookable,
  HookController,
  IEditorCoreInjection,
  IEditorPanel,
  IEditorPanelContext,
  IResourceIdentifier,
  IUndoContext,
  IUndoable,
  logger,
  PanelSystem,
  ResourceSystem,
  UndoSystem,
} from '../index';

// 内存资源后端，同时满足撤销注入，供 EditorCore.initialize 使用
class FakeEditorInjection implements IEditorCoreInjection {
  readonly maxUndoStep: number = 100;

  readonly content: Map<number, Map<string, unknown>> = new Map();

  readonly list: Map<number, IResourceIdentifier[]> = new Map();

  requestResourceCount = 0;

  requestResourceListCount = 0;

  // 向内存后端预置一个资源内容及其所属的资源列表
  seed(id: IResourceIdentifier, value: unknown): void {
    let byId = this.content.get(id.type);

    if (!byId) {
      byId = new Map();
      this.content.set(id.type, byId);
    }

    byId.set(id.id, value);

    const ids = this.list.get(id.type) ?? [];
    ids.push(id);
    this.list.set(id.type, ids);
  }

  async requestResource<T>(id: IResourceIdentifier): Promise<T> {
    this.requestResourceCount += 1;
    return this.content.get(id.type)?.get(id.id) as T;
  }

  async requestResourceList(type: number): Promise<readonly IResourceIdentifier[]> {
    this.requestResourceListCount += 1;
    return this.list.get(type) ?? [];
  }

  async writeResource(id: IResourceIdentifier, content: unknown): Promise<void> {
    this.content.get(id.type)?.set(id.id, content);
  }

  async createResource(id: IResourceIdentifier, content: unknown): Promise<void> {
    this.seed(id, content);
  }

  async deleteResource(id: IResourceIdentifier): Promise<void> {
    this.content.get(id.type)?.delete(id.id);
  }
}

// 测试用的最小面板，记录生命周期与资源更新回调
class FakePanel implements IEditorPanel {
  readonly id: string;

  initializeCount = 0;

  disposeCount = 0;

  updateResourceCount = 0;

  updateResourceListCount = 0;

  lastUpdateList: readonly IResourceIdentifier[] = [];

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

  async onUpdateResource<T>(id: IResourceIdentifier, data: T): Promise<void> {
    this.updateResourceCount += 1;
  }

  async onUpdateResourceList(type: number, list: readonly IResourceIdentifier[]): Promise<void> {
    this.updateResourceListCount += 1;
    this.lastUpdateList = list;
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
    expect(core.panelSystem).toBeDefined();
  });

  // initialize 下发注入且不抛错，随后经面板系统注册并切换面板、经资源系统广播列表更新
  it('initialize 下发注入并驱动面板与资源系统', async () => {
    const core = new EditorCore();
    const injection = new FakeEditorInjection();
    const id = Object.freeze({ type: 1, id: 'alpha' });
    injection.seed(id, 'v1');

    await expect(core.initialize(injection)).resolves.toBeUndefined();

    const panel = new FakePanel('panel-a');
    await core.panelSystem.registerPanel(async () => panel);
    await core.panelSystem.switchTo(panel);

    expect(core.panelSystem.currentPanel).toBe(panel);

    await core.resourceSystem.updateResourceList(id.type);

    expect(panel.updateResourceListCount).toBe(1);
    expect(panel.lastUpdateList).toEqual([id]);
  });
});

describe('EditorCore 初始化生命周期', () => {
  // 连续 initialize 第二次被拒：记 warn 且不重复下发注入
  it('重复 initialize 只生效一次并记 warn', async () => {
    const core = new EditorCore();
    const injection = new FakeEditorInjection();
    const id = Object.freeze({ type: 1, id: 'alpha' });
    injection.seed(id, 'v1');
    await core.initialize(injection);
    const warnSpy = vi.spyOn(logger, 'warn');
    const second = new FakeEditorInjection();
    second.seed(id, 'v2');

    await core.initialize(second);

    expect(warnSpy).toHaveBeenCalledWith('core.duplicateInitialize');

    const resource = await core.resourceSystem.requestResource<string>(id);

    expect(resource).not.toBeNull();
    expect(second.requestResourceCount).toBe(0);
    warnSpy.mockRestore();
  });

  // dispose 之后再 initialize 被拒：记 error 且资源保持未注入
  it('dispose 后 initialize 被拒并记 error', async () => {
    const core = new EditorCore();
    const injection = new FakeEditorInjection();
    const id = Object.freeze({ type: 1, id: 'alpha' });
    injection.seed(id, 'v1');
    await core.initialize(injection);
    await core.dispose();
    const errorSpy = vi.spyOn(logger, 'error');
    const second = new FakeEditorInjection();
    second.seed(id, 'v2');

    await core.initialize(second);

    expect(errorSpy).toHaveBeenCalledWith('core.initializeAfterDispose');

    const resource = await core.resourceSystem.requestResource<string>(id);

    expect(resource).toBeNull();
    expect(second.requestResourceCount).toBe(0);
    errorSpy.mockRestore();
  });
});

describe('EditorCore 释放', () => {
  // dispose 逆序释放后：当前面板清空、面板被释放、资源释放后访问被拒、撤回栈清空
  it('dispose 后三系统状态复位', async () => {
    const core = new EditorCore();
    const injection = new FakeEditorInjection();
    const id = Object.freeze({ type: 1, id: 'alpha' });
    injection.seed(id, 'v1');
    await core.initialize(injection);

    const contexts: IEditorPanelContext[] = [];
    const panel = new FakePanel('panel-a');
    await core.panelSystem.registerPanel(async (context) => {
      contexts.push(context);
      return panel;
    });
    await core.panelSystem.switchTo(panel);

    const undoable = new FakeUndoable();
    core.undoSystem.addUndoContext(undoable, { type: 1, data: 'x' });
    await contexts[0].requestResource<string>(id);

    expect(injection.requestResourceListCount).toBe(1);

    await core.dispose();

    expect(core.panelSystem.currentPanel).toBeNull();
    expect(panel.disposeCount).toBe(1);

    const afterDispose = await contexts[0].requestResource<string>(id);

    expect(afterDispose).toBeNull();
    expect(injection.requestResourceListCount).toBe(1);

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
    expect(PanelSystem).toBeDefined();
    expect(Hookable).toBeDefined();
    expect(HookController).toBeDefined();
  });
});
