import { act, cleanup, render } from '@testing-library/react';
import { createElement, FC } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { IEditorPanel } from '../../panel/types';
import { ResourceSystem } from '../../resource/resourceSystem';
import { IResourceIdentifier, IResourceInjection } from '../../resource/types';
import { UndoSystem } from '../../undo/undoSystem';
import { ShellSystem } from '../shellSystem';

// 每个用例结束后卸载已挂载的组件，避免 window 上的监听器在用例之间累积
afterEach(() => {
  cleanup();
});

// 空的资源后端：本文件的面板不读资源，仅用于装配外壳
class EmptyInjection implements IResourceInjection {
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

// 最小可注册面板：仅提供外壳渲染所需的空实现
class ShortcutPanel implements IEditorPanel {
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

  async onUpdateResource<T>(): Promise<void> {}

  async onUpdateResourceList(): Promise<void> {}

  async undo<T>(): Promise<void> {}

  async redo<T>(): Promise<void> {}
}

interface TestSystem {
  readonly shellSystem: ShellSystem;
  readonly undoSystem: UndoSystem;
}

// 组装一套已初始化的外壳系统，并注册一个最小面板类型
async function createSystem(): Promise<TestSystem> {
  const resourceSystem = new ResourceSystem();

  await resourceSystem.initialize(new EmptyInjection());

  const undoSystem = new UndoSystem();

  await undoSystem.initialize({ maxUndoStep: 100 });

  const shellSystem = new ShellSystem(undoSystem, resourceSystem);

  await shellSystem.initialize();

  shellSystem.registerPanelType({
    id: 'table',
    name: '表格面板',
    icon: null,
    create: (param) => new ShortcutPanel(param.instanceId),
  });

  const tabId = shellSystem.listTabs()[0].id;

  await act(async () => {
    await shellSystem.openPanelInTab(tabId, 'table');
  });

  return { shellSystem, undoSystem };
}

// 在 window 上派发一个可取消的 keydown 事件，并返回该事件以便断言 preventDefault
function dispatchKey(init: KeyboardEventInit): KeyboardEvent {
  const event = new KeyboardEvent('keydown', { cancelable: true, ...init });

  window.dispatchEvent(event);
  return event;
}

describe('外壳全局撤销 / 重做快捷键', () => {
  // Ctrl+Z 触发统一撤销系统的撤销，且不触发重做
  it('Ctrl+Z 触发撤销', async () => {
    const { shellSystem, undoSystem } = await createSystem();
    const undoSpy = vi.spyOn(undoSystem, 'undo');
    const redoSpy = vi.spyOn(undoSystem, 'redo');

    render(createElement(shellSystem.render()));
    dispatchKey({ key: 'z', ctrlKey: true });

    expect(undoSpy).toHaveBeenCalledTimes(1);
    expect(redoSpy).not.toHaveBeenCalled();
  });

  // Ctrl+Shift+Z 触发重做，且不触发撤销
  it('Ctrl+Shift+Z 触发重做', async () => {
    const { shellSystem, undoSystem } = await createSystem();
    const undoSpy = vi.spyOn(undoSystem, 'undo');
    const redoSpy = vi.spyOn(undoSystem, 'redo');

    render(createElement(shellSystem.render()));
    dispatchKey({ key: 'z', ctrlKey: true, shiftKey: true });

    expect(redoSpy).toHaveBeenCalledTimes(1);
    expect(undoSpy).not.toHaveBeenCalled();
  });

  // Ctrl+Y 触发重做
  it('Ctrl+Y 触发重做', async () => {
    const { shellSystem, undoSystem } = await createSystem();
    const redoSpy = vi.spyOn(undoSystem, 'redo');

    render(createElement(shellSystem.render()));
    dispatchKey({ key: 'y', ctrlKey: true });

    expect(redoSpy).toHaveBeenCalledTimes(1);
  });

  // Cmd（Meta）+Z 在 macOS 上同样触发撤销
  it('Meta+Z 触发撤销', async () => {
    const { shellSystem, undoSystem } = await createSystem();
    const undoSpy = vi.spyOn(undoSystem, 'undo');

    render(createElement(shellSystem.render()));
    dispatchKey({ key: 'z', metaKey: true });

    expect(undoSpy).toHaveBeenCalledTimes(1);
  });

  // 命中快捷键时拦下浏览器原生行为；无关按键不拦
  it('命中组合时 preventDefault，无关按键不拦截', async () => {
    const { shellSystem } = await createSystem();

    render(createElement(shellSystem.render()));

    const hit = dispatchKey({ key: 'z', ctrlKey: true });

    expect(hit.defaultPrevented).toBe(true);

    const miss = dispatchKey({ key: 'z' });

    expect(miss.defaultPrevented).toBe(false);
  });

  // 空撤销栈时按 Ctrl+Z 不抛错，撤销系统自身保持安全
  it('空撤销栈时按 Ctrl+Z 安全', async () => {
    const { shellSystem, undoSystem } = await createSystem();
    const undoSpy = vi.spyOn(undoSystem, 'undo');

    render(createElement(shellSystem.render()));

    expect(() => dispatchKey({ key: 'z', ctrlKey: true })).not.toThrow();
    expect(undoSpy).toHaveBeenCalledTimes(1);
  });
});
