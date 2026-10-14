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
import { createElement, FC, ReactElement, useCallback, useEffect, useRef, useState } from 'react';
import { ICodeEditorOpener, ITablePanelOpener } from '../react';
import { ITablePanel, ITablePanelParam, ITablePanelTarget, ITableRowNode } from './types';
import {
  ITableGridProps,
  TableGrid,
  TableGridAddHandler,
  TableGridChangeHandler,
  TableGridDeleteHandler,
  TablePanelStatus,
} from './components/TableGrid';
import { buildTableTree } from './model/traversal';
import { buildSchemaTree, isSchemaResourceId } from './model/schemaPresentation';
import {
  deleteByFieldPath,
  getParentFieldPath,
  getShortField,
  insertAfterFieldPath,
  parseFieldPath,
  setByFieldPath,
} from './model/fieldPath';
import { validateId, validateValue } from './model/validation';
import { tableSchemaResourceId } from './resourceType';

/** 多栏布局中每栏的默认像素宽度 */
const DEFAULT_COLUMN_WIDTH = 500;

const enum TableUndoType {
  /** 修改既有字段的值 */
  Change,
  /** 新增字段 */
  Add,
  /** 删除字段 */
  Delete,
  /** 整份资源替换（代码编辑器写回，D-30） */
  Replace,
}

/** 表格撤销操作的载荷：一次可逆变更所在的栏与字段路径、变更前值与变更后值 */
interface ITableUndoData {
  /** 变更所在的栏序号（0 基） */
  readonly columnIndex: number;
  /** 变更的字段路径 */
  readonly path: string;
  /** 变更前的值，供撤回还原 */
  readonly previousValue: unknown;
  /** 变更后的值，供重做恢复 */
  readonly nextValue: unknown;
  /** 新增时的锚点短名，供重做时把字段插回锚点行之后；非新增操作缺省 */
  readonly anchor?: string;
  /** 新增前 schema 的整份内容（数据表新增会同步写 `x-order`）；非新增操作缺省 */
  readonly previousSchema?: unknown;
  /** 新增后 schema 的整份内容；非新增操作缺省 */
  readonly nextSchema?: unknown;
}

/**
 * 计算同级字段的新顺序：按既有顺序（缺失时按数据键序）排出，并把 `name` 插到 `anchor` 之后
 * @param keys 变更前该层对象的字段名列表
 * @param existing 该层既有 `x-order`，可缺省或非法
 * @param anchor 新字段应紧接其后的锚点短名；不存在时追加到末尾
 * @param name 新增字段名
 * @returns 插入后的完整同级字段顺序
 */
function computeSiblingOrder(keys: readonly string[], existing: unknown, anchor: string, name: string): string[] {
  const order = Array.isArray(existing) ? existing.filter((key): key is string => typeof key === 'string') : [];
  const combined: string[] = [];
  const seen = new Set<string>();

  for (const key of order) {
    if (!keys.includes(key) || seen.has(key)) continue;

    combined.push(key);
    seen.add(key);
  }

  for (const key of keys) {
    if (seen.has(key)) continue;

    combined.push(key);
    seen.add(key);
  }

  const result = combined.filter((key) => key !== name);
  const index = result.indexOf(anchor);

  if (index === -1) result.push(name);
  else result.splice(index + 1, 0, name);

  return result;
}

/** 多栏布局中一栏的运行时状态 */
interface ITablePanelColumn {
  /** 该栏的目标表；尚未设置时为空 */
  target: ITablePanelTarget | null;
  /** 该栏最近读取到的数据内容 */
  data: unknown;
  /** 该栏最近读取到的 schema 内容 */
  schema: unknown;
  /** 该栏的视图状态订阅源 */
  readonly store: Store<ITablePanelViewState>;
}

export interface ITablePanelViewState {
  /** 当前数据加载状态 */
  readonly status: TablePanelStatus;
  /** 当前行树 */
  readonly rows: readonly ITableRowNode[];
  /** 当前目标是否为 schema（schema 专用呈现模式） */
  readonly schemaMode: boolean;
  /** 面板级成功提示，缺省时不显示 */
  readonly message?: string;
  /** 面板级错误提示，缺省时不显示 */
  readonly error?: string;
  /** 可选的面板标题（资源名等），缺省时不显示 */
  readonly title?: string;
}

/** 面板渲染根的 props：按可用宽度铺出多栏，每栏一张独立订阅的表格 */
interface ITablePanelViewProps {
  /** 按栏序号取该栏的视图状态订阅源（缺失时按需补建空栏） */
  readonly getStore: (columnIndex: number) => Store<ITablePanelViewState>;
  /** 每栏的像素宽度 */
  readonly columnWidth: number;
  /** 视图把当前铺出的可视栏数回报给面板（供「编辑 Schema」复用空栏） */
  readonly onLayout: (columnCount: number) => void;
  /** 某栏加载失败态下的重试回调 */
  readonly onRetry: (columnIndex: number) => void;
  /** 某栏的字段提交回调 */
  readonly onChange: (columnIndex: number, key: string, value: unknown) => void;
  /** 某栏的新增子项回调（锚点行键 + 新名称） */
  readonly onAdd: (columnIndex: number, anchorKey: string, name: string) => void;
  /** 某栏的删除子项回调 */
  readonly onDelete: (columnIndex: number, key: string) => void;
  /** 某栏的「编辑 Schema」回调 */
  readonly onOpenSchema: (columnIndex: number, opener: ITablePanelOpener) => void;
  /** 某栏的「在代码编辑器中打开」回调 */
  readonly onOpenInCodeEditor: (columnIndex: number, opener: ICodeEditorOpener) => void;
  /** 某栏的「关闭本栏表格」回调 */
  readonly onCloseColumn: (columnIndex: number) => void;
}

