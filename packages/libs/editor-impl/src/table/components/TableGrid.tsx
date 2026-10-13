import { Button, InputNumber, Spin } from 'antd';
import { createElement, ReactElement, useState } from 'react';
import { ICodeEditorOpener, ITablePanelOpener, useTableCapabilities } from '../../react';
import { ITableRowNode, TableEditMode } from '../types';
import { getShortField, parseFieldPath } from '../model/fieldPath';
import { buildSchemaPresentation } from '../model/schemaPresentation';
import { GapRow } from './GapRow';
import { SchemaBanner } from './SchemaBanner';
import { TableRow } from './TableRow';
import { TableToolbar } from './TableToolbar';
import '../table.css';

export const enum TablePanelStatus {
  /** 尚未设置目标表 */
  NoTarget,
  /** 正在请求数据与 schema 资源 */
  Loading,
  /** 目标表自身即 schema，且尚未定义任何字段 */
  EmptySchema,
  /** 数据中没有可显示的字段 */
  Empty,
  /** 资源请求失败 */
  Error,
  /** 已取得行树，正常渲染 */
  Ready,
}

/** 一次字段提交的处理函数 */
export type TableGridChangeHandler = (key: string, value: unknown) => void;

/** 一次「新增子项」请求的处理函数 */
export type TableGridAddHandler = (parentPath: string, name: string) => void;

/** 一次「删除子项」请求的处理函数 */
export type TableGridDeleteHandler = (key: string) => void;

/** 一次「打开外部编辑器」请求的处理函数 */
export type TableGridOpenHandler = (key: string) => void;

/** 一次「编辑 Schema」请求的处理函数，携带表格面板打开器 */
export type TableGridOpenSchemaHandler = (opener: ITablePanelOpener) => void;

/** 一次「在代码编辑器中打开」请求的处理函数，携带代码编辑器打开器 */
export type TableGridOpenCodeHandler = (opener: ICodeEditorOpener) => void;

export interface ITableGridProps {
  /** 当前数据加载状态 */
  readonly status: TablePanelStatus;
  /** 要渲染的行树 */
  readonly rows: readonly ITableRowNode[];
  /** 错误态下「重试」控件的回调 */
  readonly onRetry?: () => void;
  /** 一次字段提交的回调 */
  readonly onChange?: TableGridChangeHandler;
  /** 一次新增子项的回调 */
  readonly onAdd?: TableGridAddHandler;
  /** 一次删除子项的回调 */
  readonly onDelete?: TableGridDeleteHandler;
  /** 一次打开外部编辑器的回调 */
  readonly onOpenExternalEditor?: TableGridOpenHandler;
  /** 面板级成功提示，缺省时不显示 */
  readonly message?: string;
  /** 面板级错误提示，缺省时不显示 */
  readonly error?: string;
  /** 当前目标是否为 schema（启用 schema 专用呈现模式与提示条） */
  readonly schemaMode?: boolean;
  /** 可选的面板标题（资源名等） */
  readonly title?: string;
  /** 「编辑 Schema」回调，由能力接缝的表格面板打开器驱动 */
  readonly onOpenSchema?: TableGridOpenSchemaHandler;
  /** 「在代码编辑器中打开」回调，由能力接缝的代码编辑器打开器驱动 */
  readonly onOpenInCodeEditor?: TableGridOpenCodeHandler;
}

interface IRowRenderContext {
  /** 当前编辑模式 */
  readonly mode: TableEditMode;
  /** 是否处于 schema 专用呈现模式 */
  readonly schemaMode: boolean;
  /** 字段提交回调 */
  readonly onChange: TableGridChangeHandler | undefined;
  /** 新增子项回调 */
  readonly onAdd: TableGridAddHandler | undefined;
  /** 删除子项回调 */
  readonly onDelete: TableGridDeleteHandler | undefined;
  /** 打开外部编辑器回调 */
  readonly onOpenExternalEditor: TableGridOpenHandler | undefined;
}

/**
 * 渲染四栏列头
 * @returns 列头元素
 */
function renderHeader(): ReactElement {
  return createElement(
    'div',
    { className: 'etable-header' },
    createElement('div', { className: 'etable-cell etable-cell-name' }, '条目'),
    createElement('div', { className: 'etable-cell etable-cell-comment' }, '注释'),
    createElement('div', { className: 'etable-cell etable-cell-value' }, '值'),
    createElement('div', { className: 'etable-cell etable-cell-action' }, '操作'),
  );
}

