import {
  EditorEntryKind,
  IEditorPanel,
  IEditorPanelContext,
  IEditorPanelFactoryParam,
  IFileEntry,
  IUndoContext,
} from '@motajs/editor-core';
import { Store } from '@tanstack/store';
import { createElement, FC } from 'react';
import { ITablePanelOpener } from '../react';
import { validateId } from './model/validation';
import { deriveSchemaPath, isSchemaPath } from './resourceType';
import { TableListPanelView, ITableListPanelViewState } from './components/TableListPanelView';

// 「打开表格」列表面板：读 core 项目索引铺出当前目录的直接子条目，
// 经注入的表格面板打开器打开选中的数据文件。本面板不直接读写文件系统，
// 目录数据一律经 IEditorPanelContext.listDirectory 取，写入一律经 createResource / deleteResource。

/** 新建表格数据文件的初始内容文本：空对象 */
export const INITIAL_TABLE_DATA_TEXT = '{}';

/** 新建表格 schema 文件的初始内容文本：type 为 object、properties 为空 */
export const INITIAL_TABLE_SCHEMA_TEXT = '{"type":"object","properties":{}}';

/**
 * 拼接目录路径与文件名，根目录下直接返回文件名
 * @param directory 目录路径；根目录为空串
 * @param name 文件名
 * @returns 完整路径（以 `/` 分隔、无前导斜线）
 */
function joinPath(directory: string, name: string): string {
  return directory === '' ? name : `${directory}/${name}`;
}

/**
 * 取一个目录条目对应表格的基名：目录取原名，文件去掉 json / schema 约定后缀
 * @param entry 目录条目
 * @returns 用于重名校验的表格基名
 */
function tableBaseName(entry: IFileEntry): string {
  if (entry.kind === EditorEntryKind.Directory) return entry.name;
  if (isSchemaPath(entry.path)) return entry.name.replace(/\.schema\.jsonc?$/, '');

  return entry.name.replace(/\.jsonc?$/, '');
}

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
        onCreate: (directoryPath, name): void => void this.createTable(directoryPath, name),
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
   * 在当前选中目录下新建一对文件：`name.json`（空对象）+ `name.schema.json`（空对象 schema）
   *
   * 名称先经 `validateId` 校验（与同目录既有表格基名查重），非法时不落任何文件并发布错误；
   * 合法时经 `IEditorPanelContext.createResource` 写一对文件，写完后把该目录设为当前目录并刷新目录树。
   * @param directoryPath 新建表格所在目录路径；根目录传空串
   * @param name 表格名称（不含扩展名）
   */
  async createTable(directoryPath: string, name: string): Promise<void> {
    const entries = await this.context.listDirectory(directoryPath);
    const existing = entries.map(tableBaseName);
    const validation = validateId(name, existing);

    if (!validation.valid) {
      this.store.setState({ ...this.store.state, error: validation.error ?? '名称未通过校验' });
      return;
    }

    const dataPath = joinPath(directoryPath, `${name}.json`);
    const schemaPath = deriveSchemaPath(dataPath);

    await this.context.createResource(dataPath, INITIAL_TABLE_DATA_TEXT);
    await this.context.createResource(schemaPath, INITIAL_TABLE_SCHEMA_TEXT);

    this.directory = directoryPath;
    await this.refresh();
  }

  /**
   * 重取当前目录的直接子条目并发布到视图状态
   */
  private async refresh(): Promise<void> {
    const token = this.nextToken();

    try {
      const entries = await this.context.listDirectory(this.directory);

      if (this.requestToken !== token) return;

      this.store.setState({ directory: this.directory, entries, error: undefined });
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
