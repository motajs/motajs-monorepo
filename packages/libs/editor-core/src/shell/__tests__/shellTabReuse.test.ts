import { act, cleanup } from '@testing-library/react';
import { createElement, FC } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createCoreHarness, FakeFileSystem } from '../../__tests__/fixtures';
import { EditorCore } from '../../core';
import { IEditorPanel, IEditorPanelFactoryParam, IEditorPanelType } from '../../panel/types';

// 按类型复用标签的测试：声明 `IEditorPanelType.reuseTab` 的面板再次打开时沿用打开顺序最早的同类标签，
// 复用前先走完整的切出保存（恰好一次），冲突未表态时不写盘 / 不释放 / 不新建，保存没结算时保留原实例；
// 未声明复用的类型仍是每次新开。另钉住暂存空白标签：没人领走时仍会在微任务后正常激活。

/** 复用面板第一次打开的文件路径 */
const HERO_PATH = 'tables/hero.jsonc';
/** 复用面板第二次打开的文件路径 */
const ENEMY_PATH = 'tables/enemy.jsonc';

/** 一个可计数面板类型的装配结果 */
interface IProbeType {
  /** 注册进外壳的面板类型 */
  readonly type: IEditorPanelType;
  /** 工厂每次成功创建时收到的入参，长度即创建过的实例数 */
  readonly created: IEditorPanelFactoryParam[];
  /** 工厂按创建顺序收集的探针实例 */
  readonly panels: ProbePanel[];
}

/** 造探针面板类型时需要的选项 */
interface IProbeTypeOptions {
  /** 面板类型标识 */
  readonly id: string;
  /** 与所有探针共享的事件顺序记录 */
  readonly events: string[];
  /** 是否声明复用；不传表示不声明 */
  readonly reuse?: boolean;
}

/** 造探针面板实例时需要的选项 */
interface IProbePanelOptions {
  /** 面板实例标识，取自工厂入参 */
  readonly id: string;
  /** 与所有探针共享的事件顺序记录 */
  readonly events: string[];
  /** 工厂收到的打开参数，供断言创建顺序 */
  readonly openParam?: Record<string, unknown>;
}

// 每个用例结束后卸载已挂载的组件并还原替身，避免 DOM 与调用记录在用例之间累积
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

// 记录事件顺序、可开关冲突 / 未保存查询的探针面板
class ProbePanel implements IEditorPanel {
  readonly id: string;

  /** 与外壳共享的事件顺序记录 */
  readonly events: string[];

  /** 工厂收到的打开参数 */
  readonly openParam?: Record<string, unknown>;

  /** `hasPendingConflict` 的返回值开关 */
  pendingConflict = false;

  /** `hasUnsavedChanges` 的返回值开关 */
  unsavedChanges = false;

  /** 切入次数 */
  switchInCount = 0;

  /** 切出次数 */
  switchOutCount = 0;

  private readonly component: FC;

  /**
   * 创建一个探针面板
   * @param options 探针面板选项
   */
  constructor(options: IProbePanelOptions) {
    this.id = options.id;
    this.events = options.events;
    this.openParam = options.openParam;
    this.component = () => createElement('div', null, this.id);
  }

  /**
   * 外壳在复用前询问是否有未表态的外部冲突
   * @returns 当前开关值
   */
  hasPendingConflict(): boolean {
    return this.pendingConflict;
  }

  /**
   * 外壳在切出落盘后询问是否仍有没写成功的改动
   * @returns 当前开关值
   */
  hasUnsavedChanges(): boolean {
    return this.unsavedChanges;
  }

  async initialize(): Promise<void> {}

  async dispose(): Promise<void> {
    this.events.push(`dispose:${this.id}`);
  }

  render(): FC {
    return this.component;
  }

  async onFocus(): Promise<void> {}

  async onBlur(): Promise<void> {}

  async onSwitchIn(): Promise<void> {
    this.switchInCount += 1;
    this.events.push(`switchIn:${this.id}`);
  }

  async onSwitchOut(): Promise<void> {
    this.switchOutCount += 1;
    this.events.push(`switchOut:${this.id}`);
  }

  async onUpdateResource(): Promise<void> {}

  async undo(): Promise<void> {}

  async redo(): Promise<void> {}
}