/**
 * 渲染面板级提示：错误优先于成功提示
 * @param props 表格 props
 * @returns 提示元素；两种提示都缺省时返回 null
 */
function renderNotice(props: ITableGridProps): ReactElement | null {
  if (props.error !== undefined) {
    return createElement(
      'div',
      { className: 'etable-notice etable-notice-error', 'data-test-id': 'table-notice' },
      props.error,
    );
  }

  if (props.message !== undefined) {
    return createElement('div', { className: 'etable-notice', 'data-test-id': 'table-notice' }, props.message);
  }

  return null;
}

/**
 * 渲染加载 / 空 / 错误 / 未设目标等固定状态视图
 * @param props 表格 props
 * @returns 状态元素；状态为就绪时返回 null
 */
function renderState(props: ITableGridProps): ReactElement | null {
  if (props.status === TablePanelStatus.Loading) {
    return createElement(
      'div',
      { className: 'etable-state' },
      createElement('div', { className: 'etable-state-spinner' }, createElement(Spin, { size: 'small' })),
      createElement('div', { className: 'etable-state-body' }, '正在加载表格…'),
    );
  }

  if (props.status === TablePanelStatus.NoTarget) {
    return createElement(
      'div',
      { className: 'etable-state' },
      createElement('div', { className: 'etable-state-heading' }, '尚未设置目标表'),
      createElement('div', { className: 'etable-state-body' }, '请先为该表格面板指定要编辑的表格。'),
    );
  }

  if (props.status === TablePanelStatus.Empty || props.status === TablePanelStatus.EmptySchema) {
    const body =
      props.status === TablePanelStatus.EmptySchema ? '尚未定义任何字段。' : '该表格当前没有可显示的字段，或内容为空。';

    return createElement(
      'div',
      { className: 'etable-state' },
      createElement('div', { className: 'etable-state-heading' }, '暂无表格数据'),
      createElement('div', { className: 'etable-state-body' }, body),
    );
  }

  if (props.status === TablePanelStatus.Error) {
    return createElement(
      'div',
      { className: 'etable-state' },
      createElement('div', { className: 'etable-state-heading' }, '表格加载失败'),
      createElement('div', { className: 'etable-state-body' }, '请检查该表格资源是否存在，或稍后重试。'),
      createElement(
        'div',
        { className: 'etable-state-action' },
        createElement(Button, { size: 'small', autoInsertSpace: false, onClick: props.onRetry }, '重试'),
      ),
    );
  }

  return null;
}

/**
 * 把单个行节点渲染为 React 元素：叶子行走 TableRow，分组行走可折叠的 GapRow
 * @param row 行节点
 * @param context 行渲染上下文（模式与回调）
 * @returns 行元素
 */
function renderRowNode(row: ITableRowNode, context: IRowRenderContext): ReactElement {
  if (row.children === undefined) {
    return createElement(TableRow, {
      key: row.key,
      row,
      mode: context.mode,
      onChange: context.onChange,
      onAdd: context.onAdd,
      onDelete: context.onDelete,
      onOpenExternalEditor: context.onOpenExternalEditor,
    });
  }

  return createElement(GapRow, { key: row.key, row, children: renderRows(row.children, context) });
}

/**
 * 渲染一行成对关键字：左右两个小数字输入，标签合并显示
 * @param left 左侧关键字行
 * @param right 右侧关键字行
 * @param label 左侧关键字名，作为行标识
 * @param context 行渲染上下文
 * @returns 成对行元素
 */
function renderPairedRow(
  left: ITableRowNode,
  right: ITableRowNode,
  label: string,
  context: IRowRenderContext,
): ReactElement {
  const disabled = context.mode === TableEditMode.Delete;
  const leftValue = typeof left.value === 'number' ? left.value : undefined;
  const rightValue = typeof right.value === 'number' ? right.value : undefined;
  const dataAttr = parseFieldPath(left.key).join('-');

  return createElement(
    'div',
    { key: label, className: 'etable-row etable-row-pair', 'data-test-id': `schema-pair-${label}` },
    createElement('div', { className: 'etable-cell etable-cell-name' }, `${label} / ${getShortField(right.key)}`),
    createElement('div', { className: 'etable-cell etable-cell-comment' }),
    createElement(
      'div',
      { className: 'etable-cell etable-cell-value etable-pair-value', 'data-test-id': `table-input-${dataAttr}` },
      createElement(InputNumber, {
        size: 'small',
        value: leftValue,
        disabled,
        onChange: (value): void => context.onChange?.(left.key, value),
      }),
      createElement(InputNumber, {
        size: 'small',
        value: rightValue,
        disabled,
        onChange: (value): void => context.onChange?.(right.key, value),
      }),
    ),
    createElement('div', { className: 'etable-cell etable-cell-action' }),
  );
}