/** 单栏组件的 props：把该栏序号与各回调转交给一张表格 */
interface ITableColumnProps {
  /** 该栏的序号（0 基） */
  readonly columnIndex: number;
  /** 按栏序号取该栏的视图状态订阅源 */
  readonly getStore: (columnIndex: number) => Store<ITablePanelViewState>;
  /** 该栏加载失败态下的重试回调 */
  readonly onRetry: (columnIndex: number) => void;
  /** 该栏的字段提交回调 */
  readonly onChange: (columnIndex: number, key: string, value: unknown) => void;
  /** 该栏的新增子项回调（锚点行键 + 新名称） */
  readonly onAdd: (columnIndex: number, anchorKey: string, name: string) => void;
  /** 该栏的删除子项回调 */
  readonly onDelete: (columnIndex: number, key: string) => void;
  /** 该栏的「编辑 Schema」回调 */
  readonly onOpenSchema: (columnIndex: number, opener: ITablePanelOpener) => void;
  /** 该栏的「在代码编辑器中打开」回调 */
  readonly onOpenInCodeEditor: (columnIndex: number, opener: ICodeEditorOpener) => void;
  /** 该栏的「关闭本栏表格」回调 */
  readonly onCloseColumn: (columnIndex: number) => void;
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
 * 按字段路径读取一个值：空路径直接返回源对象（`get` 对空路径返回 undefined，此处按语义补正）
 * @param source 源对象
 * @param path 字段路径字符串
 * @returns 路径上的值；路径为空时为源对象本身
 */
function readAt(source: unknown, path: string): unknown {
  const segments = parseFieldPath(path);

  return segments.length === 0 ? source : get(source, segments);
}

/**
 * 判断一个未知值是否为表格撤销载荷
 * @param value 待判断的值
 * @returns 含字符串 `path` 与数值 `columnIndex` 字段时为 true
 */
function isTableUndoData(value: unknown): value is ITableUndoData {
  if (typeof value !== 'object' || value === null) return false;
  if (!('path' in value) || !('columnIndex' in value)) return false;

  return typeof value.path === 'string' && typeof value.columnIndex === 'number';
}

/**
 * 把代码编辑器返回的文本解析为 JSON 对象；解析失败或不是对象时返回 null（T-02-23）
 * @param text 编辑器返回的文本
 * @returns 解析出的普通对象；解析失败或不是对象时为 null
 */
function parseJsonRecord(text: string): Record<string, unknown> | null {
  let parsed: unknown;

  // 返回文本来自外部编辑器，必须解析校验后才允许写回，解析失败即拒绝（T-02-23）
  try {
    parsed = JSON.parse(text);
  } catch {
    return null;
  }

  return isRecord(parsed) ? parsed : null;
}

/**
 * 从打开参数收窄每栏宽度：缺省、非数字或非正数时回退默认宽度
 * @param openParam 面板打开参数（不透明记录）
 * @returns 每栏的像素宽度
 */
function resolveColumnWidth(openParam: Record<string, unknown> | undefined): number {
  if (openParam === undefined) return DEFAULT_COLUMN_WIDTH;

  const width = openParam.columnWidth;

  return typeof width === 'number' && width > 0 ? width : DEFAULT_COLUMN_WIDTH;
}

/**
 * 计算可视栏数：按窗口宽度与每栏宽度向下取整，至少保留一栏
 * @param windowWidth 窗口可用宽度（像素）
 * @param columnWidth 期望的每栏宽度（像素）
 * @returns 可视栏数，下限为 1
 */
function resolveColumnCount(windowWidth: number, columnWidth: number): number {
  return Math.max(1, Math.floor(windowWidth / columnWidth));
}

/**
 * 单栏组件：订阅该栏视图状态并把各回调绑定到该栏序号后渲染一张表格
 *
 * 各回调经 `useCallback` 稳定身份（依赖为来自视图根、本身稳定的 props），配合 `React.memo(TableGrid)`
 * 的浅比较，使该栏状态未实质变化时不重渲染整张表（P26）。
 * @param props 单栏 props
 * @returns 该栏的表格元素
 */
function TableColumn(props: ITableColumnProps): ReactElement {
  const view = useStore(props.getStore(props.columnIndex));
  const onRetry = useCallback((): void => props.onRetry(props.columnIndex), [props.onRetry, props.columnIndex]);
  const onChange = useCallback(
    (key: string, value: unknown): void => props.onChange(props.columnIndex, key, value),
    [props.onChange, props.columnIndex],
  );
  const onAdd = useCallback(
    (anchorKey: string, name: string): void => props.onAdd(props.columnIndex, anchorKey, name),
    [props.onAdd, props.columnIndex],
  );
  const onDelete = useCallback(
    (key: string): void => props.onDelete(props.columnIndex, key),
    [props.onDelete, props.columnIndex],
  );
  const onOpenSchema = useCallback(
    (opener: ITablePanelOpener): void => props.onOpenSchema(props.columnIndex, opener),
    [props.onOpenSchema, props.columnIndex],
  );
  const onOpenInCodeEditor = useCallback(
    (opener: ICodeEditorOpener): void => props.onOpenInCodeEditor(props.columnIndex, opener),
    [props.onOpenInCodeEditor, props.columnIndex],
  );
  const onCloseColumn = useCallback(
    (): void => props.onCloseColumn(props.columnIndex),
    [props.onCloseColumn, props.columnIndex],
  );
  const gridProps: ITableGridProps = {
    status: view.status,
    rows: view.rows,
    message: view.message,
    error: view.error,
    schemaMode: view.schemaMode,
    title: view.title,
    onRetry,
    onChange,
    onAdd,
    onDelete,
    onOpenSchema,
    onOpenInCodeEditor,
    onCloseColumn,
  };

  return createElement(
    'div',
    { className: 'etable-column', style: { flexGrow: 1, flexShrink: 1, flexBasis: 0 } },
    createElement(TableGrid, gridProps),
  );
}

/**
 * 面板渲染根组件：按窗口宽度与每栏宽度铺出等分栏，每栏一张独立表格
 * @param props 渲染根 props
 * @returns 多栏容器元素
 */
function TablePanelView(props: ITablePanelViewProps): ReactElement {
  const containerRef = useRef<HTMLDivElement>(null);
  const widthState = useState<number>((): number => window.innerWidth);
  const windowWidth = widthState[0];
  const setWindowWidth = widthState[1];

  useEffect((): (() => void) | undefined => {
    const element = containerRef.current;

    setWindowWidth(window.innerWidth);

    if (element === null) return undefined;

    if (typeof ResizeObserver === 'undefined') return undefined;

    const observer = new ResizeObserver((): void => setWindowWidth(window.innerWidth));

    observer.observe(element);

    // 释放观察器，避免组件卸载后泄漏（T-02-20-01）
    return (): void => observer.disconnect();
  }, []);

  const count = resolveColumnCount(windowWidth, props.columnWidth);

  // 把当前铺出的可视栏数回报给面板，供「编辑 Schema」在可视范围内寻找空栏
  useEffect((): void => {
    props.onLayout(count);
  }, [count, props.onLayout]);

  const columns: ReactElement[] = [];

  for (let index = 0; index < count; index += 1) {
    columns.push(
      createElement(TableColumn, {
        key: index,
        columnIndex: index,
        getStore: props.getStore,
        onRetry: props.onRetry,
        onChange: props.onChange,
        onAdd: props.onAdd,
        onDelete: props.onDelete,
        onOpenSchema: props.onOpenSchema,
        onOpenInCodeEditor: props.onOpenInCodeEditor,
        onCloseColumn: props.onCloseColumn,
      }),
    );
  }

  return createElement(
    'div',
    { className: 'etable-columns', ref: containerRef, 'data-test-id': 'table-columns' },
    columns,
  );
}

export class TablePanel implements IEditorPanel, ITablePanel {
  /** 面板实例标识符，取自 core 生成的实例 id */
  readonly id: string;

