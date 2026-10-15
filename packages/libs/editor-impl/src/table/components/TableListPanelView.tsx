import { EditorEntryKind, IFileEntry } from '@motajs/editor-core';
import { useStore } from '@tanstack/react-store';
import { Store } from '@tanstack/store';
import { Button, Input, Modal } from 'antd';
import { ChangeEvent, createElement, KeyboardEvent, ReactElement, useCallback, useState } from 'react';
import { ITablePanelOpener, ITablePreset, useTableCapabilities } from '../../react';
import { isTableDataPath } from '../resourceType';
import '../table.css';

// 「打开表格」列表面板视图：上半渲染组合根注入的预设表，下半渲染项目目录树。
// 目录树只列可作为表格打开的数据文件（json / jsonc，排除 schema 约定文件），
// 点击表项经注入的表格面板打开器打开；本组件不直接读写文件。

export interface ITableListPanelViewState {
  /** 当前选中的目录路径；根目录为空串 */
  readonly directory: string;
  /** 当前目录的直接子条目 */
  readonly entries: readonly IFileEntry[];
  /** 目录读取失败时的面板级错误提示，缺省时不显示 */
  readonly error?: string;
}

export interface ITableListPanelViewProps {
  /** 面板持有的视图状态订阅源 */
  readonly store: Store<ITableListPanelViewState>;
  /** 选中某目录的回调 */
  readonly onSelectDirectory: (path: string) => void;
  /** 在当前目录新建一对表格文件的回调 */
  readonly onCreate: (directoryPath: string, name: string) => void;
  /** 删除某张表格（数据 + schema 一对）的回调 */
  readonly onDelete: (dataPath: string) => void;
  /** 打开某个数据文件的回调，携带表格面板打开器 */
  readonly onOpen: (dataPath: string, opener: ITablePanelOpener) => void;
}

interface ITableListCreateProps {
  /** 新建表格所在目录路径；根目录为空串 */
  readonly directory: string;
  /** 确认新建的回调 */
  readonly onCreate: (directoryPath: string, name: string) => void;
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
 * 渲染「预设表」区：每项一个按钮，点击经打开器打开其数据路径
 * @param presets 组合根注入的预设表清单
 * @param opener 表格面板打开器；缺省时预设项不可点
 * @param onOpen 打开回调
 * @returns 预设区元素
 */
function renderPresets(
  presets: readonly ITablePreset[],
  opener: ITablePanelOpener | undefined,
  onOpen: (dataPath: string, opener: ITablePanelOpener) => void,
): ReactElement {
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
        disabled: opener === undefined,
        onClick: (): void => {
          if (opener !== undefined) onOpen(preset.path, opener);
        },
      },
      preset.name,
    ),
  );

  return createElement(
    'div',
    { className: 'etable-list-presets' },
    createElement('div', { className: 'etable-list-heading' }, '预设表'),
    items.length === 0
      ? createElement('div', { className: 'etable-list-empty', 'data-test-id': 'table-list-preset-empty' }, '暂无预设表')
      : items,
  );
}

/**
 * 渲染一个目录行：点击进入 / 选中该目录
 * @param label 显示文案
 * @param path 目录路径
 * @param testId 该行的 data-test-id
 * @param onSelectDirectory 选中目录回调
 * @returns 目录行元素
 */
function renderDirectoryRow(
  label: string,
  path: string,
  testId: string,
  onSelectDirectory: (path: string) => void,
): ReactElement {
  return createElement(
    'button',
    {
      key: `dir:${testId}`,
      type: 'button',
      className: 'etable-list-entry etable-list-directory',
      'data-test-id': testId,
      onClick: (): void => onSelectDirectory(path),
    },
    label,
  );
}

/**
 * 渲染一个数据文件行：点击经打开器打开该表，另一侧提供删除入口
 * @param entry 可作为表格打开的数据文件条目
 * @param opener 表格面板打开器；缺省时该行不可点
 * @param onOpen 打开回调
 * @param onRequestDelete 请求删除该表的回调
 * @returns 数据文件行元素
 */
function renderFileRow(
  entry: IFileEntry,
  opener: ITablePanelOpener | undefined,
  onOpen: (dataPath: string, opener: ITablePanelOpener) => void,
  onRequestDelete: (dataPath: string) => void,
): ReactElement {
  return createElement(
    'div',
    { key: `file:${entry.path}`, className: 'etable-list-row' },
    createElement(
      'button',
      {
        type: 'button',
        className: 'etable-list-entry etable-list-file',
        'data-test-id': `table-list-entry-${entry.path}`,
        disabled: opener === undefined,
        onClick: (): void => {
          if (opener !== undefined) onOpen(entry.path, opener);
        },
      },
      entry.name,
    ),
    createElement(
      'button',
      {
        type: 'button',
        className: 'etable-list-delete',
        'data-test-id': `table-list-delete-${entry.path}`,
        onClick: (): void => onRequestDelete(entry.path),
      },
      '删除',
    ),
  );
}

/**
 * 「新建表格」入口：点 + 后内联 antd 输入名称，回车确认、Escape 或失焦取消
 *
 * 不使用浏览器原生对话框；名称在面板侧经 `validateId` 校验。
 * @param props 新建入口 props
 * @returns 新建按钮或名称输入元素
 */
