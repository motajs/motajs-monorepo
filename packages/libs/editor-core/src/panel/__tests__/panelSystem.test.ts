import { act, render, screen } from '@testing-library/react';
import { createElement, FC } from 'react';
import { describe, expect, it } from 'vitest';
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
  }

  async onBlur(): Promise<void> {
    this.blurCount += 1;
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
