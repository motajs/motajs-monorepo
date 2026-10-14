import './shell.css';
import { Store } from '@tanstack/store';
import { createElement, FC, ReactElement, useEffect, useSyncExternalStore } from 'react';
import { IHookController } from '../hook';
import { logger } from '../log';
import { IEditorPanel, IEditorPanelContext, IEditorPanelType, PanelContext } from '../panel';
import { IResourceIdentifier, IResourceSystemAccess, IResourceSystemHooks } from '../resource';
import { IUndoSystem } from '../undo';
import { IEditorMenuItem, IEditorTab, IShellSystem } from './types';

// 浏览器式外壳的唯一实现：统管面板类型注册表、面板实例生命周期、标签状态机、菜单项与渲染根。
// 所有的状态都保存在实例字段内，模块层只放纯函数组件，因此不产生任何模块级可变绑定。

/** 面板实例的初始化状态 */
const enum ShellInstanceStatus {
  /** 工厂已创建、IEditorPanel.initialize 尚未完成 */
  Loading,
  /** 初始化完成，可正常渲染 */
  Ready,
  /** 创建或初始化失败，标签内呈现错误态 */
  Error,
}

/** 全局撤销 / 重做快捷键的语义 */
const enum UndoRedoShortcut {
  /** 触发撤销 */
  Undo,
  /** 触发重做 */
  Redo,
  /** 与撤销 / 重做无关的按键 */
  None,
}

/** 一次面板实例创建的产物：core 生成的实例 id 与其面板实例 */
interface ICreatedPanel {
  /** core 生成的唯一实例 id */
  readonly instanceId: string;
  /** 创建出的面板实例 */
  readonly instance: IEditorPanel;
}

/** 外壳渲染所依赖的一次性缓存视图状态 */
interface IShellViewState {
  /** 当前活动标签 id */
  readonly activeTabId: string | null;
  /** 当前全部标签 */
  readonly tabs: readonly IEditorTab[];
  /** 当前全部菜单项 */
  readonly menuItems: readonly IEditorMenuItem[];
  /** 当前全部面板类型 */
  readonly panelTypes: readonly IEditorPanelType[];
  /** 活动标签承载的面板实例，空白标签或无实例时为空 */
  readonly activePanel: IEditorPanel | null;
  /** 活动面板实例的初始化状态 */
  readonly activePanelStatus: ShellInstanceStatus;
}

/** 外壳根组件的 props */
interface IShellRootProps {
  /** 外壳系统，供各区域触发交互 */
  readonly system: IShellSystem;
  /** 订阅外壳状态变更 */
  readonly subscribe: (listener: () => void) => () => void;
  /** 读取外壳视图状态快照 */
  readonly getSnapshot: () => IShellViewState;
  /** 按实例 id 取面板实例，供标签解析按实例标题 */
  readonly getPanel: (instanceId: string) => IEditorPanel | undefined;
  /** 触发撤销系统的撤销 */
  readonly onUndo: () => void;
  /** 触发撤销系统的重做 */
  readonly onRedo: () => void;
}

/** 菜单行组件的 props */
interface IMenuRowProps {
  /** 外壳系统 */
  readonly system: IShellSystem;
  /** 要渲染的菜单项，按注册顺序 */
  readonly items: readonly IEditorMenuItem[];
}

/** 标签行组件的 props */
interface ITabRowProps {
  /** 外壳系统 */
  readonly system: IShellSystem;
  /** 要渲染的标签，按打开顺序 */
  readonly tabs: readonly IEditorTab[];
  /** 当前活动标签 id */
  readonly activeTabId: string | null;
  /** 用于解析标签显示名的面板类型 */
  readonly panelTypes: readonly IEditorPanelType[];
  /** 按实例 id 取面板实例，供标签解析按实例标题 */
  readonly getPanel: (instanceId: string) => IEditorPanel | undefined;
}

