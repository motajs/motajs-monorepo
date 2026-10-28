import { act, cleanup, render } from '@testing-library/react';
import { createElement, FC, ReactElement, useEffect } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { FakeFileSystem } from '../../__tests__/fixtures';
import { IEditorPanel, IEditorPanelFactoryParam } from '../../panel/types';
import { ResourceSystem } from '../../resource/resourceSystem';
import { UndoSystem } from '../../undo/undoSystem';
import { ShellSystem } from '../shellSystem';

// 切标签保存时序的测试（B1）：外壳必须等旧面板 `IEditorPanel.onSwitchOut` 结算之后，
// 才改活动标签并通知 React，因此保存期间旧组件一直挂载、面板能从组件里取到草稿；
// 同一次活动变化只切出一次，切入仍排在前一个面板切出结算之后。

// 每个用例结束后卸载已挂载的组件，避免 DOM 在用例之间累积
afterEach(() => {
  cleanup();
});

// 手工门闩：切出钩子 await 它，由测试决定何时结算，用来证明保存确实把切换卡住了
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

/** 组件挂载标记：渲染体置真、cleanup 置假，供面板判断「保存时组件还在不在」 */
interface IMountFlag {
  /** 组件当前是否处于挂载状态 */
  value: boolean;
}

/** 记录渲染与卸载的组件 props */
interface IOrderComponentProps {
  /** 面板实例 id */
  readonly id: string;
  /** 与外壳共享的事件顺序记录 */
  readonly events: string[];
  /** 组件挂载标记，与所属面板共享 */
  readonly mountFlag: IMountFlag;
}

/**
 * 把挂载与卸载写进共享事件记录的渲染组件
 * @param props 组件 props
 * @returns 固定显示实例 id 的元素
 */
function OrderComponent(props: IOrderComponentProps): ReactElement {
  props.mountFlag.value = true;
  props.events.push(`${props.id}.render`);

  useEffect((): (() => void) => {
    return (): void => {
      props.mountFlag.value = false;
      props.events.push(`${props.id}.unmount`);
    };
  }, [props.id, props.events, props.mountFlag]);

  return createElement('div', null, props.id);
}

// 记录事件顺序的面板：切出钩子可被门闩卡住，渲染组件自己报告挂载与卸载
class OrderPanel implements IEditorPanel {
  readonly id: string;

  /** 与外壳共享的事件顺序记录 */
  readonly events: string[];
  /** 组件挂载标记，切出钩子据此判断组件是否还在 */
  readonly mountFlag: IMountFlag = { value: false };
  /** 切出钩子卡住用的门闩；为空表示立刻结算 */
  gate: SaveGate | null = null;
  /** 切入次数 */
  switchInCount = 0;
  /** 切出次数 */
  switchOutCount = 0;
  /** 切出钩子开始执行那一刻的组件挂载标记快照 */
  mountedAtSwitchOut = false;

  private readonly component: FC;

  /**
   * 创建一个记录事件顺序的面板
   * @param id 面板实例 id
   * @param events 与外壳共享的事件顺序记录
   */
  constructor(id: string, events: string[]) {
    this.id = id;
    this.events = events;
    this.component = () =>
      createElement(OrderComponent, { id: this.id, events: this.events, mountFlag: this.mountFlag });
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
    this.mountedAtSwitchOut = this.mountFlag.value;
    this.events.push(`${this.id}.onSwitchOut 开始`);

    if (this.gate !== null) await this.gate.promise;

    this.events.push(`${this.id}.onSwitchOut 结束`);
  }

  async onUpdateResource<T>(): Promise<void> {}

  async undo<T>(): Promise<void> {}

