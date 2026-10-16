import { Store } from '@tanstack/store';
import { useStore } from '@tanstack/react-store';
import { Button, Modal } from 'antd';
import {
  EditorEntryKind,
  IEditorPanel,
  IEditorPanelContext,
  IEditorPanelFactoryParam,
  IFileEntry,
  IUndoContext,
} from '@motajs/editor-core';
import { get } from 'es-toolkit/compat';
import { createElement, FC, ReactElement, useCallback, useEffect, useRef, useState } from 'react';
import { ICodeEditorOpener, ITablePanelOpener, useTableCapabilities } from '../react';
import { ITablePanel, ITablePanelParam, ITablePanelTarget, ITableRowNode, TableEmptyMode } from './types';
import {
  ITableGridProps,
  TableGrid,
  TableGridAddHandler,
  TableGridChangeHandler,
  TableGridDeleteHandler,
  TablePanelStatus,
} from './components/TableGrid';
import { TableEmptyColumn } from './components/TableEmptyColumn';
import { buildTableTree } from './model/traversal';
import { buildSchemaTree } from './model/schemaPresentation';
import { parseTableText, serializeTableText, TableTextParseStatus } from './model/tableText';
import {
  deleteByFieldPath,
  getParentFieldPath,
  getShortField,
  insertAfterFieldPath,
  parseFieldPath,
  setByFieldPath,
} from './model/fieldPath';
import { validateId, validateValue } from './model/validation';
import { deriveSchemaPath, isSchemaPath } from './resourceType';

/** 多栏布局中每栏的默认像素宽度 */
const DEFAULT_COLUMN_WIDTH = 500;

/** 新建表格数据文件的初始内容文本：空对象 */
export const INITIAL_TABLE_DATA_TEXT = '{}';

/** 新建表格 schema 文件的初始内容文本：type 为 object、properties 为空 */
export const INITIAL_TABLE_SCHEMA_TEXT = '{"type":"object","properties":{}}';

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
  /** 该栏主文件记住的系统前缀原文，写回时逐字还原；无前缀时为 `''` */
  prefix: string;
  /** 该栏待确认剥离注释时暂存的宽松解析值；无需确认时为 undefined */
  pendingStrip: unknown;
  /** 该栏空栏当前的内联视图；初值为 `TableEmptyMode.Buttons` */
  emptyMode: TableEmptyMode;
  /** 该栏内联浏览器当前所在目录路径；根目录为空串 */
  directory: string;
  /** 该栏内联浏览器当前目录的直接子条目 */
  entries: readonly IFileEntry[];
  /** 该栏内联浏览器目录读取失败提示；无错误时为 undefined */
  pickerError: string | undefined;
  /** 该栏内联浏览器目录请求序号，用于丢弃过期结果 */
  pickerToken: number;
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
  /** 该栏是否正等待用户确认「剥离注释后打开」；为真时视图渲染确认弹窗 */
  readonly commentStripPending?: boolean;
  /** 该栏当前是否有未落盘的改动（视图据此显示「未保存」标记并启用「保存」按钮） */
  readonly unsaved?: boolean;
  /** 该栏空栏当前的内联视图；缺省视作 `TableEmptyMode.Buttons` */
  readonly emptyMode?: TableEmptyMode;
  /** 内联浏览器当前所在目录路径；根目录为空串 */
  readonly pickerDirectory?: string;
  /** 该目录的直接子条目 */
  readonly pickerEntries?: readonly IFileEntry[];
  /** 目录读取失败时的提示文案；缺省表示无错误 */
  readonly pickerError?: string;
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
  /** 某栏确认「剥离注释后打开」的回调 */
  readonly onConfirmCommentStrip: (columnIndex: number) => void;
  /** 某栏取消「剥离注释后打开」的回调 */
  readonly onCancelCommentStrip: (columnIndex: number) => void;
  /** 某栏空栏内联视图切换回调 */
  readonly onEmptyModeChange: (columnIndex: number, mode: TableEmptyMode) => void;
  /** 某栏内联浏览器进入某目录回调 */
  readonly onEmptyNavigate: (columnIndex: number, path: string) => void;
  /** 某栏内联浏览器打开某数据表回调（在本栏打开） */
  readonly onEmptyOpen: (columnIndex: number, dataPath: string) => void;
  /** 某栏内联新建某表格回调（在本栏新建并打开） */
  readonly onEmptyCreate: (columnIndex: number, directory: string, name: string) => void;
  /** 某栏内联删除某表格回调 */
  readonly onEmptyDelete: (columnIndex: number, dataPath: string) => void;
  /** 某栏的「保存」回调 */
  readonly onSave?: (columnIndex: number) => void;
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
  /** 该栏确认「剥离注释后打开」的回调 */
  readonly onConfirmCommentStrip: (columnIndex: number) => void;
  /** 该栏取消「剥离注释后打开」的回调 */
  readonly onCancelCommentStrip: (columnIndex: number) => void;
  /** 该栏空栏内联视图切换回调 */
  readonly onEmptyModeChange: (columnIndex: number, mode: TableEmptyMode) => void;
  /** 该栏内联浏览器进入某目录回调 */
  readonly onEmptyNavigate: (columnIndex: number, path: string) => void;
  /** 该栏内联浏览器打开某数据表回调（在本栏打开） */
  readonly onEmptyOpen: (columnIndex: number, dataPath: string) => void;
  /** 该栏内联新建某表格回调（在本栏新建并打开） */
  readonly onEmptyCreate: (columnIndex: number, directory: string, name: string) => void;
  /** 该栏内联删除某表格回调 */
  readonly onEmptyDelete: (columnIndex: number, dataPath: string) => void;
  /** 该栏的「保存」回调 */
  readonly onSave?: (columnIndex: number) => void;
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
 * 渲染某栏的「剥离注释后打开」确认弹窗：使用 antd `Modal`，确认 / 取消转交面板方法
 *
 * 确认框不是注入接缝，直接在表格面板视图内渲染；不使用浏览器原生对话框。
 * @param onConfirm 确认回调
 * @param onCancel 取消回调
 * @returns 确认弹窗元素
 */