/** 内容区组件的 props */
interface IContentAreaProps {
  /** 外壳系统 */
  readonly system: IShellSystem;
  /** 可打开的面板类型 */
  readonly panelTypes: readonly IEditorPanelType[];
  /** 当前活动标签，无标签时为空 */
  readonly activeTab: IEditorTab | null;
  /** 活动标签承载的面板实例 */
  readonly activePanel: IEditorPanel | null;
  /** 活动面板实例的初始化状态 */
  readonly activePanelStatus: ShellInstanceStatus;
}

/** 空白标签页类型列表组件的 props */
interface IBlankTabListProps {
  /** 外壳系统 */
  readonly system: IShellSystem;
  /** 可打开的面板类型 */
  readonly panelTypes: readonly IEditorPanelType[];
  /** 承载此列表的标签 id，无标签时为空 */
  readonly tabId: string | null;
}

/** 单个面板实例宿主组件的 props */
interface IPanelHostProps {
  /** 要渲染的面板实例 */
  readonly instance: IEditorPanel | null;
  /** 面板实例的初始化状态 */
  readonly status: ShellInstanceStatus;
}

/**
 * 解析标签的显示名：空白标签为固定文案；有实例且实例给出非空标题时用该标题，否则取面板类型名
 * @param tab 目标标签
 * @param panelTypes 已注册的面板类型
 * @param getPanel 按实例 id 取面板实例的解析器
 * @returns 标签显示名
 */
function resolveTabName(
  tab: IEditorTab,
  panelTypes: readonly IEditorPanelType[],
  getPanel: (instanceId: string) => IEditorPanel | undefined,
): string {
  if (tab.typeId === null) return '空白标签页';

  if (tab.instanceId !== null) {
    const panel = getPanel(tab.instanceId);

    if (panel !== undefined) {
      const title = panel.getTitle?.();

      if (title !== undefined && title !== '') return title;
    }
  }

  const type = panelTypes.find((item) => item.id === tab.typeId);

  return type === undefined ? tab.typeId : type.name;
}

/**
 * 把一次键盘事件解析为撤销 / 重做 / 无关：仅当按下 Ctrl 或 Meta（macOS 的 Cmd）时才判定；「z」不带 Shift 为撤销、带 Shift 为重做，「y」为重做
 * @param event 待解析的键盘事件
 * @returns 该事件对应的快捷键语义
 */
function resolveUndoRedoShortcut(event: KeyboardEvent): UndoRedoShortcut {
  if (!event.ctrlKey && !event.metaKey) return UndoRedoShortcut.None;

  const key = event.key.toLowerCase();

  if (key === 'z') return event.shiftKey ? UndoRedoShortcut.Redo : UndoRedoShortcut.Undo;
  if (key === 'y') return UndoRedoShortcut.Redo;

  return UndoRedoShortcut.None;
}

/**
 * 渲染顶部菜单行：按注册顺序排列菜单项按钮；零菜单项时仍渲染空行
 * @param props 菜单行 props
 * @returns 菜单行元素
 */
function MenuRow(props: IMenuRowProps): ReactElement {
  const buttons = props.items.map((item) =>
    createElement(
      'button',
      {
        key: item.id,
        type: 'button',
        className: 'editor-shell-menu-item',
        title: item.title,
        onClick: item.onClick,
      },
      item.title,
    ),
  );

  return createElement('nav', { className: 'editor-shell-menu', 'aria-label': '主菜单' }, buttons);
}

/**
 * 渲染标签行：每个标签一个标签按钮与关闭按钮，末尾固定一个新建标签按钮
 * @param props 标签行 props
 * @returns 标签行元素
 */
function TabRow(props: ITabRowProps): ReactElement {
  const tabs = props.tabs.map((tab) => {
    const name = resolveTabName(tab, props.panelTypes, props.getPanel);
    const closeLabel = tab.typeId === null ? '关闭空白标签页' : `关闭「${name}」`;
    const isActive = tab.id === props.activeTabId;

    return createElement(
      'span',
      { key: tab.id, className: isActive ? 'editor-shell-tab is-active' : 'editor-shell-tab' },
      createElement(
        'button',
        {
          type: 'button',
          className: 'editor-shell-tab-label',
          title: name,
          'aria-label': name,
          'aria-current': isActive,
          onClick: () => props.system.activateTab(tab.id),
        },
        name,
      ),
      createElement(
        'button',
        {
          type: 'button',
          className: 'editor-shell-tab-close',
          title: closeLabel,
          'aria-label': closeLabel,
          onClick: (event) => {
            event.stopPropagation();
            void props.system.closeTab(tab.id);
          },
        },
        '×',
      ),
    );
  });
  const newTab = createElement(
    'button',
    {
      type: 'button',
      className: 'editor-shell-tab-new',
      title: '新建标签页',
      'aria-label': '新建标签页',
      onClick: () => props.system.openBlankTab(),
    },
    '+',
  );

  return createElement('nav', { className: 'editor-shell-tabs', 'aria-label': '编辑器标签页' }, tabs, newTab);
}

