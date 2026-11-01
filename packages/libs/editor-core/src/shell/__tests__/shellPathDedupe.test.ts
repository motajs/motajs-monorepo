import { act, cleanup, render } from '@testing-library/react';
import { createElement, FC } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { createCoreHarness, FakeFileSystem } from '../../__tests__/fixtures';
import { EditorCore } from '../../core';
import { IEditorPanel, IEditorPanelFactoryParam, IEditorPanelType } from '../../panel/types';

// 按路径去重的测试：同一条文件路径任何时刻最多只开在一个标签里。这条测试钉住「命中即激活、不新建实例、
// 不遗留空标签」，以及不同路径各自成标签、关标签释放路径、路径归一、空串与不传路径按没有路径处理、
// 跨面板类型仍去重、同一标签换路径后旧路径释放、工厂失败时路径不被误判为空闲。

/** 表格数据文件的路径 */
const HERO_PATH = 'tables/hero.jsonc';
/** 另一张表格数据文件的路径 */
const ENEMY_PATH = 'tables/enemy.jsonc';

/** 打开参数生成器：把一条文件路径转成某个面板类型的打开参数 */
type OpenParamBuilder = (path: string) => Record<string, unknown>;

/** 工厂抛错开关：供失败用例在同一次装配里先成功后失败 */
interface ICreateFailure {
  /** 为真时工厂抛错，外壳按创建失败处理 */
  fail: boolean;
}

/** 一个可计数的面板类型：注册用的类型本体与它每次成功创建时收到的工厂入参 */
interface ICountingType {
  /** 注册进外壳的面板类型 */
  readonly type: IEditorPanelType;
  /** 工厂每成功创建一次就追加一条，长度即创建过的实例数 */
  readonly created: IEditorPanelFactoryParam[];
}

// 每个用例结束后卸载已挂载的组件，避免 DOM 在用例之间累积
afterEach(() => {
  cleanup();
});

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

  async undo(): Promise<void> {}

  async redo(): Promise<void> {}
}

/**
 * 面板 A 的打开参数形状：`{ kind, target: { dataPath } }`
 * @param path 文件路径
 * @returns 打开参数
 */
function alphaOpenParam(path: string): Record<string, unknown> {
  return { kind: 'alpha', target: { dataPath: path } };
}

/**
 * 面板 B 的打开参数形状：外层与嵌套字段都与 A 不同，用来证明外壳不读参数形状
 * @param path 文件路径
 * @returns 打开参数
 */
function betaOpenParam(path: string): Record<string, unknown> {
  return { shape: 'beta', nested: { file: path } };
}

/**
 * 造一个带打开能力、并记录每次成功创建的面板类型
 * @param id 面板类型标识
 * @param name 面板类型显示名，作为标签显示名的回退
 * @param buildParam 打开参数生成器，用来让两种面板类型交出不同形状的参数
 * @param failure 可选的工厂抛错开关
 * @returns 类型本体与工厂创建记录
 */
function createCountingType(
  id: string,
  name: string,
  buildParam: OpenParamBuilder,
  failure?: ICreateFailure,
): ICountingType {
  const created: IEditorPanelFactoryParam[] = [];
  const type: IEditorPanelType = {
    id,
    name,
    icon: null,
    canOpen: (path: string): boolean => path.startsWith('tables/'),
    createOpenParam: buildParam,
    create: (param: IEditorPanelFactoryParam): IEditorPanel => {
      if (failure !== undefined && failure.fail) throw new Error('create boom');

      created.push(param);
      return new ProbePanel(param.instanceId);
    },
  };

  return { type, created };
}

/**
 * 造一个只声明基础能力（id / name / icon / create）的面板类型：没有打开能力，天然没有路径
 * @param id 面板类型标识
 * @returns 只声明基础能力的面板类型
 */