function renderCommentStripModal(onConfirm: () => void, onCancel: () => void): ReactElement {
  return createElement(
    Modal,
    {
      open: true,
      title: '该文件包含注释',
      closable: false,
      maskClosable: false,
      keyboard: false,
      onCancel,
      footer: createElement(
        'div',
        { className: 'etable-strip-footer' },
        createElement(
          Button,
          { size: 'small', autoInsertSpace: false, 'data-test-id': 'table-strip-cancel', onClick: onCancel },
          '取消',
        ),
        createElement(
          Button,
          {
            size: 'small',
            type: 'primary',
            autoInsertSpace: false,
            'data-test-id': 'table-strip-confirm',
            onClick: onConfirm,
          },
          '继续',
        ),
      ),
    },
    '该文件包含注释或尾逗号；打开并保存后会删除全部注释。是否继续？',
  );
}

/**
 * 单栏组件：订阅该栏视图状态，未设目标时渲染空栏内联控件，否则渲染一张表格
 *
 * 各回调经 `useCallback` 稳定身份（依赖为来自视图根、本身稳定的 props），配合 `React.memo(TableGrid)`
 * 的浅比较，使该栏状态未实质变化时不重渲染整张表（P26）。
 * @param props 单栏 props
 * @returns 该栏的空栏控件或表格元素
 */