/**
 * 渲染单个面板实例宿主：初始化中显示加载行、失败显示错误文案、就绪则渲染实例组件
 * @param props 面板宿主 props
 * @returns 面板宿主元素
 */
function PanelHost(props: IPanelHostProps): ReactElement {
  if (props.instance === null || props.status === ShellInstanceStatus.Error) {
    return createElement(
      'div',
      { className: 'editor-shell-error' },
      createElement('div', { className: 'editor-shell-error-title' }, '面板打开失败'),
      createElement('div', { className: 'editor-shell-error-body' }, '请关闭此标签页后重试，或联系该面板的提供方。'),
    );
  }

  if (props.status === ShellInstanceStatus.Loading) {
    return createElement('div', { className: 'editor-shell-loading' }, '加载中…');
  }

  return createElement(props.instance.render());
}

/**
 * 渲染空白标签页内的面板类型列表；零类型时显示空态文案
 * @param props 空白标签页列表 props
 * @returns 面板类型列表或空态元素
 */
function BlankTabList(props: IBlankTabListProps): ReactElement {
  if (props.panelTypes.length === 0) {
    return createElement(
      'div',
      { className: 'editor-shell-empty' },
      createElement('div', { className: 'editor-shell-empty-heading' }, '暂无可用面板'),
      createElement('div', { className: 'editor-shell-empty-body' }, '尚未注册任何面板类型。'),
    );
  }

  const rows = props.panelTypes.map((type) =>
    createElement(
      'button',
      {
        key: type.id,
        type: 'button',
        className: 'editor-shell-blank-item',
        title: type.name,
        onClick: (): void => {
          if (props.tabId !== null) void props.system.openPanelInTab(props.tabId, type.id);
        },
      },
      createElement('span', { className: 'editor-shell-blank-icon', 'aria-hidden': true }, type.icon ?? null),
      createElement('span', { className: 'editor-shell-blank-name' }, type.name),
    ),
  );

  return createElement(
    'div',
    { className: 'editor-shell-blank' },
    createElement('div', { className: 'editor-shell-blank-heading' }, '选择面板类型'),
    createElement('div', { className: 'editor-shell-blank-list' }, rows),
  );
}

/**
 * 渲染内容区：活动标签为空白时显示类型列表，否则显示对应面板实例
 * @param props 内容区 props
 * @returns 内容区元素
 */
function ContentArea(props: IContentAreaProps): ReactElement {
  const activeTab = props.activeTab;
  const inner =
    activeTab === null || activeTab.typeId === null
      ? createElement(BlankTabList, {
          system: props.system,
          panelTypes: props.panelTypes,
          tabId: activeTab === null ? null : activeTab.id,
        })
      : createElement(PanelHost, { instance: props.activePanel, status: props.activePanelStatus });

  return createElement('div', { className: 'editor-shell-content' }, inner);
}

/**
 * 外壳根组件：订阅状态变更并组织菜单行、标签行与内容区
 * @param props 外壳根 props
 * @returns 外壳元素
 */