  async redo<T>(): Promise<void> {}
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

// 打开两个同类型面板，返回两个标签 id；结束时第二个标签为活动标签
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

describe('ShellSystem 切标签保存时序', () => {
  // 保存结算之前旧组件一直挂载：门闩卡住切出时不得出现该实例的 unmount，也不得投递切入
  it('保存结算之前旧组件仍然挂载', async () => {
    const { shellSystem, panels, events } = await createSystem();

    render(createElement(shellSystem.render()));

    const [firstTab, secondTab] = await openTwoPanels(shellSystem);

    await act(async () => {
      await shellSystem.activateTab(firstTab);
    });

    const gate = new SaveGate();

    panels[0].gate = gate;
    events.length = 0;

    await act(async () => {
      void shellSystem.activateTab(secondTab);
    });

    expect(events).toContain('instance-1.onSwitchOut 开始');
    expect(events).not.toContain('instance-1.unmount');
    expect(events).not.toContain('instance-2.onSwitchIn');

    gate.release();

    await act(async () => {});
  });

  // 保存结算之后才卸载：切出「结束」事件必须排在旧组件的 unmount 之前
  it('保存结算之后才卸载旧组件', async () => {
    const { shellSystem, panels, events } = await createSystem();

    render(createElement(shellSystem.render()));

    const [firstTab, secondTab] = await openTwoPanels(shellSystem);

    await act(async () => {
      await shellSystem.activateTab(firstTab);
    });

    const gate = new SaveGate();

    panels[0].gate = gate;
    events.length = 0;

    await act(async () => {
      void shellSystem.activateTab(secondTab);
    });

    gate.release();

    await act(async () => {});

    const switchOutEndIndex = events.indexOf('instance-1.onSwitchOut 结束');
    const unmountIndex = events.indexOf('instance-1.unmount');

    expect(switchOutEndIndex).toBeGreaterThanOrEqual(0);
    expect(unmountIndex).toBeGreaterThanOrEqual(0);
    expect(switchOutEndIndex).toBeLessThan(unmountIndex);
  });

  // 切入在切出结算之后：前一个面板没写完，下一个面板拿不到切入通知
  it('切入排在旧面板切出结算之后', async () => {
    const { shellSystem, panels, events } = await createSystem();

    render(createElement(shellSystem.render()));

    const [firstTab, secondTab] = await openTwoPanels(shellSystem);

    await act(async () => {
      await shellSystem.activateTab(firstTab);
    });

    const gate = new SaveGate();

    panels[0].gate = gate;
    events.length = 0;

    await act(async () => {
      void shellSystem.activateTab(secondTab);
    });

    gate.release();

    await act(async () => {});

    const switchOutEndIndex = events.indexOf('instance-1.onSwitchOut 结束');
    const switchInIndex = events.indexOf('instance-2.onSwitchIn');

    expect(switchOutEndIndex).toBeGreaterThanOrEqual(0);
    expect(switchInIndex).toBeGreaterThan(switchOutEndIndex);
  });

  // 不重复保存：重复激活当前标签不增加切出次数，切到另一个标签恰好增加一次
  it('重复激活当前标签时不重复保存', async () => {
    const { shellSystem, panels } = await createSystem();

    render(createElement(shellSystem.render()));

    const [firstTab, secondTab] = await openTwoPanels(shellSystem);
    const switchOutBefore = panels[1].switchOutCount;

    await act(async () => {
      await shellSystem.activateTab(secondTab);
    });

    await act(async () => {
      await shellSystem.activateTab(secondTab);
    });

    expect(panels[1].switchOutCount).toBe(switchOutBefore);

    await act(async () => {
      await shellSystem.activateTab(firstTab);
    });

    expect(panels[1].switchOutCount).toBe(switchOutBefore + 1);
  });

  // 新建标签走同一条保存前缀：保存完成前旧组件不卸载，结算之后才卸载
  it('新建标签时同样先保存再卸载旧组件', async () => {
    const { shellSystem, panels, events } = await createSystem();

    render(createElement(shellSystem.render()));

    const [firstTab] = await openTwoPanels(shellSystem);

    await act(async () => {
      await shellSystem.activateTab(firstTab);
    });

    const gate = new SaveGate();

    panels[0].gate = gate;
    events.length = 0;

    await act(async () => {
      shellSystem.openBlankTab();
    });

    expect(events).toContain('instance-1.onSwitchOut 开始');
    expect(events).not.toContain('instance-1.unmount');

    gate.release();

    await act(async () => {});

    expect(events).toContain('instance-1.unmount');
  });

  // 切出钩子开始执行时组件仍然挂载：面板可以在钩子里直接读取组件里的草稿
  it('切出钩子开始执行时组件仍然挂载', async () => {
    const { shellSystem, panels } = await createSystem();

    render(createElement(shellSystem.render()));

    const [firstTab, secondTab] = await openTwoPanels(shellSystem);

    await act(async () => {
      await shellSystem.activateTab(firstTab);
    });

    const gate = new SaveGate();

    panels[0].gate = gate;

    await act(async () => {
      void shellSystem.activateTab(secondTab);
    });

    expect(panels[0].mountedAtSwitchOut).toBe(true);
    expect(panels[0].mountFlag.value).toBe(true);

    gate.release();

    await act(async () => {});

    expect(panels[0].mountFlag.value).toBe(false);
  });
});
