import { Store } from '@tanstack/store';
import { createElement, FC, ReactElement, useSyncExternalStore } from 'react';
import { IHookController } from '../hook';
import { logger } from '../log';
import { IResourceIdentifier, IResourceSystemAccess, IResourceSystemHooks } from '../resource';
import { IUndoContext, IUndoSystem } from '../undo';
import { PanelContext } from './panelContext';
import { EditorPanelCreator, IEditorPanel, IEditorPanelContext, IPanelSystem, PanelUndoType } from './types';

interface IPanelSwitchData {
  /** 切换前的面板 */
  readonly from: IEditorPanel | null;
  /** 切换前面板的切换参数 */
  readonly fromParam?: Record<string, unknown>;
  /** 切换后的面板 */
  readonly to: IEditorPanel;
  /** 切换后面板的切换参数 */
  readonly toParam?: Record<string, unknown>;
}

interface IPanelRootProps {
  /** 订阅面板变更 */
  readonly subscribe: (listener: () => void) => () => void;
  /** 读取当前面板 */
  readonly getSnapshot: () => IEditorPanel | null;
}

/**
 * 订阅当前面板并渲染其组件；组件定义在模块层以保证 hooks 规则可识别
 * @param props 面板根组件的订阅与取快照回调
 * @returns 当前面板的渲染结果，无当前面板时为 null
 */
function PanelRoot(props: IPanelRootProps): ReactElement | null {
  const current = useSyncExternalStore(props.subscribe, props.getSnapshot);
  return current ? createElement(current.render()) : null;
}

export class PanelSystem implements IPanelSystem {
  currentPanel: IEditorPanel | null = null;

  /** 撤回系统 */
  private readonly undoSystem: IUndoSystem;
  /** 资源系统 */
  private readonly resourceSystem: IResourceSystemAccess;
  /** 面板注册表 */
  private readonly panels: Map<string, IEditorPanel> = new Map();
  /** 面板到其资源钩子控制器的映射 */
  private readonly hooks: Map<IEditorPanel, IHookController<IResourceSystemHooks>> = new Map();
  /** 尚未初始化、待 initialize 时补调的面板 */
  private readonly pendingPanels: IEditorPanel[] = [];
  /** 是否已完成初始化 */
  private initialized: boolean = false;
  /** 当前面板的切换参数 */
  private currentParam?: Record<string, unknown>;
  /** 面板版本号，仅用于通知订阅者重渲染 */
  private readonly panelStore = new Store<number>(0);
  /** 订阅面板变更，供 useSyncExternalStore 使用 */
  private readonly subscribe: (listener: () => void) => () => void;
  /** 读取当前面板，供 useSyncExternalStore 使用 */
  private readonly getSnapshot: () => IEditorPanel | null;
  /** 缓存一次的渲染根组件，避免每次 render() 返回新组件导致反复重挂 */
  private readonly RootComponent: FC;
  /** 窗口聚焦事件处理 */
  private readonly handleFocus: () => void;
  /** 窗口失焦事件处理 */
  private readonly handleBlur: () => void;

  constructor(undoSystem: IUndoSystem, resourceSystem: IResourceSystemAccess) {
    this.undoSystem = undoSystem;
    this.resourceSystem = resourceSystem;
    this.subscribe = (listener) => this.panelStore.subscribe(listener);
    this.getSnapshot = () => this.currentPanel;
    this.RootComponent = () => createElement(PanelRoot, { subscribe: this.subscribe, getSnapshot: this.getSnapshot });
    this.handleFocus = (): void => {
      void this.currentPanel?.onFocus();
    };
    this.handleBlur = (): void => {
      void this.currentPanel?.onBlur();
    };
  }

  async initialize(): Promise<void> {
    this.initialized = true;
    window.addEventListener('focus', this.handleFocus);
    window.addEventListener('blur', this.handleBlur);

    const pending = this.pendingPanels.splice(0);

    for (const panel of pending) {
      await panel.initialize();
    }
  }

  async registerPanel(creator: EditorPanelCreator): Promise<IEditorPanel | null> {
    const context = new PanelContext(this.resourceSystem, this.undoSystem);
    const panel = await creator(context);

    if (this.panels.has(panel.id)) {
      logger.error('panel.duplicateId', panel.id);
      return null;
    }

    this.panels.set(panel.id, panel);
    this.hooks.set(panel, this.resourceSystem.addHook(new EditorPanelHooks(panel, context)));

    if (this.initialized) {
      await panel.initialize();
    } else {
      this.pendingPanels.push(panel);
    }

    return panel;
  }

  async disposePanel(panel: IEditorPanel): Promise<void> {
    this.hooks.get(panel)?.unload();
    this.hooks.delete(panel);
    await panel.dispose();
    this.panels.delete(panel.id);

    if (this.currentPanel === panel) {
      this.currentPanel = null;
      this.panelStore.setState((version) => version + 1);
    }
  }

  getPanel(id: string): IEditorPanel | null {
    return this.panels.get(id) ?? null;
  }

  async switchTo(panel: IEditorPanel, param?: Record<string, unknown>): Promise<void> {
    if (panel === this.currentPanel) return;

    this.undoSystem.addUndoContext(this, {
      type: PanelUndoType.Switch,
      data: { from: this.currentPanel, fromParam: this.currentParam, to: panel, toParam: param },
    });

    await this.internalSwitchTo(panel, param);
  }

  async undo<T>(context: IUndoContext<T>): Promise<void> {
    const data = context.data as IPanelSwitchData;
    await this.internalSwitchTo(data.from, data.fromParam);
  }

  async redo<T>(context: IUndoContext<T>): Promise<void> {
    const data = context.data as IPanelSwitchData;
    await this.internalSwitchTo(data.to, data.toParam);
  }

  render(): FC {
    return this.RootComponent;
  }

  async dispose(): Promise<void> {
    window.removeEventListener('focus', this.handleFocus);
    window.removeEventListener('blur', this.handleBlur);

    const panels = [...this.panels.values()].reverse();

    for (const panel of panels) {
      this.hooks.get(panel)?.unload();
      await panel.dispose();
    }

    this.pendingPanels.length = 0;
    this.panels.clear();
    this.hooks.clear();
    this.currentPanel = null;
  }

  /**
   * 执行实际的面板切换：切出旧面板、更新当前面板并通知订阅者、切入新面板，不记录撤回
   * @param panel 要切换至的面板，null 表示切出至无面板
   * @param param 向切换至的面板传入的参数
   */
  private async internalSwitchTo(panel: IEditorPanel | null, param?: Record<string, unknown>): Promise<void> {
    const previous = this.currentPanel;

    if (previous) {
      await previous.onSwitchOut();
    }

    this.currentPanel = panel;
    this.currentParam = param;
    this.panelStore.setState((version) => version + 1);

    if (panel) {
      await panel.onSwitchIn(param);
    }
  }
}

export class EditorPanelHooks implements IResourceSystemHooks {
  /** 钩子所属的面板 */
  private readonly panel: IEditorPanel;
  /** 面板侧上下文，用于重新申请资源 */
  private readonly context: IEditorPanelContext;

  constructor(panel: IEditorPanel, context: IEditorPanelContext) {
    this.panel = panel;
    this.context = context;
  }

  async onUpdateResource(id: IResourceIdentifier): Promise<void> {
    const resource = await this.context.requestResource(id);

    if (resource) {
      await this.panel.onUpdateResource(id, await resource.request());
    }
  }

  async onUpdateResourceList(type: number): Promise<void> {
    await this.panel.onUpdateResourceList(type, await this.context.requestResourceList(type));
  }
}