function ShellRoot(props: IShellRootProps): ReactElement {
  const view = useSyncExternalStore(props.subscribe, props.getSnapshot);
  const onUndo = props.onUndo;
  const onRedo = props.onRedo;
  const activeTab = view.tabs.find((tab) => tab.id === view.activeTabId) ?? null;

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      const decision = resolveUndoRedoShortcut(event);

      if (decision === UndoRedoShortcut.Undo) {
        event.preventDefault();
        onUndo();
      } else if (decision === UndoRedoShortcut.Redo) {
        event.preventDefault();
        onRedo();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onUndo, onRedo]);

  return createElement(
    'div',
    { className: 'editor-shell' },
    createElement(MenuRow, { system: props.system, items: view.menuItems }),
    createElement(TabRow, {
      system: props.system,
      tabs: view.tabs,
      activeTabId: view.activeTabId,
      panelTypes: view.panelTypes,
      getPanel: props.getPanel,
    }),
    createElement(ContentArea, {
      system: props.system,
      panelTypes: view.panelTypes,
      activeTab,
      activePanel: view.activePanel,
      activePanelStatus: view.activePanelStatus,
    }),
  );
}

export class ShellSystem implements IShellSystem {
  /** 面板类型注册表：类型 id 到面板类型 */
  private readonly panelTypes: Map<string, IEditorPanelType> = new Map();
  /** 面板实例注册表：实例 id 到实例 */
  private readonly instances: Map<string, IEditorPanel> = new Map();
  /** 实例 id 到其面板类型 id 的映射 */
  private readonly instanceTypes: Map<string, string> = new Map();
  /** 实例 id 到其资源钩子控制器的映射 */
  private readonly hooks: Map<string, IHookController<IResourceSystemHooks>> = new Map();
  /** 实例 id 到其初始化状态的映射 */
  private readonly instanceStatuses: Map<string, ShellInstanceStatus> = new Map();
  /** 尚未初始化、待补初始化调用的面板实例 */
  private readonly pendingInstances: ICreatedPanel[] = [];
  /** 菜单项注册表，保持注册顺序 */
  private readonly menuItems: IEditorMenuItem[] = [];
  /** 标签列表，保持打开顺序 */
  private tabs: IEditorTab[] = [];
  /** 当前活动标签 id */
  private activeTabId: string | null = null;
  /** 最近一次投递过切入通知的面板实例 id，用于判定活动面板是否真正变化 */
  private lastActiveInstanceId: string | null = null;
  /** 面板实例 id 计数器，会话内递增、不复用 */
  private instanceCounter: number = 0;
  /** 标签 id 计数器，会话内递增、不复用 */
  private tabCounter: number = 0;
  /** 是否已完成初始化 */
  private initialized: boolean = false;
  /** 是否已释放 */
  private disposed: boolean = false;
  /** 缓存的视图状态，仅在状态变更时重建以保证引用稳定 */
  private snapshot: IShellViewState;
  /** 版本源，仅用于通知订阅者重渲染 */
  private readonly versionStore: Store<number> = new Store(0);
  /** 订阅状态变更，供 useSyncExternalStore 使用 */
  private readonly subscribe: (listener: () => void) => () => void;
  /** 读取视图状态快照，供 useSyncExternalStore 使用 */
  private readonly getSnapshot: () => IShellViewState;
  /** 按实例 id 取面板实例的解析器，供标签解析按实例标题 */
  private readonly getPanel: (instanceId: string) => IEditorPanel | undefined;
  /** 触发撤销系统的撤销，供外壳根的全局快捷键调用 */
  private readonly onUndo: () => void;
  /** 触发撤销系统的重做，供外壳根的全局快捷键调用 */
  private readonly onRedo: () => void;
  /** 撤回系统 */
  private readonly undoSystem: IUndoSystem;
  /** 资源系统 */
  private readonly resourceSystem: IResourceSystemAccess;
  /** 缓存一次的渲染根组件，避免每次 render() 返回新组件导致反复重挂 */
  private readonly RootComponent: FC;

  constructor(undoSystem: IUndoSystem, resourceSystem: IResourceSystemAccess) {
    this.undoSystem = undoSystem;
    this.resourceSystem = resourceSystem;
    this.snapshot = this.buildViewState();
    this.subscribe = (listener) => this.versionStore.subscribe(listener);
    this.getSnapshot = () => this.snapshot;
    this.getPanel = (instanceId) => this.instances.get(instanceId);
    this.onUndo = () => void this.undoSystem.undo();
    this.onRedo = () => void this.undoSystem.redo();
    this.RootComponent = () =>
      createElement(ShellRoot, {
        system: this,
        subscribe: this.subscribe,
        getSnapshot: this.getSnapshot,
        getPanel: this.getPanel,
        onUndo: this.onUndo,
        onRedo: this.onRedo,
      });
  }

