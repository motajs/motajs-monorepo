import { act, cleanup, render } from '@testing-library/react';
import { createElement, FC } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FakeFileSystem } from '../../__tests__/fixtures';
import { logger } from '../../log';
import { IEditorPanel, IEditorPanelFactoryParam, PanelCloseChoice } from '../../panel/types';
import { ResourceSystem } from '../../resource/resourceSystem';
import { UndoSystem } from '../../undo/undoSystem';
import { ShellSystem } from '../shellSystem';

// 关闭三态的测试：用户点 ✕ 时面板可以回答「保存并关闭 / 不保存关闭 / 取消」，
// 前两者都跳过普通切走落盘、后者保持标签；注销面板类型与释放外壳两条内部路径全程不询问、不丢弃。

// 每个用例结束后卸载已挂载的组件，避免 DOM 在用例之间累积
afterEach(() => {
  cleanup();
});

// 实现关闭三态的面板：记录询问 / 丢弃 / 释放 / 切换次数，切换与释放的先后写进共享事件数组，
// 并用「脏标记 + 写盘替身」模拟 dispose 的兜底保存，从而证明「不保存关闭」真的没有写盘
class ChoicePanel implements IEditorPanel {
  readonly id: string;

  /** 与外壳共享的事件顺序记录 */
  readonly events: string[];
  /** 与外壳共享的写盘替身记录：面板自己保存与 dispose 兜底保存都写在这里 */
  readonly writes: string[];
  /** 面板对关闭询问的回答，默认取消 */
  choice: PanelCloseChoice = PanelCloseChoice.Cancel;
  /** 设置后询问钩子抛出该文本的错误，用于验证失败隔离 */
  requestCloseError?: string;
  /** 尚有未保存改动；保存成功与丢弃都会清掉它，dispose 只在它成立时才写盘 */
  dirty = true;
  /** 关闭询问次数，用于证明内部释放路径没有询问 */
  requestCloseCount = 0;
  /** 丢弃次数，用于证明只有「不保存关闭」会投递丢弃 */
  discardCount = 0;
  /** 释放次数 */
  disposeCount = 0;
  /** 切入次数 */
  switchInCount = 0;
  /** 切出次数 */
  switchOutCount = 0;
  /** 询问发生时本面板已收到的切入次数快照，用于验证后台标签先被激活 */
  switchInAtRequestClose = 0;

  private readonly component: FC;

  constructor(id: string, events: string[], writes: string[]) {
    this.id = id;
    this.events = events;
    this.writes = writes;
    this.component = () => createElement('div', null, this.id);
  }

  getTitle(): string {
    return this.id;
  }

  async onRequestClose(): Promise<PanelCloseChoice> {
    this.requestCloseCount += 1;
    this.switchInAtRequestClose = this.switchInCount;
    this.events.push(`${this.id}.onRequestClose`);

    if (this.requestCloseError !== undefined) throw new Error(this.requestCloseError);

    if (this.choice === PanelCloseChoice.Save) {
      this.writes.push(this.id);
      this.dirty = false;
    }

    return this.choice;
  }

  onDiscard(): void {
    this.discardCount += 1;
    this.events.push(`${this.id}.onDiscard`);
    this.dirty = false;
  }

  async initialize(): Promise<void> {}

  async dispose(): Promise<void> {
    this.disposeCount += 1;
    this.events.push(`${this.id}.dispose`);

    // dispose 的兜底保存：内存里还有脏改动时才真的写盘
    if (this.dirty) this.writes.push(this.id);
  }

  render(): FC {
    return this.component;
  }

  async onFocus(): Promise<void> {}

  async onBlur(): Promise<void> {}

  async onSwitchIn(): Promise<void> {
    this.switchInCount += 1;
    this.events.push(`${this.id}.onSwitchIn`);
  }

  async onSwitchOut(): Promise<void> {
    this.switchOutCount += 1;
    this.events.push(`${this.id}.onSwitchOut`);
  }

  async onUpdateResource(): Promise<void> {}

  async undo(): Promise<void> {}

  async redo(): Promise<void> {}
}