function TableListCreate(props: ITableListCreateProps): ReactElement {
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

  if (!adding) {
    return createElement(
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
  }

  return createElement(Input, {
    autoFocus: true,
    size: 'small',
    className: 'etable-list-create-input',
    'data-test-id': 'table-list-create-input',
    value: name,
    placeholder: '表格名称',
    onChange: change,
    onKeyDown: keydown,
    onBlur: cancel,
  });
}

/**
 * 渲染删除确认弹窗：使用 antd `Modal`，明确数据与 schema 一对文件不可找回、不可撤销
 * @param dataPath 待删除的数据文件路径
 * @param onConfirm 确认回调
 * @param onCancel 取消回调
 * @returns 确认弹窗元素
 */
function renderDeleteModal(dataPath: string, onConfirm: () => void, onCancel: () => void): ReactElement {
  return createElement(
    Modal,
    {
      open: true,
      title: '删除表格',
      closable: false,
      maskClosable: false,
      keyboard: false,
      onCancel,
      footer: createElement(
        'div',
        { className: 'etable-list-delete-footer' },
        createElement(
          Button,
          { size: 'small', autoInsertSpace: false, 'data-test-id': 'table-list-delete-cancel', onClick: onCancel },
          '取消',
        ),
        createElement(
          Button,
          {
            size: 'small',
            type: 'primary',
            danger: true,
            autoInsertSpace: false,
            'data-test-id': 'table-list-delete-confirm',
            onClick: onConfirm,
          },
          '删除',
        ),
      ),
    },
    `将删除 ${dataPath} 的数据与 schema 一对文件，且无法找回、不可撤销。是否继续？`,
  );
}

/**
 * 渲染目录树：当前目录的「..」父目录行 + 目录子项 + 可作为表格打开的数据文件
 * @param state 视图状态
 * @param opener 表格面板打开器
 * @param onSelectDirectory 选中目录回调
 * @param onCreate 新建表格回调
 * @param onOpen 打开回调
 * @param onRequestDelete 请求删除表格回调
 * @returns 目录树元素
 */
function renderTree(
  state: ITableListPanelViewState,
  opener: ITablePanelOpener | undefined,
  onSelectDirectory: (path: string) => void,
  onCreate: (directoryPath: string, name: string) => void,
  onOpen: (dataPath: string, opener: ITablePanelOpener) => void,
  onRequestDelete: (dataPath: string) => void,
): ReactElement {
  const rows: ReactElement[] = [];

  if (state.directory !== '') {
    rows.push(renderDirectoryRow('..', parentDirectory(state.directory), 'table-list-up', onSelectDirectory));
  }

  for (const entry of state.entries) {
    if (entry.kind === EditorEntryKind.Directory) {
      rows.push(renderDirectoryRow(entry.name, entry.path, `table-list-entry-${entry.path}`, onSelectDirectory));
      continue;
    }

    if (isTableDataPath(entry.path)) rows.push(renderFileRow(entry, opener, onOpen, onRequestDelete));
  }

  const body =
    rows.length === 0
      ? createElement(
          'div',
          { className: 'etable-list-empty', 'data-test-id': 'table-list-empty' },
          '该目录下没有表格',
        )
      : rows;
  const error =
    state.error === undefined
      ? null
      : createElement('div', { className: 'etable-list-error', 'data-test-id': 'table-list-error' }, state.error);

  return createElement(
    'div',
    { className: 'etable-list-tree' },
    createElement(
      'div',
      { className: 'etable-list-current', title: state.directory === '' ? '/' : state.directory },
      createElement('span', { className: 'etable-list-path' }, state.directory === '' ? '/' : state.directory),
      createElement(TableListCreate, { directory: state.directory, onCreate }),
    ),
    createElement('div', { className: 'etable-list-entries' }, body),
    error,
  );
}

/**
 * 「打开表格」列表面板视图根组件：预设区 + 目录树
 * @param props 视图 props
 * @returns 列表面板元素
 */
export function TableListPanelView(props: ITableListPanelViewProps): ReactElement {
  const state = useStore(props.store);
  const capabilities = useTableCapabilities();
  const opener = capabilities.tablePanel;
  const presets = capabilities.tablePresets;
  const pendingState = useState<string | undefined>(undefined);
  const pending = pendingState[0];
  const setPending = pendingState[1];

  const requestDelete = useCallback((dataPath: string): void => setPending(dataPath), []);
  const confirmDelete = useCallback((): void => {
    const dataPath = pending;

    setPending(undefined);

    if (dataPath !== undefined) props.onDelete(dataPath);
  }, [pending, props]);
  const cancelDelete = useCallback((): void => setPending(undefined), []);
  const modal = pending === undefined ? null : renderDeleteModal(pending, confirmDelete, cancelDelete);

  return createElement(
    'div',
    { className: 'etable-list', 'data-test-id': 'table-list' },
    renderPresets(presets ?? [], opener, props.onOpen),
    renderTree(state, opener, props.onSelectDirectory, props.onCreate, props.onOpen, requestDelete),
    modal,
  );
}
