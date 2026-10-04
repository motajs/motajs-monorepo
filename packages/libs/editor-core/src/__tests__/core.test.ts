import { FC } from 'react';
import { describe, expect, it } from 'vitest';
import { EditorCore } from '../core';
import { IEditorPanel } from '../panel';
import { IResourceIdentifier } from '../resource';
import { IEditorCoreInjection } from '../types';
import { IUndoContext } from '../undo';

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