interface TestSystem {
  /** 外壳系统 */
  readonly shellSystem: ShellSystem;
  /** 按创建顺序收集的面板实例 */
  readonly panels: ChoicePanel[];
  /** 跨面板共享的事件顺序记录 */
  readonly events: string[];
  /** 跨面板共享的写盘替身记录 */
  readonly writes: string[];
}

// 组装一套已初始化的外壳系统，并注册一个收集实例、事件与写盘记录的面板类型
async function createSystem(): Promise<TestSystem> {
  const resourceSystem = new ResourceSystem();

  await resourceSystem.initialize(new FakeFileSystem());

  const undoSystem = new UndoSystem();

  await undoSystem.initialize({ maxUndoStep: 100 });

  const shellSystem = new ShellSystem(undoSystem, resourceSystem);

  await shellSystem.initialize();

  const panels: ChoicePanel[] = [];
  const events: string[] = [];
  const writes: string[] = [];

  shellSystem.registerPanelType({
    id: 'choice',
    name: '关闭三态面板',
    icon: null,
    create: (param: IEditorPanelFactoryParam): IEditorPanel => {
      const panel = new ChoicePanel(param.instanceId, events, writes);

      panels.push(panel);
      return panel;
    },
  });

  return { shellSystem, panels, events, writes };
}

// 打开两个同类型面板，返回两个标签 id
async function openTwoPanels(shellSystem: ShellSystem): Promise<readonly [string, string]> {
  const firstTab = shellSystem.listTabs()[0].id;

  await act(async () => {
    await shellSystem.openPanelInTab(firstTab, 'choice');
  });

  const secondTab = shellSystem.openBlankTab();

  await act(async () => {
    await shellSystem.openPanelInTab(secondTab, 'choice');
  });

  return [firstTab, secondTab];
}

