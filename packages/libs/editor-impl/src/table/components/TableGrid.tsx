import { Button, Spin } from 'antd';
import { createElement, ReactElement, useState } from 'react';
import { ITableRowNode, TableEditMode } from '../types';
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

export interface ITableGridProps {
  /** 当前数据加载状态 */
  readonly status: TablePanelStatus;
  /** 要渲染的行树 */
  readonly rows: readonly ITableRowNode[];
  /** 当前编辑模式，缺省为「编辑」 */
  readonly mode?: TableEditMode;
  /** 错误态下「重试」控件的回调 */
  readonly onRetry?: () => void;
  /** 一次字段提交的回调；tracer 阶段只读，不会触发 */
  readonly onChange?: TableGridChangeHandler;
}

interface ITableGridRowProps {
  /** 要渲染的行节点 */
  readonly row: ITableRowNode;
}

/**
 * 把值格式化为单元格文本：字符串原样显示，其余用 JSON 文本表示
 * @param value 字段值
 * @returns 单元格文本
 */
function formatCellValue(value: unknown): string {
  if (value === undefined) return '';
  if (typeof value === 'string') return value;
  return JSON.stringify(value);
}

/**
 * 取字段路径的短名（最后一个点号之后的部分）
 * @param key 字段路径
 * @returns 短字段名
 */
function shortFieldName(key: string): string {
  const index = key.lastIndexOf('.');
  return index === -1 ? key : key.slice(index + 1);
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
 * 渲染一行叶子字段：字段名、描述与只读值
 * @param props 行 props
 * @returns 叶子行元素
 */
function TableGridLeafRow(props: ITableGridRowProps): ReactElement {
  const row = props.row;

  return createElement(
    'div',
    { className: 'etable-row', 'data-test-id': `table-row-${row.key}` },
    createElement('div', { className: 'etable-cell etable-cell-name', title: row.key }, shortFieldName(row.key)),
    createElement(
      'div',
      { className: 'etable-cell etable-cell-comment', title: row.description ?? '' },
      row.description ?? '',
    ),
    createElement(
      'div',
      { className: 'etable-cell etable-cell-value', 'data-test-id': `table-value-${row.key}` },
      formatCellValue(row.value),
    ),
    createElement('div', { className: 'etable-cell etable-cell-action' }),
  );
}

/**
 * 渲染一行可折叠分组：折叠开关切换其子行是否进入 DOM
 * @param props 行 props
 * @returns 分组行元素
 */
function TableGridGroupRow(props: ITableGridRowProps): ReactElement {
  const row = props.row;
  const expandedState = useState(true);
  const expanded = expandedState[0];
  const setExpanded = expandedState[1];
  const children = row.children ?? [];
  const toggleLabel = expanded ? '折叠' : '展开';

  return createElement(
    'div',
    { className: 'etable-group' },
    createElement(
      'div',
      { className: 'etable-row etable-row-group', 'data-test-id': `table-row-${row.key}` },
      createElement('div', { className: 'etable-cell etable-cell-name' }, '----'),
      createElement('div', { className: 'etable-cell etable-cell-comment' }, '----'),
      createElement('div', { className: 'etable-cell etable-cell-value' }, `['${row.key}']`),
      createElement(
        'div',
        { className: 'etable-cell etable-cell-action' },
        createElement(
          Button,
          { size: 'small', type: 'text', autoInsertSpace: false, onClick: (): void => setExpanded(!expanded) },
          toggleLabel,
        ),
      ),
    ),
    expanded ? createElement('div', { className: 'etable-group-children' }, children.map(renderRow)) : null,
  );
}

/**
 * 按节点形态把一行分派给分组行或叶子行
 * @param row 行节点
 * @returns 行元素
 */
function renderRow(row: ITableRowNode): ReactElement {
  return row.children === undefined
    ? createElement(TableGridLeafRow, { key: row.key, row })
    : createElement(TableGridGroupRow, { key: row.key, row });
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
 * 表格组件：完全由 props 驱动的四栏只读网格（分组行可折叠）
 * @param props 表格 props
 * @returns 表格元素
 */
export function TableGrid(props: ITableGridProps): ReactElement {
  if (props.status !== TablePanelStatus.Ready) {
    return createElement('div', { className: 'etable', 'data-test-id': 'data-table' }, renderState(props));
  }

  return createElement(
    'div',
    { className: 'etable', 'data-test-id': 'data-table' },
    renderHeader(),
    createElement('div', { className: 'etable-body', 'data-test-id': 'data-table-grid' }, props.rows.map(renderRow)),
  );
}
