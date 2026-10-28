import { act, cleanup, render } from '@testing-library/react';
import { createElement, FC } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FakeFileSystem } from '../../__tests__/fixtures';
import { logger } from '../../log';
import { IEditorPanel, IEditorPanelFactoryParam } from '../../panel/types';
import { ResourceSystem } from '../../resource/resourceSystem';
import { UndoSystem } from '../../undo/undoSystem';
import { ShellSystem } from '../shellSystem';

// 自动保存时序的测试：钉死「外壳先等前一个面板的落盘结算，再切入下一个面板 / 再释放旧面板」这条顺序，
// 覆盖切换标签、关闭活动标签、标签内替换面板三种路径，以及落盘抛错时的失败隔离。

// 每个用例结束后卸载已挂载的组件，避免 DOM 在用例之间累积
afterEach(() => {
  cleanup();
});

// 手工门闩：落盘钩子 await 它，由测试决定何时结算，用来证明确实「停在了落盘上」
class SaveGate {
  /** 门闩对应的 promise，落盘钩子 await 它 */
  readonly promise: Promise<void>;
  /** 结算门闩的内部函数，构造时被真正的 resolve 覆盖 */
  private resolve: () => void = () => {};

  constructor() {
    this.promise = new Promise<void>((resolve) => {
      this.resolve = resolve;
    });
  }

  /** 结算此门闩，让等待中的落盘钩子继续执行 */
  release(): void {
    this.resolve();
  }
}

// 会记录事件顺序的面板：落盘钩子可被门闩卡住，用来断言外壳在落盘结算之后才继续下一步
class AutosavePanel implements IEditorPanel {
  readonly id: string;

  /** 与外壳共享的事件顺序记录 */
  readonly events: string[];
  /** 落盘钩子卡住用的门闩；为空表示立刻结算 */
  gate: SaveGate | null = null;
  /** 设置后落盘钩子抛出该文本的错误，用于验证失败隔离 */
  switchOutError?: string;
  /** 落盘钩子的调用次数 */
  switchOutCount = 0;

  /** 渲染组件，内容固定为实例 id */
  private readonly component: FC;

  /**
   * 创建一个记录事件顺序的面板
   * @param id 面板实例 id
   * @param events 与外壳共享的事件顺序记录
   */
  constructor(id: string, events: string[]) {
    this.id = id;
    this.events = events;
    this.component = () => createElement('div', null, this.id);
  }

  async initialize(): Promise<void> {
    this.events.push(`${this.id}.initialize`);
  }

  async dispose(): Promise<void> {
    this.events.push(`${this.id}.dispose`);
  }

  render(): FC {
    return this.component;
  }

  async onFocus(): Promise<void> {}

  async onBlur(): Promise<void> {}

  async onSwitchIn(): Promise<void> {
    this.events.push(`${this.id}.onSwitchIn`);
  }