  /** 面板侧上下文，提供资源层读写与撤销能力 */
  private readonly context: IEditorPanelContext;

  /** 缓存的渲染根组件 */
  private readonly component: FC;

  /** 每栏的像素宽度 */
  private readonly columnWidth: number;

  /** 视图当前铺出的可视栏数，由视图经 `onLayout` 回报，至少为 1 */
  private visibleColumnCount: number = 1;

  /** 各栏的运行时状态；按需补建，至少第 0 栏 */
  private readonly columns: ITablePanelColumn[] = [];

  /** 各栏的请求序号，用于丢弃过期请求的异步结果 */
  private readonly requestTokens: number[] = [];

  constructor(param: IEditorPanelFactoryParam) {
    this.id = param.instanceId;
    this.context = param.context;
    this.columnWidth = resolveColumnWidth(param.openParam);
    this.component = () =>
      createElement(TablePanelView, {
        getStore: (columnIndex): Store<ITablePanelViewState> => this.columnAt(columnIndex).store,
        columnWidth: this.columnWidth,
        onLayout: (columnCount): void => {
          this.visibleColumnCount = columnCount;
        },
        onRetry: (columnIndex): void => void this.refresh(columnIndex),
        onChange: (columnIndex, key, value): void => void this.commitValue(key, value, columnIndex),
        onAdd: (columnIndex, anchorKey, name): void => void this.addItem(anchorKey, name, columnIndex),
        onDelete: (columnIndex, key): void => void this.deleteItem(key, columnIndex),
        onOpenSchema: (columnIndex, opener): void => void this.openSchemaPanel(opener, columnIndex),
        onOpenInCodeEditor: (columnIndex, opener): void => void this.openCurrentViewInCodeEditor(opener, columnIndex),
        onCloseColumn: (columnIndex): void => this.closeColumn(columnIndex),
      });
  }

