import { Store } from '@tanstack/store';
import { useStore } from '@tanstack/react-store';
import {
  IEditorPanel,
  IEditorPanelContext,
  IEditorPanelFactoryParam,
  IResourceIdentifier,
  IUndoContext,
} from '@motajs/editor-core';
import { get } from 'es-toolkit/compat';
import { createElement, FC, ReactElement } from 'react';
import { ITablePanel, ITablePanelTarget, ITableRowNode } from './types';
import {
  ITableGridProps,
  TableGrid,
  TableGridAddHandler,
  TableGridChangeHandler,
  TableGridDeleteHandler,
  TablePanelStatus,
} from './components/TableGrid';
import { buildTableTree } from './model/traversal';
import { deleteByFieldPath, parseFieldPath, setByFieldPath } from './model/fieldPath';
import { validateId, validateValue } from './model/validation';

const enum TableUndoType {
  /** 修改既有字段的值 */
  Change,
  /** 新增字段 */
  Add,
  /** 删除字段 */
  Delete,
}

/** 表格撤销操作的载荷：一次可逆变更的字段路径、变更前值与变更后值 */
interface ITableUndoData {
  /** 变更的字段路径 */
  readonly path: string;
  /** 变更前的值，供撤回还原 */
  readonly previousValue: unknown;
  /** 变更后的值，供重做恢复 */
  readonly nextValue: unknown;
}

export interface ITablePanelViewState {
  /** 当前数据加载状态 */
  readonly status: TablePanelStatus;
  /** 当前行树 */
  readonly rows: readonly ITableRowNode[];
  /** 面板级成功提示，缺省时不显示 */
  readonly message?: string;
  /** 面板级错误提示，缺省时不显示 */
  readonly error?: string;
}

interface ITablePanelViewProps {
  /** 面板持有的视图状态订阅源 */
  readonly store: Store<ITablePanelViewState>;
  /** 加载失败态下的重试回调 */
  readonly onRetry: () => void;
  /** 字段提交回调 */
  readonly onChange: TableGridChangeHandler;
  /** 新增子项回调 */
  readonly onAdd: TableGridAddHandler;
  /** 删除子项回调 */
  readonly onDelete: TableGridDeleteHandler;
}

/**
 * 判断一个值是否为可读写的普通对象
 * @param value 待判断的值
 * @returns 是普通对象时为 true
 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * 判断一个未知值是否为表格撤销载荷
 * @param value 待判断的值
 * @returns 含字符串 `path` 字段时为 true
 */
function isTableUndoData(value: unknown): value is ITableUndoData {
  if (typeof value !== 'object' || value === null) return false;
  if (!('path' in value)) return false;

  return typeof value.path === 'string';
}

/**
 * 面板渲染根组件：订阅面板的视图状态并转交给可复用的表格组件
 * @param props 渲染根 props
 * @returns 表格组件元素
 */
function TablePanelView(props: ITablePanelViewProps): ReactElement {
  const view = useStore(props.store);
  const gridProps: ITableGridProps = {
    status: view.status,
    rows: view.rows,
    message: view.message,
    error: view.error,
    onRetry: props.onRetry,
    onChange: props.onChange,
    onAdd: props.onAdd,
    onDelete: props.onDelete,
  };

  return createElement(TableGrid, gridProps);
}

export class TablePanel implements IEditorPanel, ITablePanel {
  /** 面板实例标识符，取自 core 生成的实例 id */
  readonly id: string;

  /** 面板侧上下文，提供资源层读写与撤销能力 */
  private readonly context: IEditorPanelContext;

  /** 面板视图状态订阅源 */
  private readonly viewStore: Store<ITablePanelViewState>;

  /** 缓存的渲染根组件 */
  private readonly component: FC;

  /** 当前目标表；尚未设置时为空 */
  private target: ITablePanelTarget | null = null;

  /** 最近一次读取到的数据内容 */
  private data: unknown = null;

  /** 最近一次读取到的 schema 内容 */
  private schema: unknown = null;

