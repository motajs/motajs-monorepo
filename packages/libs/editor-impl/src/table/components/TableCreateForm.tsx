import { EditorEntryKind, IFileEntry } from '@motajs/editor-core';
import { Button, Input } from 'antd';
import {
  ChangeEvent,
  createElement,
  Fragment,
  KeyboardEvent,
  ReactElement,
  useCallback,
  useEffect,
  useState,
} from 'react';
import '../../shared/schemaForm/schemaForm.css';

// 可复用的新建表格表单契约：收集一个表格名，并在表单自己选定的目录下建一对文件。
// 目录区由表单自持当前目录与「该目录的直接子条目」，面板只提供初始目录与读目录回调（D-24）。

export interface ITableCreateFormProps {
  /** 初始目录路径；根目录为空串，进入目录区后由表单自持当前目录 */
  readonly directory: string;
  /** 读取某目录的直接子条目；表单不接触文件系统 */
  readonly loadChildren: (path: string) => Promise<readonly IFileEntry[]>;
  /** 外部重列令牌；变化时重读当前目录 */
  readonly reloadToken?: number;
  /** 名称校验 / 写入失败 / 目录读取失败时的提示文案；缺省时不显示 */
  readonly error?: string;
  /** 确认新建回调，携带所在目录与表格名 */
  onCreate(directory: string, name: string): void;
}

/** 目录读取失败时表单自己显示的一行文案 */
const LOAD_ERROR_TEXT = '目录读取失败，请重试。';

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
 * 子目录行从 `entries` 过滤目录条目得到，点击均经 `onNavigate` 切换表单内部的新建位置。
 * @param directory 当前目录路径；根目录为空串
 * @param entries 当前目录的直接子条目
 * @param onNavigate 进入某目录的回调
 * @returns 新建位置区元素
 */
function renderCurrentDirectory(
  directory: string,
  entries: readonly IFileEntry[],
  onNavigate: (path: string) => void,
): ReactElement {
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
 * 目录状态（当前目录与直接子条目）由组件自持，经 `loadChildren` 读取；不使用浏览器原生对话框。
 * 名称合法性由调用方（面板）承担，组件只把去空白后的名称与当前目录回调出去。
 * @param props 组件 props
 * @returns 新建按钮（或名称输入）、新建位置区与错误提示
 */
export function TableCreateForm(props: ITableCreateFormProps): ReactElement {
  const addingState = useState(false);
  const adding = addingState[0];
  const setAdding = addingState[1];
  const nameState = useState('');
  const name = nameState[0];
  const setName = nameState[1];
  const directoryState = useState(props.directory);
  const directory = directoryState[0];
  const setDirectory = directoryState[1];
  const entriesState = useState<readonly IFileEntry[]>([]);
  const entries = entriesState[0];
  const setEntries = entriesState[1];
  const loadErrorState = useState<string | undefined>(undefined);
  const loadError = loadErrorState[0];
  const setLoadError = loadErrorState[1];

  // 当前目录或重列令牌变化时重读该目录；卸载或换目录后丢弃过期结果
  useEffect((): (() => void) => {
    let active = true;

    props.loadChildren(directory).then(
      (next): void => {
        if (!active) return;

        setEntries(next);
        setLoadError(undefined);
      },
      (): void => {
        if (!active) return;

        setEntries([]);
        setLoadError(LOAD_ERROR_TEXT);
      },
    );

    return (): void => {
      active = false;
    };
  }, [directory, props.reloadToken, props.loadChildren]);

  const open = useCallback((): void => setAdding(true), []);
  const cancel = useCallback((): void => {
    setAdding(false);
    setName('');
  }, []);
  const submit = useCallback((): void => {
    const trimmed = name.trim();

    setAdding(false);
    setName('');

    if (trimmed !== '') props.onCreate(directory, trimmed);
  }, [name, directory, props]);
  const change = useCallback((event: ChangeEvent<HTMLInputElement>): void => setName(event.target.value), []);
  const keydown = useCallback(
    (event: KeyboardEvent<HTMLInputElement>): void => {
      if (event.key === 'Enter') submit();
      if (event.key === 'Escape') cancel();
    },
    [submit, cancel],
  );

  const location = renderCurrentDirectory(directory, entries, setDirectory);
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
  const message = props.error ?? loadError;
  const error =
    message === undefined
      ? null
      : createElement('div', { className: 'etable-list-error', 'data-test-id': 'table-list-error' }, message);

  return createElement(Fragment, null, control, location, error);
}
