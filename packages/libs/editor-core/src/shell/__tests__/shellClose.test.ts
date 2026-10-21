import { act, cleanup, render } from '@testing-library/react';
import { createElement, FC } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FakeFileSystem } from '../../__tests__/fixtures';
import { logger } from '../../log';
import { IEditorPanel, IEditorPanelFactoryParam } from '../../panel/types';
import { ResourceSystem } from '../../resource/resourceSystem';
import { UndoSystem } from '../../undo/undoSystem';
import { ShellSystem } from '../shellSystem';

// 关闭前询问的测试：用户点 ✕ 时外壳先把目标标签切成活动标签，再问面板能不能关；
// 回答 false 或钩子抛错都保留标签，而注销面板类型、释放外壳这类内部路径全程不问。

/** 打开两个同类型面板后得到的两个标签 id */
type TabPair = readonly [first: string, second: string];

// 每个用例结束后卸载已挂载的组件，避免 DOM 在用例之间累积
afterEach(() => {
  cleanup();
});

// 实现了关闭前钩子的面板：记录询问、切换与释放次数，可配置回答效果
class ClosePanel implements IEditorPanel {
  readonly id: string;

  /** 关闭前钩子的调用次数，用于证明内部释放路径没有询问 */
  beforeCloseCount = 0;
  /** 释放次数 */
  disposeCount = 0;
  /** 切入次数 */
  switchInCount = 0;
  /** 切出次数 */
  switchOutCount = 0;
  /** 询问发生时本面板已收到的切入次数快照 */
  switchInAtBeforeClose = 0;
  /** 询问发生时对照面板已收到的切出次数快照 */
  peerSwitchOutAtBeforeClose = 0;
  /** 钩子的回答，默认允许关闭 */
  allowClose = true;
  /** 设置后钩子抛出该文本的错误，用于验证失败隔离 */
  beforeCloseError?: string;
  /** 询问发生时用于读取切出次数的对照面板 */
  peer?: ClosePanel;

  private readonly component: FC;

  constructor(id: string) {
    this.id = id;
    this.component = () => createElement('div', null, this.id);
  }

  getTitle(): string {
    return this.id;
  }

  async onBeforeClose(): Promise<boolean> {
    this.beforeCloseCount += 1;
    this.switchInAtBeforeClose = this.switchInCount;
    this.peerSwitchOutAtBeforeClose = this.peer === undefined ? 0 : this.peer.switchOutCount;

    if (this.beforeCloseError !== undefined) throw new Error(this.beforeCloseError);

    return this.allowClose;
  }

  async initialize(): Promise<void> {}

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
  }

  async onSwitchOut(): Promise<void> {
    this.switchOutCount += 1;
  }

  async onUpdateResource(): Promise<void> {}

  async undo(): Promise<void> {}

  async redo(): Promise<void> {}
}

// 不实现关闭前钩子的面板：验证「点了 ✕ 立刻关闭」的既有行为没有回退
class PlainPanel implements IEditorPanel {
  readonly id: string;

  /** 释放次数 */
  disposeCount = 0;
  /** 切入次数 */
  switchInCount = 0;
  /** 切出次数 */
  switchOutCount = 0;

  private readonly component: FC;

  constructor(id: string) {
    this.id = id;
    this.component = () => createElement('div', null, this.id);
  }

  getTitle(): string {
    return this.id;
  }

  async initialize(): Promise<void> {}

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
  }

  async onSwitchOut(): Promise<void> {
    this.switchOutCount += 1;
  }

  async onUpdateResource(): Promise<void> {}

  async undo(): Promise<void> {}

  async redo(): Promise<void> {}
}

interface TestSystem {
  readonly shellSystem: ShellSystem;
  readonly closePanels: ClosePanel[];
  readonly plainPanels: PlainPanel[];
}

