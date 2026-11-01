import { act, cleanup, configure, render, screen } from '@testing-library/react';
import { createElement, FC } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createCoreHarness, FakeFileSystem } from '../../__tests__/fixtures';
import { EditorCore } from '../../core';
import { logger } from '../../log';
import { IEditorPanel, IEditorPanelContext, IEditorPanelFactoryParam, PanelCloseChoice } from '../../panel/types';

// 外壳落盘点的测试：切标签、关标签「保存并关闭」、释放编辑器三条路径都必须把面板刚写进缓冲的内容打到磁盘，
// 「不保存关闭」不许写盘，写盘失败也不许打断标签状态机。顺序铁律是「面板 → 缓冲 → 磁盘」。
// 关闭标签另有一条判据：写盘失败或仍有待写时标签与面板必须留在屏幕上。

configure({ testIdAttribute: 'data-test-id' });

/** 三个落盘点共用的目标路径 */
const TARGET_PATH = 'tables/demo.json';
/** 冲突用例里被关闭面板改写的另一条路径 */
const OTHER_PATH = 'tables/other.json';
/** 磁盘上预置的旧内容 */
const OLD_CONTENT = '{"a":1}';
/** 外部改动到达后磁盘上的内容 */
const EXTERNAL_CONTENT = '{"a":3}';
/** 面板往缓冲里写的新内容 */
const NEW_CONTENT = '{"a":2}';

/** 当前用例装配出的编辑器内核，用例结束后统一释放 */
let active: EditorCore | null = null;

// 每个用例结束后卸载已挂载的组件、释放编辑器并恢复真定时器，避免 DOM、window 监听器与悬挂定时器累积
afterEach(async () => {
  cleanup();

  const core = active;

  active = null;

  if (core !== null) await core.dispose();

  vi.useRealTimers();
});

// 通过真实面板上下文写缓冲的假面板：每个落盘钩子都由测试决定写不写、写什么
class FlushPanel implements IEditorPanel {
  readonly id: string;

  /** 面板侧上下文：接的是真实资源系统，本用例不 mock 资源层 */
  readonly context: IEditorPanelContext;
  /** 写入目标路径；冲突用例会把被关闭面板改到另一条路径，缺省为共用的目标路径 */
  targetPath: string = TARGET_PATH;
  /** 切出钩子要塞进缓冲的内容；为空表示切出不写 */
  switchOutContent: string | null = null;
  /** 关闭询问要塞进缓冲的内容；为空表示询问时不写 */
  requestCloseContent: string | null = null;
  /** 关闭询问的回答，默认取消 */
  choice: PanelCloseChoice = PanelCloseChoice.Cancel;
  /** 丢弃钩子要丢弃的路径；为空表示丢弃钩子什么都不做 */
  discardPath: string | null = null;
  /** 释放钩子要塞进缓冲的内容；为空表示释放时不写 */
  disposeContent: string | null = null;
  /** 切入次数 */
  switchInCount = 0;
  /** 切出次数 */
  switchOutCount = 0;

  /** 渲染组件，内容固定为实例 id */
  private readonly component: FC;

  /**
   * 创建一个经由真实资源系统写缓冲的落盘面板
   * @param id 面板实例 id
   * @param context 面板侧上下文
   */
  constructor(id: string, context: IEditorPanelContext) {
    this.id = id;
    this.context = context;
    this.component = () => createElement('div', null, this.id);
  }

  async initialize(): Promise<void> {}

  async dispose(): Promise<void> {
    if (this.disposeContent === null) return;

    await this.write(this.disposeContent);
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

    if (this.switchOutContent === null) return;

    await this.write(this.switchOutContent);
  }

  async onRequestClose(): Promise<PanelCloseChoice> {
    if (this.requestCloseContent !== null) await this.write(this.requestCloseContent);

    return this.choice;
  }

  onDiscard(): void {
    if (this.discardPath === null) return;

    this.context.discardPendingResource(this.discardPath);
  }

  async onUpdateResource<T>(): Promise<void> {}

  async undo<T>(): Promise<void> {}

  async redo<T>(): Promise<void> {}

  /**
   * 把一份内容写进资源缓冲：走面板上下文的真实资源句柄，落盘仍由外壳触发
   * @param content 要写进缓冲的内容
   */
  async write(content: string): Promise<void> {
    const resource = await this.context.requestResource(this.targetPath);

    if (resource === null) return;

    await resource.write(content);
  }
}

