import { EditorEntryKind, IFileEntry } from '@motajs/editor-core';
import { Button } from 'antd';
import { createElement, ReactElement } from 'react';
import { ITablePreset } from '../../react';
import { isTableDataPath } from '../resourceType';
import '../table.css';

// 可复用的表格浏览器契约：可选预设表 + 项目目录树。
// 「打开表格」（注入预设）与「删除表格」（不注入预设）共用同一组 props，唯一差异是 presets 是否传入。

export interface ITablePickerProps {
  /** 预设表清单；缺省或无项时不渲染预设区，这是打开态与删除态的唯一差异 */
  readonly presets?: readonly ITablePreset[];
  /** 当前目录路径；根目录为空串 */
  readonly directory: string;
  /** 该目录的直接子条目 */
  readonly entries: readonly IFileEntry[];
  /** 目录读取失败时的提示文案；缺省时不显示 */
  readonly error?: string;
  /** 为真时每个数据文件行渲染删除入口；删除态用 */
  readonly deletable?: boolean;
  /** 进入某目录 */
  onNavigate(path: string): void;
  /** 打开某数据表；打开态的数据文件行点击，删除态传空操作满足此必填契约 */
  onSelect(dataPath: string): void;
  /** 请求删除某数据表；删除态用，缺省时数据文件行不渲染删除入口 */
  onRequestDelete?(dataPath: string): void;
}

/**
 * 取路径的父目录路径，根目录下返回空串
 * @param path 完整路径
 * @returns 父目录路径
 */
function parentDirectory(path: string): string {
  const index = path.lastIndexOf('/');

  return index === -1 ? '' : path.slice(0, index);
}

/**
 * 渲染预设表区：每项一个按钮，点击回调其数据路径
 * @param presets 预设表清单（调用方保证非空）
 * @param onSelect 选中某数据表的回调
 * @returns 预设区元素
 */
function renderPresets(presets: readonly ITablePreset[], onSelect: (dataPath: string) => void): ReactElement {
  const items = presets.map((preset) =>
    createElement(
      Button,
      {
        key: preset.path,
        type: 'text',
        size: 'small',
        autoInsertSpace: false,
        className: 'etable-list-preset',
        'data-test-id': `table-list-preset-${preset.name}`,
        onClick: (): void => onSelect(preset.path),
      },
      preset.name,
    ),
  );

  return createElement(
    'div',
    { className: 'etable-list-presets' },
    createElement('div', { className: 'etable-list-heading' }, '预设表'),
    items,
  );
}

/**
 * 渲染一个目录行：点击进入该目录
 * @param label 显示文案
 * @param path 目录路径
 * @param testId 该行的 data-test-id
 * @param onNavigate 进入目录的回调
 * @returns 目录行元素
 */
function renderDirectoryRow(
  label: string,
  path: string,
  testId: string,
  onNavigate: (path: string) => void,
): ReactElement {
  return createElement(
    'button',
    {
      key: `dir:${testId}`,
      type: 'button',
      className: 'etable-list-entry etable-list-directory',
      'data-test-id': testId,
      onClick: (): void => onNavigate(path),
    },
    label,
  );
}

/**
 * 渲染一个数据文件行：主按钮打开该表，可删除时另一侧提供删除入口
 * @param entry 可作为表格打开的数据文件条目
 * @param deletable 是否为真时渲染删除入口；删除态用
 * @param onSelect 打开某数据表的回调
 * @param onRequestDelete 请求删除某数据表的回调；缺省时即使 deletable 为真也不渲染删除入口
 * @returns 数据文件行元素
 */
function renderFileRow(
  entry: IFileEntry,
  deletable: boolean | undefined,
  onSelect: (dataPath: string) => void,
  onRequestDelete: ((dataPath: string) => void) | undefined,
): ReactElement {
  let deleteButton: ReactElement | null = null;

  if (deletable && onRequestDelete !== undefined) {
    const requestDelete = onRequestDelete;

    deleteButton = createElement(
      'button',
      {
        type: 'button',
        className: 'etable-list-delete',
        'data-test-id': `table-list-delete-${entry.path}`,
        onClick: (): void => requestDelete(entry.path),
      },
      '删除',
    );
  }

  return createElement(
    'div',
    { key: `file:${entry.path}`, className: 'etable-list-row' },
    createElement(
      'button',
      {
        type: 'button',
        className: 'etable-list-entry etable-list-file',
        'data-test-id': `table-list-entry-${entry.path}`,
        onClick: (): void => onSelect(entry.path),
      },
      entry.name,
    ),
    deleteButton,
  );
}

/**
 * 可复用的表格浏览器组件：可选预设表 + 项目目录树
 *
 * 无自身状态，纯粹由 props 驱动；不直接读写文件、不引入面板或引擎代码。
 * @param props 组件 props
 * @returns 表格浏览器元素
 */
export function TablePicker(props: ITablePickerProps): ReactElement {
  const rows: ReactElement[] = [];

  if (props.directory !== '') {
    rows.push(renderDirectoryRow('..', parentDirectory(props.directory), 'table-list-up', props.onNavigate));
  }

  for (const entry of props.entries) {
    if (entry.kind === EditorEntryKind.Directory) {
      rows.push(renderDirectoryRow(entry.name, entry.path, `table-list-entry-${entry.path}`, props.onNavigate));
      continue;
    }

    if (isTableDataPath(entry.path)) {
      rows.push(renderFileRow(entry, props.deletable, props.onSelect, props.onRequestDelete));
    }
  }

  const presets = props.presets;
  const presetArea = presets === undefined || presets.length === 0 ? null : renderPresets(presets, props.onSelect);
  const body =
    rows.length === 0
      ? createElement('div', { className: 'etable-list-empty', 'data-test-id': 'table-list-empty' }, '该目录下没有表格')
      : rows;
  const error =
    props.error === undefined
      ? null
      : createElement('div', { className: 'etable-list-error', 'data-test-id': 'table-list-error' }, props.error);

  return createElement(
    'div',
    { className: 'etable-list', 'data-test-id': 'table-list' },
    presetArea,
    createElement(
      'div',
      { className: 'etable-list-tree' },
      createElement(
        'div',
        { className: 'etable-list-current', title: props.directory === '' ? '/' : props.directory },
        createElement('span', { className: 'etable-list-path' }, props.directory === '' ? '/' : props.directory),
      ),
      createElement('div', { className: 'etable-list-entries' }, body),
      error,
    ),
  );
}
