import { act, cleanup, render } from '@testing-library/react';
import { createElement, FC, ReactElement, useEffect } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { FakeFileSystem } from '../../__tests__/fixtures';
import { IEditorPanel, IEditorPanelFactoryParam } from '../../panel/types';
import { ResourceSystem } from '../../resource/resourceSystem';
import { UndoSystem } from '../../undo/undoSystem';
import { ShellSystem } from '../shellSystem';

// 切出投递顺序的测试：外壳必须在通知 React 重渲染之前就把切出排进串行链，
// 这样面板 `IEditorPanel.onSwitchOut` 的同步前缀一定跑在组件卸载之前；且一次活动变化只切出一次。

// 每个用例结束后卸载已挂载的组件，避免 DOM 在用例之间累积
afterEach(() => {
  cleanup();
});

// 手工门闩：切出钩子 await 它，由测试决定何时结算，用来证明切入确实排在切出结算之后
class SaveGate {
  /** 门闩对应的 promise，切出钩子 await 它 */
  readonly promise: Promise<void>;
  /** 结算门闩的内部函数，构造时被真正的 resolve 覆盖 */
  private resolve: () => void = () => {};

  constructor() {
    this.promise = new Promise<void>((resolve) => {
      this.resolve = resolve;
    });
  }

  /** 结算此门闩，让等待中的切出钩子继续执行 */
  release(): void {
    this.resolve();
  }
}

/** 记录渲染与卸载的组件 props */
interface IOrderComponentProps {
  /** 面板实例 id */
  readonly id: string;
  /** 与外壳共享的事件顺序记录 */
  readonly events: string[];
}

/**
 * 把挂载与卸载写进共享事件记录的渲染组件
 * @param props 组件 props
 * @returns 固定显示实例 id 的元素
 */
function OrderComponent(props: IOrderComponentProps): ReactElement {
  useEffect((): (() => void) => {
    return (): void => {
      props.events.push(`${props.id}.unmount`);
    };
  }, [props.id, props.events]);

  props.events.push(`${props.id}.render`);

  return createElement('div', null, props.id);
}

// 记录事件顺序的面板：切换钩子可被门闩卡住，渲染组件自己报告挂载与卸载
class OrderPanel implements IEditorPanel {
  readonly id: string;

  /** 与外壳共享的事件顺序记录 */
  readonly events: string[];
  /** 切出钩子卡住用的门闩；为空表示立刻结算 */
  gate: SaveGate | null = null;
  /** 切入次数 */
  switchInCount = 0;
  /** 切出次数 */
  switchOutCount = 0;

  private readonly component: FC;

  /**
   * 创建一个记录事件顺序的面板
   * @param id 面板实例 id
   * @param events 与外壳共享的事件顺序记录
   */
  constructor(id: string, events: string[]) {
    this.id = id;
    this.events = events;
    this.component = () => createElement(OrderComponent, { id: this.id, events: this.events });
  }

  getTitle(): string {
    return this.id;
  }

  async initialize(): Promise<void> {}

  async dispose(): Promise<void> {
    this.events.push(`${this.id}.dispose`);
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
    this.events.push(`${this.id}.onSwitchOut 开始`);

    if (this.gate !== null) await this.gate.promise;

    this.events.push(`${this.id}.onSwitchOut 结束`);
  }

  async onUpdateResource(): Promise<void> {}

  async undo(): Promise<void> {}

  async redo(): Promise<void> {}
}

interface TestSystem {
  /** 外壳系统 */
  readonly shellSystem: ShellSystem;
  /** 按创建顺序收集的面板实例 */
  readonly panels: OrderPanel[];
  /** 跨面板共享的事件顺序记录 */
  readonly events: string[];
}