  async initialize(): Promise<void> {
    if (this.initialized || this.disposed) return;

    this.initialized = true;

    if (this.tabs.length === 0) this.openBlankTab();

    const pending = this.pendingInstances.splice(0);

    for (const created of pending) await this.initializeInstance(created);
  }

  registerPanelType(type: IEditorPanelType): boolean {
    if (!type || !type.id || !type.name || typeof type.create !== 'function') {
      logger.error('shell.invalidPanelType', type ? type.id : '');
      return false;
    }

    if (this.panelTypes.has(type.id)) {
      logger.error('shell.duplicatePanelType', type.id);
      return false;
    }

    this.panelTypes.set(type.id, type);
    this.notify();
    return true;
  }

  async unregisterPanelType(typeId: string): Promise<void> {
    if (!this.panelTypes.has(typeId)) {
      logger.error('shell.panelTypeNotRegistered', typeId);
      return;
    }

    const tabIds = this.tabs.filter((tab) => tab.typeId === typeId).map((tab) => tab.id);

    for (const tabId of tabIds) await this.closeTab(tabId);

    const leftover = [...this.instanceTypes.entries()].filter((entry) => entry[1] === typeId).map((entry) => entry[0]);

    for (const instanceId of leftover) await this.closePanelInstance(instanceId);

    this.panelTypes.delete(typeId);
    this.notify();
  }

  listPanelTypes(): readonly IEditorPanelType[] {
    return [...this.panelTypes.values()];
  }

  async createPanelInstance(typeId: string, openParam?: Record<string, unknown>): Promise<IEditorPanel | null> {
    const created = this.createInstance(typeId, openParam);

    if (created === null) return null;

    await this.initializeInstance(created);
    return created.instance;
  }

  async closePanelInstance(instanceId: string): Promise<void> {
    const instance = this.instances.get(instanceId);

    if (instance === undefined) return;

    this.hooks.get(instanceId)?.unload();
    this.hooks.delete(instanceId);
    this.instances.delete(instanceId);
    this.instanceTypes.delete(instanceId);
    this.instanceStatuses.delete(instanceId);

    await instance.dispose();
    this.notify();
  }

  registerMenuItem(item: IEditorMenuItem): boolean {
    if (!item || !item.id || !item.title || typeof item.onClick !== 'function') return false;

    if (this.menuItems.some((existing) => existing.id === item.id)) {
      logger.error('shell.duplicateMenuItem', item.id);
      return false;
    }

    this.menuItems.push(item);
    this.notify();
    return true;
  }

  unregisterMenuItem(itemId: string): void {
    const index = this.menuItems.findIndex((item) => item.id === itemId);

    if (index === -1) return;

    this.menuItems.splice(index, 1);
    this.notify();
  }

  listMenuItems(): readonly IEditorMenuItem[] {
    return [...this.menuItems];
  }

  openBlankTab(): string {
    this.tabCounter += 1;
    const tabId = `tab-${this.tabCounter}`;

    this.tabs.push({ id: tabId, typeId: null, instanceId: null });
    this.activeTabId = tabId;
    this.notify();
    this.syncActiveInstance();
    return tabId;
  }

  async openPanelInTab(tabId: string, typeId: string, openParam?: Record<string, unknown>): Promise<boolean> {
    const index = this.tabs.findIndex((tab) => tab.id === tabId);

    if (index === -1) {
      logger.error('shell.tabNotFound', tabId);
      return false;
    }

    const current = this.tabs[index];

    if (current.instanceId !== null) {
      if (this.activeTabId === current.id) this.leaveActiveInstance(current.instanceId);
      await this.closePanelInstance(current.instanceId);
    }

    const created = this.createInstance(typeId, openParam);

    if (created === null) return false;

    this.tabs[index] = { id: current.id, typeId, instanceId: created.instanceId };
    this.activeTabId = current.id;
    this.notify();
    await this.initializeInstance(created);
    return true;
  }