function createPlainType(id: string): IEditorPanelType {
  return {
    id,
    name: '基础面板',
    icon: null,
    create: (param: IEditorPanelFactoryParam): IEditorPanel => new ProbePanel(param.instanceId),
  };
}

/**
 * 装配一个已初始化、空文件系统的编辑器核心
 * @returns 已初始化的编辑器核心
 */
async function createCore(): Promise<EditorCore> {
  return createCoreHarness(new FakeFileSystem());
}

/**
 * 在指定标签里按路径打开面板；整段异步切换包进 act，避免 React 在用例之间报警告
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
        : await core.shellSystem.openPanelInTab(tabId, type.id, type.createOpenParam!(path), path);
  });

  return opened;
}

/**
 * 调用外壳的私有跨标签聚焦方法：它只给面板上下文用，不在 `IShellSystem` 的公开面上
 * @param core 编辑器核心
 * @param identifier 资源标识（纯路径）
 * @returns 有别的标签持有该路径并已发起切换时为 true
 */
function focusResourceTabOf(core: EditorCore, identifier: string): boolean {
  return Reflect.apply(Reflect.get(core.shellSystem, 'focusResourceTab'), core.shellSystem, [identifier]);
}

describe('同文件多标签去重', () => {
  // 同一条路径先开在一个标签里，再用新空标签打开同一条路径：只剩一个标签、同一个实例，空标签被收掉
  it('同一路径第二次打开只激活已有标签，不新建实例、不遗留空标签', async () => {
    const core = await createCore();
    const { type, created } = createCountingType('alpha', '面板 A', alphaOpenParam);

    core.shellSystem.registerPanelType(type);

    const firstTab = core.shellSystem.listTabs()[0].id;

    const openedFirst = await openInTab(core, firstTab, type, HERO_PATH);

    expect(openedFirst).toBe(true);
    expect(created).toHaveLength(1);

    const { container } = render(createElement(core.shellSystem.render()));

    const secondTab = core.shellSystem.openBlankTab();

    const openedSecond = await openInTab(core, secondTab, type, HERO_PATH);

    expect(openedSecond).toBe(true);
    expect(core.shellSystem.listTabs().map((tab) => tab.id)).toEqual([firstTab]);
    expect(core.shellSystem.listTabs()[0].instanceId).toBe('instance-1');
    expect(created).toHaveLength(1);

    const activeTabs = container.querySelectorAll('.editor-shell-tab.is-active');

    expect(activeTabs.length).toBe(1);
    expect(activeTabs[0].querySelector('.editor-shell-tab-label')?.textContent).toBe('面板 A');
    expect(activeTabs[0].querySelector('.editor-shell-tab-label')?.getAttribute('aria-current')).toBe('true');
    expect(container.querySelector('.editor-shell-content')?.textContent).toBe('instance-1');
  });

  // 两条不同路径各得一个标签；随后各自用同一条路径二次打开，仍然只有那两个标签、两个实例
  it('两条不同路径得到两个标签，各自二次打开仍只有两个', async () => {
    const core = await createCore();
    const { type, created } = createCountingType('alpha', '面板 A', alphaOpenParam);

    core.shellSystem.registerPanelType(type);

    const firstTab = core.shellSystem.listTabs()[0].id;

    await openInTab(core, firstTab, type, HERO_PATH);

    const secondTab = core.shellSystem.openBlankTab();

    await openInTab(core, secondTab, type, ENEMY_PATH);

    expect(core.shellSystem.listTabs().map((tab) => tab.id)).toEqual([firstTab, secondTab]);
    expect(created).toHaveLength(2);
    expect(core.shellSystem.listTabs()[0].instanceId).not.toBe(core.shellSystem.listTabs()[1].instanceId);

    const thirdTab = core.shellSystem.openBlankTab();

    await openInTab(core, thirdTab, type, HERO_PATH);

    const fourthTab = core.shellSystem.openBlankTab();

    await openInTab(core, fourthTab, type, ENEMY_PATH);

    expect(core.shellSystem.listTabs().map((tab) => tab.id)).toEqual([firstTab, secondTab]);
    expect(created).toHaveLength(2);
  });

  // 关标签后路径被释放：外壳自动补建的空标签里重开同一条路径会真的新建实例，不复用已关闭的那个
  it('关标签后同一路径可以重新打开，并得到新实例', async () => {
    const core = await createCore();
    const { type, created } = createCountingType('alpha', '面板 A', alphaOpenParam);

    core.shellSystem.registerPanelType(type);

    const firstTab = core.shellSystem.listTabs()[0].id;

    await openInTab(core, firstTab, type, HERO_PATH);

    expect(created).toHaveLength(1);

    await act(async () => {
      await core.shellSystem.closeTab(firstTab);
    });

    const blankTab = core.shellSystem.listTabs()[0].id;

    expect(blankTab).not.toBe(firstTab);

    const openedAgain = await openInTab(core, blankTab, type, HERO_PATH);

    expect(openedAgain).toBe(true);
    expect(created).toHaveLength(2);
    expect(core.shellSystem.listTabs()[0].instanceId).toBe('instance-2');
  });

  // 路径归一：前导斜线、尾随斜线、重复斜线都命中同一个标签，四次打开只留一个标签、一个实例
  it('前导 / 尾随 / 重复斜线归一到同一个标签', async () => {
    const core = await createCore();
    const { type, created } = createCountingType('alpha', '面板 A', alphaOpenParam);

    core.shellSystem.registerPanelType(type);

    const firstTab = core.shellSystem.listTabs()[0].id;

    await openInTab(core, firstTab, type, HERO_PATH);

    const variants = ['/tables/hero.jsonc', 'tables/hero.jsonc/', 'tables//hero.jsonc'];

    for (const variant of variants) {
      const blankTab = core.shellSystem.openBlankTab();
      const opened = await openInTab(core, blankTab, type, variant);

      expect(opened).toBe(true);
    }

    expect(core.shellSystem.listTabs().map((tab) => tab.id)).toEqual([firstTab]);
    expect(created).toHaveLength(1);
  });

  // 空串按「没有路径」处理：两次用空串打开、面板类型还不同，仍得到两个标签，不会聚到同一个标签上
  it('空串不当登记键，两次空串打开得到两个标签', async () => {
    const core = await createCore();
    const alpha = createCountingType('alpha', '面板 A', alphaOpenParam);
    const beta = createCountingType('beta', '面板 B', betaOpenParam);

    core.shellSystem.registerPanelType(alpha.type);
    core.shellSystem.registerPanelType(beta.type);

    const firstTab = core.shellSystem.listTabs()[0].id;

    const openedFirst = await openInTab(core, firstTab, alpha.type, '');

    const secondTab = core.shellSystem.openBlankTab();

    const openedSecond = await openInTab(core, secondTab, beta.type, '');

    expect(openedFirst).toBe(true);
    expect(openedSecond).toBe(true);
    expect(core.shellSystem.listTabs().map((tab) => tab.id)).toEqual([firstTab, secondTab]);
    expect(alpha.created).toHaveLength(1);
    expect(beta.created).toHaveLength(1);
  });

  // 调用方不传路径时照旧打开：只声明基础能力的类型在两条空标签里各开一次都成功，且没有去重
  it('不传路径时照旧打开，不去重', async () => {
    const core = await createCore();
    const plain = createPlainType('plain');

    core.shellSystem.registerPanelType(plain);

    const firstTab = core.shellSystem.listTabs()[0].id;

    const openedFirst = await openInTab(core, firstTab, plain);

    const secondTab = core.shellSystem.openBlankTab();

    const openedSecond = await openInTab(core, secondTab, plain);

    expect(openedFirst).toBe(true);
    expect(openedSecond).toBe(true);
    expect(core.shellSystem.listTabs().map((tab) => tab.id)).toEqual([firstTab, secondTab]);
  });

  // 去重键不看面板类型：先用类型 A 打开路径 X，再用参数形状不同的类型 B 打开同一条路径仍只有一个标签
  it('跨面板类型按同一路径去重，换一条路径才得到第二个标签', async () => {
    const core = await createCore();
    const alpha = createCountingType('alpha', '面板 A', alphaOpenParam);
    const beta = createCountingType('beta', '面板 B', betaOpenParam);

    core.shellSystem.registerPanelType(alpha.type);
    core.shellSystem.registerPanelType(beta.type);

    const firstTab = core.shellSystem.listTabs()[0].id;

    await openInTab(core, firstTab, alpha.type, HERO_PATH);

    const secondTab = core.shellSystem.openBlankTab();

    const openedSamePath = await openInTab(core, secondTab, beta.type, HERO_PATH);

    expect(openedSamePath).toBe(true);
    expect(core.shellSystem.listTabs().map((tab) => tab.id)).toEqual([firstTab]);
    expect(core.shellSystem.listTabs()[0].typeId).toBe('alpha');
    expect(alpha.created).toHaveLength(1);
    expect(beta.created).toHaveLength(0);

    const thirdTab = core.shellSystem.openBlankTab();

    const openedOtherPath = await openInTab(core, thirdTab, beta.type, ENEMY_PATH);

    expect(openedOtherPath).toBe(true);
    expect(core.shellSystem.listTabs()).toHaveLength(2);
    expect(beta.created).toHaveLength(1);
  });

  // 同一标签换成另一条路径：登记被改写，旧路径要新建标签才打得开，新路径仍只聚焦这个标签
  it('同一标签换成另一条路径后旧路径被释放', async () => {
    const core = await createCore();
    const { type, created } = createCountingType('alpha', '面板 A', alphaOpenParam);

    core.shellSystem.registerPanelType(type);

    const firstTab = core.shellSystem.listTabs()[0].id;

    await openInTab(core, firstTab, type, HERO_PATH);

    expect(created).toHaveLength(1);

    const replaced = await openInTab(core, firstTab, type, ENEMY_PATH);

    expect(replaced).toBe(true);
    expect(core.shellSystem.listTabs()).toHaveLength(1);
    expect(created).toHaveLength(2);

    const secondTab = core.shellSystem.openBlankTab();

    const openedOldPath = await openInTab(core, secondTab, type, HERO_PATH);

    expect(openedOldPath).toBe(true);
    expect(core.shellSystem.listTabs().map((tab) => tab.id)).toEqual([firstTab, secondTab]);
    expect(created).toHaveLength(3);

    const thirdTab = core.shellSystem.openBlankTab();

    const openedNewPath = await openInTab(core, thirdTab, type, ENEMY_PATH);

    expect(openedNewPath).toBe(true);
    expect(core.shellSystem.listTabs().map((tab) => tab.id)).toEqual([firstTab, secondTab]);
    expect(created).toHaveLength(3);
  });

  // 换成不带路径的面板会清掉登记：之后同一条路径在新标签里打开要真的新建实例
  it('换成不带路径的面板会清掉原路径登记', async () => {
    const core = await createCore();
    const { type, created } = createCountingType('alpha', '面板 A', alphaOpenParam);
    const plain = createPlainType('plain');

    core.shellSystem.registerPanelType(type);
    core.shellSystem.registerPanelType(plain);

    const firstTab = core.shellSystem.listTabs()[0].id;

    await openInTab(core, firstTab, type, HERO_PATH);

    const cleared = await openInTab(core, firstTab, plain);

    expect(cleared).toBe(true);
    expect(core.shellSystem.listTabs()[0].typeId).toBe('plain');

    const secondTab = core.shellSystem.openBlankTab();

    const openedAgain = await openInTab(core, secondTab, type, HERO_PATH);

    expect(openedAgain).toBe(true);
    expect(core.shellSystem.listTabs().map((tab) => tab.id)).toEqual([firstTab, secondTab]);
    expect(created).toHaveLength(2);
  });

  // 工厂抛错时这条路径不被误判为空闲：返回失败、登记不清，随后重开同路径只聚焦原标签、不新建实例
  it('工厂抛错时返回失败且原路径登记不被清掉', async () => {
    const core = await createCore();
    const failure: ICreateFailure = { fail: false };
    const { type, created } = createCountingType('alpha', '面板 A', alphaOpenParam, failure);

    core.shellSystem.registerPanelType(type);

    const firstTab = core.shellSystem.listTabs()[0].id;

    await openInTab(core, firstTab, type, HERO_PATH);

    expect(created).toHaveLength(1);

    failure.fail = true;

    const openedFailed = await openInTab(core, firstTab, type, ENEMY_PATH);

    expect(openedFailed).toBe(false);
    expect(created).toHaveLength(1);
    expect(core.shellSystem.listTabs()).toHaveLength(1);

    failure.fail = false;

    const secondTab = core.shellSystem.openBlankTab();

    const openedAgain = await openInTab(core, secondTab, type, HERO_PATH);

    expect(openedAgain).toBe(true);
    expect(core.shellSystem.listTabs().map((tab) => tab.id)).toEqual([firstTab]);
    expect(created).toHaveLength(1);
  });
});

