import { Button, Spin } from 'antd';
import { createElement, ReactElement } from 'react';
import { ITableRowNode, TableEditMode } from '../types';
import { GapRow } from './GapRow';
import { TableRow } from './TableRow';
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

export interface ITableGridProps {
  /** 当前数据加载状态 */
  readonly status: TablePanelStatus;
  /** 要渲染的行树 */
  readonly rows: readonly ITableRowNode[];
  /** 当前编辑模式，缺省为「编辑」 */
  readonly mode?: TableEditMode;
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
}

interface IRowRenderContext {
  /** 当前编辑模式 */
  readonly mode: TableEditMode;
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
 * 按节点形态把一组行渲染为 React 元素：叶子行走 TableRow，分组行走可折叠的 GapRow
 * @param rows 行节点列表
 * @param context 行渲染上下文（模式与回调）
 * @returns 行元素列表
 */
function renderRows(rows: readonly ITableRowNode[], context: IRowRenderContext): ReactElement[] {
  return rows.map((row) => {
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
  });
}

/**
 * 表格组件：props 驱动的四栏网格，值单元格可编辑，分组行可折叠
 * @param props 表格 props
 * @returns 表格元素
 */
export function TableGrid(props: ITableGridProps): ReactElement {
  const mode = props.mode ?? TableEditMode.Change;
  const context: IRowRenderContext = {
    mode,
    onChange: props.onChange,
    onAdd: props.onAdd,
    onDelete: props.onDelete,
    onOpenExternalEditor: props.onOpenExternalEditor,
  };

  if (props.status !== TablePanelStatus.Ready) {
    return createElement('div', { className: 'etable', 'data-test-id': 'data-table' }, renderState(props));
  }

  return createElement(
    'div',
    { className: 'etable', 'data-test-id': 'data-table' },
    renderHeader(),
    createElement('div', { className: 'etable-body', 'data-test-id': 'data-table-grid' }, renderRows(props.rows, context)),
  );
}
