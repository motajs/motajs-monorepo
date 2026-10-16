import { EditorEntryKind, IFileEntry } from '@motajs/editor-core';
import { Button, Input } from 'antd';
import { ChangeEvent, createElement, Fragment, KeyboardEvent, ReactElement, useCallback, useState } from 'react';
import '../table.css';

// 可复用的新建表格表单契约：收集一个表格名并在当前选中目录下建一对文件。

export interface ITableCreateFormProps {
  /** 新建所在目录路径；根目录为空串 */
  readonly directory: string;
  /** 当前目录的直接子条目；缺省时不列出子目录供选择新建位置 */
  readonly entries?: readonly IFileEntry[];
  /** 名称校验 / 写入失败时的提示文案；缺省时不显示 */
  readonly error?: string;
  /** 进入某子目录作为新建位置的回调；含 `..` 上行由面板侧目录态承担 */
  onNavigate?(path: string): void;
  /** 确认新建回调，携带所在目录与表格名 */
  onCreate(directory: string, name: string): void;
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
 * 渲染一个目录行：点击进入该目录，类名与 data-test-id 沿用表格浏览器惯例
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
 * 渲染「新建位置」区：当前目录路径、非根目录时的一行「..」上行与各子目录行
 *
 * `entries` 或 `onNavigate` 缺省时返回 null（不渲染目录区，仅保留名称输入，保持向后兼容）；
 * 子目录行从 `entries` 过滤目录条目得到，点击均经 `onNavigate` 切换新建位置。
 * @param directory 当前目录路径；根目录为空串
 * @param entries 当前目录的直接子条目；缺省时不渲染目录区
 * @param onNavigate 进入某目录的回调；缺省时不渲染目录区
 * @returns 新建位置区元素；缺省时为 null
 */
function renderCurrentDirectory(
  directory: string,
  entries: readonly IFileEntry[] | undefined,
  onNavigate: ((path: string) => void) | undefined,
): ReactElement | null {
  if (entries === undefined || onNavigate === undefined) return null;

  const rows: ReactElement[] = [];

  if (directory !== '') {
    rows.push(renderDirectoryRow('..', parentDirectory(directory), 'table-list-up', onNavigate));
  }

  for (const entry of entries) {
    if (entry.kind !== EditorEntryKind.Directory) continue;

    rows.push(renderDirectoryRow(entry.name, entry.path, `table-list-entry-${entry.path}`, onNavigate));
  }

  return createElement(
    'div',
    { className: 'etable-list-tree', 'data-test-id': 'table-create-location' },
    createElement(
      'div',
      { className: 'etable-list-current', title: directory === '' ? '/' : directory },
      createElement('span', { className: 'etable-list-path' }, directory === '' ? '/' : directory),
    ),
    createElement('div', { className: 'etable-list-entries' }, rows),
  );
}

/**
 * 可复用的新建表格表单组件：可在目录树中选定新建位置，点「新建表格」内联输入名称，回车确认、
 * Escape 或失焦取消
 *
 * 不使用浏览器原生对话框；名称合法性由调用方（面板）承担，组件只把去空白后的名称回调出去。
 * @param props 组件 props
 * @returns 新建位置区、新建按钮（或名称输入）与错误提示
 */
export function TableCreateForm(props: ITableCreateFormProps): ReactElement {
  const addingState = useState(false);
  const adding = addingState[0];
  const setAdding = addingState[1];
  const nameState = useState('');
  const name = nameState[0];
  const setName = nameState[1];

  const open = useCallback((): void => setAdding(true), []);
  const cancel = useCallback((): void => {
    setAdding(false);
    setName('');
  }, []);
  const submit = useCallback((): void => {
    const trimmed = name.trim();

    setAdding(false);
    setName('');

    if (trimmed !== '') props.onCreate(props.directory, trimmed);
  }, [name, props]);
  const change = useCallback((event: ChangeEvent<HTMLInputElement>): void => setName(event.target.value), []);
  const keydown = useCallback(
    (event: KeyboardEvent<HTMLInputElement>): void => {
      if (event.key === 'Enter') submit();
      if (event.key === 'Escape') cancel();
    },
    [submit, cancel],
  );

  const location = renderCurrentDirectory(props.directory, props.entries, props.onNavigate);
  const control = adding
    ? createElement(Input, {
        autoFocus: true,
        size: 'small',
        className: 'etable-list-create-input',
        'data-test-id': 'table-list-create-input',
        value: name,
        placeholder: '表格名称',
        onChange: change,
        onKeyDown: keydown,
        onBlur: cancel,
      })
    : createElement(
        Button,
        {
          size: 'small',
          autoInsertSpace: false,
          className: 'etable-list-create',
          'data-test-id': 'table-list-create',
          onClick: open,
        },
        '新建表格',
      );
  const error =
    props.error === undefined
      ? null
      : createElement('div', { className: 'etable-list-error', 'data-test-id': 'table-list-error' }, props.error);

  return createElement(Fragment, null, location, control, error);
}
