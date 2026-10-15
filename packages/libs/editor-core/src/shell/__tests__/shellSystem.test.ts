import { act, cleanup, render, screen } from '@testing-library/react';
import { createElement, FC } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { logger } from '../../log';
import { IEditorPanel, IEditorPanelFactoryParam } from '../../panel/types';
import { ResourceSystem } from '../../resource/resourceSystem';
import { IResourceIdentifier, IResourceInjection } from '../../resource/types';
import { IUndoContext } from '../../undo/types';
import { UndoSystem } from '../../undo/undoSystem';
import { ShellSystem } from '../shellSystem';

// 每个用例结束后卸载已挂载的组件，避免 DOM 在用例之间累积
afterEach(() => {
  cleanup();
});

class FakeResourceInjection implements IResourceInjection {
  readonly content: Map<number, Map<string, unknown>> = new Map();

  readonly list: Map<number, IResourceIdentifier[]> = new Map();

  // 向内存后端预置一个资源内容及其所属的资源列表
  seed(id: IResourceIdentifier, value: unknown): void {
    let byId = this.content.get(id.type);

    if (!byId) {
      byId = new Map();
      this.content.set(id.type, byId);
    }

    byId.set(id.id, value);

    const ids = this.list.get(id.type) ?? [];
    ids.push(id);
    this.list.set(id.type, ids);
  }

  async requestResource<T>(id: IResourceIdentifier): Promise<T> {
    return this.content.get(id.type)?.get(id.id) as T;
  }

  async requestResourceList(type: number): Promise<readonly IResourceIdentifier[]> {
    return this.list.get(type) ?? [];
  }

  async writeResource(id: IResourceIdentifier, content: unknown): Promise<void> {
    this.content.get(id.type)?.set(id.id, content);
  }

  async createResource(id: IResourceIdentifier, content: unknown): Promise<void> {
    this.seed(id, content);
  }

  async deleteResource(id: IResourceIdentifier): Promise<void> {
    this.content.get(id.type)?.delete(id.id);
  }
}

class FakePanel implements IEditorPanel {
  readonly id: string;

  initializeCount = 0;
  disposeCount = 0;
  focusCount = 0;
  blurCount = 0;
  switchInCount = 0;
  switchOutCount = 0;
  updateResourceCount = 0;
  updateResourceListCount = 0;
  undoCount = 0;
  redoCount = 0;
  lastUpdateId?: IResourceIdentifier;
  lastUpdateData?: unknown;
  lastUpdateType?: number;
  lastUpdateList: readonly IResourceIdentifier[] = [];
  /** 设置后 initialize 抛出该文本的错误，用于验证错误态 */
  initializeError?: string;
  /** 设置后 initialize 等待该 Promise，用于验证加载态 */
  initializeGate?: Promise<void>;

  private readonly component: FC;

  constructor(id: string) {
    this.id = id;
    this.component = () => createElement('div', null, this.id);
  }

  async initialize(): Promise<void> {
    this.initializeCount += 1;
    if (this.initializeGate) await this.initializeGate;
    if (this.initializeError) throw new Error(this.initializeError);
  }

  async dispose(): Promise<void> {
    this.disposeCount += 1;
  }

  render(): FC {
    return this.component;
  }

  async onFocus(): Promise<void> {
    this.focusCount += 1;
  }

  async onBlur(): Promise<void> {
    this.blurCount += 1;
  }

  async onSwitchIn(): Promise<void> {
    this.switchInCount += 1;
  }

  async onSwitchOut(): Promise<void> {
    this.switchOutCount += 1;
  }

  async onUpdateResource<T>(id: IResourceIdentifier, data: T): Promise<void> {
    this.updateResourceCount += 1;
    this.lastUpdateId = id;
    this.lastUpdateData = data;
  }

  async onUpdateResourceList(type: number, list: readonly IResourceIdentifier[]): Promise<void> {
    this.updateResourceListCount += 1;
    this.lastUpdateType = type;
    this.lastUpdateList = list;
  }

  async undo<T>(context: IUndoContext<T>): Promise<void> {
    this.undoCount += 1;
  }

  async redo<T>(context: IUndoContext<T>): Promise<void> {
    this.redoCount += 1;
  }
}

