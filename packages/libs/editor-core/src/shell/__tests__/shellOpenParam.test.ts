import { act, cleanup, render } from '@testing-library/react';
import { createElement, FC } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { IEditorPanel, IEditorPanelFactoryParam } from '../../panel/types';
import { ResourceSystem } from '../../resource/resourceSystem';
import { IResourceIdentifier, IResourceInjection } from '../../resource/types';
import { UndoSystem } from '../../undo/undoSystem';
import { ShellSystem } from '../shellSystem';

// 每个用例结束后卸载已挂载的组件，避免 DOM 在用例之间累积
afterEach(() => {
  cleanup();
});

class NoopInjection implements IResourceInjection {
  async requestResource<T>(): Promise<T> {
    return undefined as T;
  }

  async requestResourceList(): Promise<readonly IResourceIdentifier[]> {
    return [];
  }

  async writeResource(): Promise<void> {}

  async createResource(): Promise<void> {}

  async deleteResource(): Promise<void> {}
}

class ProbePanel implements IEditorPanel {
  readonly id: string;

  private readonly component: FC;

  constructor(id: string) {
    this.id = id;
    this.component = () => createElement('div', null, this.id);
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

  async onUpdateResource(): Promise<void> {}

  async onUpdateResourceList(): Promise<void> {}

  async undo(): Promise<void> {}

  async redo(): Promise<void> {}
}

// 组装一套已初始化的外壳 / 资源 / 撤回系统与空后端
async function createSystem(): Promise<ShellSystem> {
  const resourceSystem = new ResourceSystem();
  await resourceSystem.initialize(new NoopInjection());
  const undoSystem = new UndoSystem();
  await undoSystem.initialize({ maxUndoStep: 100 });
  const shellSystem = new ShellSystem(undoSystem, resourceSystem);
  await shellSystem.initialize();
  return shellSystem;
}

// 注册一个记录工厂入参的探针面板类型
function registerProbe(shellSystem: ShellSystem, captured: IEditorPanelFactoryParam[]): void {
  shellSystem.registerPanelType({
    id: 'probe',
    name: '探针面板',
    icon: null,
    create: (param: IEditorPanelFactoryParam): IEditorPanel => {
      captured.push(param);
      return new ProbePanel(param.instanceId);
    },
  });
}

describe('ShellSystem 打开参数透传', () => {
  // openPanelInTab 携带打开参数时，工厂入参的 openParam 与所传内容相等
  it('openPanelInTab 把打开参数送达工厂', async () => {
    const shellSystem = await createSystem();
    const captured: IEditorPanelFactoryParam[] = [];

    registerProbe(shellSystem, captured);
    render(createElement(shellSystem.render()));

    const tabId = shellSystem.listTabs()[0].id;

    await act(async () => {
      await shellSystem.openPanelInTab(tabId, 'probe', { foo: 'bar' });
    });

    expect(captured.length).toBe(1);
    expect(captured[0].openParam).toEqual({ foo: 'bar' });
  });

  // 未提供打开参数时，工厂入参完全不含 openParam 键（不是 openParam: undefined）
  it('缺省打开参数时工厂入参不含该键', async () => {
    const shellSystem = await createSystem();
    const captured: IEditorPanelFactoryParam[] = [];

    registerProbe(shellSystem, captured);
    render(createElement(shellSystem.render()));

    const tabId = shellSystem.listTabs()[0].id;

    await act(async () => {
      await shellSystem.openPanelInTab(tabId, 'probe');
    });

    expect(captured.length).toBe(1);
    expect(captured[0].openParam).toBeUndefined();
    expect(Object.prototype.hasOwnProperty.call(captured[0], 'openParam')).toBe(false);
  });

  // createPanelInstance 携带打开参数时，工厂入参的 openParam 与所传内容相等
  it('createPanelInstance 把打开参数送达工厂', async () => {
    const shellSystem = await createSystem();
    const captured: IEditorPanelFactoryParam[] = [];

    registerProbe(shellSystem, captured);

    await shellSystem.createPanelInstance('probe', { x: 1 });

    expect(captured.length).toBe(1);
    expect(captured[0].openParam?.x).toBe(1);
  });
});