function TableColumn(props: ITableColumnProps): ReactElement {
  const view = useStore(props.getStore(props.columnIndex));
  const capabilities = useTableCapabilities();
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
  const onConfirmCommentStrip = useCallback(
    (): void => props.onConfirmCommentStrip(props.columnIndex),
    [props.onConfirmCommentStrip, props.columnIndex],
  );
  const onCancelCommentStrip = useCallback(
    (): void => props.onCancelCommentStrip(props.columnIndex),
    [props.onCancelCommentStrip, props.columnIndex],
  );
  const onEmptyModeChange = useCallback(
    (mode: TableEmptyMode): void => props.onEmptyModeChange(props.columnIndex, mode),
    [props.onEmptyModeChange, props.columnIndex],
  );
  const onEmptyNavigate = useCallback(
    (path: string): void => props.onEmptyNavigate(props.columnIndex, path),
    [props.onEmptyNavigate, props.columnIndex],
  );
  const onEmptyOpen = useCallback(
    (dataPath: string): void => props.onEmptyOpen(props.columnIndex, dataPath),
    [props.onEmptyOpen, props.columnIndex],
  );
  const onEmptyCreate = useCallback(
    (directory: string, name: string): void => props.onEmptyCreate(props.columnIndex, directory, name),
    [props.onEmptyCreate, props.columnIndex],
  );
  const onEmptyDelete = useCallback(
    (dataPath: string): void => props.onEmptyDelete(props.columnIndex, dataPath),
    [props.onEmptyDelete, props.columnIndex],
  );

  if (view.status === TablePanelStatus.NoTarget) {
    return createElement(
      'div',
      { className: 'etable-column', style: { flexGrow: 1, flexShrink: 1, flexBasis: 0 } },
      createElement(TableEmptyColumn, {
        mode: view.emptyMode ?? TableEmptyMode.Buttons,
        presets: capabilities.tablePresets,
        directory: view.pickerDirectory ?? '',
        entries: view.pickerEntries ?? [],
        error: view.pickerError,
        onModeChange: onEmptyModeChange,
        onNavigate: onEmptyNavigate,
        onOpen: onEmptyOpen,
        onCreate: onEmptyCreate,
        onDelete: onEmptyDelete,
      }),
    );
  }

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
  const stripModal =
    view.commentStripPending === true ? renderCommentStripModal(onConfirmCommentStrip, onCancelCommentStrip) : null;

  return createElement(
    'div',
    { className: 'etable-column', style: { flexGrow: 1, flexShrink: 1, flexBasis: 0 } },
    createElement(TableGrid, gridProps),
    stripModal,
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
        onConfirmCommentStrip: props.onConfirmCommentStrip,
        onCancelCommentStrip: props.onCancelCommentStrip,
        onEmptyModeChange: props.onEmptyModeChange,
        onEmptyNavigate: props.onEmptyNavigate,
        onEmptyOpen: props.onEmptyOpen,
        onEmptyCreate: props.onEmptyCreate,
        onEmptyDelete: props.onEmptyDelete,
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
        onConfirmCommentStrip: (columnIndex): void => void this.confirmCommentStrip(columnIndex),
        onCancelCommentStrip: (columnIndex): void => this.cancelCommentStrip(columnIndex),
        onEmptyModeChange: (columnIndex, mode): void => this.setEmptyMode(columnIndex, mode),
        onEmptyNavigate: (columnIndex, path): void => this.navigatePicker(columnIndex, path),
        onEmptyOpen: (columnIndex, dataPath): void => this.openIntoColumn(columnIndex, dataPath),
        onEmptyCreate: (columnIndex, directory, name): void => void this.createIntoColumn(columnIndex, directory, name),
        onEmptyDelete: (columnIndex, dataPath): void => void this.deleteFromColumn(columnIndex, dataPath),
      });
  }

  async initialize(): Promise<void> {}

  async dispose(): Promise<void> {}

  render(): FC {
    return this.component;
  }

  /**
   * 获取此面板实例的显示标题，供外壳标签按实例显示（如「表格 tables/demo.json」）
   * @returns 未设任何表时为 undefined（外壳回退类型名）；一张表时为「表格 <数据文件路径>」；
   * 两张及以上时为「表格 {<路径0>} {<路径1>} …」（按栏序号排列）
   */
  getTitle(): string | undefined {
    const paths: string[] = [];

    for (const column of this.columns) {
      if (column.target !== null) paths.push(column.target.dataPath);
    }

    if (paths.length === 0) return undefined;
    if (paths.length === 1) return `表格 ${paths[0]}`;

    return `表格 ${paths.map((path) => `{${path}}`).join(' ')}`;
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
    if (previous === null || previous.dataPath !== target.dataPath) {
      this.publish(columnIndex, TablePanelStatus.Loading, []);
    }

    void this.refresh(columnIndex);
  }

  /**
   * 关闭某一栏的表格：清空本栏目标与内容并回到未设目标态，只作用于本栏
   *
   * 关闭后本栏 `target` 归空，`findEmptyColumnIndex` 随后即可把它当作空栏供「编辑 Schema」复用；
   * 同时递增本栏请求序号以丢弃在途读取结果，避免关闭后旧结果再写回本栏。空栏内联视图一并复位为
   * 三个按钮态（`emptyMode` 归 `Buttons`、目录归根 `''`、条目与读取错误清空），使「打开表格 → 开进
   * 本栏 → ✕ 关栏 → 回到三个按钮」成立；其它栏的目标与状态不受影响。
   * @param columnIndex 要关闭的栏序号（0 基）
   */
  private closeColumn(columnIndex: number): void {
    const column = this.columnAt(columnIndex);

    column.target = null;
    column.data = null;
    column.schema = null;
    column.prefix = '';
    column.pendingStrip = undefined;
    column.emptyMode = TableEmptyMode.Buttons;
    column.directory = '';
    column.entries = [];
    column.pickerError = undefined;
    this.nextToken(columnIndex);
    this.publish(columnIndex, TablePanelStatus.NoTarget, []);
  }

  /**
   * 切换某栏空栏的内联视图；进入打开 / 删除态时顺带取该栏当前目录的直接子条目
   * @param columnIndex 栏序号（0 基）
   * @param mode 目标内联视图
   */
  private setEmptyMode(columnIndex: number, mode: TableEmptyMode): void {
    const column = this.columnAt(columnIndex);

    column.emptyMode = mode;
    this.publish(columnIndex, TablePanelStatus.NoTarget, []);

    if (mode === TableEmptyMode.Open || mode === TableEmptyMode.Delete) void this.refreshPicker(columnIndex);
  }

  /**
   * 让某栏内联浏览器切换到某目录并重取该目录的直接子条目
   * @param columnIndex 栏序号（0 基）
   * @param path 目标目录路径；根目录传空串
   */
  private navigatePicker(columnIndex: number, path: string): void {
    this.columnAt(columnIndex).directory = path;
    void this.refreshPicker(columnIndex);
  }

  /**
   * 把选中的数据表开进本栏（不是另开面板）
   * @param columnIndex 栏序号（0 基）
   * @param dataPath 要打开的数据文件路径
   */
  private openIntoColumn(columnIndex: number, dataPath: string): void {
    this.setTable({ dataPath }, columnIndex);
  }

  /**
   * 在某栏当前目录下新建一对文件（`name.json` + 推导出的 schema）并把新表开进本栏
   *
   * 名称先经 `validateId` 校验（与同目录既有表格基名查重），非法时不落任何文件并把错误写进该栏
   * 内联错误提示；合法时经 `IEditorPanelContext.createResource` 写一对文件后把新表开进本栏。
   * @param columnIndex 栏序号（0 基）
   * @param directory 新建所在目录路径；根目录传空串
   * @param name 表格名称（不含扩展名）
   */
  private async createIntoColumn(columnIndex: number, directory: string, name: string): Promise<void> {
    const column = this.columnAt(columnIndex);
    const entries = await this.context.listDirectory(directory);
    const existing = entries.map(tableBaseName);
    const validation = validateId(name, existing);

    if (!validation.valid) {
      column.pickerError = validation.error ?? '名称未通过校验';
      this.publish(columnIndex, TablePanelStatus.NoTarget, []);
      return;
    }

    const dataPath = joinPath(directory, `${name}.json`);
    const schemaPath = deriveSchemaPath(dataPath);

    await this.context.createResource(dataPath, INITIAL_TABLE_DATA_TEXT);
    await this.context.createResource(schemaPath, INITIAL_TABLE_SCHEMA_TEXT);

    column.directory = directory;
    column.pickerError = undefined;
    this.setTable({ dataPath }, columnIndex);
  }

  /**
   * 删除某栏内联浏览器中的一张表：删数据 + schema 一对文件后重取该栏浏览器目录
   *
   * 删除不可撤销（D-13）——本方法不登记任何 `IUndoContext`；二次确认由空栏控件在调用本方法前完成。
   * 删除后该栏仍是空栏、`emptyMode` 保持删除态以支持连续删除。
   * @param columnIndex 栏序号（0 基）
   * @param dataPath 要删除的数据文件路径
   */
  private async deleteFromColumn(columnIndex: number, dataPath: string): Promise<void> {
    await this.context.deleteResource(dataPath);
    await this.context.deleteResource(deriveSchemaPath(dataPath));

    await this.refreshPicker(columnIndex);
  }

  /**
   * 重取某栏内联浏览器当前目录的直接子条目并发布；用请求序号丢弃过期结果
   *
   * 读取失败时把该栏内联错误提示置为固定文案，仍保持空栏态（不抛穿面板）。
   * @param columnIndex 栏序号（0 基）
   */
  private async refreshPicker(columnIndex: number): Promise<void> {
    const column = this.columnAt(columnIndex);
    const token = column.pickerToken + 1;

    column.pickerToken = token;

    try {
      const entries = await this.context.listDirectory(column.directory);

      if (column.pickerToken !== token) return;

      column.entries = entries;
      column.pickerError = undefined;
      this.publish(columnIndex, TablePanelStatus.NoTarget, []);
    } catch {
      if (column.pickerToken !== token) return;

      column.entries = [];
      column.pickerError = '目录读取失败，请重试。';
      this.publish(columnIndex, TablePanelStatus.NoTarget, []);
    }
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
   * @param columnIndex 取目标的栏序号（0 基），省略为第 0 栏
   */
  async openSchemaPanel(opener: ITablePanelOpener, columnIndex: number = 0): Promise<void> {
    const target = this.columnAt(columnIndex).target;

    if (target === null) return;

    // 当前已是 schema 视图时 deriveSchemaPath 原样返回，不再重复派生
    const schemaTarget: ITablePanelTarget = { dataPath: deriveSchemaPath(target.dataPath) };
    const emptyIndex = this.findEmptyColumnIndex();

    if (emptyIndex !== -1) {
      this.setTable(schemaTarget, emptyIndex);
      return;
    }

    const param: ITablePanelParam = { target: schemaTarget };

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

    const content = serializeTableText(column.data, column.prefix);
    const result = await opener.open({ title: target.dataPath, content });

    if (result === null) return;

    const parsed = parseTableText(result);

    if (parsed.status !== TableTextParseStatus.Conforming || !isRecord(parsed.value)) {
      this.publishError(columnIndex, '内容不是合法的 JSON，未写回。');
      return;
    }

    column.prefix = parsed.prefix;

    if (!(await this.persist(columnIndex, parsed.value))) return;

    this.context.addUndoContext(this, {
      type: TableUndoType.Replace,
      data: { columnIndex, path: '', previousValue: column.data, nextValue: parsed.value },
    });
    this.applyData(columnIndex, parsed.value);
    this.refreshDependents(columnIndex, target.dataPath);
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
    this.refreshDependents(columnIndex, column.target.dataPath);
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
      this.refreshDependents(columnIndex, column.target.dataPath);
      return;
    }

    const previousSchema = column.schema;
    const nextSchema = isRecord(previousSchema)
      ? this.withOrder(previousSchema, ownerPath, parentObject, anchor, name)
      : undefined;

    if (!(await this.persist(columnIndex, next))) return;

    this.refreshDependents(columnIndex, column.target.dataPath);

    if (nextSchema !== undefined) {
      if (!(await this.persistSchema(columnIndex, nextSchema))) return;

      column.schema = nextSchema;
      this.refreshDependents(columnIndex, deriveSchemaPath(column.target.dataPath));
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
    this.refreshDependents(columnIndex, column.target.dataPath);
  }

  /**
   * 确认「剥离注释后打开」某一栏：以暂存的宽松解析值 + 空前缀应用该栏内容，并清空暂存与提示
   * @param columnIndex 栏序号（0 基）
   */
  async confirmCommentStrip(columnIndex: number = 0): Promise<void> {
    const column = this.columnAt(columnIndex);

    if (column.pendingStrip === undefined) return;

    const value = column.pendingStrip;

    column.pendingStrip = undefined;
    column.prefix = '';

    const target = column.target;

    if (target === null) {
      this.publish(columnIndex, TablePanelStatus.NoTarget, []);
      return;
    }

    if (this.isSchemaView(columnIndex)) {
      this.applySchemaLoaded(columnIndex, value);
      return;
    }

    const schemaText = await this.readSchemaText(deriveSchemaPath(target.dataPath));
    const schema = schemaText === undefined ? undefined : parseTableText(schemaText).value;

    this.applyLoaded(columnIndex, schema, value);
  }

  /**
   * 取消「剥离注释后打开」某一栏：清空暂存与提示并关闭该栏（不打开）
   * @param columnIndex 栏序号（0 基）
   */
  cancelCommentStrip(columnIndex: number = 0): void {
    const column = this.columnAt(columnIndex);

    if (column.pendingStrip === undefined) return;

    column.pendingStrip = undefined;
    column.prefix = '';
    column.target = null;
    column.data = null;
    column.schema = null;
    this.nextToken(columnIndex);
    this.publish(columnIndex, TablePanelStatus.NoTarget, []);
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
      prefix: '',
      pendingStrip: undefined,
      emptyMode: TableEmptyMode.Buttons,
      directory: '',
      entries: [],
      pickerError: undefined,
      pickerToken: 0,
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
   * 经资源层读取一个资源的原文
   * @param path 资源路径
   * @returns 资源原文；资源不存在或读取为空时为 undefined
   */
  private async readText(path: string): Promise<string | undefined> {
    const resource = await this.context.requestResource(path);

    if (resource === null) return undefined;

    const content = await resource.request();

    if (content === undefined) return undefined;
    if (typeof content === 'string') return content;

    return new TextDecoder().decode(content);
  }

  /**
   * 判断某个文件当前是否存在：经资源层列其所在目录核对直接条目
   *
   * 数据表可以没有同名 schema 文件（缺失即「无 schema」，不是错误）；但存在却读不出
   * 才是错误。资源层按原文读取时无法区分「文件不存在」与「读取失败」，故先用目录条目
   * 确认存在性，缺该文件时由调用方按「无 schema」处理。
   * @param path 文件的相对路径
   * @returns 该目录的直接条目中含此路径时为 true
   */
  private async fileExists(path: string): Promise<boolean> {
    const slash = path.lastIndexOf('/');
    const directory = slash === -1 ? '' : path.slice(0, slash);
    const entries = await this.context.listDirectory(directory);

    return entries.some((entry) => entry.path === path);
  }

  /**
   * 读取 schema 文件的原文：文件不存在时返回 undefined（表可无 schema），存在但读取
   * 失败仍抛出，交由刷新路径落错误态
   * @param path schema 文件路径
   * @returns 资源原文；文件不存在时为 undefined
   */
  private async readSchemaText(path: string): Promise<string | undefined> {
    if (!(await this.fileExists(path))) return undefined;

    return this.readText(path);
  }

  /**
   * 把某栏新的视图状态写入其订阅源；空栏（无目标）时一并带上空栏内联视图与目录数据
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
    const column = this.columnAt(columnIndex);
    const target = column.target;
    const emptyState =
      target === null
        ? ({
            emptyMode: column.emptyMode,
            pickerDirectory: column.directory,
            pickerEntries: column.entries,
            pickerError: column.pickerError,
          } as const)
        : {};

    column.store.setState({
      status,
      rows,
      schemaMode: target !== null && isSchemaPath(target.dataPath),
      title: target === null ? undefined : target.dataPath,
      message,
      error,
      ...emptyState,
    });
  }

  /**
   * 发布某栏的「待确认剥离注释」视图状态：不呈现内容，仅置提示位供视图渲染确认弹窗
   * @param columnIndex 栏序号（0 基）
   */
  private publishCommentStrip(columnIndex: number): void {
    const target = this.columnAt(columnIndex).target;

    this.columnAt(columnIndex).store.setState({
      status: TablePanelStatus.Loading,
      rows: [],
      schemaMode: target !== null && isSchemaPath(target.dataPath),
      title: target === null ? undefined : target.dataPath,
      commentStripPending: true,
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
   * @returns 该栏目标路径为 schema 约定文件时为 true
   */
  private isSchemaView(columnIndex: number): boolean {
    const target = this.columnAt(columnIndex).target;

    return target !== null && isSchemaPath(target.dataPath);
  }

  /**
   * 以已解析的主文件值重算某栏视图：schema 视图直接落 schema 呈现，数据视图再读 schema 后落数据行树
   * @param columnIndex 栏序号（0 基）
   * @param target 该栏目标
   * @param value 主文件解析出的值
   * @param token 本次刷新的请求序号，用于丢弃在途结果
   */
  private async loadPrimary(
    columnIndex: number,
    target: ITablePanelTarget,
    value: unknown,
    token: number,
  ): Promise<void> {
    if (this.isSchemaView(columnIndex)) {
      this.applySchemaLoaded(columnIndex, value);
      return;
    }

    const schemaText = await this.readSchemaText(deriveSchemaPath(target.dataPath));

    if (this.requestTokens[columnIndex] !== token) return;

    const schema = schemaText === undefined ? undefined : parseTableText(schemaText).value;

    this.applyLoaded(columnIndex, schema, value);
  }

  /**
   * 把某栏变更后的数据写入其目标表的资源
   * @param columnIndex 栏序号（0 基）
   * @param data 变更后的完整数据
   */
  private async writeData(columnIndex: number, data: Record<string, unknown>): Promise<void> {
    const column = this.columnAt(columnIndex);
    const target = column.target;

    if (target === null) return;

    const resource = await this.context.requestResource(target.dataPath);

    if (resource === null) return;

    await resource.write(serializeTableText(data, column.prefix));
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
    const column = this.columnAt(columnIndex);
    const target = column.target;

    if (target === null) return true;

    const resource = await this.context.requestResource(deriveSchemaPath(target.dataPath));

    if (resource === null) return true;

    try {
      if (isRecord(schema)) await resource.write(serializeTableText(schema, column.prefix));

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
    const column = this.columnAt(columnIndex);
    const target = column.target;

    if (target === null) return;

    const resource = await this.context.requestResource(deriveSchemaPath(target.dataPath));

    if (resource === null) return;

    if (isRecord(schema)) await resource.write(serializeTableText(schema, column.prefix));
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
    this.refreshDependents(columnIndex, column.target.dataPath);

    const schema = isUndo ? context.data.previousSchema : context.data.nextSchema;

    if (schema !== undefined && !this.isSchemaView(columnIndex)) {
      await this.writeSchema(columnIndex, schema);

      if (isRecord(schema)) column.schema = schema;

      this.refreshDependents(columnIndex, deriveSchemaPath(column.target.dataPath));
    }

    this.applyData(columnIndex, next);
  }

  /**
   * 请求某一栏目标表的原文并解析后重算行树；该栏无目标时落回未设目标态
   *
   * 刷新原则上**原地更新**：该栏已就绪且已有行树时不再先切成加载态，避免整棵行树卸载后重挂
   * （P26）；仅首载（尚无就绪行树）与失败重试才发加载态。读到原文后按项目约定解析：合规即打开并
   * 记住系统前缀；非合规则暂存宽松解析值并请用户确认剥离注释；无效则落固定错误态。
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
      const primaryText = await this.readText(target.dataPath);

      if (this.requestTokens[columnIndex] !== token) return;

      if (primaryText === undefined) {
        column.prefix = '';
        await this.loadPrimary(columnIndex, target, undefined, token);
        return;
      }

      const parsed = parseTableText(primaryText);

      if (parsed.status === TableTextParseStatus.NeedsCommentStrip) {
        column.prefix = '';
        column.pendingStrip = parsed.value;
        this.publishCommentStrip(columnIndex);
        return;
      }

      if (parsed.status === TableTextParseStatus.Invalid) {
        this.publish(columnIndex, TablePanelStatus.Error, []);
        return;
      }

      column.prefix = parsed.prefix;
      await this.loadPrimary(columnIndex, target, parsed.value, token);
    } catch {
      if (this.requestTokens[columnIndex] !== token) return;

      this.publish(columnIndex, TablePanelStatus.Error, []);
    }
  }

  /**
   * 按被写资源路径刷新本面板内引用它的其它栏：对每一栏 j（j ≠ columnIndex），当该栏目标的数据或
   * schema 路径命中 changedPath 时重新请求资源并重算行树
   *
   * 只刷新本面板内引用该资源的栏（按路径精确匹配），不做无差别全量刷新，也绝不做跨面板广播
   * （跨面板仍只在切入时刷新，D-15 修订版 / D-31）。
   * @param columnIndex 触发写盘的栏序号（0 基），该栏自身不在此刷新
   * @param changedPath 刚写入的资源路径（数据文件路径或其推导出的 schema 路径）
   */
  private refreshDependents(columnIndex: number, changedPath: string): void {
    const count = this.columns.length;

    for (let index = 0; index < count; index += 1) {
      if (index === columnIndex) continue;

      const target = this.columns[index].target;

      if (target === null) continue;
      if (target.dataPath !== changedPath && deriveSchemaPath(target.dataPath) !== changedPath) continue;

      void this.refresh(index);
    }
  }
}
