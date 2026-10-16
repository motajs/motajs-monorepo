import { Button, Input } from 'antd';
import { ChangeEvent, createElement, Fragment, KeyboardEvent, ReactElement, useCallback, useState } from 'react';
import '../table.css';

// 可复用的新建表格表单契约：收集一个表格名并在当前目录下建一对文件。

export interface ITableCreateFormProps {
  /** 新建所在目录路径；根目录为空串 */
  readonly directory: string;
  /** 名称校验 / 写入失败时的提示文案；缺省时不显示 */
  readonly error?: string;
  /** 确认新建回调，携带所在目录与表格名 */
  onCreate(directory: string, name: string): void;
}

/**
 * 可复用的新建表格表单组件：点「新建表格」内联输入名称，回车确认、Escape 或失焦取消
 *
 * 不使用浏览器原生对话框；名称合法性由调用方（面板）承担，组件只把去空白后的名称回调出去。
 * @param props 组件 props
 * @returns 新建按钮（或名称输入）与错误提示
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

  return createElement(Fragment, null, control, error);
}