  async closeTab(tabId: string): Promise<void> {
    const index = this.tabs.findIndex((tab) => tab.id === tabId);

    if (index === -1) {
      logger.error('shell.tabNotFound', tabId);
      return;
    }

    const tab = this.tabs[index];
    const wasActive = this.activeTabId === tabId;

    if (tab.instanceId !== null) {
      if (wasActive) this.leaveActiveInstance(tab.instanceId);
      await this.closePanelInstance(tab.instanceId);
    }

    this.tabs.splice(index, 1);

    if (this.tabs.length === 0) {
      this.openBlankTab();
      return;
    }

    if (!wasActive) {
      this.notify();
      return;
    }

    const neighborIndex = index - 1 >= 0 ? index - 1 : index;

    this.activeTabId = this.tabs[neighborIndex].id;
    this.notify();
    this.syncActiveInstance();
  }

  activateTab(tabId: string): void {
    const exists = this.tabs.some((tab) => tab.id === tabId);

    if (!exists) {
      logger.error('shell.tabNotFound', tabId);
      return;
    }

    this.activeTabId = tabId;
    this.notify();
    this.syncActiveInstance();
  }

  listTabs(): readonly IEditorTab[] {
    return [...this.tabs];
  }

  render(): FC {
    return this.RootComponent;
  }

  async dispose(): Promise<void> {
    const instanceIds = [...this.instances.keys()].reverse();

    for (const instanceId of instanceIds) await this.closePanelInstance(instanceId);

    this.pendingInstances.length = 0;
    this.tabs = [];
    this.activeTabId = null;
    this.lastActiveInstanceId = null;
    this.initialized = false;
    this.disposed = true;
    this.notify();
  }

  /**
   * 同步创建一个面板实例：解析类型、生成实例 id、调用工厂、登记实例并挂载资源钩子
   * @param typeId 面板类型标识符
   * @param openParam 打开面板时顺带携带的可选参数；未提供时省略工厂入参的该键
   * @returns 创建产物，类型未注册或工厂抛错时为 null
   */
  private createInstance(typeId: string, openParam?: Record<string, unknown>): ICreatedPanel | null {
    const type = this.panelTypes.get(typeId);

    if (type === undefined) {
      logger.error('shell.panelTypeNotRegistered', typeId);
      return null;
    }

    this.instanceCounter += 1;
    const instanceId = `instance-${this.instanceCounter}`;
    const context = new PanelContext(this.resourceSystem, this.undoSystem);
    let instance: IEditorPanel;

    try {
      instance = type.create(openParam === undefined ? { context, instanceId } : { context, instanceId, openParam });
    } catch {
      logger.error('shell.instanceCreateFailed', typeId);
      return null;
    }

    this.instances.set(instanceId, instance);
    this.instanceTypes.set(instanceId, typeId);
    this.instanceStatuses.set(instanceId, ShellInstanceStatus.Loading);
    this.hooks.set(instanceId, this.resourceSystem.addHook(new ShellPanelHooks(instance, context)));
    this.notify();
    return { instanceId, instance };
  }

  /**
   * 初始化面板实例：外壳已初始化时直接调用其 initialize 并记录状态，否则入待初始化列表
   * @param created 面板实例创建产物
   */
  private async initializeInstance(created: ICreatedPanel): Promise<void> {
    if (!this.initialized) {
      this.pendingInstances.push(created);
      return;
    }

    try {
      await created.instance.initialize();
      this.instanceStatuses.set(created.instanceId, ShellInstanceStatus.Ready);
    } catch {
      this.instanceStatuses.set(created.instanceId, ShellInstanceStatus.Error);
      logger.error('shell.instanceCreateFailed', this.instanceTypes.get(created.instanceId) ?? '');
    }

    this.notify();
    this.syncActiveInstance();
  }

  /**
   * 由当前注册表与标签状态重建视图状态快照并通知订阅者重渲染
   */
  private notify(): void {
    this.snapshot = this.buildViewState();
    this.versionStore.setState((version) => version + 1);
  }

