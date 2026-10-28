import { IFileEntry } from '@motajs/editor-core';
import { Button } from 'antd';
import { createElement, Fragment, MouseEvent, ReactElement, ReactNode } from 'react';
import { ITablePreset } from '../../react';
import { FileBrowser } from '../../shared/fileBrowser';
import { isTableDataPath, isTableOpenablePath } from '../resourceType';
import '../../shared/schemaForm/schemaForm.css';

// 可复用的表格浏览器契约：预设表区（表格自己的能力）+ 共用文件浏览器。
// 目录状态由浏览器自持，表格只提供「初始目录 / 读目录 / 过滤 / 打开」四项输入（D-24 / D-25）。
// 「打开表格」（注入预设）与「删除表格」（不注入预设）共用同一组 props，唯一差异是 presets 与过滤口径。

export interface ITablePickerProps {
  /** 预设表清单；缺省或无项时不渲染预设区，这是打开态与删除态的唯一差异 */
  readonly presets?: readonly ITablePreset[];
  /** 初始目录路径；根目录为空串，进入浏览器后由浏览器自持当前目录 */
  readonly directory: string;
  /** 读取某目录的直接子条目；浏览器不接触文件系统 */
  readonly loadChildren: (path: string) => Promise<readonly IFileEntry[]>;
  /** 目录读取失败时的提示文案；缺省时显示浏览器自带的缺省文案 */
  readonly error?: string;
  /** 外部重列令牌；变化时浏览器重读当前目录 */
  readonly reloadToken?: number;
  /** 为真时每个数据文件行渲染删除入口；删除态用 */
  readonly deletable?: boolean;
  /** 打开某数据表；删除态传空操作满足此必填契约 */
  onSelect(dataPath: string): void;
  /** 请求删除某数据表；删除态用，缺省时数据文件行不渲染删除入口 */
  onRequestDelete?(dataPath: string): void;
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
 * 渲染一个数据文件行右侧的删除入口：点击只请求删除，不冒泡成「打开」
 * @param entry 可作为表格打开的数据文件条目
 * @param onRequestDelete 请求删除某数据表的回调
 * @returns 删除入口元素
 */
function renderDeleteAction(entry: IFileEntry, onRequestDelete: (dataPath: string) => void): ReactElement {
  return createElement(
    Button,
    {
      type: 'text',
      size: 'small',
      danger: true,
      autoInsertSpace: false,
      'data-test-id': `table-list-delete-${entry.path}`,
      onClick: (event: MouseEvent): void => {
        event.stopPropagation();
        onRequestDelete(entry.path);
      },
    },
    '删除',
  );
}

/**
 * 可复用的表格浏览器组件：可选预设表 + 共用文件浏览器
 *
 * 不直接读写文件、不引入面板或引擎代码；打开态与删除态只差预设表与过滤口径：
 * 打开态用 `isTableOpenablePath`（含 schema），删除态用 `isTableDataPath`（不含 schema）。
 * @param props 组件 props
 * @returns 表格浏览器元素
 */
export function TablePicker(props: ITablePickerProps): ReactElement {
  const presets = props.presets;
  const presetArea = presets === undefined || presets.length === 0 ? null : renderPresets(presets, props.onSelect);
  const deletable = props.deletable === true;
  const filter = deletable ? isTableDataPath : isTableOpenablePath;
  const onRequestDelete = props.onRequestDelete;
  const renderRowAction =
    deletable && onRequestDelete !== undefined
      ? (entry: IFileEntry): ReactNode => renderDeleteAction(entry, onRequestDelete)
      : undefined;

  return createElement(
    Fragment,
    null,
    presetArea,
    createElement(FileBrowser, {
      testIdPrefix: 'table-list',
      directory: props.directory,
      loadChildren: props.loadChildren,
      filter,
      onOpen: props.onSelect,
      emptyText: '该目录下没有表格',
      errorText: props.error,
      renderRowAction,
      reloadToken: props.reloadToken,
    }),
  );
}
