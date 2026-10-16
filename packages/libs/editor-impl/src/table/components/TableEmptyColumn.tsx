import { IFileEntry } from '@motajs/editor-core';
import { Button, Modal } from 'antd';
import { createElement, ReactElement, useCallback, useState } from 'react';
import { ITablePreset } from '../../react';
import { TableEmptyMode } from '../types';
import { TableCreateForm } from './TableCreateForm';
import { TablePicker } from './TablePicker';
import '../table.css';

// 空栏内联控件契约与实现：把「当前内联视图 + 目录数据 + 预设表 + 各回调」聚到一处，
// 供表格面板某一栏在未设目标时渲染。Buttons 态显示三个按钮，其余态在同一栏内内联渲染
// 可复用的打开 / 新建 / 删除组件；删除的二次确认在本组件内用受控 antd Modal 完成。

export interface ITableEmptyStateProps {
  /** 当前内联视图 */
  readonly mode: TableEmptyMode;
  /** 预设表清单；缺省时打开态不渲染预设区 */
  readonly presets?: readonly ITablePreset[];
  /** 当前目录路径；根目录为空串 */
  readonly directory: string;
  /** 该目录的直接子条目 */
  readonly entries: readonly IFileEntry[];
  /** 目录读取失败时的提示文案；缺省时不显示 */
  readonly error?: string;
  /** 切换内联视图，含「返回」到按钮态 */
  onModeChange(mode: TableEmptyMode): void;
  /** 进入某目录 */
  onNavigate(path: string): void;
  /** 在该栏内打开某数据表 */
  onOpen(dataPath: string): void;
  /** 在该栏内新建某表格 */
  onCreate(directory: string, name: string): void;
  /** 删除某表格；删除前由本组件二次确认 */
  onDelete(dataPath: string): void;
}

/**
 * 删除态传给浏览器组件的空操作：删除态点表项不打开表，但不省略其必填的 `onSelect` 契约
 */
function ignoreSelect(): void {}

/**
 * 渲染「返回」按钮：把该栏空栏内联视图切回三个按钮的初始态
 * @param onBack 返回按钮态的回调
 * @returns 返回按钮元素
 */
function renderBackButton(onBack: () => void): ReactElement {
  return createElement(
    Button,
    {
      size: 'small',
      autoInsertSpace: false,
      className: 'etable-empty-back',
      'data-test-id': 'table-empty-back',
      onClick: onBack,
    },
    '返回',
  );
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
        { className: 'etable-empty-delete-footer' },
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
 * 渲染按钮态：三个按钮分别切到打开 / 新建 / 删除内联视图
 * @param onModeChange 切换内联视图的回调
 * @returns 按钮态元素
 */
function renderButtons(onModeChange: (mode: TableEmptyMode) => void): ReactElement {
  return createElement(
    'div',
    { className: 'etable-empty', 'data-test-id': 'table-empty' },
    createElement(
      'div',
      { className: 'etable-empty-actions' },
      createElement(
        Button,
        {
          size: 'small',
          autoInsertSpace: false,
          'data-test-id': 'table-empty-open',
          onClick: (): void => onModeChange(TableEmptyMode.Open),
        },
        '打开表格',
      ),
      createElement(
        Button,
        {
          size: 'small',
          autoInsertSpace: false,
          'data-test-id': 'table-empty-create',
          onClick: (): void => onModeChange(TableEmptyMode.Create),
        },
        '新建表格',
      ),
      createElement(
        Button,
        {
          size: 'small',
          autoInsertSpace: false,
          'data-test-id': 'table-empty-delete',
          onClick: (): void => onModeChange(TableEmptyMode.Delete),
        },
        '删除表格',
      ),
    ),
  );
}

/**
 * 空栏控件组件：按 `mode` 渲染三个按钮，或在本栏内内联渲染打开 / 新建 / 删除组件
 *
 * 纯由 props 驱动（仅删除二次确认用本地 `useState` 持有待删路径）；不直接读写文件、
 * 不引入面板或引擎代码，打开 / 删除两态共用 `TablePicker`、差异只是是否传入预设表。
 * @param props 组件 props
 * @returns 空栏控件元素
 */
export function TableEmptyColumn(props: ITableEmptyStateProps): ReactElement {
  const pendingState = useState<string | undefined>(undefined);
  const pending = pendingState[0];
  const setPending = pendingState[1];

  const back = useCallback((): void => props.onModeChange(TableEmptyMode.Buttons), [props]);
  const requestDelete = useCallback((dataPath: string): void => setPending(dataPath), []);
  const confirmDelete = useCallback((): void => {
    const dataPath = pending;

    setPending(undefined);

    if (dataPath !== undefined) props.onDelete(dataPath);
  }, [pending, props]);
  const cancelDelete = useCallback((): void => setPending(undefined), []);

  if (props.mode === TableEmptyMode.Open) {
    return createElement(
      'div',
      { className: 'etable-empty-mode', 'data-test-id': 'table-empty-mode-open' },
      renderBackButton(back),
      createElement(TablePicker, {
        presets: props.presets,
        directory: props.directory,
        entries: props.entries,
        error: props.error,
        onNavigate: props.onNavigate,
        onSelect: props.onOpen,
      }),
    );
  }

  if (props.mode === TableEmptyMode.Create) {
    return createElement(
      'div',
      { className: 'etable-empty-mode', 'data-test-id': 'table-empty-mode-create' },
      renderBackButton(back),
      createElement(TableCreateForm, {
        directory: props.directory,
        entries: props.entries,
        error: props.error,
        onNavigate: props.onNavigate,
        onCreate: props.onCreate,
      }),
    );
  }

  if (props.mode === TableEmptyMode.Delete) {
    const modal = pending === undefined ? null : renderDeleteModal(pending, confirmDelete, cancelDelete);

    return createElement(
      'div',
      { className: 'etable-empty-mode', 'data-test-id': 'table-empty-mode-delete' },
      renderBackButton(back),
      createElement(TablePicker, {
        directory: props.directory,
        entries: props.entries,
        error: props.error,
        deletable: true,
        onNavigate: props.onNavigate,
        onSelect: ignoreSelect,
        onRequestDelete: requestDelete,
      }),
      modal,
    );
  }

  return renderButtons(props.onModeChange);
}