// 组装一套已初始化的外壳系统，并注册「会询问」与「不询问」两种面板类型
async function createSystem(): Promise<TestSystem> {
  const resourceSystem = new ResourceSystem();

  await resourceSystem.initialize(new FakeFileSystem());

  const undoSystem = new UndoSystem();

  await undoSystem.initialize({ maxUndoStep: 100 });

  const shellSystem = new ShellSystem(undoSystem, resourceSystem);

  await shellSystem.initialize();

  const closePanels: ClosePanel[] = [];
  const plainPanels: PlainPanel[] = [];

  shellSystem.registerPanelType({
    id: 'close',
    name: '待关闭面板',
    icon: null,
    create: (param: IEditorPanelFactoryParam): IEditorPanel => {
      const panel = new ClosePanel(param.instanceId);

      closePanels.push(panel);
      return panel;
    },
  });

  shellSystem.registerPanelType({
    id: 'plain',
    name: '直接关闭面板',
    icon: null,
    create: (param: IEditorPanelFactoryParam): IEditorPanel => {
      const panel = new PlainPanel(param.instanceId);

      plainPanels.push(panel);
      return panel;
    },
  });

  return { shellSystem, closePanels, plainPanels };
}

// 在首个标签打开一个面板，再新建第二个标签并在其中打开同类型面板
async function openTwoPanels(shellSystem: ShellSystem, typeId: string): Promise<TabPair> {
  const firstTab = shellSystem.listTabs()[0].id;

  await act(async () => {
    await shellSystem.openPanelInTab(firstTab, typeId);
  });

  const secondTab = shellSystem.openBlankTab();

  await act(async () => {
    await shellSystem.openPanelInTab(secondTab, typeId);
  });

  return [firstTab, secondTab];
}

