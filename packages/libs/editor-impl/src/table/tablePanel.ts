import { Store } from '@tanstack/store';
import { useStore } from '@tanstack/react-store';
import { IEditorPanel, IEditorPanelContext, IEditorPanelFactoryParam, IResourceIdentifier } from '@motajs/editor-core';
import { createElement, FC, ReactElement } from 'react';
import { ITablePanel, ITablePanelTarget, ITableRowNode, TableEditMode } from './types';
import { ITableGridProps, TableGrid, TablePanelStatus } from './components/TableGrid';
import { buildTableTree } from './model/traversal';

export interface ITablePanelViewState {
  /** 当前数据加载状态 */
  readonly status: TablePanelStatus;
  /** 当前行树 */
  readonly rows: readonly ITableRowNode[];
}

interface ITablePanelViewProps {
  /** 面板持有的视图状态订阅源 */
  readonly store: Store<ITablePanelViewState>;
}

/**
 * 面板渲染根组件：订阅面板的视图状态并转交给可复用的表格组件
 * @param props 渲染根 props
 * @returns 表格组件元素
 */
function TablePanelView(props: ITablePanelViewProps): ReactElement {
  const view = useStore(props.store);
  const gridProps: ITableGridProps = { status: view.status, rows: view.rows, mode: TableEditMode.Change };

  return createElement(TableGrid, gridProps);
}

export class TablePanel implements IEditorPanel, ITablePanel {
  /** 面板实例标识符，取自 core 生成的实例 id */
  readonly id: string;

  /** 面板侧上下文，提供资源层读写 */
  private readonly context: IEditorPanelContext;

  /** 面板视图状态订阅源 */
  private readonly viewStore: Store<ITablePanelViewState>;

  /** 缓存的渲染根组件 */
  private readonly component: FC;

  /** 当前目标表；尚未设置时为空 */
  private target: ITablePanelTarget | null = null;

  /** 请求序号，用于丢弃过期请求的异步结果 */
  private requestToken: number = 0;

  constructor(param: IEditorPanelFactoryParam) {
    this.id = param.instanceId;
    this.context = param.context;
    this.viewStore = new Store<ITablePanelViewState>({ status: TablePanelStatus.NoTarget, rows: [] });
    this.component = () => createElement(TablePanelView, { store: this.viewStore });
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

  async onUpdateResourceList(): Promise<void> {}

  async undo(): Promise<void> {}

  async redo(): Promise<void> {}

  setTable(target: ITablePanelTarget): void {
    this.target = target;
    void this.refresh();
  }

  /**
   * 经资源层读取一个资源的内容
   * @param id 资源标识符
   * @returns 资源内容；资源不在资源列表中时为 undefined
   */
  private async readResource(id: IResourceIdentifier): Promise<unknown> {
    const resource = await this.context.requestResource(id);

    if (resource === null) return undefined;

    return resource.request();
  }

  /**
   * 把新的视图状态写入订阅源
   * @param status 新的加载状态
   * @param rows 新的行树
   */
  private publish(status: TablePanelStatus, rows: readonly ITableRowNode[]): void {
    this.viewStore.setState({ status, rows });
  }

  /**
   * 依据已读取的 schema 与数据计算行树并写入视图状态：有字段则就绪，否则落回空态
   * @param schema schema 内容
   * @param data 数据内容
   */
  private applyLoaded(schema: unknown, data: unknown): void {
    const rows = buildTableTree(schema, data);

    if (rows.length > 0) {
      this.publish(TablePanelStatus.Ready, rows);
      return;
    }

    const hasSchema = typeof schema === 'object' && schema !== null && !Array.isArray(schema);

    this.publish(hasSchema ? TablePanelStatus.Empty : TablePanelStatus.EmptySchema, []);
  }

  /**
   * 请求目标表的数据与 schema 资源并重算行树；无目标时落回未设目标态
   */
  private async refresh(): Promise<void> {
    const target = this.target;

    if (target === null) {
      this.publish(TablePanelStatus.NoTarget, []);
      return;
    }

    this.requestToken += 1;
    const token = this.requestToken;

    this.publish(TablePanelStatus.Loading, []);

    // 资源读取失败是行为关键路径：落回固定错误态而非抛穿，面板保持打开（D-29）
    try {
      const data = await this.readResource(target.data);
      const schema = await this.readResource(target.schema);

      if (token !== this.requestToken) return;

      this.applyLoaded(schema, data);
    } catch {
      if (token !== this.requestToken) return;

      this.publish(TablePanelStatus.Error, []);
    }
  }
}
