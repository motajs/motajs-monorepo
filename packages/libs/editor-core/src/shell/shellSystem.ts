import './shell.css';
import { Store } from '@tanstack/store';
import { createElement, FC, ReactElement, useEffect, useSyncExternalStore } from 'react';
import { EditorFileChangeKind } from '../fs';
import { IHookController } from '../hook';
import { logger } from '../log';
import { IEditorPanel, IEditorPanelContext, IEditorPanelType, PanelCloseChoice, PanelContext } from '../panel';
import { IResourceIdentifier, IResourceSystemAccess, IResourceSystemHooks } from '../resource';
import { IUndoSystem } from '../undo';
import { IEditorMenuItem, IEditorTab, IShellSystem } from './types';

// 浏览器式外壳的唯一实现：统管面板类型注册表、面板实例生命周期、标签状态机、菜单项与渲染根。
// 所有的状态都保存在实例字段内，模块层只放纯函数组件，因此不产生任何模块级可变绑定。

/**
 * 把一条打开路径归一成去重键：去掉全部前导 `/`、折叠重复的 `/`、去掉尾随 `/`
 *
 * 只做这三件事，**不**解析 `.` / `..`（资源层已保证路径里没有这些段）。
 * 空串归一后仍是空串，调用方据此判定「这次打开没有路径」，绝不把空串当登记键。
 * 登记与查找共用这一个函数，`/foo` 与 `foo` 因此命中同一个标签。
 * @param path 调用方传入的文件路径
 * @returns 归一后的去重键
 */