/**
 * 按 schema 专用呈现规则渲染一组同层关键字行：成对关键字合成一行，其余各占一行
 * @param rows 同层关键字行
 * @param context 行渲染上下文
 * @returns 行元素列表
 */
function renderSchemaRows(rows: readonly ITableRowNode[], context: IRowRenderContext): ReactElement[] {
  const rules = buildSchemaPresentation(rows);
  const byKeyword = new Map(rows.map((row) => [getShortField(row.key), row]));
  const elements: ReactElement[] = [];

  for (const rule of rules) {
    if (rule.pair !== undefined) {
      const left = byKeyword.get(rule.pair.keywords[0]);
      const right = byKeyword.get(rule.pair.keywords[1]);

      if (left !== undefined && right !== undefined) {
        elements.push(renderPairedRow(left, right, rule.keyword, context));
        continue;
      }
    }

    const row = byKeyword.get(rule.keyword);

    if (row !== undefined) elements.push(renderRowNode(row, context));
  }

  return elements;
}

/**
 * 按节点形态把一组行渲染为 React 元素：schema 模式走成对合行布局，常规模式逐行渲染
 * @param rows 行节点列表
 * @param context 行渲染上下文（模式与回调）
 * @returns 行元素列表
 */
function renderRows(rows: readonly ITableRowNode[], context: IRowRenderContext): ReactElement[] {
  if (context.schemaMode) return renderSchemaRows(rows, context);

  return rows.map((row) => renderRowNode(row, context));
}

/**
 * 表格组件：props 驱动的四栏网格，工具栏切换编辑模式与打开动作，值单元格可编辑，分组行可折叠
 * @param props 表格 props
 * @returns 表格元素
 */
export function TableGrid(props: ITableGridProps): ReactElement {
  const modeState = useState<TableEditMode>(TableEditMode.Change);
  const mode = modeState[0];
  const setMode = modeState[1];
  const capabilities = useTableCapabilities();
  const schemaMode = props.schemaMode ?? false;
  const loading = props.status === TablePanelStatus.Loading;
  const failed = props.status === TablePanelStatus.Error;
  const context: IRowRenderContext = {
    mode,
    schemaMode,
    onChange: props.onChange,
    onAdd: props.onAdd,
    onDelete: props.onDelete,
    onOpenExternalEditor: props.onOpenExternalEditor,
  };
  const toolbar = createElement(TableToolbar, {
    mode,
    onModeChange: setMode,
    title: props.title,
    showSchemaButton: !schemaMode && !failed,
    schemaButtonEnabled: capabilities.tablePanel !== undefined && !loading,
    onOpenSchema: (): void => {
      const opener = capabilities.tablePanel;

      if (opener !== undefined) props.onOpenSchema?.(opener);
    },
    codeButtonEnabled: capabilities.codeEditor !== undefined,
    onOpenInCodeEditor: (): void => {
      const opener = capabilities.codeEditor;

      if (opener !== undefined) props.onOpenInCodeEditor?.(opener);
    },
  });
  const banner = schemaMode ? createElement(SchemaBanner, {}) : null;
  const notice = renderNotice(props);

  if (props.status !== TablePanelStatus.Ready) {
    return createElement(
      'div',
      { className: 'etable', 'data-test-id': 'data-table' },
      toolbar,
      banner,
      notice,
      renderState(props),
    );
  }

  return createElement(
    'div',
    { className: 'etable', 'data-test-id': 'data-table' },
    toolbar,
    banner,
    notice,
    renderHeader(),
    createElement(
      'div',
      { className: 'etable-body', 'data-test-id': 'data-table-grid' },
      renderRows(props.rows, context),
    ),
  );
}