interface TestSystem {
  /** 已初始化的编辑器内核 */
  readonly core: EditorCore;
  /** 播种了旧内容的假文件系统，测试用它读原始磁盘内容 */
  readonly fs: FakeFileSystem;
  /** 按创建顺序收集的面板实例 */
  readonly panels: FlushPanel[];
}

// 组装一套已初始化的编辑器内核，并注册一个收集实例的落盘面板类型
async function createSystem(): Promise<TestSystem> {
  const fs = new FakeFileSystem();

  fs.seed(TARGET_PATH, OLD_CONTENT);

  const core = await createCoreHarness(fs);
  const panels: FlushPanel[] = [];

  active = core;

  core.shellSystem.registerPanelType({
    id: 'flush',
    name: '落盘面板',
    icon: null,
    create: (param: IEditorPanelFactoryParam): IEditorPanel => {
      const panel = new FlushPanel(param.instanceId, param.context);

      panels.push(panel);
      return panel;
    },
  });

  return { core, fs, panels };
}

// 打开两个同类型面板，返回两个标签 id；结束时第二个标签为活动标签
async function openTwoPanels(system: TestSystem): Promise<readonly [string, string]> {
  const firstTab = system.core.shellSystem.listTabs()[0].id;

  await system.core.shellSystem.openPanelInTab(firstTab, 'flush');

  const secondTab = system.core.shellSystem.openBlankTab();

  await system.core.shellSystem.openPanelInTab(secondTab, 'flush');

  return [firstTab, secondTab];
}

