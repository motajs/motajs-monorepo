import { act, cleanup, render } from '@testing-library/react';
import { createElement, FC } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { logger } from '../../log';
import { IEditorPanel, IEditorPanelFactoryParam } from '../../panel/types';
import { ResourceSystem } from '../../resource/resourceSystem';
import { IResourceIdentifier, IResourceInjection } from '../../resource/types';
import { UndoSystem } from '../../undo/undoSystem';
import { ShellSystem } from '../shellSystem';

// 每个用例结束后卸载已挂载的组件，避免 DOM 在用例之间累积
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

// 记录切换钩子调用的面板；可令切入点钩子抛错以验证失败隔离
class SwitchPanel implements IEditorPanel {
  readonly id: string;

  switchInCount = 0;
  switchOutCount = 0;
  initializeCount = 0;
  disposeCount = 0;
  /** 设置后在 onSwitchIn 抛出该文本的错误，用于验证失败隔离 */
  switchInError?: string;

  private readonly component: FC;

  constructor(id: string) {
    this.id = id;
    this.component = () => createElement('div', null, this.id);
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

  async onFocus(): Promise<void> {}

  async onBlur(): Promise<void> {}

  async onSwitchIn(): Promise<void> {
    this.switchInCount += 1;
    if (this.switchInError) throw new Error(this.switchInError);
  }

  async onSwitchOut(): Promise<void> {
    this.switchOutCount += 1;
  }

  async onUpdateResource<T>(): Promise<void> {}

  async onUpdateResourceList(): Promise<void> {}

  async undo<T>(): Promise<void> {}

  async redo<T>(): Promise<void> {}
}

interface TestSystem {
  readonly shellSystem: ShellSystem;
  readonly panels: SwitchPanel[];
}

// 组装一套已初始化的外壳系统，并注册一个收集面板实例的面板类型
async function createSystem(): Promise<TestSystem> {
  const resourceSystem = new ResourceSystem();

  await resourceSystem.initialize(new EmptyInjection());

  const undoSystem = new UndoSystem();

  await undoSystem.initialize({ maxUndoStep: 100 });

  const shellSystem = new ShellSystem(undoSystem, resourceSystem);

  await shellSystem.initialize();

  const panels: SwitchPanel[] = [];

  shellSystem.registerPanelType({
    id: 'table',
    name: '表格面板',
    icon: null,
    create: (param: IEditorPanelFactoryParam): IEditorPanel => {
      const panel = new SwitchPanel(param.instanceId);

      panels.push(panel);
      return panel;
    },
  });

  return { shellSystem, panels };
}

describe('ShellSystem 切换钩子', () => {
  // 切换活动标签：离开的面板收到 onSwitchOut、进入的面板收到 onSwitchIn
  it('切换活动标签时通知离开与进入的面板', async () => {
    const { shellSystem, panels } = await createSystem();

    render(createElement(shellSystem.render()));

    const firstTab = shellSystem.listTabs()[0].id;

    await act(async () => {
      await shellSystem.openPanelInTab(firstTab, 'table');
    });

    const secondTab = shellSystem.openBlankTab();

    await act(async () => {
      await shellSystem.openPanelInTab(secondTab, 'table');
    });

    // 打开第二个面板前新建了空白标签，首个面板应已被切出
    expect(panels[0].switchInCount).toBe(1);
    expect(panels[0].switchOutCount).toBe(1);
    expect(panels[1].switchInCount).toBe(1);
    expect(panels[1].switchOutCount).toBe(0);

    // 切回第一个标签：第二个面板切出、第一个面板再次切入
    await act(async () => {
      shellSystem.activateTab(firstTab);
    });

    expect(panels[1].switchOutCount).toBe(1);
    expect(panels[0].switchInCount).toBe(2);
  });

  // 关闭活动标签切到相邻标签：被销毁的面板先收到 onSwitchOut，相邻面板收到 onSwitchIn
  it('关闭活动标签时切出被销毁面板并切入相邻面板', async () => {
    const { shellSystem, panels } = await createSystem();

    render(createElement(shellSystem.render()));

    const firstTab = shellSystem.listTabs()[0].id;

    await act(async () => {
      await shellSystem.openPanelInTab(firstTab, 'table');
    });

    const secondTab = shellSystem.openBlankTab();

    await act(async () => {
      await shellSystem.openPanelInTab(secondTab, 'table');
    });

    // 关闭当前活动的第二个标签，自动切回第一个标签
    await act(async () => {
      await shellSystem.closeTab(secondTab);
    });

    expect(panels[1].switchOutCount).toBe(1);
    expect(panels[1].disposeCount).toBe(1);
    expect(panels[0].switchInCount).toBe(2);
  });

  // 关闭非活动标签不触发切换钩子：活动面板保持切入状态
  it('关闭非活动标签不触发切换钩子', async () => {
    const { shellSystem, panels } = await createSystem();

    render(createElement(shellSystem.render()));

    const firstTab = shellSystem.listTabs()[0].id;

    await act(async () => {
      await shellSystem.openPanelInTab(firstTab, 'table');
    });

    const secondTab = shellSystem.openBlankTab();

    await act(async () => {
      await shellSystem.openPanelInTab(secondTab, 'table');
    });

    const thirdTab = shellSystem.openBlankTab();

    await act(async () => {
      await shellSystem.openPanelInTab(thirdTab, 'table');
    });

    const secondInBefore = panels[1].switchInCount;
    const secondOutBefore = panels[1].switchOutCount;

    // 关闭中间的第二个标签（非活动），活动标签仍为第三个
    await act(async () => {
      await shellSystem.closeTab(secondTab);
    });

    expect(panels[1].switchInCount).toBe(secondInBefore);
    expect(panels[1].switchOutCount).toBe(secondOutBefore);
    expect(panels[2].switchInCount).toBe(1);
  });

  // 切入钩子抛错时成功隔离：外壳仍完成打开，并记录回调失败日志
  it('切入钩子抛错时外壳仍完成切换', async () => {
    const { shellSystem } = await createSystem();
    const throwing = new SwitchPanel('throwing');

    throwing.switchInError = 'switch boom';
    shellSystem.registerPanelType({ id: 'boom', name: '坏面板', icon: null, create: () => throwing });

    const errorSpy = vi.spyOn(logger, 'error');
    const tabId = shellSystem.listTabs()[0].id;
    let opened = false;

    await act(async () => {
      opened = await shellSystem.openPanelInTab(tabId, 'boom');
    });
    await act(async () => {});

    expect(opened).toBe(true);
    expect(shellSystem.listTabs()[0].typeId).toBe('boom');
    expect(throwing.switchInCount).toBe(1);
    expect(errorSpy).toHaveBeenCalledWith('shell.callbackFailed', 'boom');
    errorSpy.mockRestore();
  });
});
