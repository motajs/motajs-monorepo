import { act, render, screen } from '@testing-library/react';
import { createElement, FC } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { logger } from '../../log';
import { ResourceSystem } from '../../resource/resourceSystem';
import { IResourceIdentifier, IResourceInjection } from '../../resource/types';
import { IUndoContext } from '../../undo/types';
import { UndoSystem } from '../../undo/undoSystem';
import { PanelSystem } from '../panelSystem';
import { IEditorPanel } from '../types';

class FakeResourceInjection implements IResourceInjection {
  readonly content: Map<number, Map<string, unknown>> = new Map();

  readonly list: Map<number, IResourceIdentifier[]> = new Map();

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
    return this.content.get(id.type)?.get(id.id) as T;
  }

  async requestResourceList(type: number): Promise<readonly IResourceIdentifier[]> {
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

class FakePanel implements IEditorPanel {
  readonly id: string;

  initializeCount = 0;
  disposeCount = 0;
  focusCount = 0;
  blurCount = 0;
  switchInCount = 0;
  switchOutCount = 0;
  updateResourceCount = 0;
  updateResourceListCount = 0;
  undoCount = 0;
  redoCount = 0;
  lastUpdateId?: IResourceIdentifier;
  lastUpdateData?: unknown;
  lastUpdateType?: number;
  lastUpdateList: readonly IResourceIdentifier[] = [];
  lastUndoContext?: IUndoContext<unknown>;
  lastRedoContext?: IUndoContext<unknown>;
  /** 设置后在 onFocus 时抛出该文本的错误，用于验证焦点回调兜底 */
  focusError?: string;
  /** 设置后在 onBlur 时抛出该文本的错误，用于验证焦点回调兜底 */
  blurError?: string;

  private readonly component: FC;
  private readonly disposeLog?: string[];

  constructor(id: string, disposeLog?: string[]) {
    this.id = id;
    this.disposeLog = disposeLog;
    this.component = () => createElement('div', null, this.id);
  }

  async initialize(): Promise<void> {
    this.initializeCount += 1;
  }

  async dispose(): Promise<void> {
    this.disposeCount += 1;
    this.disposeLog?.push(this.id);
  }

  render(): FC {
    return this.component;
  }

  async onFocus(): Promise<void> {
    this.focusCount += 1;
    if (this.focusError) throw new Error(this.focusError);
  }

  async onBlur(): Promise<void> {
    this.blurCount += 1;
    if (this.blurError) throw new Error(this.blurError);
  }

  async onSwitchIn(): Promise<void> {
    this.switchInCount += 1;
  }

  async onSwitchOut(): Promise<void> {
    this.switchOutCount += 1;
  }

  async onUpdateResource<T>(id: IResourceIdentifier, data: T): Promise<void> {
    this.updateResourceCount += 1;
    this.lastUpdateId = id;
    this.lastUpdateData = data;
  }

  async onUpdateResourceList(type: number, list: readonly IResourceIdentifier[]): Promise<void> {
    this.updateResourceListCount += 1;
    this.lastUpdateType = type;
    this.lastUpdateList = list;
  }

  async undo<T>(context: IUndoContext<T>): Promise<void> {
    this.undoCount += 1;
    this.lastUndoContext = context;
  }

  async redo<T>(context: IUndoContext<T>): Promise<void> {
    this.redoCount += 1;
    this.lastRedoContext = context;
  }
}

interface TestSystem {
  readonly panelSystem: PanelSystem;
  readonly undoSystem: UndoSystem;
  readonly resourceSystem: ResourceSystem;
  readonly injection: FakeResourceInjection;
}

// 组装一套已初始化的面板/资源/撤回系统与内存后端
async function createSystem(maxUndoStep = 100): Promise<TestSystem> {
  const injection = new FakeResourceInjection();
  const resourceSystem = new ResourceSystem();
  await resourceSystem.initialize(injection);
  const undoSystem = new UndoSystem();
  await undoSystem.initialize({ maxUndoStep });
  const panelSystem = new PanelSystem(undoSystem, resourceSystem);
  await panelSystem.initialize();
  return { panelSystem, undoSystem, resourceSystem, injection };
}

describe('PanelSystem 最小闭环', () => {
  // 未 initialize 时注册只入待初始化列表，initialize 时补调面板的 initialize
  it('注册未初始化时只入待初始化列表，initialize 时补调', async () => {
    const resourceSystem = new ResourceSystem();
    await resourceSystem.initialize(new FakeResourceInjection());
    const undoSystem = new UndoSystem();
    await undoSystem.initialize({ maxUndoStep: 100 });
    const panelSystem = new PanelSystem(undoSystem, resourceSystem);
    const a = new FakePanel('panel-a');

    await panelSystem.registerPanel(async () => a);

    expect(a.initializeCount).toBe(0);

    await panelSystem.initialize();

    expect(a.initializeCount).toBe(1);
  });

  // render 返回一个可供挂载的组件函数
  it('render 返回面板系统的渲染根组件函数', async () => {
    const system = await createSystem();
    const root = system.panelSystem.render();

    expect(typeof root).toBe('function');
  });

  // switchTo 触发旧面板 onSwitchOut 与新面板 onSwitchIn，currentPanel 变为新面板
  it('switchTo 触发切出/切入并更新 currentPanel', async () => {
    const system = await createSystem();
    const a = new FakePanel('panel-a');
    const b = new FakePanel('panel-b');
    await system.panelSystem.registerPanel(async () => a);
    await system.panelSystem.registerPanel(async () => b);

    await system.panelSystem.switchTo(a);
    await system.panelSystem.switchTo(b);

    expect(a.switchOutCount).toBe(1);
    expect(b.switchInCount).toBe(1);
    expect(system.panelSystem.currentPanel).toBe(b);
  });

  // 真实挂载渲染根后 switchTo 切换面板，画面显示新面板内容
  it('真实挂载渲染根后 switchTo 切换到新面板内容', async () => {
    const system = await createSystem();
    const a = new FakePanel('panel-a');
    const b = new FakePanel('panel-b');
    await system.panelSystem.registerPanel(async () => a);
    await system.panelSystem.registerPanel(async () => b);

    render(createElement(system.panelSystem.render()));

    await act(async () => {
      await system.panelSystem.switchTo(a);
    });

    expect(screen.getByText('panel-a')).not.toBeNull();

    await act(async () => {
      await system.panelSystem.switchTo(b);
    });

    expect(screen.getByText('panel-b')).not.toBeNull();
    expect(screen.queryByText('panel-a')).toBeNull();
  });
});

describe('PanelSystem 切换撤回', () => {
  // switchTo 记录一条撤回；undo 回到上一面板且不产生新记录，redo 再切回
  it('switchTo 记录撤回，undo/redo 只切换不再记录', async () => {
    const system = await createSystem(100);
    const a = new FakePanel('panel-a');
    const b = new FakePanel('panel-b');
    await system.panelSystem.registerPanel(async () => a);
    await system.panelSystem.registerPanel(async () => b);

    await system.panelSystem.switchTo(a);
    await system.panelSystem.switchTo(b);

    await system.undoSystem.undo();

    expect(system.panelSystem.currentPanel).toBe(a);
    expect(a.switchInCount).toBe(2);
    expect(b.switchInCount).toBe(1);

    await system.undoSystem.redo();

    expect(system.panelSystem.currentPanel).toBe(b);
    expect(b.switchInCount).toBe(2);
  });

  // 切换到当前面板为 no-op，不新增撤回也不触发切换回调
  it('切换到当前面板为 no-op', async () => {
    const system = await createSystem(100);
    const a = new FakePanel('panel-a');
    await system.panelSystem.registerPanel(async () => a);

    await system.panelSystem.switchTo(a);
    await system.panelSystem.switchTo(a);

    expect(a.switchInCount).toBe(1);
    expect(a.switchOutCount).toBe(0);

    await system.undoSystem.undo();

    expect(system.panelSystem.currentPanel).toBeNull();
  });
});

describe('PanelSystem 注册表', () => {
  // 同 id 注册两次时记录错误、返回 null，且被丢弃的重复面板先被释放
  it('重复 id 注册记录错误、返回 null 并释放重复面板', async () => {
    const system = await createSystem();
    await system.panelSystem.registerPanel(async () => new FakePanel('dup'));
    const duplicate = new FakePanel('dup');
    const errorSpy = vi.spyOn(logger, 'error');

    const result = await system.panelSystem.registerPanel(async () => duplicate);

    expect(result).toBeNull();
    expect(errorSpy).toHaveBeenCalledWith('panel.duplicateId', 'dup');
    expect(duplicate.disposeCount).toBe(1);
    errorSpy.mockRestore();
  });

  // getPanel 命中返回面板，未命中返回 null
  it('getPanel 命中返回面板，未命中返回 null', async () => {
    const system = await createSystem();
    const a = new FakePanel('panel-a');
    await system.panelSystem.registerPanel(async () => a);

    expect(system.panelSystem.getPanel('panel-a')).toBe(a);
    expect(system.panelSystem.getPanel('missing')).toBeNull();
  });
});

describe('PanelSystem 资源桥接', () => {
  // updateResource 经 EditorPanelHooks 重新申请资源并通知面板最新内容
  it('updateResource 通知面板最新内容', async () => {
    const system = await createSystem();
    const id = Object.freeze({ type: 1, id: 'alpha' });
    system.injection.seed(id, 'v1');
    const a = new FakePanel('panel-a');
    await system.panelSystem.registerPanel(async () => a);

    await system.resourceSystem.updateResource(id);

    expect(a.updateResourceCount).toBe(1);
    expect(a.lastUpdateId).toBe(id);
    expect(a.lastUpdateData).toBe('v1');

    system.injection.content.get(id.type)?.set(id.id, 'v2');
    await system.resourceSystem.updateResource(id);

    expect(a.updateResourceCount).toBe(2);
    expect(a.lastUpdateData).toBe('v2');
  });

  // updateResourceList 经 EditorPanelHooks 重新申请列表并通知面板
  it('updateResourceList 通知面板最新列表', async () => {
    const system = await createSystem();
    const id = Object.freeze({ type: 2, id: 'beta' });
    system.injection.seed(id, 'v1');
    const a = new FakePanel('panel-a');
    await system.panelSystem.registerPanel(async () => a);

    await system.resourceSystem.updateResourceList(id.type);

    expect(a.updateResourceListCount).toBe(1);
    expect(a.lastUpdateType).toBe(id.type);
    expect(a.lastUpdateList).toEqual([id]);
  });
});

describe('PanelSystem 窗口焦点', () => {
  // window focus/blur 事件触发当前面板的 onFocus/onBlur
  it('window focus/blur 触发当前面板 onFocus/onBlur', async () => {
    const system = await createSystem();
    const a = new FakePanel('panel-a');
    await system.panelSystem.registerPanel(async () => a);
    await system.panelSystem.switchTo(a);

    await act(async () => {
      window.dispatchEvent(new Event('focus'));
    });

    await act(async () => {
      window.dispatchEvent(new Event('blur'));
    });

    expect(a.focusCount).toBe(1);
    expect(a.blurCount).toBe(1);
  });
});

describe('PanelSystem 释放', () => {
  // disposePanel 卸载钩子、释放面板并清空当前面板
  it('disposePanel 卸载钩子、释放面板并清空当前面板', async () => {
    const system = await createSystem();
    const id = Object.freeze({ type: 3, id: 'gamma' });
    system.injection.seed(id, 'v1');
    const a = new FakePanel('panel-a');
    await system.panelSystem.registerPanel(async () => a);
    await system.panelSystem.switchTo(a);

    await system.panelSystem.disposePanel(a);

    expect(a.disposeCount).toBe(1);
    expect(system.panelSystem.getPanel('panel-a')).toBeNull();
    expect(system.panelSystem.currentPanel).toBeNull();

    await system.resourceSystem.updateResource(id);

    expect(a.updateResourceCount).toBe(0);
  });

  // dispose 移除监听并按注册逆序释放面板、卸载其钩子
  it('dispose 按注册逆序释放面板', async () => {
    const system = await createSystem();
    const order: string[] = [];
    const a = new FakePanel('panel-a', order);
    const b = new FakePanel('panel-b', order);
    const c = new FakePanel('panel-c', order);
    await system.panelSystem.registerPanel(async () => a);
    await system.panelSystem.registerPanel(async () => b);
    await system.panelSystem.registerPanel(async () => c);

    await system.panelSystem.dispose();

    expect(order).toEqual(['panel-c', 'panel-b', 'panel-a']);
    expect(system.panelSystem.currentPanel).toBeNull();

    await system.resourceSystem.updateResource(Object.freeze({ type: 4, id: 'delta' }));

    expect(a.updateResourceCount).toBe(0);
  });

  // 重复 initialize 为 no-op，不重复挂窗口监听（焦点回调只触发一次）
  it('重复 initialize 不重复挂窗口监听', async () => {
    const system = await createSystem();
    const a = new FakePanel('panel-a');
    await system.panelSystem.registerPanel(async () => a);
    await system.panelSystem.switchTo(a);

    await system.panelSystem.initialize();

    await act(async () => {
      window.dispatchEvent(new Event('focus'));
    });

    expect(a.focusCount).toBe(1);
  });

  // dispose 复位 initialized 后，新面板先入待初始化列表；再次 initialize 补调并恢复窗口监听
  it('dispose 后重新 initialize 补调面板并恢复窗口监听', async () => {
    const system = await createSystem();
    const a = new FakePanel('panel-a');
    await system.panelSystem.registerPanel(async () => a);
    await system.panelSystem.switchTo(a);

    await system.panelSystem.dispose();

    const b = new FakePanel('panel-b');
    await system.panelSystem.registerPanel(async () => b);

    expect(b.initializeCount).toBe(0);

    await system.panelSystem.initialize();

    expect(b.initializeCount).toBe(1);

    await system.panelSystem.switchTo(b);

    await act(async () => {
      window.dispatchEvent(new Event('focus'));
    });

    expect(b.focusCount).toBe(1);
  });
});

describe('PanelSystem 切换校验与回调兜底', () => {
  // 未注册面板 switchTo 被拒绝：记日志、currentPanel 不变、撤回栈不受影响
  it('未注册面板 switchTo 被拒绝且不影响撤回栈', async () => {
    const system = await createSystem(100);
    const a = new FakePanel('panel-a');
    await system.panelSystem.registerPanel(async () => a);
    await system.panelSystem.switchTo(a);

    const unregistered = new FakePanel('panel-x');
    const errorSpy = vi.spyOn(logger, 'error');

    await system.panelSystem.switchTo(unregistered);

    expect(errorSpy).toHaveBeenCalledWith('panel.notRegistered', 'panel-x');
    expect(system.panelSystem.currentPanel).toBe(a);

    await system.undoSystem.undo();

    expect(system.panelSystem.currentPanel).toBeNull();
    expect(unregistered.switchInCount).toBe(0);
    errorSpy.mockRestore();
  });

  // onFocus 失败被捕获并经集中日志记录，不产生未处理 rejection
  it('onFocus 失败被捕获并记日志', async () => {
    const system = await createSystem();
    const a = new FakePanel('panel-a');
    a.focusError = 'focus boom';
    await system.panelSystem.registerPanel(async () => a);
    await system.panelSystem.switchTo(a);
    const errorSpy = vi.spyOn(logger, 'error');

    await act(async () => {
      window.dispatchEvent(new Event('focus'));
    });

    expect(errorSpy).toHaveBeenCalledWith('panel.callbackFailed', 'Error: focus boom');
    expect(a.focusCount).toBe(1);
    errorSpy.mockRestore();
  });
});