  /**
   * 由当前注册表与标签状态构造一份新的视图状态
   * @returns 新的视图状态
   */
  private buildViewState(): IShellViewState {
    const activeTab = this.tabs.find((tab) => tab.id === this.activeTabId) ?? null;
    const instanceId = activeTab === null ? null : activeTab.instanceId;
    const activePanel = instanceId === null ? null : (this.instances.get(instanceId) ?? null);
    const activePanelStatus =
      instanceId === null
        ? ShellInstanceStatus.Ready
        : (this.instanceStatuses.get(instanceId) ?? ShellInstanceStatus.Ready);

    return {
      activeTabId: this.activeTabId,
      tabs: [...this.tabs],
      menuItems: [...this.menuItems],
      panelTypes: [...this.panelTypes.values()],
      activePanel,
      activePanelStatus,
    };
  }

  /**
   * 读取当前活动标签承载的面板实例 id
   * @returns 活动面板实例 id；活动标签为空白、无实例或无标签时为空
   */
  private activeInstanceId(): string | null {
    const activeTab = this.tabs.find((tab) => tab.id === this.activeTabId);

    return activeTab === undefined ? null : activeTab.instanceId;
  }

  /**
   * 在活动面板即将被销毁时立即中断其切入状态：清空记录并向该面板投递切出通知
   * @param instanceId 即将销毁的面板实例 id
   */
  private leaveActiveInstance(instanceId: string): void {
    this.lastActiveInstanceId = null;
    void this.invokeSwitchOut(instanceId);
  }

  /**
   * 将活动面板与最近一次切入通知对齐：目标变化时对离开的面板投递切出、对进入的面板投递切入
   * 目标面板仍在初始化时不投递，待其初始化完成由 initializeInstance 再次对齐
   */
  private syncActiveInstance(): void {
    const nextInstanceId = this.activeInstanceId();

    if (nextInstanceId === this.lastActiveInstanceId) return;

    if (nextInstanceId !== null && this.instanceStatuses.get(nextInstanceId) === ShellInstanceStatus.Loading) return;

    const previousInstanceId = this.lastActiveInstanceId;

    this.lastActiveInstanceId = nextInstanceId;

    if (previousInstanceId !== null) void this.invokeSwitchOut(previousInstanceId);
    if (nextInstanceId !== null) void this.invokeSwitchIn(nextInstanceId);
  }

  /**
   * 向指定面板投递切入通知；单个面板抛错不影响外壳的标签状态机
   * @param instanceId 目标面板实例 id
   */
  private async invokeSwitchIn(instanceId: string): Promise<void> {
    const instance = this.instances.get(instanceId);

    if (instance === undefined) return;

    try {
      await instance.onSwitchIn();
    } catch {
      logger.error('shell.callbackFailed', this.instanceTypes.get(instanceId) ?? '');
    }
  }

  /**
   * 向指定面板投递切出通知；单个面板抛错不影响外壳的标签状态机
   * @param instanceId 目标面板实例 id
   */
  private async invokeSwitchOut(instanceId: string): Promise<void> {
    const instance = this.instances.get(instanceId);

    if (instance === undefined) return;

    try {
      await instance.onSwitchOut();
    } catch {
      logger.error('shell.callbackFailed', this.instanceTypes.get(instanceId) ?? '');
    }
  }
}

export class ShellPanelHooks implements IResourceSystemHooks {
  /** 钩子所属的面板实例 */
  private readonly panel: IEditorPanel;
  /** 面板侧上下文，用于重新申请资源 */
  private readonly context: IEditorPanelContext;

  constructor(panel: IEditorPanel, context: IEditorPanelContext) {
    this.panel = panel;
    this.context = context;
  }

  async onUpdateResource(id: IResourceIdentifier): Promise<void> {
    const resource = await this.context.requestResource(id);

    if (!resource) return;

    const data = await resource.request();

    if (data === undefined) return;

    await this.panel.onUpdateResource(id, data);
  }

  async onUpdateResourceList(type: number): Promise<void> {
    await this.panel.onUpdateResourceList(type, await this.context.requestResourceList(type));
  }
}