describe('ShellSystem 关闭三态', () => {
  // 保存并关闭：面板自己写完，外壳跳过普通切走落盘，标签消失且邻居拿到切入
  it('选择保存并关闭时跳过切走落盘并移除标签', async () => {
    const { shellSystem, panels, writes } = await createSystem();

    render(createElement(shellSystem.render()));

    const [firstTab, secondTab] = await openTwoPanels(shellSystem);

    panels[1].choice = PanelCloseChoice.Save;

    await act(async () => {
      await shellSystem.closeTab(secondTab);
    });

    expect(shellSystem.listTabs().map((tab) => tab.id)).toEqual([firstTab]);
    expect(panels[1].requestCloseCount).toBe(1);
    expect(panels[1].switchOutCount).toBe(0);
    expect(panels[1].disposeCount).toBe(1);
    // 只有面板自己那一次写盘，dispose 的兜底保存因为脏标记已清而没有再写一次
    expect(writes).toEqual(['instance-2']);
    expect(panels[0].switchInCount).toBe(2);
  });

  // 不保存关闭：先丢弃再释放，普通切走与 dispose 的兜底保存都不写盘
  it('选择不保存关闭时先丢弃再释放且不写盘', async () => {
    const { shellSystem, panels, events, writes } = await createSystem();

    render(createElement(shellSystem.render()));

    const [firstTab, secondTab] = await openTwoPanels(shellSystem);

    panels[1].choice = PanelCloseChoice.Discard;

    await act(async () => {
      await shellSystem.closeTab(secondTab);
    });

    expect(shellSystem.listTabs().map((tab) => tab.id)).toEqual([firstTab]);
    expect(panels[1].discardCount).toBe(1);
    expect(panels[1].switchOutCount).toBe(0);
    expect(panels[1].disposeCount).toBe(1);
    expect(writes).toEqual([]);
    // 丢弃必须发生在释放之前：面板先清脏，dispose 才有机会什么都不写
    expect(events.indexOf('instance-2.onDiscard')).toBeGreaterThanOrEqual(0);
    expect(events.indexOf('instance-2.onDiscard')).toBeLessThan(events.indexOf('instance-2.dispose'));
    // 跳过落盘不等于跳过切邻：剩下的面板照常拿到切入通知
    expect(panels[0].switchInCount).toBe(2);
  });

  // 取消关闭：标签与实例都保留，且完全没有释放
  it('选择取消关闭时保留标签与实例', async () => {
    const { shellSystem, panels, writes } = await createSystem();

    render(createElement(shellSystem.render()));

    const [firstTab, secondTab] = await openTwoPanels(shellSystem);

    await act(async () => {
      await shellSystem.closeTab(secondTab);
    });

    expect(shellSystem.listTabs().map((tab) => tab.id)).toEqual([firstTab, secondTab]);
    expect(panels[1].requestCloseCount).toBe(1);
    expect(panels[1].discardCount).toBe(0);
    expect(panels[1].disposeCount).toBe(0);
    expect(writes).toEqual([]);
  });

  // 询问钩子抛错：按取消关闭处理，标签保留并记录 shell.beforeCloseFailed
  it('询问钩子抛错时按取消处理并记录日志', async () => {
    const { shellSystem, panels, writes } = await createSystem();

    render(createElement(shellSystem.render()));

    const [firstTab, secondTab] = await openTwoPanels(shellSystem);

    panels[1].requestCloseError = 'choice boom';

    const errorSpy = vi.spyOn(logger, 'error');

    await act(async () => {
      await shellSystem.closeTab(secondTab);
    });

    expect(shellSystem.listTabs().map((tab) => tab.id)).toEqual([firstTab, secondTab]);
    expect(panels[1].disposeCount).toBe(0);
    expect(panels[1].discardCount).toBe(0);
    expect(writes).toEqual([]);
    expect(errorSpy).toHaveBeenCalledWith('shell.beforeCloseFailed', 'choice');

    errorSpy.mockRestore();
  });

  // 注销面板类型：内部路径永不询问、永不丢弃，脏改动仍靠 dispose 的兜底保存写回
  it('注销面板类型时不询问也不丢弃', async () => {
    const { shellSystem, panels, writes } = await createSystem();

    render(createElement(shellSystem.render()));

    await openTwoPanels(shellSystem);

    panels[0].choice = PanelCloseChoice.Discard;
    panels[1].choice = PanelCloseChoice.Discard;

    await act(async () => {
      await shellSystem.unregisterPanelType('choice');
    });

    expect(panels[0].requestCloseCount).toBe(0);
    expect(panels[1].requestCloseCount).toBe(0);
    expect(panels[0].discardCount).toBe(0);
    expect(panels[1].discardCount).toBe(0);
    expect(panels[0].disposeCount).toBe(1);
    expect(panels[1].disposeCount).toBe(1);
    expect(writes.length).toBe(2);
  });

  // 释放外壳：同样不询问、不丢弃
  it('释放外壳时不询问也不丢弃', async () => {
    const { shellSystem, panels } = await createSystem();

    await openTwoPanels(shellSystem);

    panels[0].choice = PanelCloseChoice.Discard;
    panels[1].choice = PanelCloseChoice.Discard;

    await shellSystem.dispose();

    expect(panels[0].requestCloseCount).toBe(0);
    expect(panels[1].requestCloseCount).toBe(0);
    expect(panels[0].discardCount).toBe(0);
    expect(panels[1].discardCount).toBe(0);
    expect(panels[0].disposeCount).toBe(1);
    expect(panels[1].disposeCount).toBe(1);
  });

  // 关闭后台标签：同样先切成活动标签再询问三态，丢弃生效、标签消失且邻居保持切入
  it('关闭后台标签时同样询问三态且邻居保持切入', async () => {
    const { shellSystem, panels, writes } = await createSystem();

    render(createElement(shellSystem.render()));

    const [firstTab, secondTab] = await openTwoPanels(shellSystem);

    await act(async () => {
      await shellSystem.activateTab(firstTab);
    });

    panels[1].choice = PanelCloseChoice.Discard;

    await act(async () => {
      await shellSystem.closeTab(secondTab);
    });

    expect(shellSystem.listTabs().map((tab) => tab.id)).toEqual([firstTab]);
    expect(panels[1].requestCloseCount).toBe(1);
    expect(panels[1].switchInAtRequestClose).toBeGreaterThanOrEqual(1);
    expect(panels[1].discardCount).toBe(1);
    expect(panels[1].disposeCount).toBe(1);
    expect(writes).toEqual([]);
    expect(panels[0].switchInCount).toBeGreaterThanOrEqual(1);
  });
});