  /** 请求序号，用于丢弃过期请求的异步结果 */
  private requestToken: number = 0;

  constructor(param: IEditorPanelFactoryParam) {
    this.id = param.instanceId;
    this.context = param.context;
    this.viewStore = new Store<ITablePanelViewState>({ status: TablePanelStatus.NoTarget, rows: [] });
    this.component = () =>
      createElement(TablePanelView, {
        store: this.viewStore,
        onRetry: (): void => void this.refresh(),
        onChange: (key, value): void => void this.commitValue(key, value),
        onAdd: (parentPath, name): void => void this.addItem(parentPath, name),
        onDelete: (key): void => void this.deleteItem(key),
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

  async onUpdateResourceList(): Promise<void> {}

  async undo(context: IUndoContext<unknown>): Promise<void> {
    await this.applyUndoRedo(context, true);
  }

  async redo(context: IUndoContext<unknown>): Promise<void> {
    await this.applyUndoRedo(context, false);
  }

  setTable(target: ITablePanelTarget): void {
    this.target = target;
    void this.refresh();
  }

  /**
   * 提交一次字段值变更：先按 schema 校验，再写入资源并记录一次可逆撤销操作
   * @param key 字段路径
   * @param value 新值
   */
  async commitValue(key: string, value: unknown): Promise<void> {
    if (this.target === null) return;

    const row = this.findRow(this.viewStore.state.rows, key);
    const config = row === undefined ? undefined : row.config;

    if (!validateValue(config, value)) {
      this.publishError(`${key} : 输入的值不合要求，请鼠标放置在注释上查看说明`);
      return;
    }

    const previousValue = this.readField(key);
    const next = setByFieldPath(this.data, key, value);

    if (!(await this.persist(next))) return;

    this.context.addUndoContext(this, {
      type: TableUndoType.Change,
      data: { path: key, previousValue, nextValue: value },
    });
    this.applyLoaded(this.schema, next);
  }

  /**
   * 在父路径下新增一项：先用 `validateId` 校验名称，再写入资源并记录一次可逆撤销操作
   * @param parentPath 父级字段路径，顶层为空串
   * @param name 新项名称
   */
  async addItem(parentPath: string, name: string): Promise<void> {
    if (this.target === null) return;

    const parentObject = get(this.data, parseFieldPath(parentPath));
    const existingKeys = isRecord(parentObject) ? Object.keys(parentObject) : [];
    const validation = validateId(name, existingKeys, false);

    if (!validation.valid) {
      this.publishError(validation.error ?? '名称未通过校验');
      return;
    }

    const path = `${parentPath}['${name}']`;
    const next = setByFieldPath(this.data, path, null);

    if (!(await this.persist(next))) return;

    this.context.addUndoContext(this, {
      type: TableUndoType.Add,
      data: { path, previousValue: undefined, nextValue: null },
    });
    this.applyLoaded(this.schema, next, '添加成功，刷新后生效。');
  }

  /**
   * 删除一项：写入资源并记录一次可逆撤销操作；是否允许删除由行内的空值校验决定
   * @param key 字段路径
   */
  async deleteItem(key: string): Promise<void> {
    if (this.target === null) return;

    const previousValue = this.readField(key);
    const next = deleteByFieldPath(this.data, key);

    if (!(await this.persist(next))) return;

    this.context.addUndoContext(this, {
      type: TableUndoType.Delete,
      data: { path: key, previousValue, nextValue: undefined },
    });
    this.applyLoaded(this.schema, next, '删除成功，刷新后生效。');
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
   * @param message 面板级成功提示
   * @param error 面板级错误提示
   */
  private publish(
    status: TablePanelStatus,
    rows: readonly ITableRowNode[],
    message?: string,
    error?: string,
  ): void {
    this.viewStore.setState({ status, rows, message, error });
  }

  /**
   * 保留当前行树、仅更新面板级错误提示
   * @param message 错误提示文案
   */
  private publishError(message: string): void {
    const state = this.viewStore.state;

    this.publish(state.status, state.rows, undefined, message);
  }

  /**
   * 依据已读取的 schema 与数据计算行树并写入视图状态：有字段则就绪，否则落回空态
   * @param schema schema 内容
   * @param data 数据内容
   * @param message 面板级成功提示
   * @param error 面板级错误提示
   */
  private applyLoaded(schema: unknown, data: unknown, message?: string, error?: string): void {
    this.schema = schema;
    this.data = data;

    const rows = buildTableTree(schema, data);

    if (rows.length > 0) {
      this.publish(TablePanelStatus.Ready, rows, message, error);
      return;
    }

    const hasSchema = isRecord(schema);

    this.publish(hasSchema ? TablePanelStatus.Empty : TablePanelStatus.EmptySchema, [], message, error);
  }

  /**
   * 把变更后的数据写入目标表的资源
   * @param data 变更后的完整数据
   */
  private async writeData(data: Record<string, unknown>): Promise<void> {
    const target = this.target;

    if (target === null) return;

    const resource = await this.context.requestResource<Record<string, unknown>>(target.data);

    if (resource === null) return;

    await resource.write(data);
  }

  /**
   * 写入数据并把失败隔离成面板级错误提示，成功时返回 true
   * @param data 变更后的完整数据
   * @returns 写入成功时为 true
   */
  private async persist(data: Record<string, unknown>): Promise<boolean> {
    try {
      await this.writeData(data);
      return true;
    } catch {
      this.publishError('写入失败，请重试。');
      return false;
    }
  }

  /**
   * 读取某字段路径在当前数据中的值
   * @param key 字段路径
   * @returns 字段值；路径不存在时为 undefined
   */
  private readField(key: string): unknown {
    return get(this.data, parseFieldPath(key));
  }

  /**
   * 在行树中按字段路径查找一个行节点
   * @param rows 行树节点列表
   * @param key 字段路径
   * @returns 命中的行节点；未命中时为 undefined
   */
  private findRow(rows: readonly ITableRowNode[], key: string): ITableRowNode | undefined {
    for (const row of rows) {
      if (row.key === key) return row;

      const children = row.children;

      if (children === undefined) continue;

      const found = this.findRow(children, key);

      if (found !== undefined) return found;
    }

    return undefined;
  }

  /**
   * 依据撤销类型与方向计算应用后（或撤销后）的完整数据
   * @param type 撤销操作类型号
   * @param payload 撤销载荷
   * @param isUndo 为 true 时应用逆操作，为 false 时应用正向操作
   * @returns 计算后的完整数据；类型号未知时为 undefined
   */
  private computeState(
    type: number,
    payload: ITableUndoData,
    isUndo: boolean,
  ): Record<string, unknown> | undefined {
    if (type === TableUndoType.Change) {
      return setByFieldPath(this.data, payload.path, isUndo ? payload.previousValue : payload.nextValue);
    }

    if (type === TableUndoType.Add) {
      return isUndo
        ? deleteByFieldPath(this.data, payload.path)
        : setByFieldPath(this.data, payload.path, payload.nextValue);
    }

    if (type === TableUndoType.Delete) {
      return isUndo
        ? setByFieldPath(this.data, payload.path, payload.previousValue)
        : deleteByFieldPath(this.data, payload.path);
    }

    return undefined;
  }

  /**
   * 执行一次撤回或重做：写回资源并重算视图；写入失败时抛出，使撤销系统保留历史以便重试
   * @param context 撤销上下文
   * @param isUndo 为 true 时执行撤回，为 false 时执行重做
   */
  private async applyUndoRedo(context: IUndoContext<unknown>, isUndo: boolean): Promise<void> {
    if (this.target === null) return;
    if (!isTableUndoData(context.data)) return;

    const next = this.computeState(context.type, context.data, isUndo);

    if (next === undefined) return;

    await this.writeData(next);
    this.applyLoaded(this.schema, next);
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