// 组装一套已初始化的外壳系统，并注册一个收集实例与事件顺序的面板类型
async function createSystem(): Promise<TestSystem> {
  const resourceSystem = new ResourceSystem();

  await resourceSystem.initialize(new FakeFileSystem());

  const undoSystem = new UndoSystem();

  await undoSystem.initialize({ maxUndoStep: 100 });

  const shellSystem = new ShellSystem(undoSystem, resourceSystem);

  await shellSystem.initialize();

  const panels: OrderPanel[] = [];
  const events: string[] = [];

  shellSystem.registerPanelType({
    id: 'order',
    name: '顺序面板',
    icon: null,
    create: (param: IEditorPanelFactoryParam): IEditorPanel => {
      const panel = new OrderPanel(param.instanceId, events);

      panels.push(panel);
      return panel;
    },
  });

  return { shellSystem, panels, events };
}

// 打开两个同类型面板，返回两个标签 id
async function openTwoPanels(shellSystem: ShellSystem): Promise<readonly [string, string]> {
  const firstTab = shellSystem.listTabs()[0].id;

  await act(async () => {
    await shellSystem.openPanelInTab(firstTab, 'order');
  });

  let secondTab = '';

  await act(async () => {
    secondTab = shellSystem.openBlankTab();
  });

  await act(async () => {
    await shellSystem.openPanelInTab(secondTab, 'order');
  });

  return [firstTab, secondTab];
}

describe('ShellSystem 切出投递顺序', () => {
  // 切标签时切出排在组件卸载之前：面板在被卸载前仍能完成同步快照
  it('切出排在组件卸载之前', async () => {
    const { shellSystem, events } = await createSystem();

    render(createElement(shellSystem.render()));

    const firstTab = shellSystem.listTabs()[0].id;

    await act(async () => {
      await shellSystem.openPanelInTab(firstTab, 'order');
    });

    events.length = 0;

    await act(async () => {
      shellSystem.openBlankTab();
    });

    const switchOutIndex = events.indexOf('instance-1.onSwitchOut 开始');
    const unmountIndex = events.indexOf('instance-1.unmount');

    expect(switchOutIndex).toBeGreaterThanOrEqual(0);
    expect(unmountIndex).toBeGreaterThanOrEqual(0);
    expect(switchOutIndex).toBeLessThan(unmountIndex);
  });

  // 一次活动变化恰好投递一次切出：重复激活同一标签不重复投递
  it('每次切换只投递一次切出', async () => {
    const { shellSystem, panels } = await createSystem();

    render(createElement(shellSystem.render()));

    const [firstTab, secondTab] = await openTwoPanels(shellSystem);

    expect(panels[0].switchOutCount).toBe(1);

    await act(async () => {
      shellSystem.activateTab(firstTab);
    });

    // 重复激活已是活动的标签：不得再投递一次切出
    await act(async () => {
      shellSystem.activateTab(firstTab);
    });

    expect(panels[0].switchOutCount).toBe(1);

    await act(async () => {
      shellSystem.activateTab(secondTab);
    });

    expect(panels[0].switchOutCount).toBe(2);
  });

  // 切入排在切出结算之后：前一个面板没写完，下一个面板拿不到切入通知
  it('切入排在前一个面板切出结算之后', async () => {
    const { shellSystem, panels, events } = await createSystem();

    render(createElement(shellSystem.render()));

    const [firstTab] = await openTwoPanels(shellSystem);
    const gate = new SaveGate();

    panels[1].gate = gate;
    events.length = 0;

    await act(async () => {
      shellSystem.activateTab(firstTab);
    });

    // 外壳停在切出上：只有「切出开始」，切入还没有投递
    expect(events).toContain('instance-2.onSwitchOut 开始');
    expect(events).not.toContain('instance-1.onSwitchIn');

    gate.release();

    await act(async () => {});

    expect(events.indexOf('instance-2.onSwitchOut 结束')).toBeGreaterThanOrEqual(0);
    expect(events.indexOf('instance-2.onSwitchOut 结束')).toBeLessThan(events.indexOf('instance-1.onSwitchIn'));
  });
});