  async initialize(): Promise<void> {}

  async dispose(): Promise<void> {}

  render(): FC {
    return this.component;
  }

  /**
   * 获取此面板实例的显示标题，供外壳标签按实例显示（如「表格 table.demo」）
   * @returns 已设目标时为「表格 <资源 id>」；未设目标时为 undefined，外壳据此回退面板类型名
   */
  getTitle(): string | undefined {
    const column = this.columns[0];

    if (column === undefined) return undefined;

    const target = column.target;

    return target === null ? undefined : `表格 ${target.data.id}`;
  }

  async onFocus(): Promise<void> {}

  async onBlur(): Promise<void> {}

  async onSwitchIn(): Promise<void> {
    const count = this.columns.length;

    for (let index = 0; index < count; index += 1) await this.refresh(index);
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

  setTable(target: ITablePanelTarget, columnIndex: number = 0): void {
    const column = this.columnAt(columnIndex);
    const previous = column.target;

    column.target = target;

    // 换到另一张表（或此前无目标）时先清掉旧表行树：不同表的旧行在新表加载期间不能继续显示（P26）
    if (previous === null || previous.data.id !== target.data.id) {
      this.publish(columnIndex, TablePanelStatus.Loading, []);
    }

    void this.refresh(columnIndex);
  }

  /**
   * 关闭某一栏的表格：清空本栏目标与内容并回到未设目标态，只作用于本栏
   *
   * 关闭后本栏 `target` 归空，`findEmptyColumnIndex` 随后即可把它当作空栏供「编辑 Schema」复用；
   * 同时递增本栏请求序号以丢弃在途读取结果，避免关闭后旧结果再写回本栏。其它栏的目标与状态不受影响。
   * @param columnIndex 要关闭的栏序号（0 基）
   */
  private closeColumn(columnIndex: number): void {
    const column = this.columnAt(columnIndex);

    column.target = null;
    column.data = null;
    column.schema = null;
    this.nextToken(columnIndex);
    this.publish(columnIndex, TablePanelStatus.NoTarget, []);
  }

  /**
   * 在当前可视栏范围内查找第一个尚未设目标的空栏
   * @returns 空栏的序号（0 基）；当前可视栏都已设目标时为 -1
   */
  private findEmptyColumnIndex(): number {
    for (let index = 0; index < this.visibleColumnCount; index += 1) {
      const column = this.columns[index];

      if (column === undefined || column.target === null) return index;
    }

    return -1;
  }

  /**
   * 优先把当前表的 schema 放进本面板的一个空栏；没有空栏时才经注入的打开器新开面板（D-06 / P1）
   * @param opener 组合根注入的表格面板打开器
   * @param columnIndex 取表名的栏序号（0 基），省略为第 0 栏
   */
  async openSchemaPanel(opener: ITablePanelOpener, columnIndex: number = 0): Promise<void> {
    const name = this.currentTableName(columnIndex);

    if (name === null) return;

    const target: ITablePanelTarget = {
      data: tableSchemaResourceId(name),
      schema: tableSchemaResourceId(name),
    };
    const emptyIndex = this.findEmptyColumnIndex();

    if (emptyIndex !== -1) {
      this.setTable(target, emptyIndex);
      return;
    }

    const param: ITablePanelParam = { target };

    await opener.open(param);
  }

  /**
   * 在注入的代码编辑器中打开某一栏当前视图对应的资源内容，并把确认返回的整份内容写回（D-30）
   * @param opener 组合根注入的代码编辑器打开器
   * @param columnIndex 目标栏序号（0 基），省略为第 0 栏
   */
  async openCurrentViewInCodeEditor(opener: ICodeEditorOpener, columnIndex: number = 0): Promise<void> {
    const column = this.columnAt(columnIndex);
    const target = column.target;

    if (target === null) return;

    const content = JSON.stringify(column.data, null, 2) ?? '';
    const result = await opener.open({ title: target.data.id, content });

    if (result === null) return;

    const parsed = parseJsonRecord(result);

    if (parsed === null) {
      this.publishError(columnIndex, '内容不是合法的 JSON，未写回。');
      return;
    }

    if (!(await this.persist(columnIndex, parsed))) return;

    this.context.addUndoContext(this, {
      type: TableUndoType.Replace,
      data: { columnIndex, path: '', previousValue: column.data, nextValue: parsed },
    });
    this.applyData(columnIndex, parsed);
    this.refreshDependents(columnIndex, target.data);
  }

  /**
   * 提交某栏一次字段值变更：先按 schema 校验，再写入资源并记录一次可逆撤销操作
   * @param key 字段路径
   * @param value 新值
   * @param columnIndex 目标栏序号（0 基），省略为第 0 栏
   */
  async commitValue(key: string, value: unknown, columnIndex: number = 0): Promise<void> {
    const column = this.columnAt(columnIndex);

    if (column.target === null) return;

    const row = this.findRow(column.store.state.rows, key);
    const config = row === undefined ? undefined : row.config;

    if (!validateValue(config, value)) {
      this.publishError(columnIndex, `${key} : 输入的值不合要求，请鼠标放置在注释上查看说明`);
      return;
    }

    const previousValue = this.readField(columnIndex, key);
    const next = setByFieldPath(column.data, key, value);

    if (!(await this.persist(columnIndex, next))) return;

    this.context.addUndoContext(this, {
      type: TableUndoType.Change,
      data: { columnIndex, path: key, previousValue, nextValue: value },
    });
    this.applyData(columnIndex, next);
    this.refreshDependents(columnIndex, column.target.data);
  }

  /**
   * 在某栏新增一项：新字段插到锚点行**之后**（不是末尾），并把新名称同步写进该层 schema 的
   * `x-order`（数据表视图写 schema 资源，schema 视图写在自身）；先用 `validateId` 校验名称，
   * 再写入资源并记录一次可逆撤销操作
   * @param anchorKey 锚点行的字段路径（新字段插在其后）；无锚点时追加到末尾
   * @param name 新项名称
   * @param columnIndex 目标栏序号（0 基），省略为第 0 栏
   */
  async addItem(anchorKey: string, name: string, columnIndex: number = 0): Promise<void> {
    const column = this.columnAt(columnIndex);

    if (column.target === null) return;

    const parentPath = getParentFieldPath(anchorKey);
    const parentObject = readAt(column.data, parentPath);
    const existingKeys = isRecord(parentObject) ? Object.keys(parentObject) : [];
    const validation = validateId(name, existingKeys, false);

    if (!validation.valid) {
      this.publishError(columnIndex, validation.error ?? '名称未通过校验');
      return;
    }

    const schemaView = this.isSchemaView(columnIndex);
    const anchor = getShortField(anchorKey);
    const path = `${parentPath}['${name}']`;
    const next = insertAfterFieldPath(column.data, path, anchor, schemaView ? {} : null);

    if (!this.wasAdded(next, parentPath, name)) {
      this.publishError(columnIndex, '名称不合法，未添加。');
      return;
    }

    const ownerPath = schemaView ? this.schemaOwnerPath(parentPath) : this.schemaMirrorPath(parentPath);

    if (schemaView) {
      const ordered = this.withOrder(next, ownerPath, parentObject, anchor, name);

      if (!(await this.persist(columnIndex, ordered))) return;

      this.context.addUndoContext(this, {
        type: TableUndoType.Add,
        data: { columnIndex, path, previousValue: undefined, nextValue: {}, anchor },
      });
      this.applyData(columnIndex, ordered, '添加成功');
      this.refreshDependents(columnIndex, column.target.data);
      return;
    }

    const previousSchema = column.schema;
    const nextSchema = isRecord(previousSchema)
      ? this.withOrder(previousSchema, ownerPath, parentObject, anchor, name)
      : undefined;

    if (!(await this.persist(columnIndex, next))) return;

    this.refreshDependents(columnIndex, column.target.data);

    if (nextSchema !== undefined) {
      if (!(await this.persistSchema(columnIndex, nextSchema))) return;

      column.schema = nextSchema;
      this.refreshDependents(columnIndex, column.target.schema);
    }

    this.context.addUndoContext(this, {
      type: TableUndoType.Add,
      data: { columnIndex, path, previousValue: undefined, nextValue: null, anchor, previousSchema, nextSchema },
    });
    this.applyData(columnIndex, next, '添加成功');
  }

  /**
   * 删除某栏的一项：写入资源并记录一次可逆撤销操作；是否允许删除由行内的空值校验决定
   * @param key 字段路径
   * @param columnIndex 目标栏序号（0 基），省略为第 0 栏
   */
  async deleteItem(key: string, columnIndex: number = 0): Promise<void> {
    const column = this.columnAt(columnIndex);

    if (column.target === null) return;

    const previousValue = this.readField(columnIndex, key);
    const next = deleteByFieldPath(column.data, key);

    if (!(await this.persist(columnIndex, next))) return;

    this.context.addUndoContext(this, {
      type: TableUndoType.Delete,
      data: { columnIndex, path: key, previousValue, nextValue: undefined },
    });
    this.applyData(columnIndex, next, '删除成功');
    this.refreshDependents(columnIndex, column.target.data);
  }

  /**
   * 取第 columnIndex 栏的运行时状态，缺失时按需补建空栏
   * @param columnIndex 栏序号（0 基）
   * @returns 该栏的运行时状态
   */
  private columnAt(columnIndex: number): ITablePanelColumn {
    while (this.columns.length <= columnIndex) this.columns.push(this.createColumn());

    return this.columns[columnIndex];
  }

  /**
   * 新建一栏的空运行时状态：无目标、无数据，视图落回未设目标态
   * @returns 新的栏状态
   */
  private createColumn(): ITablePanelColumn {
    return {
      target: null,
      data: null,
      schema: null,
      store: new Store<ITablePanelViewState>({ status: TablePanelStatus.NoTarget, rows: [], schemaMode: false }),
    };
  }

  /**
   * 递增并返回某栏的请求序号，用于判定异步结果是否仍是最新一次请求
   * @param columnIndex 栏序号（0 基）
   * @returns 该栏递增后的请求序号
   */
  private nextToken(columnIndex: number): number {
    const next = (this.requestTokens[columnIndex] ?? 0) + 1;

    this.requestTokens[columnIndex] = next;
    return next;
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
   * 把某栏新的视图状态写入其订阅源
   * @param columnIndex 栏序号（0 基）
   * @param status 新的加载状态
   * @param rows 新的行树
   * @param message 面板级成功提示
   * @param error 面板级错误提示
   */
  private publish(
    columnIndex: number,
    status: TablePanelStatus,
    rows: readonly ITableRowNode[],
    message?: string,
    error?: string,
  ): void {
    const target = this.columnAt(columnIndex).target;

    this.columnAt(columnIndex).store.setState({
      status,
      rows,
      schemaMode: target !== null && isSchemaResourceId(target.data.id),
      title: target === null ? undefined : target.data.id,
      message,
      error,
    });
  }

  /**
   * 保留某栏当前行树、仅更新其面板级错误提示
   * @param columnIndex 栏序号（0 基）
   * @param message 错误提示文案
   */
  private publishError(columnIndex: number, message: string): void {
    const state = this.columnAt(columnIndex).store.state;

    this.publish(columnIndex, state.status, state.rows, undefined, message);
  }

  /**
   * 依据已读取的 schema 与数据计算某栏行树并写入视图状态：有字段则就绪，否则落回空态
   * @param columnIndex 栏序号（0 基）
   * @param schema schema 内容
   * @param data 数据内容
   * @param message 面板级成功提示
   * @param error 面板级错误提示
   */
  private applyLoaded(columnIndex: number, schema: unknown, data: unknown, message?: string, error?: string): void {
    const column = this.columnAt(columnIndex);

    column.schema = schema;
    column.data = data;

    const rows = buildTableTree(schema, data);

    if (rows.length > 0) {
      this.publish(columnIndex, TablePanelStatus.Ready, rows, message, error);
      return;
    }

    const hasSchema = isRecord(schema);

    this.publish(columnIndex, hasSchema ? TablePanelStatus.Empty : TablePanelStatus.EmptySchema, [], message, error);
  }

  /**
   * 依据 schema 文档计算某栏 schema 呈现行树并写入视图状态：有关键字则就绪，否则落回空态
   * @param columnIndex 栏序号（0 基）
   * @param schema schema 文档内容
   * @param message 面板级成功提示
   * @param error 面板级错误提示
   */
  private applySchemaLoaded(columnIndex: number, schema: unknown, message?: string, error?: string): void {
    const column = this.columnAt(columnIndex);

    column.schema = null;
    column.data = schema;

    const rows = buildSchemaTree(schema);

    if (rows.length > 0) {
      this.publish(columnIndex, TablePanelStatus.Ready, rows, message, error);
      return;
    }

    this.publish(columnIndex, TablePanelStatus.EmptySchema, [], message, error);
  }

  /**
   * 按某栏目标是否为 schema 选择呈现方式重算该栏视图
   * @param columnIndex 栏序号（0 基）
   * @param next 变更后的完整内容
   * @param message 面板级成功提示
   * @param error 面板级错误提示
   */
  private applyData(columnIndex: number, next: unknown, message?: string, error?: string): void {
    if (this.isSchemaView(columnIndex)) {
      this.applySchemaLoaded(columnIndex, next, message, error);
      return;
    }

    this.applyLoaded(columnIndex, this.columnAt(columnIndex).schema, next, message, error);
  }

  /**
   * 判断某栏目标是否为 schema 视图（schema 视图不向资源层请求 schema）
   * @param columnIndex 栏序号（0 基）
   * @returns 该栏的数据资源 id 形如 `table#schema.<name>` 时为 true
   */
  private isSchemaView(columnIndex: number): boolean {
    const target = this.columnAt(columnIndex).target;

    return target !== null && isSchemaResourceId(target.data.id);
  }

  /**
   * 从某栏目标的资源 id 推导表名
   * @param columnIndex 栏序号（0 基）
   * @returns 表名；该栏目标未设置或 id 不合约定时为 null
   */
  private currentTableName(columnIndex: number): string | null {
    const target = this.columnAt(columnIndex).target;

    if (target === null) return null;

    const id = target.data.id;
    const prefix = 'table.';

    return id.startsWith(prefix) ? id.slice(prefix.length) : null;
  }

  /**
   * 把某栏变更后的数据写入其目标表的资源
   * @param columnIndex 栏序号（0 基）
   * @param data 变更后的完整数据
   */
  private async writeData(columnIndex: number, data: Record<string, unknown>): Promise<void> {
    const target = this.columnAt(columnIndex).target;

    if (target === null) return;

    const resource = await this.context.requestResource<Record<string, unknown>>(target.data);

    if (resource === null) return;

    await resource.write(data);
  }

  /**
   * 写入某栏数据并把失败隔离成该栏面板级错误提示，成功时返回 true
   * @param columnIndex 栏序号（0 基）
   * @param data 变更后的完整数据
   * @returns 写入成功时为 true
   */
  private async persist(columnIndex: number, data: Record<string, unknown>): Promise<boolean> {
    try {
      await this.writeData(columnIndex, data);
      return true;
    } catch {
      this.publishError(columnIndex, '写入失败，请重试。');
      return false;
    }
  }

  /**
   * 把某栏变更后的 schema 写入其目标的 schema 资源，并把失败隔离成该栏面板级错误提示
   * @param columnIndex 栏序号（0 基）
   * @param schema 变更后的 schema 内容
   * @returns 写入成功时为 true
   */
  private async persistSchema(columnIndex: number, schema: unknown): Promise<boolean> {
    const target = this.columnAt(columnIndex).target;

    if (target === null) return true;

    const resource = await this.context.requestResource<Record<string, unknown>>(target.schema);

    if (resource === null) return true;

    try {
      if (isRecord(schema)) await resource.write(schema);

      return true;
    } catch {
      this.publishError(columnIndex, '写入失败，请重试。');
      return false;
    }
  }

  /**
   * 把某栏的 schema 内容写入其 schema 资源（撤回 / 重做路径用）
   * @param columnIndex 栏序号（0 基）
   * @param schema 要写回的 schema 内容
   */
  private async writeSchema(columnIndex: number, schema: unknown): Promise<void> {
    const target = this.columnAt(columnIndex).target;

    if (target === null) return;

    const resource = await this.context.requestResource<Record<string, unknown>>(target.schema);

    if (resource === null) return;

    if (isRecord(schema)) await resource.write(schema);
  }

  /**
   * 判断新增字段是否已写入目标层对象（写入被危险段防护拒绝时为 false）
   * @param next 写入后的完整数据
   * @param parentPath 目标层对象的字段路径
   * @param name 新增字段名
   * @returns 目标层对象已含有该自有字段时为 true
   */
  private wasAdded(next: Record<string, unknown>, parentPath: string, name: string): boolean {
    const parent = readAt(next, parentPath);

    return isRecord(parent) && Object.prototype.hasOwnProperty.call(parent, name);
  }

  /**
   * 取数据路径在 schema 文档中的镜像路径：数据 `['a']['b']` 镜像为 `['properties']['a']['properties']['b']`
   * @param parentPath 数据字段路径（顶层为空串）
   * @returns schema 文档中对应的对象路径
   */
  private schemaMirrorPath(parentPath: string): string {
    const mirrored: string[] = [];

    for (const segment of parseFieldPath(parentPath)) {
      mirrored.push('properties', segment);
    }

    return mirrored.map((segment) => `['${segment}']`).join('');
  }

  /**
   * 取 schema 视图下属性父路径对应的「持有 properties 的节点」路径：去掉末尾的 `['properties']` 段
   * @param parentPath schema 视图下的字段路径（形如 `['properties']`）
   * @returns 持有该 properties 的节点路径
   */
  private schemaOwnerPath(parentPath: string): string {
    const segments = parseFieldPath(parentPath);

    if (segments[segments.length - 1] === 'properties') segments.pop();

    return segments.map((segment) => `['${segment}']`).join('');
  }

  /**
   * 把新字段名插入某节点 `x-order` 的锚点键之后，并把完整同级顺序写回文档（缺省时新建 `x-order`）
   * @param document 承载 `x-order` 的文档（数据表视图为 schema 文档，schema 视图为其自身）
   * @param ownerPath 持有 `x-order` 的节点路径
   * @param parentObject 变更前该层对象（提供字段名列表）
   * @param anchor 新字段应紧接其后的锚点短名
   * @param name 新字段名
   * @returns 写入 `x-order` 后的新文档
   */
  private withOrder(
    document: unknown,
    ownerPath: string,
    parentObject: unknown,
    anchor: string,
    name: string,
  ): Record<string, unknown> {
    const keys = isRecord(parentObject) ? Object.keys(parentObject) : [];
    const existing = get(document, [...parseFieldPath(ownerPath), 'x-order']);
    const order = computeSiblingOrder(keys, existing, anchor, name);

    return setByFieldPath(document, `${ownerPath}['x-order']`, order);
  }

  /**
   * 读取某栏某字段路径在当前数据中的值
   * @param columnIndex 栏序号（0 基）
   * @param key 字段路径
   * @returns 字段值；路径不存在时为 undefined
   */
  private readField(columnIndex: number, key: string): unknown {
    return get(this.columnAt(columnIndex).data, parseFieldPath(key));
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
   * 依据撤销类型与方向计算某栏应用后（或撤销后）的完整数据
   * @param column 撤销操作所属的栏
   * @param type 撤销操作类型号
   * @param payload 撤销载荷
   * @param isUndo 为 true 时应用逆操作，为 false 时应用正向操作
   * @returns 计算后的完整数据；类型号未知时为 undefined
   */
  private computeState(
    column: ITablePanelColumn,
    type: number,
    payload: ITableUndoData,
    isUndo: boolean,
  ): Record<string, unknown> | undefined {
    if (type === TableUndoType.Change) {
      return setByFieldPath(column.data, payload.path, isUndo ? payload.previousValue : payload.nextValue);
    }

    if (type === TableUndoType.Add) {
      if (isUndo) return deleteByFieldPath(column.data, payload.path);

      return payload.anchor === undefined
        ? setByFieldPath(column.data, payload.path, payload.nextValue)
        : insertAfterFieldPath(column.data, payload.path, payload.anchor, payload.nextValue);
    }

    if (type === TableUndoType.Delete) {
      return isUndo
        ? setByFieldPath(column.data, payload.path, payload.previousValue)
        : deleteByFieldPath(column.data, payload.path);
    }

    if (type === TableUndoType.Replace) {
      const value = isUndo ? payload.previousValue : payload.nextValue;

      return isRecord(value) ? value : undefined;
    }

    return undefined;
  }

  /**
   * 执行一次撤回或重做：对载荷所记的栏写回资源并重算；栏号越界时忽略，绝不误写其它栏
   * @param context 撤销上下文
   * @param isUndo 为 true 时执行撤回，为 false 时执行重做
   */
  private async applyUndoRedo(context: IUndoContext<unknown>, isUndo: boolean): Promise<void> {
    if (!isTableUndoData(context.data)) return;

    const columnIndex = context.data.columnIndex;

    if (columnIndex < 0 || columnIndex >= this.columns.length) return;

    const column = this.columns[columnIndex];

    if (column.target === null) return;

    const next = this.computeState(column, context.type, context.data, isUndo);

    if (next === undefined) return;

    await this.writeData(columnIndex, next);
    this.refreshDependents(columnIndex, column.target.data);

    const schema = isUndo ? context.data.previousSchema : context.data.nextSchema;

    if (schema !== undefined && !this.isSchemaView(columnIndex)) {
      await this.writeSchema(columnIndex, schema);

      if (isRecord(schema)) column.schema = schema;

      this.refreshDependents(columnIndex, column.target.schema);
    }

    this.applyData(columnIndex, next);
  }

  /**
   * 请求某一栏目标表的数据与 schema 资源并重算行树；该栏无目标时落回未设目标态
   *
   * 刷新原则上**原地更新**：该栏已就绪且已有行树时不再先切成加载态，避免整棵行树卸载后重挂
   * （P26）；仅首载（尚无就绪行树）与失败重试才发加载态。读取完成后经既有的 `applyLoaded` /
   * `applySchemaLoaded` / `Error` 就地更新，加载 / 空 / 错误 / 未设目标四种状态语义与文案不变。
   * @param columnIndex 栏序号（0 基）
   */
  private async refresh(columnIndex: number = 0): Promise<void> {
    const column = this.columnAt(columnIndex);
    const target = column.target;

    if (target === null) {
      this.publish(columnIndex, TablePanelStatus.NoTarget, []);
      return;
    }

    const current = column.store.state;
    const hasContent = current.status === TablePanelStatus.Ready && current.rows.length > 0;
    const token = this.nextToken(columnIndex);

    if (!hasContent) this.publish(columnIndex, TablePanelStatus.Loading, []);

    // 资源读取失败是行为关键路径：落回固定错误态而非抛穿，面板保持打开（D-29）
    try {
      if (isSchemaResourceId(target.data.id)) {
        const schema = await this.readResource(target.data);

        if (this.requestTokens[columnIndex] !== token) return;

        this.applySchemaLoaded(columnIndex, schema);
        return;
      }

      const data = await this.readResource(target.data);
      const schema = await this.readResource(target.schema);

      if (this.requestTokens[columnIndex] !== token) return;

      this.applyLoaded(columnIndex, schema, data);
    } catch {
      if (this.requestTokens[columnIndex] !== token) return;

      this.publish(columnIndex, TablePanelStatus.Error, []);
    }
  }

  /**
   * 按被写资源 id 刷新本面板内引用它的其它栏：对每一栏 j（j ≠ columnIndex），当该栏目标的数据或
   * schema 资源 id 命中 changedId 时重新请求资源并重算行树
   *
   * 只刷新本面板内引用该资源的栏（按 id 精确匹配），不做无差别全量刷新，也绝不做跨面板广播
   * （跨面板仍只在切入时刷新，D-15 修订版 / D-31）。
   * @param columnIndex 触发写盘的栏序号（0 基），该栏自身不在此刷新
   * @param changedId 刚写入的资源标识（数据资源 `table.<name>` 或 schema 资源 `table#schema.<name>`）
   */
  private refreshDependents(columnIndex: number, changedId: IResourceIdentifier): void {
    const count = this.columns.length;

    for (let index = 0; index < count; index += 1) {
      if (index === columnIndex) continue;

      const target = this.columns[index].target;

      if (target === null) continue;
      if (target.data.id !== changedId.id && target.schema.id !== changedId.id) continue;

      void this.refresh(index);
    }
  }
}