/**
 * 造一个记录创建与事件的探针面板类型
 * @param options 类型选项
 * @returns 类型本体、工厂创建记录与探针实例
 */
function createProbeType(options: IProbeTypeOptions): IProbeType {
  const created: IEditorPanelFactoryParam[] = [];
  const panels: ProbePanel[] = [];
  const type: IEditorPanelType = {
    id: options.id,
    name: options.id,
    icon: null,
    ...(options.reuse === true ? { reuseTab: true } : {}),
    create: (param: IEditorPanelFactoryParam): IEditorPanel => {
      const instanceId = param.instanceId;

      created.push(param);
      options.events.push(`create:${instanceId}`);

      const panel = new ProbePanel({ id: instanceId, events: options.events, openParam: param.openParam });

      panels.push(panel);
      return panel;
    },
  };

  return { type, created, panels };
}

/**
 * 装配一个已初始化、空文件系统的编辑器核心
 * @returns 已初始化的编辑器核心
 */
function createCore(): Promise<EditorCore> {
  return createCoreHarness(new FakeFileSystem());
}

/**
 * 在指定标签里打开面板；整段异步切换包进 act，避免 React 在用例之间报警告
 * @param core 编辑器核心
 * @param tabId 目标标签 id
 * @param type 要打开的面板类型
 * @param path 交给外壳去重用的文件路径；不传表示这次打开不对应任何文件
 * @returns 外壳的打开结果
 */
async function openInTab(core: EditorCore, tabId: string, type: IEditorPanelType, path?: string): Promise<boolean> {
  let opened = false;

  await act(async () => {
    opened =
      path === undefined
        ? await core.shellSystem.openPanelInTab(tabId, type.id)
        : await core.shellSystem.openPanelInTab(tabId, type.id, { target: { path } }, path);
  });

  return opened;
}

/**
 * 在当前打开的空白标签里打开面板；打开空白标签与打开面板必须在同一次同步段内完成，才能领走暂存
 * @param core 编辑器核心
 * @param type 要打开的面板类型
 * @param path 交给外壳去重用的文件路径；不传表示这次打开不对应任何文件
 * @returns 外壳的打开结果
 */
async function openInBlankTab(core: EditorCore, type: IEditorPanelType, path?: string): Promise<boolean> {
  let opened = false;

  await act(async () => {
    const tabId = core.shellSystem.openBlankTab();

    opened =
      path === undefined
        ? await core.shellSystem.openPanelInTab(tabId, type.id)
        : await core.shellSystem.openPanelInTab(tabId, type.id, { target: { path } }, path);
  });

  return opened;
}

/**
 * 读取外壳私有的路径登记判据
 * @param core 编辑器核心
 * @param path 已归一或未归一的路径
 * @returns 登记了该路径的标签 id；没有时为 undefined
 */
function findTabByPathOf(core: EditorCore, path: string): string | undefined {
  return Reflect.apply(Reflect.get(core.shellSystem, 'findTabByPath'), core.shellSystem, [path]);
}

/**
 * 读取外壳私有的活动标签 id
 * @param core 编辑器核心
 * @returns 活动标签 id；没有时为 null
 */
function activeTabIdOf(core: EditorCore): string | null {
  return Reflect.get(core.shellSystem, 'activeTabId');
}

/**
 * 把当前活动标签切成指定标签
 * @param core 编辑器核心
 * @param tabId 目标标签 id
 */
async function activate(core: EditorCore, tabId: string): Promise<void> {
  await act(async () => {
    await core.shellSystem.activateTab(tabId);
  });
}