interface TestSystem {
  readonly shellSystem: ShellSystem;
  readonly undoSystem: UndoSystem;
  readonly resourceSystem: ResourceSystem;
  readonly injection: FakeResourceInjection;
}

// 组装一套已初始化的外壳/资源/撤回系统与内存后端
async function createSystem(maxUndoStep = 100): Promise<TestSystem> {
  const injection = new FakeResourceInjection();
  const resourceSystem = new ResourceSystem();
  await resourceSystem.initialize(injection);
  const undoSystem = new UndoSystem();
  await undoSystem.initialize({ maxUndoStep });
  const shellSystem = new ShellSystem(undoSystem, resourceSystem);
  await shellSystem.initialize();
  return { shellSystem, undoSystem, resourceSystem, injection };
}

// 注册一个面板类型，其工厂按 core 生成的实例 id 创建面板并收集到列表
function registerType(system: TestSystem, id: string, name: string, panels: FakePanel[]): void {
  system.shellSystem.registerPanelType({
    id,
    name,
    icon: null,
    create: (param: IEditorPanelFactoryParam): IEditorPanel => {
      const panel = new FakePanel(param.instanceId);
      panels.push(panel);
      return panel;
    },
  });
}

describe('ShellSystem 端到端', () => {
  // initialize 后自动存在一个空白标签页
  it('initialize 后默认存在一个空白标签页', async () => {
    const system = await createSystem();

    const tabs = system.shellSystem.listTabs();

    expect(tabs.length).toBe(1);
    expect(tabs[0].typeId).toBeNull();
    expect(tabs[0].instanceId).toBeNull();
  });

  // 注册类型后，空白标签页列出该类型
  it('注册类型后空白标签页列出该类型', async () => {
    const system = await createSystem();
    const panels: FakePanel[] = [];
    registerType(system, 'table', '表格面板', panels);

    render(createElement(system.shellSystem.render()));

    expect(screen.getByText('选择面板类型')).not.toBeNull();
    expect(screen.getByRole('button', { name: '表格面板' })).not.toBeNull();
  });

  // 点击类型项后用新实例替换空白标签并在内容区渲染
  it('点击类型项后打开实例并渲染', async () => {
    const system = await createSystem();
    const panels: FakePanel[] = [];
    registerType(system, 'table', '表格面板', panels);

    render(createElement(system.shellSystem.render()));

    const tabId = system.shellSystem.listTabs()[0].id;

    await act(async () => {
      await system.shellSystem.openPanelInTab(tabId, 'table');
    });

    const tabs = system.shellSystem.listTabs();

    expect(tabs[0].typeId).toBe('table');
    expect(tabs[0].instanceId).toBe('instance-1');
    expect(screen.getByText('instance-1')).not.toBeNull();
  });

  // 同类型可开两个独立实例，关闭其一会释放对应实例且不影响另一个
  it('同类型可开两个互不冲突的独立实例', async () => {
    const system = await createSystem();
    const panels: FakePanel[] = [];
    registerType(system, 'table', '表格面板', panels);

    render(createElement(system.shellSystem.render()));

    const firstTab = system.shellSystem.listTabs()[0].id;

    await act(async () => {
      await system.shellSystem.openPanelInTab(firstTab, 'table');
    });

    let secondTab = '';

    await act(async () => {
      secondTab = system.shellSystem.openBlankTab();
    });

    await act(async () => {
      await system.shellSystem.openPanelInTab(secondTab, 'table');
    });

    const tabs = system.shellSystem.listTabs();

    expect(panels.length).toBe(2);
    expect(tabs[1].instanceId).not.toBe(tabs[0].instanceId);

    await act(async () => {
      await system.shellSystem.closeTab(secondTab);
    });

    expect(panels[1].disposeCount).toBe(1);
    expect(panels[0].disposeCount).toBe(0);
  });

  // 关闭标签触发实例 dispose，并自动切到相邻（优先左邻）标签
  it('关闭标签触发 dispose 并自动切到相邻标签', async () => {
    const system = await createSystem();
    const panels: FakePanel[] = [];
    registerType(system, 'table', '表格面板', panels);

    render(createElement(system.shellSystem.render()));

    const firstTab = system.shellSystem.listTabs()[0].id;

    await act(async () => {
      await system.shellSystem.openPanelInTab(firstTab, 'table');
    });

    let secondTab = '';

    await act(async () => {
      secondTab = system.shellSystem.openBlankTab();
    });

    await act(async () => {
      await system.shellSystem.openPanelInTab(secondTab, 'table');
    });

    await act(async () => {
      await system.shellSystem.closeTab(secondTab);
    });

    expect(panels[1].disposeCount).toBe(1);
    expect(system.shellSystem.listTabs().length).toBe(1);
    expect(screen.getByText('instance-1')).not.toBeNull();
  });

  // 关闭非当前标签时前台标签保持不变，只移除被关闭的标签
  it('关闭非当前标签时前台标签保持不变', async () => {
    const system = await createSystem();
    const panels: FakePanel[] = [];
    registerType(system, 'table', '表格面板', panels);

    render(createElement(system.shellSystem.render()));

    const firstTab = system.shellSystem.listTabs()[0].id;

    await act(async () => {
      await system.shellSystem.openPanelInTab(firstTab, 'table');
    });

    const secondTab = system.shellSystem.openBlankTab();

    await act(async () => {
      await system.shellSystem.openPanelInTab(secondTab, 'table');
    });

    const thirdTab = system.shellSystem.openBlankTab();

    await act(async () => {
      await system.shellSystem.openPanelInTab(thirdTab, 'table');
    });

    await act(async () => {
      await system.shellSystem.closeTab(secondTab);
    });

    expect(system.shellSystem.listTabs().length).toBe(2);
    expect(screen.getByText('instance-3')).not.toBeNull();
    expect(screen.queryByText('instance-2')).toBeNull();
    expect(panels[1].disposeCount).toBe(1);
  });

  // 关闭当前标签时自动切到左邻标签
  it('关闭当前标签时自动切到左邻标签', async () => {
    const system = await createSystem();
    const panels: FakePanel[] = [];
    registerType(system, 'table', '表格面板', panels);

    render(createElement(system.shellSystem.render()));

    const firstTab = system.shellSystem.listTabs()[0].id;

    await act(async () => {
      await system.shellSystem.openPanelInTab(firstTab, 'table');
    });

    const secondTab = system.shellSystem.openBlankTab();

    await act(async () => {
      await system.shellSystem.openPanelInTab(secondTab, 'table');
    });

    const thirdTab = system.shellSystem.openBlankTab();

    await act(async () => {
      await system.shellSystem.openPanelInTab(thirdTab, 'table');
    });

    act(() => {
      system.shellSystem.activateTab(secondTab);
    });

    await act(async () => {
      await system.shellSystem.closeTab(secondTab);
    });

    expect(system.shellSystem.listTabs().length).toBe(2);
    expect(screen.getByText('instance-1')).not.toBeNull();
  });

  // 关闭最左的当前标签时切到右邻标签（空白）
  it('关闭最左当前标签时切到右邻标签', async () => {
    const system = await createSystem();
    const panels: FakePanel[] = [];
    registerType(system, 'table', '表格面板', panels);

    render(createElement(system.shellSystem.render()));

    const firstTab = system.shellSystem.listTabs()[0].id;

    await act(async () => {
      await system.shellSystem.openPanelInTab(firstTab, 'table');
    });

    system.shellSystem.openBlankTab();

    act(() => {
      system.shellSystem.activateTab(firstTab);
    });

    await act(async () => {
      await system.shellSystem.closeTab(firstTab);
    });

    const tabs = system.shellSystem.listTabs();

    expect(tabs.length).toBe(1);
    expect(tabs[0].typeId).toBeNull();
  });

  // 关闭最后一个标签后自动重建一个空白标签页
  it('关闭最后一个标签后重建一个空白标签页', async () => {
    const system = await createSystem();

    render(createElement(system.shellSystem.render()));

    const tabId = system.shellSystem.listTabs()[0].id;

    await act(async () => {
      await system.shellSystem.closeTab(tabId);
    });

    const tabs = system.shellSystem.listTabs();

    expect(tabs.length).toBe(1);
    expect(tabs[0].typeId).toBeNull();
  });

  // 重复的面板类型 id 被拒绝且不覆盖既有注册
  it('重复面板类型 id 被拒绝并记日志', async () => {
    const system = await createSystem();
    const panels: FakePanel[] = [];
    registerType(system, 'dup', 'A', panels);
    const errorSpy = vi.spyOn(logger, 'error');

    const result = system.shellSystem.registerPanelType({
      id: 'dup',
      name: 'B',
      icon: null,
      create: (param: IEditorPanelFactoryParam): IEditorPanel => new FakePanel(param.instanceId),
    });

    expect(result).toBe(false);
    expect(errorSpy).toHaveBeenCalledWith('shell.duplicatePanelType', 'dup');
    expect(system.shellSystem.listPanelTypes()[0].name).toBe('A');
    errorSpy.mockRestore();
  });

  // 零注册时外壳照常呈现菜单行、标签行与空白标签页
  it('零注册时仍渲染菜单行、标签行与空白标签页', async () => {
    const system = await createSystem();

    render(createElement(system.shellSystem.render()));

    expect(screen.getByLabelText('主菜单')).not.toBeNull();
    expect(screen.getByLabelText('编辑器标签页')).not.toBeNull();
    expect(screen.getByText('暂无可用面板')).not.toBeNull();
    expect(screen.getByText('尚未注册任何面板类型。')).not.toBeNull();
    expect(screen.getByRole('button', { name: '新建标签页' })).not.toBeNull();
  });

  // 注册类型后新建标签页会追加标签并激活它
  it('新建标签页追加标签并激活', async () => {
    const system = await createSystem();

    render(createElement(system.shellSystem.render()));

    const firstTab = system.shellSystem.listTabs()[0].id;
    const secondTab = system.shellSystem.openBlankTab();

    expect(system.shellSystem.listTabs().length).toBe(2);
    expect(secondTab).not.toBe(firstTab);
  });

  // 标签的打开 / 关闭 / 切换不写入撤销历史
  it('标签导航不写入撤销历史', async () => {
    const system = await createSystem();
    const panels: FakePanel[] = [];
    registerType(system, 'table', '表格面板', panels);
    const spy = vi.spyOn(system.undoSystem, 'addUndoContext');

    render(createElement(system.shellSystem.render()));

    const tabId = system.shellSystem.listTabs()[0].id;

    await act(async () => {
      await system.shellSystem.openPanelInTab(tabId, 'table');
    });

    const newTab = system.shellSystem.openBlankTab();

    system.shellSystem.activateTab(newTab);

    await act(async () => {
      await system.shellSystem.closeTab(newTab);
    });

    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  // 注销面板类型会关闭其全部实例与标签，且不再出现在类型列表
  it('注销面板类型关闭其全部实例与标签', async () => {
    const system = await createSystem();
    const panels: FakePanel[] = [];
    registerType(system, 'table', '表格面板', panels);

    render(createElement(system.shellSystem.render()));

    const firstTab = system.shellSystem.listTabs()[0].id;

    await act(async () => {
      await system.shellSystem.openPanelInTab(firstTab, 'table');
    });

    let secondTab = '';

    await act(async () => {
      secondTab = system.shellSystem.openBlankTab();
    });

    await act(async () => {
      await system.shellSystem.openPanelInTab(secondTab, 'table');
    });

    await act(async () => {
      await system.shellSystem.unregisterPanelType('table');
    });

    expect(panels[0].disposeCount).toBe(1);
    expect(panels[1].disposeCount).toBe(1);
    expect(system.shellSystem.listPanelTypes().length).toBe(0);
    expect(system.shellSystem.listTabs().every((tab) => tab.typeId === null)).toBe(true);
  });

  // 工厂抛错时拒绝打开且标签保持空白
  it('工厂抛错时拒绝打开且标签保持空白', async () => {
    const system = await createSystem();
    system.shellSystem.registerPanelType({
      id: 'broken',
      name: '坏面板',
      icon: null,
      create: (): IEditorPanel => {
        throw new Error('factory boom');
      },
    });
    const errorSpy = vi.spyOn(logger, 'error');

    render(createElement(system.shellSystem.render()));

    const tabId = system.shellSystem.listTabs()[0].id;
    let opened = true;

    await act(async () => {
      opened = await system.shellSystem.openPanelInTab(tabId, 'broken');
    });

    expect(opened).toBe(false);
    expect(system.shellSystem.listTabs()[0].typeId).toBeNull();
    expect(errorSpy).toHaveBeenCalledWith('shell.instanceCreateFailed', 'broken');
    errorSpy.mockRestore();
  });

  // 实例初始化未完成时内容区显示加载行
  it('实例初始化未完成时显示加载行', async () => {
    const system = await createSystem();
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const panel = new FakePanel('panel-a');

    panel.initializeGate = gate;
    system.shellSystem.registerPanelType({ id: 'slow', name: '慢面板', icon: null, create: () => panel });

    render(createElement(system.shellSystem.render()));

    const tabId = system.shellSystem.listTabs()[0].id;
    let opening: Promise<boolean> = Promise.resolve(false);

    await act(async () => {
      opening = system.shellSystem.openPanelInTab(tabId, 'slow');
    });

    expect(screen.getByText('加载中…')).not.toBeNull();

    await act(async () => {
      release();
      await opening;
    });

    expect(screen.getByText('panel-a')).not.toBeNull();
  });

  // 实例初始化失败时内容区显示错误态，标签保持可关闭
  it('实例初始化失败时显示错误态', async () => {
    const system = await createSystem();
    const panel = new FakePanel('panel-a');

    panel.initializeError = 'init boom';
    system.shellSystem.registerPanelType({ id: 'broken', name: '坏面板', icon: null, create: () => panel });

    render(createElement(system.shellSystem.render()));

    const tabId = system.shellSystem.listTabs()[0].id;
    const errorSpy = vi.spyOn(logger, 'error');

    await act(async () => {
      await system.shellSystem.openPanelInTab(tabId, 'broken');
    });

    expect(screen.getByText('面板打开失败')).not.toBeNull();
    expect(screen.getByText('请关闭此标签页后重试，或联系该面板的提供方。')).not.toBeNull();
    expect(system.shellSystem.listTabs()[0].typeId).toBe('broken');
    errorSpy.mockRestore();
  });
});

describe('ShellSystem 资源桥接', () => {
  // 资源更新经 ShellPanelHooks 重新申请并通知面板最新内容
  it('updateResource 通知面板最新内容', async () => {
    const system = await createSystem();
    const panels: FakePanel[] = [];
    registerType(system, 'table', '表格面板', panels);
    const id = Object.freeze({ type: 1, id: 'alpha', path: 'test' });

    system.injection.seed(id, 'v1');

    const tabId = system.shellSystem.listTabs()[0].id;

    await system.shellSystem.openPanelInTab(tabId, 'table');

    await system.resourceSystem.updateResource(id);

    expect(panels[0].updateResourceCount).toBe(1);
    expect(panels[0].lastUpdateId).toBe(id);
    expect(panels[0].lastUpdateData).toBe('v1');
  });

  // 资源列表更新经 ShellPanelHooks 重新申请并通知面板最新列表
  it('updateResourceList 通知面板最新列表', async () => {
    const system = await createSystem();
    const panels: FakePanel[] = [];
    registerType(system, 'table', '表格面板', panels);
    const id = Object.freeze({ type: 2, id: 'beta', path: 'test' });

    system.injection.seed(id, 'v1');

    const tabId = system.shellSystem.listTabs()[0].id;

    await system.shellSystem.openPanelInTab(tabId, 'table');

    await system.resourceSystem.updateResourceList(id.type);

    expect(panels[0].updateResourceListCount).toBe(1);
    expect(panels[0].lastUpdateType).toBe(id.type);
    expect(panels[0].lastUpdateList).toEqual([id]);
  });
});

describe('ShellSystem 外壳状态覆盖', () => {
  // 菜单标题、面板类型名与标签名均以文本节点渲染，含尖括号的输入不生成任何元素（防标记注入）
  it('外部文本以文本节点渲染且不生成元素', async () => {
    const system = await createSystem();
    const panels: FakePanel[] = [];

    system.shellSystem.registerMenuItem({ id: 'm1', title: '<b>menu</b>', onClick: (): void => {} });
    registerType(system, 'evil', '<img src=x onerror="alert(1)">', panels);

    const { container } = render(createElement(system.shellSystem.render()));

    expect(container.querySelector('.editor-shell-menu-item')?.textContent).toBe('<b>menu</b>');
    expect(container.querySelector('.editor-shell-blank-name')?.textContent).toBe('<img src=x onerror="alert(1)">');
    expect(container.querySelector('b')).toBeNull();
    expect(container.querySelector('img')).toBeNull();

    const tabId = system.shellSystem.listTabs()[0].id;

    await act(async () => {
      await system.shellSystem.openPanelInTab(tabId, 'evil');
    });

    expect(container.querySelector('.editor-shell-tab-label')?.textContent).toBe('<img src=x onerror="alert(1)">');
    expect(container.querySelector('img')).toBeNull();
  });

  // 菜单标题、标签名与类型名的完整文本暴露在元素 title 属性上
  it('菜单、标签与类型名的完整文本暴露在 title 上', async () => {
    const system = await createSystem();
    const panels: FakePanel[] = [];

    system.shellSystem.registerMenuItem({ id: 'm1', title: 'File Menu', onClick: (): void => {} });
    registerType(system, 'long', 'A Very Long Panel Name', panels);

    const { container } = render(createElement(system.shellSystem.render()));

    expect(container.querySelector('.editor-shell-menu-item')?.getAttribute('title')).toBe('File Menu');
    expect(container.querySelector('.editor-shell-blank-item')?.getAttribute('title')).toBe('A Very Long Panel Name');

    const tabId = system.shellSystem.listTabs()[0].id;

    await act(async () => {
      await system.shellSystem.openPanelInTab(tabId, 'long');
    });

    expect(container.querySelector('.editor-shell-tab-label')?.getAttribute('title')).toBe('A Very Long Panel Name');
  });

  // 菜单项、标签与类型名带单行省略所需的外壳类名，且标签行含 + 控件类名
  it('菜单项、标签与类型名带单行省略类名', async () => {
    const system = await createSystem();
    const panels: FakePanel[] = [];

    system.shellSystem.registerMenuItem({ id: 'm1', title: 'File Menu', onClick: (): void => {} });
    registerType(system, 'long', 'A Very Long Panel Name', panels);

    const { container } = render(createElement(system.shellSystem.render()));

    expect(container.querySelector('.editor-shell-menu-item')).not.toBeNull();
    expect(container.querySelector('.editor-shell-tab-label')).not.toBeNull();
    expect(container.querySelector('.editor-shell-tab-new')).not.toBeNull();
    expect(container.querySelector('.editor-shell-blank-name')).not.toBeNull();
  });

  // 空白标签页零类型时渲染空态标题与正文
  it('空白标签页零类型时显示空态文案', async () => {
    const system = await createSystem();

    const { container } = render(createElement(system.shellSystem.render()));

    expect(container.querySelector('.editor-shell-empty-heading')?.textContent).toBe('暂无可用面板');
    expect(container.querySelector('.editor-shell-empty-body')?.textContent).toBe('尚未注册任何面板类型。');
  });

  // 空白标签页类型列表按注册顺序一行一个类型渲染
  it('空白标签页类型列表按注册顺序渲染', async () => {
    const system = await createSystem();
    const panels: FakePanel[] = [];

    registerType(system, 'alpha', '甲类型', panels);
    registerType(system, 'beta', '乙类型', panels);
    registerType(system, 'gamma', '丙类型', panels);

    const { container } = render(createElement(system.shellSystem.render()));

    const rows = Array.from(container.querySelectorAll('.editor-shell-blank-item'));

    expect(rows.length).toBe(3);
    expect(rows.map((row) => row.textContent)).toEqual(['甲类型', '乙类型', '丙类型']);
  });

  // 菜单行为空时仍渲染固定菜单行，但没有任何菜单项
  it('菜单行为空时仍渲染空菜单行', async () => {
    const system = await createSystem();

    const { container } = render(createElement(system.shellSystem.render()));

    const menu = container.querySelector('.editor-shell-menu');

    expect(menu).not.toBeNull();
    expect(menu?.querySelectorAll('.editor-shell-menu-item').length).toBe(0);
  });

  // 标签行始终含 + 控件；标签数量增长到溢出后 + 仍然存在
  it('标签行始终含 + 控件且多标签溢出时仍存在', async () => {
    const system = await createSystem();

    const { container } = render(createElement(system.shellSystem.render()));

    expect(screen.getByRole('button', { name: '新建标签页' })).not.toBeNull();

    await act(async () => {
      for (let index = 0; index < 30; index += 1) system.shellSystem.openBlankTab();
    });

    expect(container.querySelectorAll('.editor-shell-tab').length).toBe(31);
    expect(container.querySelector('.editor-shell-tab-new')?.getAttribute('aria-label')).toBe('新建标签页');
  });
});