describe('ShellSystem 关闭前询问', () => {
  // 钩子回答 true：标签被移除，实例恰好释放一次
  it('钩子回答 true 时移除标签并释放实例', async () => {
    const { shellSystem, closePanels } = await createSystem();

    render(createElement(shellSystem.render()));

    const [firstTab, secondTab] = await openTwoPanels(shellSystem, 'close');

    await act(async () => {
      await shellSystem.closeTab(secondTab);
    });

    expect(shellSystem.listTabs().map((tab) => tab.id)).toEqual([firstTab]);
    expect(closePanels[1].beforeCloseCount).toBe(1);
    expect(closePanels[1].disposeCount).toBe(1);
    expect(closePanels[0].disposeCount).toBe(0);
  });

  // 钩子回答 false：标签与实例都保留，且只询问一次
  it('钩子回答 false 时保留标签与实例', async () => {
    const { shellSystem, closePanels } = await createSystem();

    render(createElement(shellSystem.render()));

    const [firstTab, secondTab] = await openTwoPanels(shellSystem, 'close');

    closePanels[1].allowClose = false;

    await act(async () => {
      await shellSystem.closeTab(secondTab);
    });

    expect(shellSystem.listTabs().map((tab) => tab.id)).toEqual([firstTab, secondTab]);
    expect(closePanels[1].beforeCloseCount).toBe(1);
    expect(closePanels[1].disposeCount).toBe(0);
  });

  // 后台标签被关闭时先激活再询问：询问发生时它已切入、原前台已切出
  it('关闭后台标签时先激活再询问', async () => {
    const { shellSystem, closePanels } = await createSystem();

    render(createElement(shellSystem.render()));

    const [firstTab, secondTab] = await openTwoPanels(shellSystem, 'close');

    act(() => {
      shellSystem.activateTab(firstTab);
    });

    closePanels[1].peer = closePanels[0];
    closePanels[1].allowClose = false;

    await act(async () => {
      await shellSystem.closeTab(secondTab);
    });

    expect(closePanels[1].beforeCloseCount).toBe(1);
    expect(closePanels[1].switchInAtBeforeClose).toBeGreaterThanOrEqual(1);
    expect(closePanels[1].peerSwitchOutAtBeforeClose).toBeGreaterThanOrEqual(1);
    expect(shellSystem.listTabs().map((tab) => tab.id)).toEqual([firstTab, secondTab]);
    expect(closePanels[1].disposeCount).toBe(0);
  });

  // 后台标签同意关闭后活动标签落到相邻标签，不停在已移除的 id 上
  it('后台标签同意关闭后活动标签落到相邻标签', async () => {
    const { shellSystem, closePanels } = await createSystem();
    const { container } = render(createElement(shellSystem.render()));

    const [firstTab, secondTab] = await openTwoPanels(shellSystem, 'close');

    act(() => {
      shellSystem.activateTab(firstTab);
    });

    await act(async () => {
      await shellSystem.closeTab(secondTab);
    });

    const activeTabs = container.querySelectorAll('.editor-shell-tab.is-active');
    const activeLabel = activeTabs[0].querySelector('.editor-shell-tab-label');

    expect(shellSystem.listTabs().map((tab) => tab.id)).toEqual([firstTab]);
    expect(activeTabs.length).toBe(1);
    expect(activeLabel?.textContent).toBe('instance-1');
    expect(activeLabel?.getAttribute('aria-current')).toBe('true');
    expect(container.querySelector('.editor-shell-content')?.textContent).toBe('instance-1');
    expect(closePanels[1].disposeCount).toBe(1);
  });

  // 钩子抛错：标签保留、实例不释放，并记录 shell.beforeCloseFailed
  it('钩子抛错时保留标签并记录日志', async () => {
    const { shellSystem, closePanels } = await createSystem();

    render(createElement(shellSystem.render()));

    const [firstTab, secondTab] = await openTwoPanels(shellSystem, 'close');

    closePanels[1].beforeCloseError = 'close boom';

    const errorSpy = vi.spyOn(logger, 'error');

    await act(async () => {
      await shellSystem.closeTab(secondTab);
    });

    expect(shellSystem.listTabs().map((tab) => tab.id)).toEqual([firstTab, secondTab]);
    expect(closePanels[1].disposeCount).toBe(0);
    expect(errorSpy).toHaveBeenCalledWith('shell.beforeCloseFailed', 'close');

    errorSpy.mockRestore();
  });

  // 未实现钩子的面板直接关闭，且关闭后台标签时前台不变
  it('未实现钩子的面板直接关闭且前台不变', async () => {
    const { shellSystem, plainPanels } = await createSystem();
    const { container } = render(createElement(shellSystem.render()));

    const [firstTab, secondTab] = await openTwoPanels(shellSystem, 'plain');

    act(() => {
      shellSystem.activateTab(firstTab);
    });

    const switchInBefore = plainPanels[0].switchInCount;
    const switchOutBefore = plainPanels[0].switchOutCount;

    await act(async () => {
      await shellSystem.closeTab(secondTab);
    });

    const activeLabel = container.querySelector('.editor-shell-tab.is-active .editor-shell-tab-label');

    expect('onBeforeClose' in plainPanels[1]).toBe(false);
    expect(shellSystem.listTabs().map((tab) => tab.id)).toEqual([firstTab]);
    expect(plainPanels[1].disposeCount).toBe(1);
    expect(activeLabel?.textContent).toBe('instance-1');
    expect(plainPanels[0].switchInCount).toBe(switchInBefore);
    expect(plainPanels[0].switchOutCount).toBe(switchOutBefore);
  });

  // 注销面板类型全程不询问：带未保存内容的类型标签、实例与类型一起消失
  it('注销面板类型不询问且不留标签', async () => {
    const { shellSystem, closePanels } = await createSystem();

    render(createElement(shellSystem.render()));

    await openTwoPanels(shellSystem, 'close');

    closePanels[1].allowClose = false;

    await act(async () => {
      await shellSystem.unregisterPanelType('close');
    });

    expect(closePanels[0].beforeCloseCount).toBe(0);
    expect(closePanels[1].beforeCloseCount).toBe(0);
    expect(closePanels[0].disposeCount).toBe(1);
    expect(closePanels[1].disposeCount).toBe(1);
    expect(shellSystem.listPanelTypes().some((type) => type.id === 'close')).toBe(false);
    expect(shellSystem.listTabs().length).toBe(1);
    expect(shellSystem.listTabs().every((tab) => tab.typeId === null)).toBe(true);
  });

  // 释放外壳全程不询问：即使面板有未保存内容也直接释放
  it('释放外壳不询问关闭钩子', async () => {
    const { shellSystem, closePanels } = await createSystem();

    await openTwoPanels(shellSystem, 'close');

    closePanels[0].allowClose = false;
    closePanels[1].allowClose = false;

    await shellSystem.dispose();

    expect(closePanels[0].beforeCloseCount).toBe(0);
    expect(closePanels[1].beforeCloseCount).toBe(0);
    expect(closePanels[0].disposeCount).toBe(1);
    expect(closePanels[1].disposeCount).toBe(1);
    expect(shellSystem.listTabs().length).toBe(0);
  });
});
