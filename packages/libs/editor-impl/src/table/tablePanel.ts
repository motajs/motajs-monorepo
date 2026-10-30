import { Store } from '@tanstack/store';
import { useStore } from '@tanstack/react-store';
import { Button, Modal } from 'antd';
import {
  EditorEntryKind,
  EditorFileChangeKind,
  IEditorPanel,
  IEditorPanelContext,
  IEditorPanelFactoryParam,
  IFileEntry,
  IResourceIdentifier,
  IUndoContext,
  PanelCloseChoice,
} from '@motajs/editor-core';
import { get } from 'es-toolkit/compat';
import {
  createElement,
  createRef,
  FC,
  FocusEvent,
  ReactElement,
  RefObject,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import { ICodeEditorOpener, ITablePanelOpener, useTableCapabilities } from '../react';
import {
  ITableCloseDialogState,
  ITableDocument,
  ITableEdit,
  ITableEditableProps,
  ITablePanel,
  ITablePanelParam,
  ITablePanelTarget,
  ITablePendingConflict,
  ITableRowNode,
  TableEditKind,
  TableEmptyMode,
} from './types';
import { TablePanelStatus } from '../shared/schemaForm/components/TableGrid';
import { TableEmptyColumn } from './components/TableEmptyColumn';
import { EditableTable } from './components/EditableTable';
import { ContentSaveStatus, IEditableContentHandle } from '../shared/editable/types';
import { ExternalChangeDialog } from '../shared/panelDialogs/ExternalChangeDialog';
import { PanelCloseDialog } from '../shared/panelDialogs/PanelCloseDialog';
import { buildTableTree } from '../shared/schemaForm/model/traversal';
import { buildSchemaTree } from '../shared/schemaForm/model/schemaPresentation';
import { parseTableText, serializeTableText, TableTextParseStatus } from '../shared/jsonc';
import {
  deleteByFieldPath,
  getParentFieldPath,
  getShortField,
  insertAfterFieldPath,
  parseFieldPath,
  setByFieldPath,
} from '../shared/schemaForm/model/fieldPath';
import { validateId, validateValue } from '../shared/schemaForm/model/validation';
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
 * 一次编辑落成的结果：新文档，以及需要在该栏提示位发布的成功文案
 */
interface ITableEditOutcome {
  /** 编辑后的文档 */
  readonly document: ITableDocument;
  /** 成功提示文案；缺省表示不提示（改值不弹文案） */
  readonly notice?: string;
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
  /** 该栏数据文件上一次载入 / 写盘成功的原文；与外部内容逐字比较，相同即视为自写回声（D-15 / D-36） */
  baselineText: string | undefined;
  /** 该栏 schema 文件上一次载入 / 写盘成功的原文；与 `baselineText` 同口径 */
  baselineSchemaText: string | undefined;
  /** 该栏主文件记住的系统前缀原文，写回时逐字还原；无前缀时为 `''` */
  prefix: string;
  /** 该栏待确认剥离注释时暂存的宽松解析值；无需确认时为 undefined */
  pendingStrip: unknown;
  /** 该栏空栏当前的内联视图；初值为 `TableEmptyMode.Buttons` */
  emptyMode: TableEmptyMode;
  /** 该栏内联浏览区的初始目录路径；根目录为空串，进入浏览区后由浏览器 / 新建表单自持当前目录 */
  directory: string;
  /** 该栏内联浏览区的重列令牌；递增时让浏览器 / 新建表单重读当前目录 */
  pickerReloadToken: number;
  /** 该栏内联浏览区目录读取失败提示；无错误时为 undefined */
  pickerError: string | undefined;
  /** 该栏是否有未落盘的数据改动（编辑 / 新增 / 删除 / 代码编辑器写回 / 撤销重做 / 确认剥离注释都会置真） */
  unsaved: boolean;
  /** 该栏目标路径现在是否还有内容在等待写盘；与组件草稿脏、面板侧未落盘标记一起决定工具栏的「未保存」，5 秒自动写盘完成后会自动变回假 */
  pendingWrite: boolean;
  /** 该栏是否有未落盘的镜像 schema 改动（数据视图新增字段会同步改镜像 schema） */
  unsavedSchema: boolean;
  /** 该栏「换内容」的版本号：只在载入 / 外部刷新 / 撤销重做 / 换表 / 保存回写五处递增，本地编辑绝不递增 */
  contentVersion: number;
  /** 该栏组件交回或面板现算的文档副本；为空表示面板只有基线内容 */
  draft: ITableDocument | null;
  /** 该栏交回的草稿是否脏；与 `draft` 成对写入、成对作废 */
  draftDirty: boolean;
  /** 该栏待用户选择的外部改动冲突；为 undefined 表示没有待决冲突（D-17 / D-37） */
  pendingConflict: ITablePendingConflict | undefined;
  /** 该栏已确认「剥离注释后打开」的路径 → 确认时的原文；原文未变时不再重弹 */
  readonly stripConfirmed: Map<string, string>;
  /** 该栏待确认剥离时暂存的原文，供 `TablePanel.confirmCommentStrip` 登记进 `stripConfirmed` */
  pendingStripText: string;
  /** 该栏的视图状态订阅源 */
  readonly store: Store<ITablePanelViewState>;
}

export interface ITablePanelViewState {
  /** 当前数据加载状态 */
  readonly status: TablePanelStatus;
  /** 面板下发给该栏组件的文档：草稿副本优先，没有草稿时用面板基线拼一份 */
  readonly content: ITableDocument;
  /** 面板「换内容」的版本号；只有它变化时组件才重置草稿 */
  readonly contentVersion: number;
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
  /** 该栏待决的外部改动冲突；缺省表示无冲突（弹窗只在有待决冲突时出现） */
  readonly pendingConflict?: ITablePendingConflict;
  /** 该栏空栏当前的内联视图；缺省视作 `TableEmptyMode.Buttons` */
  readonly emptyMode?: TableEmptyMode;
  /** 内联浏览区的初始目录路径；根目录为空串 */
  readonly pickerDirectory?: string;
  /** 内联浏览区的重列令牌；变化时浏览器 / 新建表单重读当前目录 */
  readonly pickerReloadToken?: number;
  /** 目录读取失败时的提示文案；缺省表示无错误 */
  readonly pickerError?: string;
}

/** 面板渲染根的 props：按可用宽度铺出多栏，每栏一张独立订阅的表格 */
interface ITablePanelViewProps {
  /** 按栏序号取该栏的视图状态订阅源（缺失时按需补建空栏） */
  readonly getStore: (columnIndex: number) => Store<ITablePanelViewState>;
  /** 面板级「当前可见的外部改动冲突」订阅源：同一时刻只渲染一个弹窗（D-37） */
  readonly conflictStore: Store<ITablePendingConflict | undefined>;
  /** 每栏的像素宽度 */
  readonly columnWidth: number;
  /** 视图把当前铺出的可视栏数回报给面板（供「编辑 Schema」复用空栏） */
  readonly onLayout: (columnCount: number) => void;
  /** 某栏加载失败态下的重试回调 */
  readonly onRetry: (columnIndex: number) => void;
  /** 某栏的组件句柄归属：面板为该栏建立的唯一 `RefObject`，视图只转交不自建 */
  readonly getColumnRef: (columnIndex: number) => RefObject<IEditableContentHandle<ITableDocument> | null>;
  /** 面板侧唯一的编辑入口：组件把一次编辑意图交给面板，面板落成新文档 */
  readonly applyEdit: (columnIndex: number, edit: ITableEdit, document: ITableDocument) => ITableDocument | null;
  /** 面板侧唯一的写盘入口：组件请求保存与面板切走保存都走它 */
  readonly saveDocument: (columnIndex: number, document: ITableDocument) => Promise<ContentSaveStatus>;
  /** 某栏组件交回草稿：面板据此持有一份副本与交回脏标记 */
  readonly onDraftChange: (columnIndex: number, content: ITableDocument, dirty: boolean) => void;
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
  /** 某栏内联浏览区读取某目录的直接子条目（稳定引用，浏览器 / 新建表单据此自持目录） */
  readonly onEmptyLoadChildren: (columnIndex: number, path: string) => Promise<readonly IFileEntry[]>;
  /** 某栏内联浏览器打开某数据表回调（在本栏打开） */
  readonly onEmptyOpen: (columnIndex: number, dataPath: string) => void;
  /** 某栏内联新建某表格回调（在本栏新建并打开） */
  readonly onEmptyCreate: (columnIndex: number, directory: string, name: string) => void;
  /** 某栏内联删除某表格回调 */
  readonly onEmptyDelete: (columnIndex: number, dataPath: string) => void;
  /**
   * 用户是否正在某个字段里输入：真表示焦点在某个可编辑字段（input / textarea / select / contenteditable）上且尚未失焦 / 尚未确认提交，
   * 外部冲突弹窗据此推迟到停手后再弹；实现方必须同步、不返回 Promise（一次焦点变化只报一次，不需要等待任何异步结果）
   */
  readonly onFieldEditingChange?: (editing: boolean) => void;
  /** 冲突弹窗选择「保存外部修改」：丢掉编辑器里的待写、重新载入外部那一份 */
  readonly onConflictDiscard: () => void;
  /** 冲突弹窗选择「保存编辑器的」：用编辑器里的内容覆盖外部修改并立刻写盘 */
  readonly onConflictKeep: () => void;
  /** 面板级关闭弹窗状态的订阅源：整个面板只渲染一处，与栏数无关（D-38） */
  readonly closeDialogStore: Store<ITableCloseDialogState>;
  /** 关闭弹窗上的选择：三个分支都交回面板结算（构造期绑定，稳定引用） */
  readonly onCloseChoice: (choice: PanelCloseChoice) => void;
}

/** 单栏组件的 props：把该栏序号与各回调转交给一张表格 */
interface ITableColumnProps {
  /** 该栏的序号（0 基） */
  readonly columnIndex: number;
  /** 按栏序号取该栏的视图状态订阅源 */
  readonly getStore: (columnIndex: number) => Store<ITablePanelViewState>;
  /** 该栏加载失败态下的重试回调 */
  readonly onRetry: (columnIndex: number) => void;
  /** 该栏的组件句柄归属：面板为该栏建立的唯一 `RefObject`，单栏只把它转交给可编辑组件 */
  readonly getColumnRef: (columnIndex: number) => RefObject<IEditableContentHandle<ITableDocument> | null>;
  /** 面板侧唯一的编辑入口 */
  readonly applyEdit: (columnIndex: number, edit: ITableEdit, document: ITableDocument) => ITableDocument | null;
  /** 面板侧唯一的写盘入口 */
  readonly saveDocument: (columnIndex: number, document: ITableDocument) => Promise<ContentSaveStatus>;
  /** 某栏组件交回草稿 */
  readonly onDraftChange: (columnIndex: number, content: ITableDocument, dirty: boolean) => void;
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
  /** 该栏内联浏览区读取某目录的直接子条目（稳定引用，浏览器 / 新建表单据此自持目录） */
  readonly onEmptyLoadChildren: (columnIndex: number, path: string) => Promise<readonly IFileEntry[]>;
  /** 该栏内联浏览器打开某数据表回调（在本栏打开） */
  readonly onEmptyOpen: (columnIndex: number, dataPath: string) => void;
  /** 该栏内联新建某表格回调（在本栏新建并打开） */
  readonly onEmptyCreate: (columnIndex: number, directory: string, name: string) => void;
  /** 该栏内联删除某表格回调 */
  readonly onEmptyDelete: (columnIndex: number, dataPath: string) => void;
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
 * 判断焦点落在的是不是一个「可编辑字段」
 *
 * 只认 input / textarea / select 与可编辑的 contenteditable 元素：焦点落在工具栏按钮、行或表格空白上
 * 并不等于有人在打字，冲突弹窗不该因此被推迟。这里只看事件目标自身，绝不去读浏览器当前聚焦的元素
 * （editor-core / editor-impl 都禁 `document`）。
 * @param target 焦点事件的 `event.target` 或 `event.relatedTarget`
 * @returns 是可编辑字段时为 true
 */
function isEditableFieldElement(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;

  return target.matches('input, textarea, select, [contenteditable]:not([contenteditable="false"])');
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
 * 单栏组件：订阅该栏视图状态，未设目标时渲染空栏内联控件，否则渲染一个可编辑表格组件
 *
 * 各回调经 `useCallback` 稳定身份（依赖为来自视图根、本身稳定的 props），配合 `React.memo(TableGrid)`
 * 的浅比较，使该栏状态未实质变化时不重渲染整张表（P26）。本组件**不自建 ref**：组件句柄的唯一归属是
 * `TablePanel.columnRefs`，这里只把面板给的那个 `RefObject` 转交给 `EditableTable`（D-03 / D-05）。
 * @param props 单栏 props
 * @returns 该栏的空栏控件或表格元素
 */
function TableColumn(props: ITableColumnProps): ReactElement {
  const view = useStore(props.getStore(props.columnIndex));
  const capabilities = useTableCapabilities();
  const onRetry = useCallback((): void => props.onRetry(props.columnIndex), [props.onRetry, props.columnIndex]);
  const applyEdit = useCallback(
    (edit: ITableEdit, document: ITableDocument): ITableDocument | null =>
      props.applyEdit(props.columnIndex, edit, document),
    [props.applyEdit, props.columnIndex],
  );
  const onSave = useCallback(
    (document: ITableDocument): Promise<ContentSaveStatus> => props.saveDocument(props.columnIndex, document),
    [props.saveDocument, props.columnIndex],
  );
  const onDraftChange = useCallback(
    (content: ITableDocument, dirty: boolean): void => props.onDraftChange(props.columnIndex, content, dirty),
    [props.onDraftChange, props.columnIndex],
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
  const onEmptyLoadChildren = useCallback(
    (path: string): Promise<readonly IFileEntry[]> => props.onEmptyLoadChildren(props.columnIndex, path),
    [props.onEmptyLoadChildren, props.columnIndex],
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
        loadChildren: onEmptyLoadChildren,
        error: view.pickerError,
        reloadToken: view.pickerReloadToken,
        onModeChange: onEmptyModeChange,
        onOpen: onEmptyOpen,
        onCreate: onEmptyCreate,
        onDelete: onEmptyDelete,
      }),
    );
  }

  const editableProps: ITableEditableProps = {
    content: view.content,
    contentVersion: view.contentVersion,
    status: view.status,
    title: view.title,
    message: view.message,
    error: view.error,
    onRetry,
    applyEdit,
    onSave,
    onDraftChange,
    onOpenSchema,
    onOpenInCodeEditor,
    onCloseColumn,
    unsaved: view.unsaved === true,
    ref: props.getColumnRef(props.columnIndex),
  };
  const stripModal =
    view.commentStripPending === true ? renderCommentStripModal(onConfirmCommentStrip, onCancelCommentStrip) : null;

  return createElement(
    'div',
    { className: 'etable-column', style: { flexGrow: 1, flexShrink: 1, flexBasis: 0 } },
    createElement(EditableTable, editableProps),
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
  const conflict = useStore(props.conflictStore);
  const closeDialog = useStore(props.closeDialogStore);

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
        getColumnRef: props.getColumnRef,
        applyEdit: props.applyEdit,
        saveDocument: props.saveDocument,
        onDraftChange: props.onDraftChange,
        onOpenSchema: props.onOpenSchema,
        onOpenInCodeEditor: props.onOpenInCodeEditor,
        onCloseColumn: props.onCloseColumn,
        onConfirmCommentStrip: props.onConfirmCommentStrip,
        onCancelCommentStrip: props.onCancelCommentStrip,
        onEmptyModeChange: props.onEmptyModeChange,
        onEmptyLoadChildren: props.onEmptyLoadChildren,
        onEmptyOpen: props.onEmptyOpen,
        onEmptyCreate: props.onEmptyCreate,
        onEmptyDelete: props.onEmptyDelete,
      }),
    );
  }

  return createElement(
    'div',
    {
      className: 'etable-columns',
      ref: containerRef,
      'data-test-id': 'table-columns',
      // 「正在打字」只按可编辑字段算：焦点落到工具栏 / 行 / 空白上不推迟冲突弹窗（D-14 的手感要求）
      onFocus: (event: FocusEvent<HTMLDivElement>): void => {
        if (isEditableFieldElement(event.target)) props.onFieldEditingChange?.(true);
      },
      onBlur: (event: FocusEvent<HTMLDivElement>): void => {
        if (isEditableFieldElement(event.relatedTarget)) return;

        props.onFieldEditingChange?.(false);
      },
    },
    columns,
    // 冲突弹窗在面板根上只挂一处：非活动面板不渲染，重新切入时由订阅源把待决冲突带回（D-37）
    conflict === undefined
      ? null
      : createElement(ExternalChangeDialog, {
          open: true,
          onDiscard: props.onConflictDiscard,
          onKeep: props.onConflictKeep,
          keepLabel: '保存编辑器的',
          discardLabel: '保存外部修改',
          noteText:
            '保存编辑器的会立刻用编辑器里的内容覆盖磁盘上的外部修改；保存外部修改会丢弃编辑器里还没写盘的内容，并重新载入外部那一份。',
        }),
    // 关闭弹窗同样只在面板根上挂一处：不管此刻铺出几栏，DOM 里都只有一个（D-38）
    closeDialog.open
      ? createElement(PanelCloseDialog, {
          open: true,
          saving: closeDialog.saving,
          error: closeDialog.error,
          onChoose: props.onCloseChoice,
        })
      : null,
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

  /** 各栏可编辑组件的句柄归属；与 `columns` 在同一处同步增长，第 N 栏恰好对应第 N 个 ref */
  private readonly columnRefs: RefObject<IEditableContentHandle<ITableDocument> | null>[] = [];

  /** 面板级「当前可见的外部改动冲突」；同一时刻只显示一个，其余留在各栏状态里排队（D-37） */
  private readonly conflictStore: Store<ITablePendingConflict | undefined> = new Store<
    ITablePendingConflict | undefined
  >(undefined);

  /** 当前显示冲突的栏序号；没有显示时为 undefined */
  private visibleConflictColumn: number | undefined = undefined;

  /** 是否有可编辑字段正在输入（已聚焦未失焦 / 未确认提交）；为真时待决冲突只记进栏状态、不弹窗 */
  private fieldEditing: boolean = false;

  /** 待写路径变化的退订函数；未订阅时为空 */
  private pendingUnwatch: (() => void) | undefined = undefined;

  /** 面板级关闭弹窗状态：整个面板只一份，与「哪一栏触发关闭」和栏数无关（D-38） */
  private readonly closeDialogStore: Store<ITableCloseDialogState> = new Store<ITableCloseDialogState>({
    open: false,
    saving: false,
  });

  /** 等待中的关闭询问的结算函数；为 undefined 表示没有询问在等，重复点按只结算一次 */
  private closeDialogResolve: ((choice: PanelCloseChoice) => void) | undefined = undefined;

  /**
   * 关闭弹窗上的选择：交回面板结算，取消 / 丢弃 / 保存三个分支都在面板里执行
   * @param choice 用户的选择
   */
  private readonly answerCloseDialog = (choice: PanelCloseChoice): void => {
    void this.handleCloseChoice(choice);
  };

  /**
   * 某栏组件交回草稿：只覆盖面板副本与交回脏标记，绝不写盘（T-04.2-08-01）
   * @param columnIndex 栏序号（0 基）
   * @param content 组件交回的草稿
   * @param dirty 交回时刻的脏标记
   */
  private readonly updateColumnDraft = (columnIndex: number, content: ITableDocument, dirty: boolean): void => {
    const column = this.columnAt(columnIndex);

    column.draft = content;
    column.draftDirty = dirty;
  };

  /**
   * 取某栏的组件句柄引用：缺失时按需补建该栏，保证「第 N 栏 ↔ 第 N 个 ref」一一对应
   * @param columnIndex 栏序号（0 基）
   * @returns 该栏唯一的组件句柄引用
   */
  private readonly columnRefAt = (columnIndex: number): RefObject<IEditableContentHandle<ITableDocument> | null> => {
    this.columnAt(columnIndex);

    return this.columnRefs[columnIndex];
  };

  /**
   * 读取某栏空栏浏览区的目录子条目：成功时清掉该栏读取错误，失败时记下可读文案并重新抛出
   *
   * 构造期绑定一次，作为浏览器 / 新建表单的稳定 `loadChildren` 引用，避免每次渲染换新函数；
   * 失败时重新抛出，让浏览器进入带「重试」的错误态（UI-SPEC）。
   * @param columnIndex 栏序号（0 基）
   * @param path 要读取的目录路径；根目录为空串
   * @returns 该目录的直接子条目
   */
  private readonly loadPickerChildren = async (columnIndex: number, path: string): Promise<readonly IFileEntry[]> => {
    try {
      const entries = await this.context.listDirectory(path);
      const column = this.columnAt(columnIndex);

      if (column.pickerError !== undefined) {
        column.pickerError = undefined;
        this.publish(columnIndex, TablePanelStatus.NoTarget);
      }

      return entries;
    } catch (error) {
      const column = this.columnAt(columnIndex);

      column.pickerError = '目录读取失败，请重试。';
      this.publish(columnIndex, TablePanelStatus.NoTarget);
      throw error;
    }
  };

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
        getColumnRef: this.columnRefAt,
        applyEdit: (columnIndex, edit, document): ITableDocument | null => this.applyEdit(columnIndex, edit, document),
        saveDocument: (columnIndex, document): Promise<ContentSaveStatus> => this.saveDocument(columnIndex, document),
        onDraftChange: this.updateColumnDraft,
        onOpenSchema: (columnIndex, opener): void => void this.openSchemaPanel(opener, columnIndex),
        onOpenInCodeEditor: (columnIndex, opener): void => void this.openCurrentViewInCodeEditor(opener, columnIndex),
        onCloseColumn: (columnIndex): void => this.closeColumn(columnIndex),
        onConfirmCommentStrip: (columnIndex): void => void this.confirmCommentStrip(columnIndex),
        onCancelCommentStrip: (columnIndex): void => this.cancelCommentStrip(columnIndex),
        onEmptyModeChange: (columnIndex, mode): void => this.setEmptyMode(columnIndex, mode),
        onEmptyLoadChildren: this.loadPickerChildren,
        onEmptyOpen: (columnIndex, dataPath): void => this.openIntoColumn(columnIndex, dataPath),
        onEmptyCreate: (columnIndex, directory, name): void => void this.createIntoColumn(columnIndex, directory, name),
        onEmptyDelete: (columnIndex, dataPath): void => void this.deleteFromColumn(columnIndex, dataPath),
        conflictStore: this.conflictStore,
        onConflictDiscard: (): void => {
          void this.discardExternalConflict();
        },
        onConflictKeep: (): void => {
          void this.keepExternalConflict();
        },
        onFieldEditingChange: (editing): void => this.setFieldEditing(editing),
        closeDialogStore: this.closeDialogStore,
        onCloseChoice: this.answerCloseDialog,
      });
  }

  async initialize(): Promise<void> {
    if (this.pendingUnwatch !== undefined) return;

    // 订阅时会立刻用当前全部待写路径回调一次，因此不必另外查一遍
    this.pendingUnwatch = this.context.watchPendingChange((paths): void => this.refreshPendingWrites(paths));
  }

  async dispose(): Promise<void> {
    this.pendingUnwatch?.();
    this.pendingUnwatch = undefined;

    await this.saveDirtyColumns();
  }

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

  /**
   * 用户点标签上的关闭：没有任何一栏有未保存改动就直接放行；有脏改动才在面板根上弹三态框等选择
   *
   * 脏判定只走 `TablePanel.isColumnDirty`（三个来源合起来看），绝不只读某一个标志位，
   * 否则「刚编辑过但组件草稿刚被重置」会被误判成干净而静默丢改动（D-05 / D-08）。
   * 三个来源里的「本栏还有待写」让「只有待写、没有草稿」的情况也会弹三态框，于是关闭时能看到
   * 既有的「正在保存…」态并等写盘结算（D-20）。
   * @returns 保存并关闭 / 不保存关闭 / 取消关闭
   */
  async onRequestClose(): Promise<PanelCloseChoice> {
    if (!this.hasDirtyColumn()) return PanelCloseChoice.Save;

    this.publishCloseDialog({ open: true, saving: false });

    return new Promise<PanelCloseChoice>((resolve) => {
      this.closeDialogResolve = resolve;
    });
  }

  /**
   * 用户选择「不保存关闭」时由外壳投递：清掉各栏的内存脏标记与草稿，使 `TablePanel.dispose`
   * 的兜底保存成为空操作；不写盘、不登记撤销（D-10）
   *
   * 本栏涉及的路径（数据文件与由它推导出的 schema 文件）还要各丢弃一次待写，否则 5 秒后定时器会把
   * 刚被丢弃的改动写回磁盘（D-08 / T-04.3-11）。
   */
  onDiscard(): void {
    const count = this.columns.length;

    this.closeDialogResolve = undefined;
    this.publishCloseDialog({ open: false, saving: false });

    for (let index = 0; index < count; index += 1) this.clearColumnDirty(index);

    for (let index = 0; index < count; index += 1) {
      const target = this.columns[index].target;

      if (target === null) continue;

      this.context.discardPendingResource(target.dataPath);
      this.context.discardPendingResource(deriveSchemaPath(target.dataPath));
    }
  }

  /**
   * 结算一次关闭询问：三个分支都把关闭弹窗收回，并唤醒等待中的 `TablePanel.onRequestClose`
   *
   * 结算函数只取一次并立刻清空，因此重复点按不会二次结算（T-04.2-11-03）。
   * @param choice 用户的选择
   * @param error 保存失败的原因；有值时弹窗留在屏幕上并把原因显示出来
   */
  private settleCloseDialog(choice: PanelCloseChoice, error?: string): void {
    const resolve = this.closeDialogResolve;

    this.closeDialogResolve = undefined;
    this.publishCloseDialog(error === undefined ? { open: false, saving: false } : { open: true, error });

    if (resolve !== undefined) resolve(choice);
  }

  /**
   * 响应关闭弹窗上的一个选择：保存分支先逐栏落盘，任一栏失败都留在弹窗里并结算为取消
   * @param choice 用户的选择
   */
  private async handleCloseChoice(choice: PanelCloseChoice): Promise<void> {
    if (choice !== PanelCloseChoice.Save) {
      this.settleCloseDialog(choice);
      return;
    }

    this.publishCloseDialog({ open: true, saving: true });

    const error = await this.saveAllColumns();

    if (error === undefined) {
      this.settleCloseDialog(PanelCloseChoice.Save);
      return;
    }

    this.settleCloseDialog(PanelCloseChoice.Cancel, error);
  }

  /**
   * 把关闭弹窗状态写进面板级订阅源（全仓唯一写入口，保证只有一份状态）
   * @param state 新的弹窗状态
   */
  private publishCloseDialog(state: ITableCloseDialogState): void {
    this.closeDialogStore.setState(state);
  }

  /**
   * 判断是否存在任何一栏有未保存改动
   * @returns 至少一栏为脏时为 true
   */
  private hasDirtyColumn(): boolean {
    const count = this.columns.length;

    for (let index = 0; index < count; index += 1) {
      if (this.isColumnDirty(index)) return true;
    }

    return false;
  }

  /**
   * 逐栏保存并返回第一条失败原因；全部成功（或本来就不用写）时返回 undefined
   *
   * 与 `TablePanel.onSwitchOut` 共用同一条写盘入口 `TablePanel.saveColumn`：它会转调
   * `TablePanel.saveDocument` 的非安静分支，因此这一轮等到的是「按该栏路径真正写盘」结算完毕，
   * 而不是只排进缓冲。「保存并关闭」的「正在保存…」态就等这一轮（D-20）。
   * 成功后把组件标记为已保存，使随后的 `dispose` 兜底保存成为空操作（D-09）。
   * @returns 保存失败的原因；没有失败时为 undefined
   */
  private async saveAllColumns(): Promise<string | undefined> {
    const count = this.columns.length;

    for (let index = 0; index < count; index += 1) {
      const status = await this.saveColumn(index);

      if (status === ContentSaveStatus.Failed) return this.columnAt(index).store.state.error ?? '保存失败';

      this.columnRefs[index]?.current?.markSaved();
    }

    return undefined;
  }

  /**
   * 清掉某一栏的内存脏状态：把挂载中的组件标记为已保存，并作废草稿与三个脏标记，不碰基线内容
   * @param columnIndex 栏序号（0 基）
   */
  private clearColumnDirty(columnIndex: number): void {
    const column = this.columnAt(columnIndex);

    this.columnRefs[columnIndex]?.current?.markSaved();
    column.draft = null;
    column.draftDirty = false;
    column.unsaved = false;
    column.unsavedSchema = false;
  }

  async onSwitchIn(): Promise<void> {
    const count = this.columns.length;

    for (let index = 0; index < count; index += 1) await this.refresh(index);

    this.refreshAwaitingPickers();
  }

  async onSwitchOut(): Promise<void> {
    const count = this.columns.length;

    // B1：外壳在通知 React 之前就 await 了本方法，保存期间组件仍然挂载，因此这里可以直接读 ref 取草稿
    for (let index = 0; index < count; index += 1) {
      const status = await this.saveColumn(index);

      if (status === ContentSaveStatus.Saved) this.columnRefs[index]?.current?.markSaved();
    }
  }

  async onUpdateResource(): Promise<void> {
    this.refreshAwaitingPickers();
  }

  /**
   * 资源层确认某个路径发生变化后，逐栏按目标路径匹配并处理（D-15 / D-16 / D-36）
   *
   * 只有本面板某栏目标的数据文件、或由它推导出的 schema 文件才处理，其它路径直接忽略且不读内容；
   * 处理时先读外部原文并与该栏「上次载入 / 写盘成功的基线」比较，相同即视为编辑器自己的写入回声，
   * 既不刷新也不弹框。读取失败降级为该栏提示，绝不覆盖内存内容。
   * @param identifier 资源统一标识符
   * @param kind 变化种类
   */
  async onResourceChange(identifier: IResourceIdentifier, kind: EditorFileChangeKind): Promise<void> {
    const count = this.columns.length;

    for (let index = 0; index < count; index += 1) {
      const target = this.columns[index].target;

      if (target === null) continue;
      if (target.dataPath !== identifier && deriveSchemaPath(target.dataPath) !== identifier) continue;

      await this.handleResourceChange(index, identifier, kind);
    }
  }

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

    // 换目标前先把该栏未落盘改动同步快照后异步写回，避免切换后丢掉内存改动（T-02.1-20-01）
    if (previous !== null && this.isColumnDirty(columnIndex)) void this.flushColumn(columnIndex);

    column.target = target;
    column.unsaved = false;
    column.unsavedSchema = false;
    column.baselineText = undefined;
    column.baselineSchemaText = undefined;
    column.pendingConflict = undefined;

    if (this.visibleConflictColumn === columnIndex) {
      this.visibleConflictColumn = undefined;
      this.conflictStore.setState(undefined);
    }

    // 版本号自增与草稿作废必须成对发生：换表后组件不能从上一张表的草稿重置（T-04.2-08-05）
    this.resetColumnDraft(columnIndex);
    this.bumpContentVersion(columnIndex);

    // 换到另一张表（或此前无目标）时先清掉旧表行树：不同表的旧行在新表加载期间不能继续显示（P26）
    if (previous === null || previous.dataPath !== target.dataPath) {
      this.publish(columnIndex, TablePanelStatus.Loading);
    }

    this.showNextConflict();
    void this.refresh(columnIndex);
  }

  /**
   * 保存某一栏：先按同一条链把内容排进缓冲，再由写入路径按该栏两条路径立刻写盘
   *
   * 「保存按钮 = 立刻写盘」就落在这一条上：`TablePanel.saveColumn` 转调
   * `TablePanel.saveDocument` 的非安静分支，后者把数据文件与由它推导出的 schema 文件各 flush 一次。
   * 这里**不**用全量写盘，否则会把别的面板还没确认的内容一起写掉（D-11 / T-04.3-01）。
   * @param columnIndex 目标栏的序号（0 基），省略为第 0 栏
   */
  async save(columnIndex: number = 0): Promise<void> {
    await this.saveColumn(columnIndex);
  }

  /**
   * 关闭某一栏的表格：清空本栏目标与内容并回到未设目标态，只作用于本栏
   *
   * 关闭后本栏 `target` 归空，`findEmptyColumnIndex` 随后即可把它当作空栏供「编辑 Schema」复用；
   * 同时递增本栏请求序号以丢弃在途读取结果，避免关闭后旧结果再写回本栏。关栏前若本栏有未落盘改动，
   * 先同步快照后异步写回，避免丢改动（T-02.1-20-01）。空栏内联视图一并复位为三个按钮态（`emptyMode`
   * 归 `Buttons`、目录归根 `''`、读取错误清空），使「打开表格 → 开进本栏 → ✕ 关栏 → 回到三个
   * 按钮」成立；其它栏的目标与状态不受影响。
   * @param columnIndex 要关闭的栏序号（0 基）
   */
  private closeColumn(columnIndex: number): void {
    const column = this.columnAt(columnIndex);

    if (this.isColumnDirty(columnIndex)) void this.flushColumn(columnIndex);

    column.target = null;
    column.data = null;
    column.schema = null;
    column.baselineText = undefined;
    column.baselineSchemaText = undefined;
    column.prefix = '';
    column.pendingStrip = undefined;
    column.unsaved = false;
    column.unsavedSchema = false;
    column.pendingStripText = '';
    column.pendingConflict = undefined;
    column.emptyMode = TableEmptyMode.Buttons;
    column.directory = '';
    column.pickerError = undefined;

    if (this.visibleConflictColumn === columnIndex) {
      this.visibleConflictColumn = undefined;
      this.conflictStore.setState(undefined);
    }

    this.resetColumnDraft(columnIndex);
    this.nextToken(columnIndex);
    this.publish(columnIndex, TablePanelStatus.NoTarget);
    this.showNextConflict();
  }

  /**
   * 切换某栏空栏的内联视图；进入打开 / 新建 / 删除态时清掉读取错误并递增重列令牌，
   * 让浏览器 / 新建表单按初始目录自己读一次
   * @param columnIndex 栏序号（0 基）
   * @param mode 目标内联视图
   */
  private setEmptyMode(columnIndex: number, mode: TableEmptyMode): void {
    const column = this.columnAt(columnIndex);

    column.emptyMode = mode;

    if (mode === TableEmptyMode.Open || mode === TableEmptyMode.Create || mode === TableEmptyMode.Delete) {
      column.pickerError = undefined;
      column.pickerReloadToken += 1;
    }

    this.publish(columnIndex, TablePanelStatus.NoTarget);
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
      this.publish(columnIndex, TablePanelStatus.NoTarget);
      return;
    }

    const dataPath = joinPath(directory, `${name}.json`);
    const schemaPath = deriveSchemaPath(dataPath);

    await this.context.createResource(dataPath, INITIAL_TABLE_DATA_TEXT);
    await this.context.createResource(schemaPath, INITIAL_TABLE_SCHEMA_TEXT);

    column.directory = directory;
    column.pickerError = undefined;
    this.setTable({ dataPath }, columnIndex);
    this.refreshAwaitingPickers();
  }

  /**
   * 删除某栏内联浏览器中的一张表：删数据 + schema 一对文件后让该栏浏览器重读当前目录
   *
   * 删除不可撤销（D-13）——本方法不登记任何 `IUndoContext`；二次确认由空栏控件在调用本方法前完成。
   * 删除后该栏仍是空栏、`emptyMode` 保持删除态以支持连续删除。
   * @param columnIndex 栏序号（0 基）
   * @param dataPath 要删除的数据文件路径
   */
  private async deleteFromColumn(columnIndex: number, dataPath: string): Promise<void> {
    await this.context.deleteResource(dataPath);
    await this.context.deleteResource(deriveSchemaPath(dataPath));

    this.columnAt(columnIndex).pickerError = undefined;
    this.refreshAwaitingPickers();
  }

  /**
   * 让本面板**所有**处于打开 / 删除态栏的浏览器重读当前目录，使「打开表格」列表实时同步
   *
   * 供面板内建 / 删表格后、`TablePanel.onSwitchIn` 与 `TablePanel.onUpdateResource` 复用；
   * 仅递增内联浏览区处于 `Open` / `Delete` 态且尚未设目标的栏的重列令牌，其余栏不受影响。
   */
  private refreshAwaitingPickers(): void {
    const count = this.columns.length;

    for (let index = 0; index < count; index += 1) {
      const column = this.columns[index];

      if (column.target !== null) continue;
      if (column.emptyMode !== TableEmptyMode.Open && column.emptyMode !== TableEmptyMode.Delete) continue;

      column.pickerReloadToken += 1;
      this.publish(index, TablePanelStatus.NoTarget);
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
    column.unsaved = true;

    this.context.addUndoContext(this, {
      type: TableUndoType.Replace,
      data: { columnIndex, path: '', previousValue: column.data, nextValue: parsed.value },
    });
    this.applyData(columnIndex, parsed.value);
  }

  /**
   * 一次编辑落成的结果：新文档，以及需要在该栏提示位发布的成功文案
   */

  /**
   * 唯一的编辑实现：接住组件的一次编辑意图，产出新文档并登记撤销
   *
   * 本地编辑与「面板换内容」是两个信号：这里只更新面板副本与脏标记，**不**调
   * `TablePanel.applyData`、**不**递增版本号、**不**发布行树（D-02 / D-06 / T-04.2-08-04）。
   * 行树由组件按自己的草稿重算，因此本地编辑不会把面板内容整块换掉。
   *
   * 一次确认之后还要顺手做两件事（都在成功分支末尾）：把内容写进缓冲（`TablePanel.saveAfterEdit`，
   * 即发即忘，不改变本方法的同步签名），以及解除「正在打字」推迟（数字框回车确认后不失焦也算停手）。
   * @param columnIndex 栏序号（0 基）
   * @param edit 组件这次要执行的编辑意图
   * @param document 组件提交时的文档（草稿可能比面板副本新一帧）
   * @returns 编辑后的新文档；为 null 表示这次编辑被拒绝且面板已发布错误
   */
  applyEdit(columnIndex: number, edit: ITableEdit, document: ITableDocument): ITableDocument | null {
    const column = this.columnAt(columnIndex);

    if (column.target === null) return null;

    const outcome =
      edit.kind === TableEditKind.Change
        ? this.computeChange(columnIndex, edit, document)
        : edit.kind === TableEditKind.Add
          ? this.computeAdd(columnIndex, edit, document)
          : this.computeDelete(columnIndex, edit, document);

    if (outcome === null) return null;

    column.draft = outcome.document;
    column.draftDirty = true;
    this.publish(columnIndex, column.store.state.status, outcome.notice);
    this.saveAfterEdit(columnIndex);
    // 一次成功的确认提交也算「停手」：数字框按回车确认后不失焦，只靠失焦事件永远等不到这一刻
    this.setFieldEditing(false);

    return outcome.document;
  }

  /**
   * 计算一次改值后的文档：按行内配置校验新值，并登记一步可逆撤销
   * @param columnIndex 栏序号（0 基）
   * @param edit 改值意图
   * @param document 组件提交时的文档
   * @returns 新文档；校验未通过时为 null
   */
  private computeChange(columnIndex: number, edit: ITableEdit, document: ITableDocument): ITableEditOutcome | null {
    const column = this.columnAt(columnIndex);

    if (!validateValue(edit.config, edit.value)) {
      this.publishError(columnIndex, `${edit.key} : 输入的值不合要求，请鼠标放置在注释上查看说明`);
      return null;
    }

    const previousValue = readAt(document.data, edit.key);
    const next = setByFieldPath(document.data, edit.key, edit.value);

    column.unsaved = true;
    this.context.addUndoContext(this, {
      type: TableUndoType.Change,
      data: { columnIndex, path: edit.key, previousValue, nextValue: edit.value },
    });

    return { document: { data: next, schema: document.schema, schemaMode: document.schemaMode } };
  }

  /**
   * 计算一次新增后的文档：新字段插到锚点行**之后**（不是末尾），并把新名称同步写进该层 schema 的
   * `x-order`（数据表视图写文档里的 schema 副本，schema 视图写在自身）
   * @param columnIndex 栏序号（0 基）
   * @param edit 新增意图（`anchorKey` / `key` 为锚点路径，`name` 为新字段名）
   * @param document 组件提交时的文档
   * @returns 新文档；名称未通过校验或写入被拒绝时为 null
   */
  private computeAdd(columnIndex: number, edit: ITableEdit, document: ITableDocument): ITableEditOutcome | null {
    const column = this.columnAt(columnIndex);
    const anchorKey = edit.anchorKey === undefined ? edit.key : edit.anchorKey;
    const name = edit.name === undefined ? '' : edit.name;
    const parentPath = getParentFieldPath(anchorKey);
    const parentObject = readAt(document.data, parentPath);
    const existingKeys = isRecord(parentObject) ? Object.keys(parentObject) : [];
    const validation = validateId(name, existingKeys, false);

    if (!validation.valid) {
      this.publishError(columnIndex, validation.error ?? '名称未通过校验');
      return null;
    }

    const schemaView = document.schemaMode;
    const anchor = getShortField(anchorKey);
    const path = `${parentPath}['${name}']`;
    const next = insertAfterFieldPath(document.data, path, anchor, schemaView ? {} : null);

    if (!this.wasAdded(next, parentPath, name)) {
      this.publishError(columnIndex, '名称不合法，未添加。');
      return null;
    }

    const ownerPath = schemaView ? this.schemaOwnerPath(parentPath) : this.schemaMirrorPath(parentPath);

    if (schemaView) {
      const ordered = this.withOrder(next, ownerPath, parentObject, anchor, name);

      column.unsaved = true;
      this.context.addUndoContext(this, {
        type: TableUndoType.Add,
        data: { columnIndex, path, previousValue: undefined, nextValue: {}, anchor },
      });
      return { document: { data: ordered, schema: document.schema, schemaMode: true }, notice: '添加成功' };
    }

    const previousSchema = document.schema;
    const nextSchema = isRecord(previousSchema)
      ? this.withOrder(previousSchema, ownerPath, parentObject, anchor, name)
      : undefined;

    column.unsaved = true;

    if (nextSchema !== undefined) column.unsavedSchema = true;

    this.context.addUndoContext(this, {
      type: TableUndoType.Add,
      data: { columnIndex, path, previousValue: undefined, nextValue: null, anchor, previousSchema, nextSchema },
    });

    return {
      document: { data: next, schema: nextSchema === undefined ? previousSchema : nextSchema, schemaMode: false },
      notice: '添加成功',
    };
  }

  /**
   * 计算一次删除后的文档：是否允许删除由行内的空值校验在组件侧决定，这里只登记一步可逆撤销
   * @param columnIndex 栏序号（0 基）
   * @param edit 删除意图
   * @param document 组件提交时的文档
   * @returns 新文档
   */
  private computeDelete(columnIndex: number, edit: ITableEdit, document: ITableDocument): ITableEditOutcome {
    const column = this.columnAt(columnIndex);
    const previousValue = readAt(document.data, edit.key);
    const next = deleteByFieldPath(document.data, edit.key);

    column.unsaved = true;
    this.context.addUndoContext(this, {
      type: TableUndoType.Delete,
      data: { columnIndex, path: edit.key, previousValue, nextValue: undefined },
    });

    return {
      document: { data: next, schema: document.schema, schemaMode: document.schemaMode },
      notice: '删除成功',
    };
  }

  /**
   * 兼容薄壳：按旧三参数（字段路径 + 新值 + 栏号）组装一次改值意图后转调 `TablePanel.applyEdit`
   *
   * `undo.test.ts` / `panelSync.uat.test.tsx` / `schemaMode.test.tsx` 仍以具体 `TablePanel`
   * 类型调用本方法，因此保留；它自身没有编辑语义、不写盘，也不是第二套编辑实现。
   * @param key 字段路径
   * @param value 新值
   * @param columnIndex 目标栏序号（0 基），省略为第 0 栏
   */
  async commitValue(key: string, value: unknown, columnIndex: number = 0): Promise<void> {
    if (this.columnAt(columnIndex).target === null) return;

    const document = this.currentDocument(columnIndex);
    const row = this.findRow(this.rowsForDocument(document), key);

    this.applyEdit(
      columnIndex,
      { kind: TableEditKind.Change, key, value, config: row === undefined ? undefined : row.config },
      document,
    );
  }

  /**
   * 兼容薄壳：按旧三参数（锚点路径 + 新名称 + 栏号）组装一次新增意图后转调 `TablePanel.applyEdit`
   * @param anchorKey 锚点行的字段路径（新字段插在其后）；无锚点时追加到末尾
   * @param name 新项名称
   * @param columnIndex 目标栏序号（0 基），省略为第 0 栏
   */
  async addItem(anchorKey: string, name: string, columnIndex: number = 0): Promise<void> {
    if (this.columnAt(columnIndex).target === null) return;

    this.applyEdit(
      columnIndex,
      { kind: TableEditKind.Add, key: anchorKey, anchorKey, name },
      this.currentDocument(columnIndex),
    );
  }

  /**
   * 兼容薄壳：按旧两参数（字段路径 + 栏号）组装一次删除意图后转调 `TablePanel.applyEdit`
   * @param key 字段路径
   * @param columnIndex 目标栏序号（0 基），省略为第 0 栏
   */
  async deleteItem(key: string, columnIndex: number = 0): Promise<void> {
    if (this.columnAt(columnIndex).target === null) return;

    this.applyEdit(columnIndex, { kind: TableEditKind.Delete, key }, this.currentDocument(columnIndex));
  }

  /**
   * 唯一的写盘入口：把组件草稿（或面板副本）写回资源，返回可观察的保存结果
   *
   * 进入方法时先同步拍下目标与前缀：换表 / 关栏可能在写盘进行中改掉 `column.target`，
   * 快照保证内容仍写回原文件。失败时**保留脏标记**并发布错误，绝不静默丢改动（T-04.2-08-02）。
   *
   * 两条语义按 `quiet` 分开：安静模式只把内容排进缓冲（字段确认后的自动保存走这一条，5 秒后才落盘、
   * 也不刷「已保存」）；其余入口（保存按钮 / 切走 / 关闭 / 释放）写缓冲之后会按该栏两条路径各 flush
   * 一次，因此「保存按钮 = 立刻写盘」成立，写盘失败走既有的错误通道并返回 `Failed`。
   * @param columnIndex 栏序号（0 基）
   * @param document 要写回的文档
   * @param quiet 安静模式：只把内容排进缓冲、不刷「已保存」提示也不清已有提示位、也不立刻写盘
   * @returns 保存结果：已保存或失败
   */
  async saveDocument(
    columnIndex: number,
    document: ITableDocument,
    quiet: boolean = false,
  ): Promise<ContentSaveStatus> {
    const column = this.columnAt(columnIndex);
    const target = column.target;
    const prefix = column.prefix;

    if (target === null) return ContentSaveStatus.Saved;

    const startVersion = column.contentVersion;
    const wroteData = column.unsaved;
    const wroteSchema = column.unsavedSchema;

    if (wroteData && !(await this.persist(columnIndex, target, document.data, prefix))) {
      return ContentSaveStatus.Failed;
    }

    if (wroteSchema && !(await this.persistSchema(columnIndex, target, document.schema, prefix))) {
      return ContentSaveStatus.Failed;
    }

    // 写盘期间换了目标 / 换了内容（撤销、外部刷新）：内容已写回原文件，但不能再拿这份快照覆盖更新的面板状态
    // 面板侧没有待写内容（脏只来自组件尚未同步的标记）时同样不写内容、也不改写基线。
    if (column.target === target && column.contentVersion === startVersion && (wroteData || wroteSchema)) {
      // 写盘成功后把基线同步为刚写出的原文：之后宿主回声与基线相同，被判为无变化（D-15 / D-36）。
      // 这一步必须早于 50 毫秒合并通知，也不能挪到写盘之后，否则写者自己每次编辑都会弹冲突框。
      if (wroteData) column.baselineText = serializeTableText(document.data, prefix);
      if (wroteSchema && isRecord(document.schema)) {
        column.baselineSchemaText = serializeTableText(document.schema, prefix);
      }

      column.data = document.data;
      column.schema = document.schema;
      column.draft = document;
      column.unsaved = false;
      column.unsavedSchema = false;
      column.draftDirty = false;
      this.bumpContentVersion(columnIndex);
      this.publish(
        columnIndex,
        column.store.state.status,
        quiet ? column.store.state.message : '已保存',
        quiet ? column.store.state.error : undefined,
      );

      if (wroteData) this.refreshDependents(columnIndex, target.dataPath);
      if (wroteSchema) this.refreshDependents(columnIndex, deriveSchemaPath(target.dataPath));
    }

    if (quiet) return ContentSaveStatus.Saved;

    // 按路径立刻写盘：只写本栏这两条路径，绝不使用全量写盘（那会写掉别的面板还没确认的内容）
    try {
      await this.context.flushResource(target.dataPath);
      await this.context.flushResource(deriveSchemaPath(target.dataPath));
    } catch {
      this.publishError(columnIndex, '写入失败，请重试。');
      return ContentSaveStatus.Failed;
    }

    return ContentSaveStatus.Saved;
  }

  /**
   * 唯一的脏判定：三个来源中任一为真即视为脏
   *
   * 三个来源是：① 面板侧未落盘标记（`unsaved` / `unsavedSchema`）；② 组件草稿脏（面板持有的交回脏标记，
   * 或挂载中的组件自己判脏）；③ 该栏目标路径现在还有待写（`pendingWrite`，5 秒自动写盘完成后自动变假）。
   * 第三来源不能省：自动保存之后草稿脏会被清零，只看草稿会把「已经确认、还没落盘」的改动判成干净，
   * 关闭询问就会直接放行。
   * 供保存、切走、换表、关栏与外部变化 / 关闭三态共用；**不要**再直接读某一个标志位（D-04 / D-05 / D-11）。
   * @param columnIndex 栏序号（0 基），省略为第 0 栏
   * @returns 该栏有未落盘改动时为 true
   */
  isColumnDirty(columnIndex: number = 0): boolean {
    const column = this.columnAt(columnIndex);

    if (column.unsaved || column.unsavedSchema || column.draftDirty || column.pendingWrite) return true;

    return this.columnRefs[columnIndex]?.current?.isDirty() ?? false;
  }

  /**
   * 取面板要下发给组件的文档：草稿副本优先，没有草稿时用面板基线拼一份
   *
   * 与 `TablePanel.currentDocument` 的差别：这里**不读组件 ref**。面板主动换内容时必须发布
   * 面板自己刚算出的新基线，否则会把组件里还没重置的旧草稿当成新内容发回去（D-02 / §Q2.4）。
   * @param columnIndex 栏序号（0 基）
   * @returns 要下发给该栏组件的文档
   */
  private publishedDocument(columnIndex: number): ITableDocument {
    const column = this.columnAt(columnIndex);

    if (column.draft !== null) return column.draft;

    return { data: column.data, schema: column.schema, schemaMode: this.isSchemaView(columnIndex) };
  }

  /**
   * 按三级顺序取该栏当前文档：组件 ref（已挂载且脏）→ 面板草稿副本（已卸载但有交回、或面板侧刚算出的新值）→ 面板基线
   *
   * 组件只有在自己脏时才比面板副本新（编辑必经 `TablePanel.applyEdit`）；组件干净时它的内容就是面板
   * 上一次发布的基线，此时若面板副本更新（兼容薄壳、撤销在未挂载 / 干净组件上落的新值），必须用副本。
   * 第三级不能省：撤销 / 重做在面板未挂载时改的是面板副本，`applyData` 会把 `column.draft`
   * 作废，此时新内容只在 `column.data` / `column.schema` 上（§R2）。
   * @param columnIndex 栏序号（0 基）
   * @returns 该栏当前应被保存 / 呈现的文档
   */
  private currentDocument(columnIndex: number): ITableDocument {
    const column = this.columnAt(columnIndex);
    const handle = this.columnRefs[columnIndex]?.current;

    if (handle !== undefined && handle !== null && handle.isDirty()) return handle.getData();
    if (column.draft !== null) return column.draft;
    if (handle !== undefined && handle !== null) return handle.getData();

    return { data: column.data, schema: column.schema, schemaMode: this.isSchemaView(columnIndex) };
  }

  /**
   * 按文档自身的 schemaMode 算出呈现行树，供兼容薄壳取出字段的行内配置
   * @param document 要计算行树的文档
   * @returns 行树
   */
  private rowsForDocument(document: ITableDocument): readonly ITableRowNode[] {
    return document.schemaMode ? buildSchemaTree(document.data) : buildTableTree(document.schema, document.data);
  }

  /**
   * 版本号唯一自增点：只由载入 / 外部刷新 / 换表 / 保存回写四个显式入口调用
   * （撤销与外部刷新经 `applyData` 落到载入路径）
   * @param columnIndex 栏序号（0 基）
   */
  private bumpContentVersion(columnIndex: number): void {
    this.columnAt(columnIndex).contentVersion += 1;
  }

  /**
   * 草稿的唯一作废入口：把该栏草稿与交回脏标记一起清掉，不碰基线内容与两个未落盘标志
   *
   * 调用点固定四处（载入 / schema 载入 / 换表 / 关栏）；`TablePanel.saveDocument` 成功后不调用它，
   * 因为此时草稿已等于刚写盘的内容（D-02 / D-06 / D-17）。
   * @param columnIndex 栏序号（0 基）
   */
  private resetColumnDraft(columnIndex: number): void {
    const column = this.columnAt(columnIndex);

    column.draft = null;
    column.draftDirty = false;
  }

  /**
   * 取数 + 判脏 + 转调写盘入口：`TablePanel.save` 与切走保存共用这一条
   * @param columnIndex 栏序号（0 基）
   * @param quiet 安静模式：转交给 `TablePanel.saveDocument`，字段确认后的自动保存用它避免刷「已保存」
   * @returns 保存结果
   */
  private async saveColumn(columnIndex: number, quiet: boolean = false): Promise<ContentSaveStatus> {
    const column = this.columnAt(columnIndex);

    if (column.target === null) return ContentSaveStatus.Saved;
    if (!this.isColumnDirty(columnIndex)) return ContentSaveStatus.Saved;

    return this.saveDocument(columnIndex, this.currentDocument(columnIndex), quiet);
  }

  /**
   * 字段确认之后把该栏自动写进缓冲：取数、判脏、转调 `TablePanel.saveColumn`（安静模式）
   *
   * 这是「一次确认 = 一次缓冲写入」的唯一入口，与手动保存共用同一条写盘链，不另写一套序列化。
   * 它是一条即发即忘的旁路：失败由既有的错误通道发布，绝不向外抛，因此不改变
   * `TablePanel.applyEdit` 的同步签名。
   * @param columnIndex 栏序号（0 基）
   */
  private saveAfterEdit(columnIndex: number): void {
    void this.saveColumn(columnIndex, true);
  }

  /**
   * 确认「剥离注释后打开」某一栏：以暂存的宽松解析值 + 空前缀应用该栏内容，并清空暂存与提示
   * @param columnIndex 栏序号（0 基）
   */
  async confirmCommentStrip(columnIndex: number = 0): Promise<void> {
    const column = this.columnAt(columnIndex);

    if (column.pendingStrip === undefined) return;

    const value = column.pendingStrip;
    const rememberedText = column.pendingStripText;

    column.pendingStrip = undefined;
    column.pendingStripText = '';
    column.prefix = '';

    const target = column.target;

    if (target === null) {
      this.publish(columnIndex, TablePanelStatus.NoTarget);
      return;
    }

    column.stripConfirmed.set(target.dataPath, rememberedText);
    column.unsaved = true;

    const token = this.nextToken(columnIndex);

    await this.loadPrimary(columnIndex, target, value, token, rememberedText);
  }

  /**
   * 取消「剥离注释后打开」某一栏：清空暂存与提示并关闭该栏（不打开）
   * @param columnIndex 栏序号（0 基）
   */
  cancelCommentStrip(columnIndex: number = 0): void {
    const column = this.columnAt(columnIndex);

    if (column.pendingStrip === undefined) return;

    column.pendingStrip = undefined;
    column.pendingStripText = '';
    column.prefix = '';
    column.target = null;
    column.data = null;
    column.schema = null;
    column.baselineText = undefined;
    column.baselineSchemaText = undefined;
    this.nextToken(columnIndex);
    this.publish(columnIndex, TablePanelStatus.NoTarget);
  }

  /**
   * 取第 columnIndex 栏的运行时状态，缺失时按需补建空栏
   *
   * 栏位与组件句柄引用在同一处增长，因此「第 N 栏 ↔ 第 N 个 ref」一一对应、每栏恰好一个（D-03 / D-05）。
   * @param columnIndex 栏序号（0 基）
   * @returns 该栏的运行时状态
   */
  private columnAt(columnIndex: number): ITablePanelColumn {
    while (this.columns.length <= columnIndex) {
      this.columns.push(this.createColumn());
      this.columnRefs.push(createRef<IEditableContentHandle<ITableDocument> | null>());
    }

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
      baselineText: undefined,
      baselineSchemaText: undefined,
      prefix: '',
      pendingStrip: undefined,
      emptyMode: TableEmptyMode.Buttons,
      directory: '',
      pickerReloadToken: 0,
      pickerError: undefined,
      unsaved: false,
      pendingWrite: false,
      unsavedSchema: false,
      contentVersion: 0,
      draft: null,
      draftDirty: false,
      pendingConflict: undefined,
      stripConfirmed: new Map<string, string>(),
      pendingStripText: '',
      store: new Store<ITablePanelViewState>({
        status: TablePanelStatus.NoTarget,
        content: { data: null, schema: null, schemaMode: false },
        contentVersion: 0,
        schemaMode: false,
      }),
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
   *
   * 视图不再携带行树：行树的唯一来源是该栏组件的草稿。这里只发布「面板下发的文档 + 版本号」，
   * 组件按版本号决定是否重置自己的草稿。
   * @param columnIndex 栏序号（0 基）
   * @param status 新的加载状态
   * @param message 面板级成功提示
   * @param error 面板级错误提示
   */
  private publish(columnIndex: number, status: TablePanelStatus, message?: string, error?: string): void {
    const column = this.columnAt(columnIndex);
    const target = column.target;
    const emptyState =
      target === null
        ? ({
            emptyMode: column.emptyMode,
            pickerDirectory: column.directory,
            pickerReloadToken: column.pickerReloadToken,
            pickerError: column.pickerError,
          } as const)
        : {};

    column.store.setState({
      status,
      content: this.publishedDocument(columnIndex),
      contentVersion: column.contentVersion,
      schemaMode: target !== null && isSchemaPath(target.dataPath),
      title: target === null ? undefined : target.dataPath,
      message,
      error,
      // 「未保存」的展示面与 `TablePanel.isColumnDirty` 是同一件事：面板侧未落盘标记或本栏还有待写
      unsaved: column.unsaved || column.pendingWrite,
      pendingConflict: column.pendingConflict,
      ...emptyState,
    });
  }

  /**
   * 按「当前全部待写路径」刷新每栏的待写布尔并重发视图
   *
   * 订阅回调每次都会把当前全部待写路径送进来（订阅那一刻也会送一次），所以这里不必再查资源层；
   * 该栏数据路径或由它推导出的 schema 路径任一条还在待写，就算该栏「还有待写」。
   * 只改「有没有未保存」这一位，提示位原样带过去：自动保存不该顺手清掉「添加成功」这类文案。
   * @param paths 当前全部待写路径
   */
  private refreshPendingWrites(paths: readonly string[] = []): void {
    const count = this.columns.length;
    const pending = new Set<string>(paths);

    for (let index = 0; index < count; index += 1) {
      const column = this.columns[index];
      const target = column.target;
      const next = target !== null && (pending.has(target.dataPath) || pending.has(deriveSchemaPath(target.dataPath)));

      if (column.pendingWrite === next) continue;

      column.pendingWrite = next;
      this.publish(index, column.store.state.status, column.store.state.message, column.store.state.error);
    }
  }

  /**
   * 发布某栏的「待确认剥离注释」视图状态：不呈现内容，仅置提示位供视图渲染确认弹窗
   * @param columnIndex 栏序号（0 基）
   */
  private publishCommentStrip(columnIndex: number): void {
    const column = this.columnAt(columnIndex);
    const target = column.target;

    column.store.setState({
      status: TablePanelStatus.Loading,
      content: this.publishedDocument(columnIndex),
      contentVersion: column.contentVersion,
      schemaMode: target !== null && isSchemaPath(target.dataPath),
      title: target === null ? undefined : target.dataPath,
      commentStripPending: true,
      unsaved: column.unsaved || column.pendingWrite,
    });
  }

  /**
   * 保留某栏当前状态、仅更新其面板级提示文案（成功 / 提示位，不是错误位）
   * @param columnIndex 栏序号（0 基）
   * @param message 提示文案
   */
  private publishMessage(columnIndex: number, message: string): void {
    const state = this.columnAt(columnIndex).store.state;

    this.publish(columnIndex, state.status, message);
  }

  /**
   * 保留某栏当前状态、仅更新其面板级错误提示
   * @param columnIndex 栏序号（0 基）
   * @param message 错误提示文案
   */
  private publishError(columnIndex: number, message: string): void {
    const state = this.columnAt(columnIndex).store.state;

    this.publish(columnIndex, state.status, undefined, message);
  }

  /**
   * 依据已读取的 schema 与数据重算某栏基线并推进版本号：有字段则就绪，否则落回空态
   *
   * 这是「面板换内容」的五处入口之一：基线替换、草稿作废、版本号自增必须成对发生，
   * 否则换表 / 外部刷新后组件会从上一份草稿重置、或把旧内容写进新文件（D-02 / D-06 / D-17）。
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

    this.resetColumnDraft(columnIndex);
    this.bumpContentVersion(columnIndex);

    if (rows.length > 0) {
      this.publish(columnIndex, TablePanelStatus.Ready, message, error);
      return;
    }

    const hasSchema = isRecord(schema);

    this.publish(columnIndex, hasSchema ? TablePanelStatus.Empty : TablePanelStatus.EmptySchema, message, error);
  }

  /**
   * 依据 schema 文档重算某栏基线并推进版本号：有关键字则就绪，否则落回空态
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

    this.resetColumnDraft(columnIndex);
    this.bumpContentVersion(columnIndex);

    if (rows.length > 0) {
      this.publish(columnIndex, TablePanelStatus.Ready, message, error);
      return;
    }

    this.publish(columnIndex, TablePanelStatus.EmptySchema, message, error);
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
   * 以已解析的主文件值重算某栏视图，并把该栏基线更新为本次载入的原文
   *
   * schema 视图直接落 schema 呈现，数据视图再读 schema 后落数据行树；基线只在这里（载入成功）
   * 与 `TablePanel.saveDocument`（写盘成功）两处更新，是判断「外部内容有没有真的变」的唯一依据。
   * @param columnIndex 栏序号（0 基）
   * @param target 该栏目标
   * @param value 主文件解析出的值
   * @param token 本次刷新的请求序号，用于丢弃在途结果
   * @param text 本次载入的主文件原文
   */
  private async loadPrimary(
    columnIndex: number,
    target: ITablePanelTarget,
    value: unknown,
    token: number,
    text: string | undefined,
  ): Promise<void> {
    const column = this.columnAt(columnIndex);

    if (this.isSchemaView(columnIndex)) {
      column.baselineText = text;
      column.baselineSchemaText = undefined;
      this.applySchemaLoaded(columnIndex, value);
      return;
    }

    const schemaText = await this.readSchemaText(deriveSchemaPath(target.dataPath));

    if (this.requestTokens[columnIndex] !== token) return;

    const schema = schemaText === undefined ? undefined : parseTableText(schemaText).value;

    column.baselineText = text;
    column.baselineSchemaText = schemaText;
    this.applyLoaded(columnIndex, schema, value);
  }

  /**
   * 写回本面板**所有**有未落盘改动的栏
   *
   * 供 `TablePanel.onSwitchOut` 与 `TablePanel.dispose` 复用，落实「切出面板时自动保存已修改的表格」。
   */
  private async saveDirtyColumns(): Promise<void> {
    const count = this.columns.length;

    for (let index = 0; index < count; index += 1) await this.save(index);
  }

  /**
   * 换表 / 关栏前的同步快照 + 异步写回：取数顺序与 `TablePanel.save` 完全一致
   *
   * 快照先于 `TablePanel.setTable` / `TablePanel.closeColumn` 的目标替换 / 清空发生，故换目标 / 关栏
   * 不会丢改动；脏判定用 `TablePanel.isColumnDirty`，草稿在手也算脏。
   * @param columnIndex 栏序号（0 基）
   */
  private async flushColumn(columnIndex: number): Promise<void> {
    const column = this.columnAt(columnIndex);

    if (column.target === null) return;
    if (!this.isColumnDirty(columnIndex)) return;

    await this.saveDocument(columnIndex, this.currentDocument(columnIndex));
  }

  /**
   * 把某栏的数据写入指定目标的资源（目标由调用方同步快照传入，避免写盘途中换表串到新文件）
   * @param target 该栏写盘时快照下的目标
   * @param data 变更后的完整数据
   * @param prefix 该栏写盘时快照下的系统前缀原文
   */
  private async writeData(target: ITablePanelTarget, data: unknown, prefix: string): Promise<void> {
    const resource = await this.context.requestResource(target.dataPath);

    if (resource === null) return;

    await resource.write(serializeTableText(data, prefix));
  }

  /**
   * 写入某栏数据并把失败隔离成该栏面板级错误提示，成功时返回 true
   * @param columnIndex 栏序号（0 基）
   * @param target 该栏写盘时快照下的目标
   * @param data 变更后的完整数据
   * @param prefix 该栏写盘时快照下的系统前缀原文
   * @returns 写入成功时为 true
   */
  private async persist(
    columnIndex: number,
    target: ITablePanelTarget,
    data: unknown,
    prefix: string,
  ): Promise<boolean> {
    try {
      await this.writeData(target, data, prefix);
      return true;
    } catch {
      this.publishError(columnIndex, '写入失败，请重试。');
      return false;
    }
  }

  /**
   * 把某栏变更后的 schema 写入指定目标的 schema 资源，并把失败隔离成该栏面板级错误提示
   * @param columnIndex 栏序号（0 基）
   * @param target 该栏写盘时快照下的目标
   * @param schema 变更后的 schema 内容
   * @param prefix 该栏写盘时快照下的系统前缀原文
   * @returns 写入成功时为 true
   */
  private async persistSchema(
    columnIndex: number,
    target: ITablePanelTarget,
    schema: unknown,
    prefix: string,
  ): Promise<boolean> {
    const resource = await this.context.requestResource(deriveSchemaPath(target.dataPath));

    if (resource === null) return true;

    try {
      if (isRecord(schema)) await resource.write(serializeTableText(schema, prefix));

      return true;
    } catch {
      this.publishError(columnIndex, '写入失败，请重试。');
      return false;
    }
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
    // 草稿在手时以草稿为撤销基底：本地编辑只推进草稿，面板基线可能落后一帧（§R2）
    const base = column.draft === null ? column.data : column.draft.data;

    if (type === TableUndoType.Change) {
      return setByFieldPath(base, payload.path, isUndo ? payload.previousValue : payload.nextValue);
    }

    if (type === TableUndoType.Add) {
      if (isUndo) return deleteByFieldPath(base, payload.path);

      return payload.anchor === undefined
        ? setByFieldPath(base, payload.path, payload.nextValue)
        : insertAfterFieldPath(base, payload.path, payload.anchor, payload.nextValue);
    }

    if (type === TableUndoType.Delete) {
      return isUndo ? setByFieldPath(base, payload.path, payload.previousValue) : deleteByFieldPath(base, payload.path);
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

    column.unsaved = true;

    const schema = isUndo ? context.data.previousSchema : context.data.nextSchema;

    if (schema !== undefined && !this.isSchemaView(columnIndex)) {
      if (isRecord(schema)) column.schema = schema;

      column.unsavedSchema = true;
    }

    this.applyData(columnIndex, next);
    // 撤销 / 重做也是一次内容变更：把刚算出的新内容写进缓冲，别让更早那一份快照留在缓冲里等着落盘。
    // 这里必须传面板自己算出的文档：那一刻挂载中的组件还持着撤销前的草稿并自称脏，
    // 走 `TablePanel.currentDocument` 会把撤销掉的内容又写回去。
    void this.saveDocument(
      columnIndex,
      { data: column.data, schema: column.schema, schemaMode: this.isSchemaView(columnIndex) },
      true,
    );
  }

  /**
   * 处理某一栏的一次外部变化：读原文、比对基线，再按「忽略 / 自动刷新 / 冲突」分流
   *
   * 读原文走既有的两步资源读取（先拿句柄、再取内容）；读取失败与非法内容都降级为提示并保留内存内容。
   * 与基线相同即自写回声 / 空变化，什么都不做；基线不同且本栏不脏时替换内容并递增版本号。
   * @param columnIndex 栏序号（0 基）
   * @param path 变化路径（数据文件或该栏推导出的 schema 文件）
   * @param kind 变化种类
   */
  private async handleResourceChange(columnIndex: number, path: string, kind: EditorFileChangeKind): Promise<void> {
    const column = this.columnAt(columnIndex);
    const target = column.target;

    if (target === null) return;

    if (kind === EditorFileChangeKind.Delete) {
      this.publishMessage(columnIndex, '外部文件已被删除，已保留你的改动。');
      return;
    }

    let text: string | undefined;

    try {
      text = await this.readText(path);
    } catch {
      text = undefined;
    }

    if (text === undefined) {
      this.publishMessage(columnIndex, '读取外部改动失败，已保留你的改动。');
      return;
    }

    const mirroredSchema = !isSchemaPath(target.dataPath) && path === deriveSchemaPath(target.dataPath);

    if ((mirroredSchema ? column.baselineSchemaText : column.baselineText) === text) return;

    const parsed = parseTableText(text);

    if (parsed.status !== TableTextParseStatus.Conforming) {
      this.publishMessage(columnIndex, '外部改动包含注释或格式非法，已保留你的改动。');
      return;
    }

    if (this.isColumnDirty(columnIndex)) {
      this.recordPendingConflict(columnIndex, path, text);
      return;
    }

    if (mirroredSchema) {
      column.baselineSchemaText = text;
      this.applyLoaded(columnIndex, parsed.value, column.data);
      return;
    }

    if (this.isSchemaView(columnIndex)) {
      column.baselineText = text;
      this.applySchemaLoaded(columnIndex, parsed.value);
      return;
    }

    column.prefix = parsed.prefix;
    column.baselineText = text;
    this.applyLoaded(columnIndex, column.schema, parsed.value);
  }

  /**
   * 记录「有可编辑字段正在输入」，并把待决冲突推迟到停手之后再弹
   *
   * 只做两件事：置标志；由真变假的那一刻调一次 `TablePanel.showNextConflict`（这是「停手就弹」的唯一出口）。
   * 标志本来就是目标值时直接返回，不重复触发。
   * @param editing 是否还有可编辑字段处于「已聚焦未失焦 / 未确认提交」的状态
   */
  private setFieldEditing(editing: boolean): void {
    if (this.fieldEditing === editing) return;

    this.fieldEditing = editing;

    if (!editing) this.showNextConflict();
  }

  /**
   * 记录某栏的待决冲突并在面板根发布它；同栏同路径同原文只入队一次（D-17 / D-37）
   *
   * 有可编辑字段正在输入时**只记进栏状态、不写弹窗 store**：用户正在打字，弹窗抢焦点会打断输入；
   * 一停手（失焦或一次确认提交）就由 `TablePanel.setFieldEditing` 弹出来。
   * @param columnIndex 栏序号（0 基）
   * @param path 变化路径
   * @param text 读到的外部原文
   */
  private recordPendingConflict(columnIndex: number, path: string, text: string): void {
    const column = this.columnAt(columnIndex);
    const current = column.pendingConflict;

    if (current !== undefined && current.path === path && current.text === text) return;

    column.pendingConflict = { path, text };
    this.publish(columnIndex, column.store.state.status);

    if (this.visibleConflictColumn === columnIndex) {
      this.conflictStore.setState(column.pendingConflict);
      return;
    }

    if (this.fieldEditing) return;

    this.showNextConflict();
  }

  /**
   * 在一处发布最靠前的待决冲突；已有可见冲突时不抢占，保证同一变化只弹一次
   */
  private showNextConflict(): void {
    if (this.visibleConflictColumn !== undefined) return;

    const count = this.columns.length;

    for (let index = 0; index < count; index += 1) {
      const conflict = this.columns[index].pendingConflict;

      if (conflict === undefined) continue;

      this.visibleConflictColumn = index;
      this.conflictStore.setState(conflict);
      return;
    }
  }

  /**
   * 冲突弹窗选「保存外部修改」：丢弃本栏待写（同时失效该路径内容缓存），再按外部原文重新载入
   *
   * 丢弃必须发生在换内容之前：待写条目留着的话，5 秒后会把被丢弃的那一份写回磁盘，等于用编辑器里
   * 旧内容覆盖用户刚接受的外部内容。换内容只用收到变化时记下的原文快照，**不**重新读磁盘——磁盘可能
   * 已被在途写盘覆盖，只有快照能保证「面板显示的就是外部那一份」（D-08 / D-16 / T-04.3-11）。
   */
  private async discardExternalConflict(): Promise<void> {
    const columnIndex = this.visibleConflictColumn;

    if (columnIndex === undefined) return;

    const column = this.columnAt(columnIndex);
    const conflict = column.pendingConflict;

    this.visibleConflictColumn = undefined;
    column.pendingConflict = undefined;
    this.conflictStore.setState(undefined);

    if (conflict === undefined) {
      this.showNextConflict();
      return;
    }

    const target = column.target;
    const parsed = parseTableText(conflict.text);

    if (target === null || parsed.status !== TableTextParseStatus.Conforming) {
      this.publishMessage(columnIndex, '读取外部改动失败，已保留你的改动。');
      this.showNextConflict();
      return;
    }

    await this.context.discardPendingResource(conflict.path);

    const mirroredSchema = !isSchemaPath(target.dataPath) && conflict.path === deriveSchemaPath(target.dataPath);

    column.unsaved = false;
    column.unsavedSchema = false;

    if (mirroredSchema) {
      column.baselineSchemaText = conflict.text;
      this.applyLoaded(columnIndex, parsed.value, column.data);
    } else if (this.isSchemaView(columnIndex)) {
      column.baselineText = conflict.text;
      this.applySchemaLoaded(columnIndex, parsed.value);
    } else {
      column.prefix = parsed.prefix;
      column.baselineText = conflict.text;
      this.applyLoaded(columnIndex, column.schema, parsed.value);
    }

    this.showNextConflict();
  }

  /**
   * 冲突弹窗选「保存编辑器的」：立刻用编辑器里的内容覆盖磁盘上的外部修改，点下去就生效
   *
   * 四步顺序不能变：① 先把该栏显式放回「未落盘」（`TablePanel.saveDocument` 在数据与 schema 都没标记时
   * 提前返回，不先放回就是空转）；② 走同一条链把内容排进缓冲（`quiet` 必须显式传真，这不是用户点保存，
   * 不能刷「已保存」）；③ 立刻把该路径待写写盘，缓冲条目与「外部已改」标记随之消失、右上角提示随之更新；
   * ④ 清冲突与弹窗、重发视图、处理下一条。
   *
   * 两个失败分支都确定性结算、绝不抛给点击处理器（点击路径是 `(): void` 箭头）：待写保留、条目与
   * 「外部已改」标记不清、弹窗不关、未保存标记仍在，只有既有的错误提示与日志（O2 / D-07）。
   */
  private async keepExternalConflict(): Promise<void> {
    const columnIndex = this.visibleConflictColumn;

    if (columnIndex === undefined) return;

    const column = this.columnAt(columnIndex);
    const conflict = column.pendingConflict;
    const target = column.target;

    if (conflict === undefined || target === null) {
      this.visibleConflictColumn = undefined;
      column.pendingConflict = undefined;
      this.conflictStore.setState(undefined);
      this.showNextConflict();
      return;
    }

    const mirroredSchema = !isSchemaPath(target.dataPath) && conflict.path === deriveSchemaPath(target.dataPath);

    if (mirroredSchema) column.unsavedSchema = true;
    else column.unsaved = true;

    const status = await this.saveColumn(columnIndex, true);

    // 排进缓冲就失败了：错误已由 `TablePanel.persist` 发布过，这里直接停手，弹窗留给用户再点一次
    if (status === ContentSaveStatus.Failed) return;

    try {
      await this.context.flushResource(conflict.path);
    } catch {
      // 缓冲按 Plan 04 保留条目并已记 `resource.flushFailed`；这里复用既有文案提示一次，不新增失败界面
      this.publishError(columnIndex, '写入失败，请重试。');
      return;
    }

    this.visibleConflictColumn = undefined;
    column.pendingConflict = undefined;
    this.conflictStore.setState(undefined);
    this.publish(columnIndex, column.store.state.status);
    this.showNextConflict();
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
      this.publish(columnIndex, TablePanelStatus.NoTarget);
      return;
    }

    // 该栏有未落盘改动时不重读覆盖内存，保住手动保存下的内存改动（T-02.1-20-01）
    if (column.unsaved || column.unsavedSchema || column.draftDirty) return;

    const current = column.store.state;
    const hasContent = current.status === TablePanelStatus.Ready;
    const token = this.nextToken(columnIndex);

    if (!hasContent) this.publish(columnIndex, TablePanelStatus.Loading);

    // 资源读取失败是行为关键路径：落回固定错误态而非抛穿，面板保持打开（D-29）
    try {
      const primaryText = await this.readText(target.dataPath);

      if (this.requestTokens[columnIndex] !== token) return;

      if (primaryText === undefined) {
        column.prefix = '';
        await this.loadPrimary(columnIndex, target, undefined, token, undefined);
        return;
      }

      const parsed = parseTableText(primaryText);

      if (parsed.status === TableTextParseStatus.NeedsCommentStrip) {
        const remembered = column.stripConfirmed.get(target.dataPath);

        if (remembered === primaryText) {
          column.prefix = '';
          await this.loadPrimary(columnIndex, target, parsed.value, token, primaryText);
          return;
        }

        column.prefix = '';
        column.pendingStrip = parsed.value;
        column.pendingStripText = primaryText;
        this.publishCommentStrip(columnIndex);
        return;
      }

      if (parsed.status === TableTextParseStatus.Invalid) {
        this.publish(columnIndex, TablePanelStatus.Error);
        return;
      }

      column.prefix = parsed.prefix;
      await this.loadPrimary(columnIndex, target, parsed.value, token, primaryText);
    } catch {
      if (this.requestTokens[columnIndex] !== token) return;

      this.publish(columnIndex, TablePanelStatus.Error);
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
