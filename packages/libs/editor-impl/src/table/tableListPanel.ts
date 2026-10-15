import { IEditorPanel, IEditorPanelContext, IEditorPanelFactoryParam, IUndoContext } from '@motajs/editor-core';
import { Store } from '@tanstack/store';
import { createElement, FC } from 'react';
import { ITablePanelOpener } from '../react';
import { TableListPanelView, ITableListPanelViewState } from './components/TableListPanelView';

// 「打开表格」列表面板：读 core 项目索引铺出当前目录的直接子条目，
// 经注入的表格面板打开器打开选中的数据文件。本面板不直接读写文件系统，
// 目录数据一律经 IEditorPanelContext.listDirectory 取。

/**
 * 列表面板：从 core 项目索引读取目录树，并经注入的打开器打开表格
 */
export class TableListPanel implements IEditorPanel {
  /** 面板实例标识符，取自 core 生成的实例 id */
  readonly id: string;

  /** 面板侧上下文，提供资源层的目录列举能力 */
  private readonly context: IEditorPanelContext;

  /** 缓存的渲染根组件 */
  private readonly component: FC;

  /** 视图状态订阅源：当前目录与直接子条目 */
  private readonly store: Store<ITableListPanelViewState>;

  /** 当前选中的目录路径；根目录为空串 */
  private directory: string = '';

  /** 目录树请求序号，用于丢弃过期的异步结果 */
  private requestToken: number = 0;

  constructor(param: IEditorPanelFactoryParam) {
    this.id = param.instanceId;
    this.context = param.context;
    this.store = new Store<ITableListPanelViewState>({ directory: '', entries: [] });
    this.component = () =>
      createElement(TableListPanelView, {
        store: this.store,
        onSelectDirectory: (path): void => void this.selectDirectory(path),
        onOpen: (dataPath, opener): void => void this.openTable(dataPath, opener),
      });
  }

  async initialize(): Promise<void> {}

  async dispose(): Promise<void> {}

  render(): FC {
    return this.component;
  }

  async onFocus(): Promise<void> {}

  async onBlur(): Promise<void> {}

  async onSwitchIn(): Promise<void> {
    await this.refresh();
  }

  async onSwitchOut(): Promise<void> {}

  async onUpdateResource(): Promise<void> {}

  async undo(context: IUndoContext<unknown>): Promise<void> {}

  async redo(context: IUndoContext<unknown>): Promise<void> {}

  /**
   * 设置当前选中目录并重取该目录的直接子条目
   * @param path 目标目录路径；根目录传空串
   */
  async selectDirectory(path: string): Promise<void> {
    this.directory = path;
    await this.refresh();
  }

  /**
   * 经注入的表格面板打开器打开一个瞄准该数据路径的表格面板
   * @param dataPath 要打开的数据文件路径
   * @param opener 组合根注入的表格面板打开器
   */
  async openTable(dataPath: string, opener: ITablePanelOpener): Promise<void> {
    await opener.open({ target: { dataPath } });
  }

  /**
   * 重取当前目录的直接子条目并发布到视图状态
   */
  private async refresh(): Promise<void> {
    const token = this.nextToken();

    try {
      const entries = await this.context.listDirectory(this.directory);

      if (this.requestToken !== token) return;

      this.store.setState({ directory: this.directory, entries });
    } catch {
      if (this.requestToken !== token) return;

      this.store.setState({ directory: this.directory, entries: [], error: '目录读取失败，请重试。' });
    }
  }

  /**
   * 递增并返回目录树请求序号，用于判定异步结果是否仍是最新一次请求
   * @returns 递增后的请求序号
   */
  private nextToken(): number {
    this.requestToken += 1;
    return this.requestToken;
  }
}