describe('ShellSystem 外壳落盘点', () => {
  // 切标签：面板的切出钩子把草稿写进缓冲，外壳随后在切出结算之后把缓冲打到磁盘
  it('切换标签时把面板刚写进缓冲的内容打到磁盘', async () => {
    const system = await createSystem();
    const [firstTab] = await openTwoPanels(system);

    system.panels[1].switchOutContent = NEW_CONTENT;

    await system.core.shellSystem.activateTab(firstTab);

    expect(await system.fs.readFile(TARGET_PATH)).toBe(NEW_CONTENT);
  });

  // 关标签「保存并关闭」：面板把内容写进缓冲，外壳写完盘才真正移除标签
  it('关闭标签选择保存并关闭时先写盘再关闭', async () => {
    const system = await createSystem();
    const [, secondTab] = await openTwoPanels(system);

    system.panels[1].requestCloseContent = NEW_CONTENT;
    system.panels[1].choice = PanelCloseChoice.Save;

    await system.core.shellSystem.closeTab(secondTab);

    expect(await system.fs.readFile(TARGET_PATH)).toBe(NEW_CONTENT);
    expect(
      system.core.shellSystem.listTabs().some((tab) => {
        return tab.id === secondTab;
      }),
    ).toBe(false);
  });

  // 关标签「不保存关闭」：面板丢弃该路径待写，外壳不写盘，推进 5 000 毫秒磁盘仍是旧值
  it('关闭标签选择不保存关闭时丢弃待写且不写盘', async () => {
    vi.useFakeTimers();

    const system = await createSystem();
    const [, secondTab] = await openTwoPanels(system);

    await system.panels[1].write(NEW_CONTENT);

    expect(system.core.resourceSystem.listPendingPaths()).toEqual([TARGET_PATH]);

    system.panels[1].discardPath = TARGET_PATH;
    system.panels[1].choice = PanelCloseChoice.Discard;

    await system.core.shellSystem.closeTab(secondTab);
    await vi.advanceTimersByTimeAsync(5000);

    expect(system.core.resourceSystem.listPendingPaths()).toEqual([]);
    expect(await system.fs.readFile(TARGET_PATH)).toBe(OLD_CONTENT);
    expect(
      system.core.shellSystem.listTabs().some((tab) => {
        return tab.id === secondTab;
      }),
    ).toBe(false);
  });

  // 写盘失败：只记 resource.flushFailed 日志，切标签照常完成、待写保留可重试
  it('写盘失败时不打断切换且待写保留', async () => {
    const system = await createSystem();
    const [firstTab] = await openTwoPanels(system);

    system.panels[1].switchOutContent = NEW_CONTENT;
    system.fs.failing.add(TARGET_PATH);

    const errorSpy = vi.spyOn(logger, 'error');

    await system.core.shellSystem.activateTab(firstTab);

    expect(system.panels[1].switchOutCount).toBe(1);
    expect(system.panels[0].switchInCount).toBe(2);
    expect(system.core.resourceSystem.listPendingPaths()).toEqual([TARGET_PATH]);
    expect(errorSpy).toHaveBeenCalledWith('resource.flushFailed', expect.stringContaining('write failed'));

    errorSpy.mockRestore();
  });

  // 释放编辑器：面板在释放钩子里写进缓冲的内容，由资源系统释放时写进磁盘
  it('释放编辑器时把面板最后一次写入打到磁盘', async () => {
    const system = await createSystem();

    await openTwoPanels(system);

    system.panels[1].disposeContent = NEW_CONTENT;

    await system.core.dispose();

    expect(await system.fs.readFile(TARGET_PATH)).toBe(NEW_CONTENT);
  });

  // 「保存并关闭」写盘失败：标签不被丢弃、待写保留、磁盘仍是旧值；清掉故障后重试才真正关闭
  it('保存并关闭写盘失败时标签保持打开、重试成功后才关闭', async () => {
    const system = await createSystem();
    const [, secondTab] = await openTwoPanels(system);

    system.panels[1].requestCloseContent = NEW_CONTENT;
    system.panels[1].choice = PanelCloseChoice.Save;
    system.fs.failing.add(TARGET_PATH);

    await system.core.shellSystem.closeTab(secondTab);

    expect(
      system.core.shellSystem.listTabs().some((tab) => {
        return tab.id === secondTab;
      }),
    ).toBe(true);
    expect(system.core.resourceSystem.listPendingPaths()).toEqual([TARGET_PATH]);

    // FakeFileSystem 的 failing 同时作用于读：先清掉故障才能读回磁盘，确认失败那次没有改动磁盘
    system.fs.failing.delete(TARGET_PATH);

    expect(await system.fs.readFile(TARGET_PATH)).toBe(OLD_CONTENT);

    await system.core.shellSystem.closeTab(secondTab);

    expect(
      system.core.shellSystem.listTabs().some((tab) => {
        return tab.id === secondTab;
      }),
    ).toBe(false);
    expect(await system.fs.readFile(TARGET_PATH)).toBe(NEW_CONTENT);
  });

  // 冲突未表态的条目被全量写盘跳过、缓冲仍非空：标签不被丢弃，同一轮里别的路径照常写出
  it('冲突被跳过时仍有待写、标签不被丢弃', async () => {
    const system = await createSystem();
    const [, secondTab] = await openTwoPanels(system);

    await system.core.resourceSystem.writeContent(TARGET_PATH, NEW_CONTENT);
    system.fs.seed(TARGET_PATH, EXTERNAL_CONTENT);
    await system.core.resourceSystem.updateResource(TARGET_PATH);

    system.panels[1].targetPath = OTHER_PATH;
    system.panels[1].requestCloseContent = NEW_CONTENT;
    system.panels[1].choice = PanelCloseChoice.Save;

    await system.core.shellSystem.closeTab(secondTab);

    expect(
      system.core.shellSystem.listTabs().some((tab) => {
        return tab.id === secondTab;
      }),
    ).toBe(true);
    expect(system.core.resourceSystem.listPendingPaths()).toEqual([TARGET_PATH]);
    expect(await system.fs.readFile(TARGET_PATH)).toBe(EXTERNAL_CONTENT);
    expect(await system.fs.readFile(OTHER_PATH)).toBe(NEW_CONTENT);
  });

  // 自身没有待写的标签，在别处有未决写入时也保持打开；可见状态就是右上角既有的待写提示
  it('干净标签在别处有未决写入时保持打开且既有提示可见', async () => {
    const system = await createSystem();
    const [, secondTab] = await openTwoPanels(system);

    await system.core.resourceSystem.writeContent(TARGET_PATH, NEW_CONTENT);
    system.fs.seed(TARGET_PATH, EXTERNAL_CONTENT);
    await system.core.resourceSystem.updateResource(TARGET_PATH);

    system.panels[1].requestCloseContent = null;
    system.panels[1].choice = PanelCloseChoice.Save;

    render(createElement(system.core.shellSystem.render()));

    await act(async () => {
      await system.core.shellSystem.closeTab(secondTab);
    });

    expect(
      system.core.shellSystem.listTabs().some((tab) => {
        return tab.id === secondTab;
      }),
    ).toBe(true);
    expect(screen.getByTestId('editor-shell-pending').textContent).toContain('正在等待保存');
  });
});