describe('跨标签聚焦（ShellSystem.focusResourceTab）', () => {
  // 别的标签持有这条路径：同步返回真，切换即发即忘，等一次微任务后活动标签变成持有者
  it('别的标签持有该路径时返回真并切过去', async () => {
    const core = await createCore();
    const { type } = createCountingType('alpha', '面板 A', alphaOpenParam);

    core.shellSystem.registerPanelType(type);

    const firstTab = core.shellSystem.listTabs()[0].id;

    await openInTab(core, firstTab, type, HERO_PATH);

    const secondTab = core.shellSystem.openBlankTab();

    await openInTab(core, secondTab, type);
    await act(async () => {
      await core.shellSystem.activateTab(secondTab);
    });

    const { container } = render(createElement(core.shellSystem.render()));

    let focused = false;

    await act(async () => {
      focused = focusResourceTabOf(core, HERO_PATH);
      await new Promise<unknown>((resolve): void => {
        setTimeout(resolve, 0);
      });
    });

    expect(focused).toBe(true);

    const activeTabs = container.querySelectorAll('.editor-shell-tab.is-active');

    expect(activeTabs.length).toBe(1);
    expect(activeTabs[0].querySelector('.editor-shell-tab-label')?.textContent).toBe('面板 A');
    expect(container.querySelector('.editor-shell-content')?.textContent).toBe('instance-1');
  });

  // 没人持有这条路径：同步返回假，调用方可以继续换目标
  it('没人持有该路径时返回假', async () => {
    const core = await createCore();
    const { type } = createCountingType('alpha', '面板 A', alphaOpenParam);

    core.shellSystem.registerPanelType(type);

    const firstTab = core.shellSystem.listTabs()[0].id;

    await openInTab(core, firstTab, type, HERO_PATH);

    expect(focusResourceTabOf(core, ENEMY_PATH)).toBe(false);
  });

  // 当前活动标签自己登记了这条路径：返回假，关掉一栏后再打开同一文件仍然能开
  it('当前活动标签自己持有该路径时返回假', async () => {
    const core = await createCore();
    const { type } = createCountingType('alpha', '面板 A', alphaOpenParam);

    core.shellSystem.registerPanelType(type);

    const firstTab = core.shellSystem.listTabs()[0].id;

    await openInTab(core, firstTab, type, HERO_PATH);

    expect(focusResourceTabOf(core, HERO_PATH)).toBe(false);
  });
});
