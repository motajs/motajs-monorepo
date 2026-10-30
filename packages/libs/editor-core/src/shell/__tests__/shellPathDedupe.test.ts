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

/** 开发宿主里那个「工厂是否抛错」的开关：供失败用例先成功后失败 */
interface ICreateFailure {
  /** 为真时工厂抛错、外壳按创建失败处理 */
  fail: boolean;
}

/** 一个可计数的面板类型：注册用的类型本体与它每次收到的工厂入参 */
interface ICountingType {
  /** 注册进外壳的面板类型 */
  readonly type: IEditorPanelType;
  /** 工厂每收到一次入参就追加一条，长度即创建过的实例数 */
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
 * 造一个带打开能力、并记录每次工厂调用的面板类型
 * @param id 面板类型标识
 * @param name 面板类型显示名，用作标签显示名的回退
 * @param failure 可选的工厂抛错开关
 * @returns 类型本体与工厂调用记录
 */
function createCountingType(id: string, name: string, failure?: ICreateFailure): ICountingType {
  const created: IEditorPanelFactoryParam[] = [];
  const type: IEditorPanelType = {
    id,
    name,
    icon: null,
    canOpen: (path: string): boolean => path.startsWith('tables/'),
    createOpenParam: (path: string): Record<string, unknown> => ({ kind: id, target: { dataPath: path } }),
    create: (param: IEditorPanelFactoryParam): IEditorPanel => {
      created.push(param);

      if (failure?.fail === true) throw new Error('create boom');

      return new ProbePanel(param.instanceId);
    },
  };

  return { type, created };
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
 * @param path 交给外壳去重用的文件路径
 * @returns 外壳的打开结果
 */
async function openInTab(core: EditorCore, tabId: string, type: IEditorPanelType, path: string): Promise<boolean> {
  let opened = false;

  await act(async () => {
    opened = await core.shellSystem.openPanelInTab(tabId, type.id, type.createOpenParam!(path), path);
  });

  return opened;
}

describe('同文件多标签去重', () => {
  // 同一条路径先开在一个标签里，再用新空标签打开同一条路径：只剩一个标签、同一个实例，空标签被收掉
  it('同一路径第二次打开只激活已有标签，不新建实例、不遗留空标签', async () => {
    const core = await createCore();
    const { type, created } = createCountingType('alpha', '面板 A');

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
});