  async onSwitchOut(): Promise<void> {
    this.switchOutCount += 1;
    this.events.push(`${this.id}.onSwitchOut 开始`);

    if (this.switchOutError !== undefined) throw new Error(this.switchOutError);

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
  readonly panels: AutosavePanel[];
  /** 跨面板共享的事件顺序记录 */
  readonly events: string[];
}

// 组装一套已初始化的外壳系统，并注册一个统一收集实例与事件顺序的面板类型
async function createSystem(): Promise<TestSystem> {
  const resourceSystem = new ResourceSystem();

  await resourceSystem.initialize(new FakeFileSystem());

  const undoSystem = new UndoSystem();

  await undoSystem.initialize({ maxUndoStep: 100 });

  const shellSystem = new ShellSystem(undoSystem, resourceSystem);

  await shellSystem.initialize();

  const panels: AutosavePanel[] = [];
  const events: string[] = [];

  shellSystem.registerPanelType({
    id: 'save',
    name: '自动保存面板',
    icon: null,
    create: (param: IEditorPanelFactoryParam): IEditorPanel => {
      const panel = new AutosavePanel(param.instanceId, events);

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
    await shellSystem.openPanelInTab(firstTab, 'save');
  });

  const secondTab = shellSystem.openBlankTab();

  await act(async () => {
    await shellSystem.openPanelInTab(secondTab, 'save');
  });

  return [firstTab, secondTab];
}

describe('ShellSystem 自动保存时序', () => {
  // 切换标签：离开面板的落盘结算之前，新面板不会收到 onSwitchIn
  it('切换标签时先结算前一个面板的落盘再切入下一个面板', async () => {
    const { shellSystem, panels, events } = await createSystem();

    render(createElement(shellSystem.render()));

    const [firstTab] = await openTwoPanels(shellSystem);
    const gate = new SaveGate();

    panels[1].gate = gate;
    events.length = 0;

    await act(async () => {
      shellSystem.activateTab(firstTab);
    });

    // 外壳停在落盘上：只有「切出开始」，切入还没有投递
    expect(events).toEqual(['instance-2.onSwitchOut 开始']);

    gate.release();

    await act(async () => {});

    expect(events).toEqual(['instance-2.onSwitchOut 开始', 'instance-2.onSwitchOut 结束', 'instance-1.onSwitchIn']);
  });

  // 关闭活动标签：落盘结算之前面板不会被释放，结算之后才释放并切入相邻面板
  it('关闭活动标签时先结算落盘再释放面板', async () => {
    const { shellSystem, panels, events } = await createSystem();

    render(createElement(shellSystem.render()));

    const [, secondTab] = await openTwoPanels(shellSystem);
    const gate = new SaveGate();

    panels[1].gate = gate;
    events.length = 0;

    let closing: Promise<void> = Promise.resolve();

    await act(async () => {
      closing = shellSystem.closeTab(secondTab);
      await Promise.resolve();
    });

    // 标签还在、面板还没释放：外壳停在落盘上
    expect(events).toEqual(['instance-2.onSwitchOut 开始']);
    expect(shellSystem.listTabs().some((tab) => tab.id === secondTab)).toBe(true);

    gate.release();

    await act(async () => {
      await closing;
    });

    expect(events).toEqual([
      'instance-2.onSwitchOut 开始',
      'instance-2.onSwitchOut 结束',
      'instance-2.dispose',
      'instance-1.onSwitchIn',
    ]);
    expect(shellSystem.listTabs().some((tab) => tab.id === secondTab)).toBe(false);
  });

  // 标签内替换面板：旧面板的落盘结算之前不会创建新面板，新面板的 initialize 与切入都排在其后
  it('替换标签内的面板时先结算旧面板落盘再创建新面板', async () => {
    const { shellSystem, panels, events } = await createSystem();

    render(createElement(shellSystem.render()));

    const firstTab = shellSystem.listTabs()[0].id;

    await act(async () => {
      await shellSystem.openPanelInTab(firstTab, 'save');
    });

    const gate = new SaveGate();

    panels[0].gate = gate;
    events.length = 0;

    let replacing: Promise<boolean> = Promise.resolve(false);

    await act(async () => {
      replacing = shellSystem.openPanelInTab(firstTab, 'save');
      await Promise.resolve();
    });

    // 旧面板还在落盘：新面板尚未被工厂创建
    expect(events).toEqual(['instance-1.onSwitchOut 开始']);
    expect(panels.length).toBe(1);

    gate.release();

    await act(async () => {
      await replacing;
    });

    expect(events).toEqual([
      'instance-1.onSwitchOut 开始',
      'instance-1.onSwitchOut 结束',
      'instance-1.dispose',
      'instance-2.initialize',
      'instance-2.onSwitchIn',
    ]);
  });

  // 落盘钩子抛错：只记日志、切换照常完成，且串行链没有被 reject 污染
  it('落盘钩子抛错时切换仍完成且串行链不被污染', async () => {
    const { shellSystem, panels } = await createSystem();

    render(createElement(shellSystem.render()));

    const [firstTab, secondTab] = await openTwoPanels(shellSystem);

    panels[1].switchOutError = 'save boom';

    const errorSpy = vi.spyOn(logger, 'error');

    await act(async () => {
      await shellSystem.activateTab(firstTab);
    });
    await act(async () => {});

    // 抛错没有卡住切换：新面板照常切入，外壳只记录回调失败
    expect(panels[1].switchOutCount).toBe(1);
    expect(panels[1].events).toContain('instance-1.onSwitchIn');
    expect(errorSpy).toHaveBeenCalledWith('shell.callbackFailed', 'save');

    // 链若被 reject 污染，后续的切入会被跳过；这里再切回去证明链仍然可用
    await act(async () => {
      await shellSystem.activateTab(secondTab);
    });
    await act(async () => {});

    expect(panels[1].events.filter((event) => event === 'instance-2.onSwitchIn').length).toBe(2);

    errorSpy.mockRestore();
  });
});