function normalizeResourcePath(path: string): string {
  return path
    .replace(/\/{2,}/g, '/')
    .replace(/^\/+/, '')
    .replace(/\/+$/, '');
}

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
  /** 现在是否还有内容在等待写盘；右上角提示据此显示 */
  readonly hasPendingWrite: boolean;
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
  /** 现在是否还有内容在等待写盘；右上角提示据此显示 */
  readonly hasPendingWrite: boolean;
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
 * 渲染顶部菜单行：按注册顺序排列菜单项按钮，有待写时在末尾追加一条固定文案的提示；零菜单项时仍渲染空行
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

  // 无待写时传 null 而不是空串：空串元素会一直占位，让「有待写」的断言永远成立
  const pending = props.hasPendingWrite
    ? createElement(
        'span',
        { className: 'editor-shell-pending', 'data-test-id': 'editor-shell-pending' },
        '正在等待保存，请勿关闭页面或浏览器',
      )
    : null;

  return createElement('nav', { className: 'editor-shell-menu', 'aria-label': '主菜单' }, buttons, pending);
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
          onClick: (): void => void props.system.activateTab(tab.id),
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
    createElement(MenuRow, {
      system: props.system,
      items: view.menuItems,
      hasPendingWrite: view.hasPendingWrite,
    }),
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
  /** 刚建出来、还没被 `ShellSystem.openPanelInTab` 领走的空白标签 id；没有时为 null */
  private stagedBlankTabId: string | null = null;
  /** 标签 id 到它当前显示的全部文件路径（已归一）的登记表：按路径去重的唯一数据来源 */
  private readonly tabPaths: Map<string, ReadonlySet<string>> = new Map();
  /** 最近一次投递过切入通知的面板实例 id，用于判定活动面板是否真正变化 */
  private lastActiveInstanceId: string | null = null;
  /** 串行切换链：切出与切入按投递顺序依次结算，链本身永不 reject */
  private switchChain: Promise<void> = Promise.resolve();
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
  /** 「有没有待写」变化的钩子控制器：待写出现 / 消失时刷新视图状态；未注册时为空 */
  private pendingChangeHook: IHookController<IResourceSystemHooks> | null = null;
  /** 关闭页面时的 window 监听器：有待写就弹浏览器原生确认并尽力发起一次写盘；未注册时为空 */
  private beforeUnloadHandler: ((event: BeforeUnloadEvent) => void) | null = null;
  /** 页面即将卸载 / 进往返缓存时的 window 监听器：尽力发起一次写盘；未注册时为空 */
  private pageHideHandler: (() => void) | null = null;
  /** 窗口失焦时的 window 监听器：尽力发起一次写盘；未注册时为空 */
  private windowBlurHandler: (() => void) | null = null;
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

    // 待写出现 / 消失不会经过 notify()：资源层只在这条钩子里报「有无变化」，外壳收到后重建视图状态，
    // 否则右上角提示永远不出现。重复初始化时先注销再挂，保证只有一条订阅
    this.pendingChangeHook?.unload();
    this.pendingChangeHook = this.resourceSystem.addHook({
      onPendingChange: async (): Promise<void> => {
        this.notify();
      },
    });

    // 页面级事件只挂在 window 上（禁止 document）；重复初始化时先注销再注册，保证只有一条监听
    if (this.beforeUnloadHandler !== null) window.removeEventListener('beforeunload', this.beforeUnloadHandler);
    if (this.pageHideHandler !== null) window.removeEventListener('pagehide', this.pageHideHandler);
    if (this.windowBlurHandler !== null) window.removeEventListener('blur', this.windowBlurHandler);

    this.beforeUnloadHandler = (event: BeforeUnloadEvent): void => {
      if (!this.resourceSystem.hasAnyPendingContent()) return;

      // 浏览器不允许在这里 await 异步写盘：处理函数返回后页面就继续卸载，因此这里只做两件事——
      // 弹原生确认（两个属性都写，缺一个可能不弹框），再「发起」一次写盘，不承诺写完
      event.preventDefault();
      event.returnValue = '';
      void this.flushPendingContent();
    };
    this.pageHideHandler = (): void => {
      void this.flushPendingContent();
    };
    this.windowBlurHandler = (): void => {
      void this.flushPendingContent();
    };

    window.addEventListener('beforeunload', this.beforeUnloadHandler);
    window.addEventListener('pagehide', this.pageHideHandler);
    window.addEventListener('blur', this.windowBlurHandler);

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

    for (const tabId of tabIds) await this.discardTab(tabId, false);

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

    // 释放前必须等所有尚未结算的落盘：标签替换、注销面板类型、释放 core 都经由这里释放实例
    await this.switchChain;

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

  /**
   * 切标签的保存前缀：在改活动标签与通知 React 之前，先等即将离开的面板切出结算
   *
   * 整段「判定 + 切出」排在串行切换链上执行，因此并发切换（连点两个标签、新建标签与标签内打开撞在一起）
   * 会依次执行，后一个永远等前一个保存完。判定必须在链节点**执行时**才读 `lastActiveInstanceId`：
   * 两个并发调用先后入链时，第二个节点看到的已经是前一个清空后的记录，同一面板因此不会被保存两次。
   * 顺序是这条方法的全部意义：保存没结算就通知 React，旧组件会先卸载，面板就拿不到组件里的草稿。
   * @param nextInstanceId 切换后将成为活动的面板实例 id；目标标签为空白时为 null
   * @returns 该次切出结算完成时 resolve
   */
  private departActiveInstance(nextInstanceId: string | null): Promise<void> {
    const step = this.switchChain.then(async (): Promise<void> => {
      const previousInstanceId = this.lastActiveInstanceId;

      if (previousInstanceId === nextInstanceId) return;

      this.lastActiveInstanceId = null;

      if (previousInstanceId !== null) await this.invokeSwitchOut(previousInstanceId);
    });

    this.switchChain = step.catch((): void => {});
    return step;
  }

  /**
   * 反查哪个标签已经把这条路径开在手里：路径去重的唯一判据
   * @param path 已归一的去重键
   * @returns 登记了该路径的标签 id；没有标签登记时为 undefined
   */
  private findTabByPath(path: string): string | undefined {
    for (const [tabId, registered] of this.tabPaths) {
      if (registered.has(path)) return tabId;
    }

    return undefined;
  }

  /**
   * 找打开顺序最早、承载指定面板类型的标签：复用的唯一判据
   * @param typeId 面板类型标识符
   * @returns 第一个同类型标签 id；没有时为 undefined
   */
  private findTabByType(typeId: string): string | undefined {
    for (const tab of this.tabs) {
      if (tab.typeId === typeId) return tab.id;
    }

    return undefined;
  }

  /**
   * 面板请求切到「已经把这条路径开在手里」的那个标签
   *
   * 顺序写死：归一 → 空串返回假 → 反查 → 没找到或正是当前活动标签时返回假 → 否则发起切换并返回真。
   * 返回值决定面板要不要改自己的目标，所以必须在切换任何东西之前就能答出来；切换本身即发即忘。
   * @param identifier 资源标识（纯路径）
   * @returns 有别的标签持有该路径并已发起切换时为 true
   */
  private focusResourceTab(identifier: IResourceIdentifier): boolean {
    const key = normalizeResourcePath(identifier);

    if (key === '') return false;

    const ownerTabId = this.findTabByPath(key);

    if (ownerTabId === undefined || ownerTabId === this.activeTabId) return false;

    void this.activateTab(ownerTabId);
    return true;
  }

  /**
   * 登记或改写某个标签的路径集合：整份替换、不合并，新集合里没有的旧路径因此自然释放
   * @param tabId 标签 id
   * @param paths 已归一的去重键列表
   */
  private rememberTabPaths(tabId: string, paths: readonly string[]): void {
    this.tabPaths.set(tabId, new Set(paths));
  }

  /**
   * 清掉某个标签的路径登记：换成不带路径的面板、关标签、释放外壳时调用
   * @param tabId 标签 id
   */
  private forgetTabPath(tabId: string): void {
    this.tabPaths.delete(tabId);
  }

  /**
   * 接收面板自报的路径集合：只认该实例自己所在的标签，找不到标签时是空操作
   *
   * 每条路径先归一、丢掉空串、去重；结果为空时清掉该标签的登记，否则整份替换。
   * 实例已被替换（不再挂在任何标签里）时，面板的上报不会影响任何别的标签。
   * @param instanceId 上报的面板实例 id
   * @param identifiers 面板当前显示的资源标识列表
   */
  private registerTabResourcePaths(instanceId: string, identifiers: readonly IResourceIdentifier[]): void {
    const tab = this.tabs.find((candidate) => candidate.instanceId === instanceId);

    if (tab === undefined) return;

    const keys: Set<string> = new Set();

    for (const identifier of identifiers) {
      const key = normalizeResourcePath(identifier);

      if (key !== '') keys.add(key);
    }

    if (keys.size === 0) this.forgetTabPath(tab.id);
    else this.rememberTabPaths(tab.id, [...keys]);
  }

  /**
   * 去重命中时收掉调用方刚建出来的空白标签：只对 `typeId` 与 `instanceId` 都为 null 的标签动手
   *
   * 动手前先等串行切换链结算——`ShellSystem.openBlankTab` 可能已经为这个标签排了一次切换。
   * 全程不经过 `ShellSystem.activateTab`，因此不会再有第二次切出落盘；调用方自己已在用的标签不会被销毁。
   * @param tabId 候选空白标签 id
   */
  private async dropBlankTab(tabId: string): Promise<void> {
    await this.switchChain;

    const index = this.tabs.findIndex((tab) => tab.id === tabId);

    if (index === -1) return;

    const tab = this.tabs[index];

    if (tab.typeId !== null || tab.instanceId !== null) return;

    this.tabs.splice(index, 1);

    // 活动标签指向刚被收掉的空标签时先清掉：否则视图状态会短暂指向一个已移除的标签
    if (this.activeTabId === tabId) {
      this.activeTabId = null;
      this.clearActiveInstance();
    }

    this.notify();
  }

  openBlankTab(): string {
    this.tabCounter += 1;
    const tabId = `tab-${this.tabCounter}`;

    this.tabs.push({ id: tabId, typeId: null, instanceId: null });

    // 没有挂载中的面板时同步切换即可；确有面板挂载时只先登记暂存，激活延后一个微任务。
    // 延后的唯一目的是让紧随其后的 `ShellSystem.openPanelInTab` 有机会先领走它——领走之后
    // 这次打开就不会再触发一次「为切到空白标签而保存旧面板」，复用判定与冲突询问因此都能
    // 抢在任何落盘之前。没人领走时（用户点「+」）微任务结束后仍会正常激活，行为不变。
    if (this.lastActiveInstanceId === null) {
      this.activeTabId = tabId;
      this.notify();
      this.syncActiveInstance();
      return tabId;
    }

    this.notify();
    this.stagedBlankTabId = tabId;
    queueMicrotask((): void => this.activateStagedBlankTab(tabId));
    return tabId;
  }

  /**
   * 暂存空白标签的补激活：仍未被领走时才真正切过去
   * @param tabId 暂存的空白标签 id
   */
  private activateStagedBlankTab(tabId: string): void {
    if (this.stagedBlankTabId !== tabId) return;

    this.stagedBlankTabId = null;
    void this.activateTab(tabId);
  }

  /**
   * 领走暂存的空白标签：让随后排队的补激活变成空操作
   * @param tabId 调用方正要填入内容的标签 id
   */
  private claimStagedBlankTab(tabId: string): void {
    if (this.stagedBlankTabId === tabId) this.stagedBlankTabId = null;
  }

  async openPanelInTab(
    tabId: string,
    typeId: string,
    openParam?: Record<string, unknown>,
    path?: string,
  ): Promise<boolean> {
    // 第一条同步语句：领走暂存空白标签，使它的补激活变成空操作。之后所有路径去重、复用判定与
    // 冲突询问都排在「为切到空白标签而保存旧面板」之前，这是 D-33「不写盘」的机制保证。
    this.claimStagedBlankTab(tabId);

    const index = this.tabs.findIndex((tab) => tab.id === tabId);

    if (index === -1) {
      logger.error('shell.tabNotFound', tabId);
      return false;
    }

    // 去重判定必须在任何关闭 / 创建动作之前：命中时这次调用本身不碰面板、不写盘
    const key = path === undefined ? '' : normalizeResourcePath(path);

    if (key !== '') {
      const ownerTabId = this.findTabByPath(key);

      if (ownerTabId === tabId) {
        await this.activateTab(tabId);
        return true;
      }

      if (ownerTabId !== undefined) {
        // 命中别的标签：先收掉调用方刚建的空标签（只对真正的空标签动手），再切到已有标签
        await this.dropBlankTab(tabId);
        await this.activateTab(ownerTabId);
        return true;
      }
    }

    let current = this.tabs[index];
    let reusing = false;
    const type = this.panelTypes.get(typeId);
    const callerIsBlank = current.typeId === null && current.instanceId === null;

    // 复用判定：只有「调用方传入空白标签 + 类型声明复用 + 已有同类型标签」三者同时成立才参与
    if (type !== undefined && type.reuseTab === true && callerIsBlank) {
      const ownerTabId = this.findTabByType(typeId);

      if (ownerTabId !== undefined && ownerTabId !== tabId) {
        const owner = this.tabs.find((candidate) => candidate.id === ownerTabId);
        const ownerInstanceId = owner === undefined ? null : owner.instanceId;

        // 冲突判定必须抢在任何落盘 / 释放 / 新建之前：为真时只收掉空白标签、把持有者切到前台，
        // 不写被复用面板的盘、不释放它、不新建实例，也不打开本次的目标文件
        if (ownerInstanceId !== null && this.instances.get(ownerInstanceId)?.hasPendingConflict?.() === true) {
          await this.dropBlankTab(tabId);

          if (this.activeTabId !== ownerTabId) await this.activateTab(ownerTabId);

          return true;
        }

        // 收掉空白标签会 splice 数组，旧下标已失效；之后必须按 id 重新定位持有者标签
        await this.dropBlankTab(tabId);

        const ownerIndex = this.tabs.findIndex((candidate) => candidate.id === ownerTabId);

        if (ownerIndex === -1) {
          logger.error('shell.tabNotFound', ownerTabId);
          return false;
        }

        current = this.tabs[ownerIndex];
        reusing = true;
      }
    }

    // 只保存，先不释放：活动标签走既有的切出通道，非活动标签仅在复用路径上补一次切出。
    // 一次复用因此恰好保存一次：活动标签由 `ShellSystem.leaveActiveInstance` 负责，非活动标签由
    // `ShellSystem.enqueueSwitchOut` 负责，不会在活动分支再补一次。
    let saved = true;

    if (current.instanceId !== null) {
      if (this.activeTabId === current.id) saved = await this.leaveActiveInstance(current.instanceId);
      else if (reusing) saved = await this.enqueueSwitchOut(current.instanceId);
    }

    // 保存失败门禁：保存没有真正结算时不释放、不重建；被复用的标签本来就是活动标签时，
    // 还要把它重新切成活动面板，否则面板的 onSwitchOut 已把它标成非活动
    if (reusing && current.instanceId !== null) {
      const stillUnsaved = this.instances.get(current.instanceId)?.hasUnsavedChanges?.() === true;

      if (saved === false || stillUnsaved) {
        if (this.activeTabId === current.id) await this.restoreActiveInstance(current.instanceId);

        return false;
      }
    }

    if (current.instanceId !== null) await this.closePanelInstance(current.instanceId);

    const created = this.createInstance(typeId, openParam);

    if (created === null) return false;

    const targetIndex = this.tabs.findIndex((tab) => tab.id === current.id);

    if (targetIndex === -1) {
      logger.error('shell.tabNotFound', current.id);
      return false;
    }

    this.tabs[targetIndex] = { id: current.id, typeId, instanceId: created.instanceId };

    // 登记写在标签记录之后、初始化之前：初始化失败时这条路径仍被这个标签占着，重开只会聚焦它。
    // 换成不带路径的面板则清掉登记，避免旧路径继续指向这个标签
    if (key === '') this.forgetTabPath(current.id);
    else this.rememberTabPaths(current.id, [key]);

    // 先等旧面板的切出保存结算，再改活动标签与通知 React（B1）
    await this.departActiveInstance(created.instanceId);
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

    if (tab.instanceId !== null) {
      const instanceId = tab.instanceId;
      const instance = this.instances.get(instanceId);
      const asks =
        instance !== undefined && (instance.onRequestClose !== undefined || instance.onBeforeClose !== undefined);

      // 询问前先把目标标签切成活动标签：面板的未保存对话框需要挂在自己的 DOM 上才可能 settle。
      // 必须等切换真的完成（含旧面板保存结算），三态询问才发生在切换之后。
      // 不询问的面板保持既有行为：直接关闭、前台不变
      if (asks && this.activeTabId !== tabId) await this.activateTab(tabId);

      if (instance !== undefined && instance.onRequestClose !== undefined) {
        let choice: PanelCloseChoice = PanelCloseChoice.Cancel;

        try {
          choice = await instance.onRequestClose();
        } catch {
          // 钩子自身出错时按「取消关闭」处理：数据安全优先，绝不把异常抛给点击关闭的人
          logger.error('shell.beforeCloseFailed', this.instanceTypes.get(instanceId) ?? '');
          return;
        }

        // 只认三态枚举的三个值：未知值一律按取消处理
        if (choice !== PanelCloseChoice.Save && choice !== PanelCloseChoice.Discard) return;

        // 面板自己要保存的那一态已自行写完，丢弃那一态必须先把内存改动清掉，
        // 否则 dispose 的兜底保存会把「不保存关闭」变成一次写盘
        if (choice === PanelCloseChoice.Discard) instance.onDiscard?.();

        // 「保存并关闭」：面板刚把草稿写进缓冲，外壳这时才把缓冲打到磁盘，写完才真正关标签；
        // 「不保存关闭」不写盘——丢弃钩子已经把该路径待写丢掉，再写盘等于把丢弃变成一次写盘。
        // 写盘失败或仍有待写（含被冲突规则跳过的条目）时直接返回：标签与面板保持打开，失败可见于既有提示
        if (choice === PanelCloseChoice.Save) {
          const flushed = await this.flushPendingContent();

          if (!flushed) return;
        }

        await this.discardTab(tabId, true);
        return;
      }

      if (instance !== undefined && instance.onBeforeClose !== undefined) {
        let allowed = false;

        try {
          allowed = await instance.onBeforeClose();
        } catch {
          // 钩子自身出错时按「取消关闭」处理：数据安全优先，绝不把异常抛给点击关闭的人
          logger.error('shell.beforeCloseFailed', this.instanceTypes.get(instanceId) ?? '');
          return;
        }

        if (!allowed) return;
      }
    }

    await this.discardTab(tabId, false);
  }

  async activateTab(tabId: string): Promise<void> {
    const exists = this.tabs.some((tab) => tab.id === tabId);

    if (!exists) {
      logger.error('shell.tabNotFound', tabId);
      return;
    }

    const nextTab = this.tabs.find((tab) => tab.id === tabId);
    const nextInstanceId = nextTab === undefined ? null : nextTab.instanceId;

    // 顺序是这条方法的全部意义：先等旧面板的 onSwitchOut 结算，再改活动标签并通知 React（B1）。
    // 保存没完成就通知，React 会先卸载旧组件，面板就拿不到组件里的草稿。
    await this.departActiveInstance(nextInstanceId);
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
    // 先注销待写变化订阅与页面级监听：释放过程中与释放之后都不再因缓冲 / 页面事件重渲染
    this.pendingChangeHook?.unload();
    this.pendingChangeHook = null;

    if (this.beforeUnloadHandler !== null) window.removeEventListener('beforeunload', this.beforeUnloadHandler);
    if (this.pageHideHandler !== null) window.removeEventListener('pagehide', this.pageHideHandler);
    if (this.windowBlurHandler !== null) window.removeEventListener('blur', this.windowBlurHandler);

    this.beforeUnloadHandler = null;
    this.pageHideHandler = null;
    this.windowBlurHandler = null;

    const instanceIds = [...this.instances.keys()].reverse();

    for (const instanceId of instanceIds) await this.closePanelInstance(instanceId);

    this.pendingInstances.length = 0;
    this.tabs = [];
    this.tabPaths.clear();
    this.activeTabId = null;
    this.stagedBlankTabId = null;
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
    const context = new PanelContext(
      this.resourceSystem,
      this.undoSystem,
      (identifier): boolean => this.focusResourceTab(identifier),
      (identifiers): void => this.registerTabResourcePaths(instanceId, identifiers),
    );
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
      hasPendingWrite: this.resourceSystem.hasAnyPendingContent(),
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
   * 释放实例、移除标签并按需切邻，全程不询问面板：这是唯一真正移除标签的一段逻辑，
   * `ShellSystem.closeTab` 在用户询问通过后复用它，`ShellSystem.unregisterPanelType` 直接复用它，
   * 因此注销类型与释放 core 永远拿不到关闭询问钩子
   * @param tabId 要移除的标签 id
   * @param skipFlush 为真时跳过活动面板的普通切走落盘：调用方要么已自行保存，要么已丢弃内存改动
   */
  private async discardTab(tabId: string, skipFlush: boolean): Promise<void> {
    const index = this.tabs.findIndex((tab) => tab.id === tabId);

    if (index === -1) {
      logger.error('shell.tabNotFound', tabId);
      return;
    }

    const tab = this.tabs[index];
    // 必须在这里重新判定：为询问而激活过的后台标签，调用方手里的旧值仍是「非活动」，会跳过切邻
    const wasActive = this.activeTabId === tabId;

    if (tab.instanceId !== null) {
      if (wasActive) {
        // 跳过落盘只跳过「排切出」，不能跳过「清记录」：否则移除标签后邻居拿不到切入通知
        if (skipFlush) this.clearActiveInstance();
        else await this.leaveActiveInstance(tab.instanceId);
      }
      await this.closePanelInstance(tab.instanceId);
    }

    this.tabs.splice(index, 1);
    this.forgetTabPath(tabId);

    // 被移除的标签如果还挂着暂存，一并清掉：否则微任务补激活会指向一个已不存在的标签
    if (this.stagedBlankTabId === tabId) this.stagedBlankTabId = null;

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

  /**
   * 清空「最近一次投递过切入通知」的记录：只断开对齐，不投递切出
   */
  private clearActiveInstance(): void {
    this.lastActiveInstanceId = null;
  }

  /**
   * 在活动面板即将被销毁时立即中断其切入状态：清空记录并把切出排进串行切换链
   * @param instanceId 即将销毁的面板实例 id
   * @returns 该切出结算完成时 resolve，供调用方在释放实例前等待
   */
  private leaveActiveInstance(instanceId: string): Promise<boolean> {
    this.clearActiveInstance();
    return this.enqueueSwitchOut(instanceId);
  }

  /**
   * 保存失败、复用被拒时把某个实例重新恢复成活动面板
   *
   * 只改「最近切入」的对齐记录并把切入重新排进串行链；活动标签本身没有变化，
   * 面板的 `IEditorPanel.onSwitchOut` 可能已经把它标成非活动，这里用切入通知把它拉回来。
   * @param instanceId 要恢复成活动面板的实例 id
   * @returns 切入通知结算完成时 resolve
   */
  private async restoreActiveInstance(instanceId: string): Promise<void> {
    this.lastActiveInstanceId = instanceId;
    await this.enqueueSwitchIn(instanceId);
  }

  /**
   * 将活动面板与最近一次切入通知对齐：目标变化时对离开的面板投递切出、对进入的面板投递切入
   * 两者都排进同一条串行链，保证切入一定在切出（落盘）结算之后才发生
   * 目标面板仍在初始化时不投递，待其初始化完成由 initializeInstance 再次对齐
   */
  private syncActiveInstance(): void {
    const nextInstanceId = this.activeInstanceId();

    if (nextInstanceId === this.lastActiveInstanceId) return;

    if (nextInstanceId !== null && this.instanceStatuses.get(nextInstanceId) === ShellInstanceStatus.Loading) return;

    const previousInstanceId = this.lastActiveInstanceId;

    this.lastActiveInstanceId = nextInstanceId;

    if (previousInstanceId !== null) this.enqueueSwitchOut(previousInstanceId);
    if (nextInstanceId !== null) this.enqueueSwitchIn(nextInstanceId);
  }

  /**
   * 把一次切入投递排进串行切换链
   * @param instanceId 目标面板实例 id
   * @returns 该链节点结算完成时 resolve
   */
  private enqueueSwitchIn(instanceId: string): Promise<void> {
    const step = this.switchChain.then(() => this.invokeSwitchIn(instanceId));

    this.switchChain = step;
    return step;
  }

  /**
   * 把一次切出（落盘）投递排进串行切换链
   * @param instanceId 目标面板实例 id
   * @returns 该链节点结算完成时 resolve
   */
  private enqueueSwitchOut(instanceId: string): Promise<boolean> {
    const step = this.switchChain.then(() => this.invokeSwitchOut(instanceId));

    this.switchChain = step.then((): void => {});
    return step;
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
   * 向指定面板投递切出通知并结算全量落盘；单个面板抛错不影响外壳的标签状态机
   * @param instanceId 目标面板实例 id
   * @returns 切出钩子没有抛错、且全量落盘结算成功时为 true
   */
  private async invokeSwitchOut(instanceId: string): Promise<boolean> {
    const instance = this.instances.get(instanceId);

    if (instance === undefined) return true;

    let failed = false;

    try {
      await instance.onSwitchOut();
    } catch {
      logger.error('shell.callbackFailed', this.instanceTypes.get(instanceId) ?? '');
      failed = true;
    }

    // 顺序铁律：面板先把草稿写进缓冲，外壳随后才把缓冲打到磁盘；反过来会漏掉刚写进缓冲的内容
    const flushed = await this.flushPendingContent();

    return !failed && flushed;
  }

  /**
   * 把缓冲里全部待写内容打到磁盘，并回答「现在能不能丢弃标签」
   *
   * 真表示这次尝试之后缓冲已经空了、可以安全关闭；假表示写盘抛错或仍有待写（包括被冲突规则
   * 跳过的条目），必须保持标签与面板。假值是全局判据——不区分待写属于哪个标签，因此一个自身
   * 没有待写的标签，在别处有未决写入时同样会被挡住；这不是静默失败，待写还在时菜单行既有的
   * 「正在等待保存」提示就在屏幕上，它就是假值的可见状态。
   * @returns 缓冲已空时为 true；写盘抛错或仍有待写时为 false
   */
  private async flushPendingContent(): Promise<boolean> {
    try {
      await this.resourceSystem.flushAllContent();
    } catch (error: unknown) {
      logger.error('resource.flushFailed', String(error));
      return false;
    }

    return !this.resourceSystem.hasAnyPendingContent();
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

  /**
   * 把一条宿主变化转给面板：面板实现了新通道时只转发路径与种类，未实现时退回预读通道
   * @param id 资源标识（纯路径）
   * @param kind 变化种类
   */
  async onResourceChange(id: IResourceIdentifier, kind: EditorFileChangeKind): Promise<void> {
    if (this.panel.onResourceChange !== undefined) {
      await this.panel.onResourceChange(id, kind);
      return;
    }

    await this.onUpdateResource(id);
  }
}