describe('按类型复用标签（IEditorPanelType.reuseTab）', () => {
  // 复用类型的活动标签：先开 A、再在暂存空白标签里开 B → 只剩一个标签、实例被重建、只保存一次
  it('活动标签复用：一个标签、先保存一次再重建实例', async () => {
    const core = await createCore();
    const events: string[] = [];
    const probe = createProbeType({ id: 'reuse', events, reuse: true });
    const flush = vi.spyOn(core.resourceSystem, 'flushAllContent');

    core.shellSystem.registerPanelType(probe.type);

    const firstTab = core.shellSystem.listTabs()[0].id;

    await openInTab(core, firstTab, probe.type, HERO_PATH);

    expect(core.shellSystem.listTabs()).toHaveLength(1);
    expect(probe.created).toHaveLength(1);

    events.length = 0;
    flush.mockClear();

    const opened = await openInBlankTab(core, probe.type, ENEMY_PATH);

    expect(opened).toBe(true);
    expect(core.shellSystem.listTabs()).toHaveLength(1);
    expect(core.shellSystem.listTabs()[0].id).toBe(firstTab);
    expect(core.shellSystem.listTabs()[0].instanceId).toBe('instance-2');
    expect(probe.created).toHaveLength(2);
    expect(probe.created[0].openParam).toEqual({ target: { path: HERO_PATH } });
    expect(probe.created[1].openParam).toEqual({ target: { path: ENEMY_PATH } });

    expect(events.indexOf('switchOut:instance-1')).toBeGreaterThanOrEqual(0);
    expect(events.indexOf('switchOut:instance-1')).toBeLessThan(events.indexOf('dispose:instance-1'));
    expect(events.indexOf('dispose:instance-1')).toBeLessThan(events.indexOf('create:instance-2'));

    expect(probe.panels[0].switchOutCount).toBe(1);
    expect(flush).toHaveBeenCalledTimes(1);
  });

  // 复用标签不是活动标签：仍先切出保存一次再重建，另一个活动探针的最后一次切出不计入 A 的次数
  it('非活动标签复用：先保存一次再重建实例', async () => {
    const core = await createCore();
    const events: string[] = [];
    const reuse = createProbeType({ id: 'reuse', events, reuse: true });
    const plain = createProbeType({ id: 'plain', events });

    core.shellSystem.registerPanelType(reuse.type);
    core.shellSystem.registerPanelType(plain.type);

    const firstTab = core.shellSystem.listTabs()[0].id;

    await openInTab(core, firstTab, reuse.type, HERO_PATH);
    await openInBlankTab(core, plain.type);

    const secondTab = core.shellSystem.listTabs()[1].id;

    expect(activeTabIdOf(core)).toBe(secondTab);

    reuse.panels[0].switchOutCount = 0;
    events.length = 0;

    const opened = await openInBlankTab(core, reuse.type, ENEMY_PATH);

    expect(opened).toBe(true);
    expect(core.shellSystem.listTabs()).toHaveLength(2);
    expect(core.shellSystem.listTabs()[0].id).toBe(firstTab);
    expect(core.shellSystem.listTabs()[0].instanceId).toBe('instance-3');
    expect(reuse.created).toHaveLength(2);
    expect(reuse.panels[0].switchOutCount).toBe(1);
    expect(events.filter((event) => event === 'switchOut:instance-1')).toHaveLength(1);
  });

  // 冲突且 owner 是活动标签：判定抢在任何落盘之前，一个切出 / 释放 / 新建都不发生，只返回成功
  it('冲突且 owner 活动：不切出、不写盘、不释放、不新建', async () => {
    const core = await createCore();
    const events: string[] = [];
    const probe = createProbeType({ id: 'reuse', events, reuse: true });
    const flush = vi.spyOn(core.resourceSystem, 'flushAllContent');

    core.shellSystem.registerPanelType(probe.type);

    const firstTab = core.shellSystem.listTabs()[0].id;

    await openInTab(core, firstTab, probe.type, HERO_PATH);
    probe.panels[0].pendingConflict = true;

    events.length = 0;
    flush.mockClear();

    const opened = await openInBlankTab(core, probe.type, ENEMY_PATH);

    expect(opened).toBe(true);
    expect(core.shellSystem.listTabs()).toHaveLength(1);
    expect(core.shellSystem.listTabs()[0].id).toBe(firstTab);
    expect(core.shellSystem.listTabs()[0].instanceId).toBe('instance-1');
    expect(activeTabIdOf(core)).toBe(firstTab);
    expect(probe.created).toHaveLength(1);
    expect(probe.panels[0].switchOutCount).toBe(0);
    expect(flush).not.toHaveBeenCalled();
    expect(events).not.toContain('dispose:instance-1');
    expect(findTabByPathOf(core, HERO_PATH)).toBe(firstTab);
  });

  // 冲突且 owner 不是活动标签（真实资源管理器形状）：不写被复用面板的盘、不释放、不新建，只把它切到前台
  it('冲突且 owner 非活动：不写被复用面板的盘、不释放、不新建', async () => {
    const core = await createCore();
    const events: string[] = [];
    const reuse = createProbeType({ id: 'reuse', events, reuse: true });
    const plain = createProbeType({ id: 'plain', events });

    core.shellSystem.registerPanelType(reuse.type);
    core.shellSystem.registerPanelType(plain.type);

    const firstTab = core.shellSystem.listTabs()[0].id;

    await openInTab(core, firstTab, reuse.type, HERO_PATH);
    await openInBlankTab(core, plain.type);

    reuse.panels[0].pendingConflict = true;
    reuse.panels[0].switchOutCount = 0;
    events.length = 0;

    const opened = await openInBlankTab(core, reuse.type, ENEMY_PATH);

    expect(opened).toBe(true);
    expect(core.shellSystem.listTabs()).toHaveLength(2);
    expect(core.shellSystem.listTabs()[0].id).toBe(firstTab);
    expect(core.shellSystem.listTabs()[0].instanceId).toBe('instance-1');
    expect(activeTabIdOf(core)).toBe(firstTab);
    expect(reuse.created).toHaveLength(1);
    expect(reuse.panels[0].switchOutCount).toBe(0);
    expect(events).not.toContain('dispose:instance-1');
  });

  // 没声明复用的类型（表格即此形状）：两次打开不同目标仍是两个标签、两次创建
  it('未声明复用的类型每次新开标签', async () => {
    const core = await createCore();
    const events: string[] = [];
    const plain = createProbeType({ id: 'plain', events });

    core.shellSystem.registerPanelType(plain.type);

    const firstTab = core.shellSystem.listTabs()[0].id;

    await openInTab(core, firstTab, plain.type, HERO_PATH);
    await openInBlankTab(core, plain.type, ENEMY_PATH);

    expect(core.shellSystem.listTabs()).toHaveLength(2);
    expect(plain.created).toHaveLength(2);
  });

  // 路径去重先于复用：要打开的文件已经登记在复用标签里时只聚焦、不重建
  it('已登记的路径只聚焦，不重建实例', async () => {
    const core = await createCore();
    const events: string[] = [];
    const probe = createProbeType({ id: 'reuse', events, reuse: true });
    const flush = vi.spyOn(core.resourceSystem, 'flushAllContent');

    core.shellSystem.registerPanelType(probe.type);

    const firstTab = core.shellSystem.listTabs()[0].id;

    await openInTab(core, firstTab, probe.type, HERO_PATH);

    probe.panels[0].switchOutCount = 0;
    flush.mockClear();

    const opened = await openInBlankTab(core, probe.type, HERO_PATH);

    expect(opened).toBe(true);
    expect(core.shellSystem.listTabs()).toHaveLength(1);
    expect(probe.created).toHaveLength(1);
    expect(probe.panels[0].switchOutCount).toBe(0);
    expect(flush).not.toHaveBeenCalled();
  });

  // 保存没结算：不释放、不重建，保留原活动面板并让它重新切入，本次返回假
  it('保存未结算时保留原实例并返回假', async () => {
    const core = await createCore();
    const events: string[] = [];
    const probe = createProbeType({ id: 'reuse', events, reuse: true });

    core.shellSystem.registerPanelType(probe.type);

    const firstTab = core.shellSystem.listTabs()[0].id;

    await openInTab(core, firstTab, probe.type, HERO_PATH);
    probe.panels[0].unsavedChanges = true;
    probe.panels[0].switchInCount = 0;

    events.length = 0;

    const opened = await openInBlankTab(core, probe.type, ENEMY_PATH);

    expect(opened).toBe(false);
    expect(core.shellSystem.listTabs()).toHaveLength(1);
    expect(core.shellSystem.listTabs()[0].id).toBe(firstTab);
    expect(core.shellSystem.listTabs()[0].instanceId).toBe('instance-1');
    expect(activeTabIdOf(core)).toBe(firstTab);
    expect(probe.created).toHaveLength(1);
    expect(events).not.toContain('dispose:instance-1');
    expect(events).not.toContain('create:instance-2');
    expect(probe.panels[0].switchInCount).toBe(1);
  });

  // 非复用替换的前提：直接对已有实例的活动标签再开 B 照旧替换该标签，并在替换前保存一次
  it('活动标签直接替换仍先保存一次；非活动替换保持不保存', async () => {
    const core = await createCore();
    const events: string[] = [];
    const reuse = createProbeType({ id: 'reuse', events, reuse: true });
    const plain = createProbeType({ id: 'plain', events });

    core.shellSystem.registerPanelType(reuse.type);
    core.shellSystem.registerPanelType(plain.type);

    const firstTab = core.shellSystem.listTabs()[0].id;

    await openInTab(core, firstTab, reuse.type, HERO_PATH);
    await openInBlankTab(core, plain.type);

    const secondTab = core.shellSystem.listTabs()[1].id;

    await activate(core, firstTab);

    reuse.panels[0].switchOutCount = 0;

    const replaced = await openInTab(core, firstTab, reuse.type, ENEMY_PATH);

    expect(replaced).toBe(true);
    expect(core.shellSystem.listTabs()).toHaveLength(2);
    expect(core.shellSystem.listTabs()[0].id).toBe(firstTab);
    expect(core.shellSystem.listTabs()[0].instanceId).toBe('instance-3');
    expect(reuse.created).toHaveLength(2);
    expect(reuse.panels[0].switchOutCount).toBe(1);

    await activate(core, secondTab);

    const replacedPanel = reuse.panels[1];

    replacedPanel.switchOutCount = 0;

    const replacedAgain = await openInTab(core, firstTab, reuse.type, HERO_PATH);

    expect(replacedAgain).toBe(true);
    expect(core.shellSystem.listTabs()[0].instanceId).toBe('instance-4');
    expect(replacedPanel.switchOutCount).toBe(0);
  });

  // 复用打开顺序最早的标签：已有两个同类标签时取先打开的那个
  it('复用打开顺序最早的同类标签', async () => {
    const core = await createCore();
    const events: string[] = [];
    const reuse = createProbeType({ id: 'reuse', events, reuse: true });
    const plain = createProbeType({ id: 'plain', events });

    core.shellSystem.registerPanelType(reuse.type);
    core.shellSystem.registerPanelType(plain.type);

    const firstTab = core.shellSystem.listTabs()[0].id;

    await openInTab(core, firstTab, reuse.type, HERO_PATH);
    await openInBlankTab(core, plain.type);

    const secondTab = core.shellSystem.listTabs()[1].id;

    await openInTab(core, secondTab, reuse.type, ENEMY_PATH);

    expect(core.shellSystem.listTabs()).toHaveLength(2);
    expect(core.shellSystem.listTabs()[1].id).toBe(secondTab);
    expect(core.shellSystem.listTabs()[1].typeId).toBe('reuse');

    const secondInstanceId = core.shellSystem.listTabs()[1].instanceId;

    await openInBlankTab(core, reuse.type, 'tables/third.jsonc');

    expect(core.shellSystem.listTabs()).toHaveLength(2);
    expect(core.shellSystem.listTabs()[0].id).toBe(firstTab);
    expect(core.shellSystem.listTabs()[0].instanceId).toBe('instance-4');
    expect(core.shellSystem.listTabs()[1].instanceId).toBe(secondInstanceId);
  });

  // 没人领走的空白标签仍会在微任务后激活：旧面板照样收到一次切出，行为与既有切换顺序一致
  it('没人领走的空白标签仍会在微任务后激活', async () => {
    const core = await createCore();
    const events: string[] = [];
    const probe = createProbeType({ id: 'plain', events });

    core.shellSystem.registerPanelType(probe.type);

    const firstTab = core.shellSystem.listTabs()[0].id;

    await openInTab(core, firstTab, probe.type);

    probe.panels[0].switchOutCount = 0;

    let blankTab = '';

    await act(async () => {
      blankTab = core.shellSystem.openBlankTab();
      await new Promise<unknown>((resolve): void => {
        setTimeout(resolve, 0);
      });
    });

    expect(core.shellSystem.listTabs()).toHaveLength(2);
    expect(activeTabIdOf(core)).toBe(blankTab);
    expect(probe.panels[0].switchOutCount).toBe(1);
  });
});
