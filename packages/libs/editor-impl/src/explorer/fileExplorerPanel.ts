import { IEditorPanelContext, IEditorPanelFactoryParam, IEditorPanelType, IFileEntry } from '@motajs/editor-core';
import { Store } from '@tanstack/store';
import { message } from 'antd';
import { createElement, FC } from 'react';
import { FileExplorerView } from './components';
import { IFileExplorerCapabilities, IFileExplorerPanel, IFileExplorerViewState } from './types';

// 文件资源管理器面板：只做浏览 + 打开，没有任何新建 / 重命名 / 删除 / 移动 / 预览入口（D-23 / D-30）。
// 目录级隐藏由 `FileExplorerPanel.loadChildren` 剔除点开头的条目（共用浏览器规定目录永不受过滤），
// 文件级显示由 `FileExplorerPanel.filterPath` 再叠加「至少一个面板类型能打开」的判定。

/**
 * 判断面板类型能否打开某路径：必须同时声明 `canOpen` 与 `createOpenParam`，且 `canOpen` 为真
 * @param type 已注册的面板类型
 * @param path 文件的规范化相对路径
 * @returns 该类型是候选时为 true
 */
function acceptsPath(type: IEditorPanelType, path: string): boolean {
  if (type.canOpen === undefined) return false;
  if (type.createOpenParam === undefined) return false;
  return type.canOpen(path);
}

/**
 * 判断路径是否含以 `.` 开头的路径段
 * @param path 规范化相对路径
 * @returns 任一段以 `.` 开头时为 true
 */
function hasHiddenSegment(path: string): boolean {
  return path.split('/').some((segment) => segment.startsWith('.'));
}

export class FileExplorerPanel implements IFileExplorerPanel {
  /** 面板实例标识符，取自 core 生成的实例 id */
  readonly id: string;

  /** 面板侧上下文，提供目录条目读取 */
  private readonly context: IEditorPanelContext;

  /** 宿主注入的资源管理器能力：列面板类型与打开面板 */
  private readonly capabilities: IFileExplorerCapabilities;

  /** 视图状态订阅源：目录、候选与错误提示都由此发布 */
  private readonly store: Store<IFileExplorerViewState>;

  /** 缓存的渲染根组件，构造期创建一次 */
  private readonly component: FC;

  /**
   * 读取某目录的直接子条目，并剔除名字以 `.` 开头的目录与文件
   * @param path 目录路径；根目录为空串
   * @returns 该目录的直接子条目
   */
  readonly loadChildren = async (path: string): Promise<readonly IFileEntry[]> => {
    const entries = await this.context.listDirectory(path);

    return entries.filter((entry) => !entry.name.startsWith('.'));
  };

  /**
   * 判断文件行是否显示：无点开头的路径段，且至少一个面板类型能打开
   * @param path 文件的规范化相对路径
   * @returns 显示时为 true
   */
  readonly filterPath = (path: string): boolean => {
    if (hasHiddenSegment(path)) return false;

    return this.capabilities.listPanelTypes().some((type) => acceptsPath(type, path));
  };

  /**
   * 打开一个文件路径：0 候选提示、1 候选直接打开、多候选弹窗等待用户选择
   * @param path 来自索引的规范化相对路径
   */
  readonly openPath = async (path: string): Promise<void> => {
    const types = this.capabilities.listPanelTypes().filter((type) => acceptsPath(type, path));

    if (types.length === 0) {
      message.warning('没有可以打开该文件的面板');
      this.store.setState((state) => ({ ...state, error: '没有可以打开该文件的面板' }));
      return;
    }

    if (types.length === 1) {
      this.store.setState((state) => ({ ...state, error: undefined }));
      await this.openWith(types[0], path);
      return;
    }

    this.store.setState((state) => ({
      ...state,
      error: undefined,
      pendingPath: path,
      candidateTypeIds: types.map((type) => type.id),
    }));
  };

  /**
   * 候选弹窗选中某一面板类型后打开；成功与失败都同时清空待打开路径与候选列表
   * @param typeId 选中的面板类型标识
   */
  readonly selectCandidate = (typeId: string): void => {
    const pendingPath = this.store.state.pendingPath;
    const type = this.capabilities.listPanelTypes().find((candidate) => candidate.id === typeId);

    this.store.setState((state) => ({ ...state, pendingPath: undefined, candidateTypeIds: undefined }));

    if (pendingPath === undefined || type === undefined) return;

    void this.openWith(type, pendingPath);
  };

  /** 候选弹窗取消：与 `FileExplorerPanel.selectCandidate` 一样清空待打开路径与候选列表 */
  readonly cancelCandidate = (): void => {
    this.store.setState((state) => ({ ...state, pendingPath: undefined, candidateTypeIds: undefined }));
  };

  constructor(param: IEditorPanelFactoryParam, capabilities: IFileExplorerCapabilities) {
    this.id = param.instanceId;
    this.context = param.context;
    this.capabilities = capabilities;
    this.store = new Store<IFileExplorerViewState>({ directory: '', reloadToken: 0 });
    this.component = () =>
      createElement(FileExplorerView, {
        store: this.store,
        candidates: this.capabilities.listPanelTypes(),
        loadChildren: this.loadChildren,
        filterPath: this.filterPath,
        onOpen: this.openPath,
        onSelectCandidate: this.selectCandidate,
        onCancelCandidate: this.cancelCandidate,
      });
  }

  async initialize(): Promise<void> {}

  async dispose(): Promise<void> {}

  render(): FC {
    return this.component;
  }

  getTitle(): string {
    return '文件资源管理器';
  }

  async onFocus(): Promise<void> {}

  async onBlur(): Promise<void> {}

  async onSwitchIn(): Promise<void> {}

  async onSwitchOut(): Promise<void> {}

  async onUpdateResource(): Promise<void> {}

  async onResourceChange(): Promise<void> {
    this.store.setState((state) => ({ ...state, reloadToken: state.reloadToken + 1 }));
  }

  async undo(): Promise<void> {}

  async redo(): Promise<void> {}

  /**
   * 用指定面板类型打开文件；宿主返回 false 时提示打开失败
   * @param type 选中的面板类型
   * @param path 文件的规范化相对路径
   */
  private async openWith(type: IEditorPanelType, path: string): Promise<void> {
    if (type.createOpenParam === undefined) return;

    const opened = await this.capabilities.openPanel(type.id, type.createOpenParam(path));

    if (!opened) message.error('打开失败，请稍后重试');
  }
}
