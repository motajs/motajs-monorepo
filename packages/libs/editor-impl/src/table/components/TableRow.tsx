import { ReactElement, useRef, useState } from 'react';
import { ITableEditorCapabilities, IMultiSelectItem, useTableCapabilities } from '../../react';
import { ITableRowNode, TableControlKind, TableEditMode, TableExternalEditor } from '../types';
import { inferControlKind } from '../model/control';
import { validateValue } from '../model/validation';
import { getParentFieldPath, getShortField, parseFieldPath } from '../model/fieldPath';
import { ActionButtons } from './ActionButtons';
import { CheckboxInput } from './inputs/CheckboxInput';
import { CheckboxSet } from './inputs/CheckboxSet';
import { ColorInput } from './inputs/ColorInput';
import { SelectInput } from './inputs/SelectInput';
import { TextareaInput } from './inputs/TextareaInput';

/** 两次点击间隔小于该值即视为双击（毫秒），对齐 legacy 的触屏双击语义 */
const DOUBLE_CLICK_INTERVAL_MS = 500;

export interface ITableRowProps {
  /** 要渲染的叶子行节点 */
  readonly row: ITableRowNode;
  /** 当前编辑模式，决定双击的分发行为 */
  readonly mode: TableEditMode;
  /** 提交一个已通过校验的新值 */
  readonly onChange?: (key: string, value: unknown) => void;
  /** 请求在父路径下新增一项 */
  readonly onAdd?: (parentPath: string, name: string) => void;
  /** 请求删除该项 */
  readonly onDelete?: (key: string) => void;
  /** 自定义打开外部编辑器的回调；缺省时行内按 `x-editor` 分发到注入的能力打开器 */
  readonly onOpenExternalEditor?: (key: string) => void;
}

/**
 * 判断给定外部编辑器所需的能力是否已注入
 * @param editor 字段使用的外部编辑器种类
 * @param capabilities 注入的能力包
 * @returns 对应打开器已注入时为 true
 */
function isExternalEditorAvailable(editor: TableExternalEditor, capabilities: ITableEditorCapabilities): boolean {
  if (editor === TableExternalEditor.Code) return capabilities.codeEditor !== undefined;
  if (editor === TableExternalEditor.Event) return capabilities.eventEditor !== undefined;
  if (editor === TableExternalEditor.Material) return capabilities.multiSelect !== undefined;
  if (editor === TableExternalEditor.MultiSelect) return capabilities.multiSelect !== undefined;
  if (editor === TableExternalEditor.Point) return capabilities.pointSelect !== undefined;

  return false;
}

/**
 * 计算外部编辑器能力缺失时的提示文案
 * @param editor 字段使用的外部编辑器种类
 * @returns 中文提示文案
 */
function externalEditorDisabledHint(editor: TableExternalEditor): string {
  if (editor === TableExternalEditor.Code) return '未注入代码编辑器能力';
  if (editor === TableExternalEditor.Event) return '未注入事件编辑器能力';
  if (editor === TableExternalEditor.Material || editor === TableExternalEditor.MultiSelect) {
    return '未注入多选能力';
  }

  return '未注入坐标选择能力';
}

/**
 * 把字段值转成代码 / 事件编辑器的初始内容：字符串原样、其余按缩进 JSON
 * @param value 字段当前值
 * @returns 编辑器初始内容文本
 */
function toEditorContent(value: unknown): string {
  if (typeof value === 'string') return value;

  return JSON.stringify(value, null, 2) ?? '';
}

/**
 * 从字段 schema 的数组项 enum 构造多选弹窗候选项，id 与标签均为成员文本
 * @param row 叶子行节点
 * @returns 候选项列表；无数组项 enum 时为空数组
 */
function toMultiSelectItems(row: ITableRowNode): readonly IMultiSelectItem[] {
  const config = row.config;

  if (config === undefined) return [];

  const items = config.items;

  if (items === undefined) return [];

  const options = items.enum ?? [];

  return options.map((option) => ({ id: String(option), label: String(option) }));
}

/**
 * 从字段 schema 的数组项 enum 取原始成员值，用于把多选结果 id 还原为写回值
 * @param row 叶子行节点
 * @returns 原始成员值列表；无数组项 enum 时为空数组
 */
function toOptionValues(row: ITableRowNode): readonly unknown[] {
  const config = row.config;

  if (config === undefined) return [];

  const items = config.items;

  if (items === undefined) return [];

  return items.enum ?? [];
}

/**
 * 把多选结果的 id 列表还原为写回值：命中原始 enum 成员时用原值，否则保留 id 文本
 * @param ids 多选确认的 id 列表
 * @param values 字段数组项的原始成员值列表
 * @returns 写回值数组
 */
function toSelectedValues(ids: readonly string[], values: readonly unknown[]): readonly unknown[] {
  return ids.map((id) => {
    const index = values.findIndex((value) => String(value) === id);

    return index === -1 ? id : values[index];
  });
}

/**
 * 按字段的外部编辑器种类选择打开器并取回写回值
 *
 * 代码 / 事件走独立面板打开器，素材 / 多选 / 坐标走弹窗打开器；能力缺失或用户取消时返回
 * `undefined`，调用方据此不提交。返回值随后经统一提交入口校验并进入可撤销路径。
 * @param editor 字段使用的外部编辑器种类
 * @param capabilities 注入的能力包
 * @param row 叶子行节点，提供字段名、当前值与数组项 enum
 * @returns 写回值；能力缺失或用户取消时为 undefined
 */
async function openExternalEditor(
  editor: TableExternalEditor,
  capabilities: ITableEditorCapabilities,
  row: ITableRowNode,
): Promise<unknown> {
  const title = getShortField(row.key);
  const value = row.value;

  if (editor === TableExternalEditor.Code) {
    const opener = capabilities.codeEditor;

    if (opener === undefined) return undefined;

    const text = await opener.open({ title, content: toEditorContent(value) });

    return text === null ? undefined : text;
  }

  if (editor === TableExternalEditor.Event) {
    const opener = capabilities.eventEditor;

    if (opener === undefined) return undefined;

    const text = await opener.open({ title, content: toEditorContent(value) });

    return text === null ? undefined : text;
  }

  if (editor === TableExternalEditor.Material || editor === TableExternalEditor.MultiSelect) {
    const opener = capabilities.multiSelect;

    if (opener === undefined) return undefined;

    const selectedIds = Array.isArray(value) ? value.map((member) => String(member)) : [];
    const result = await opener.open({ title, items: toMultiSelectItems(row), selectedIds });

    if (result === null) return undefined;

    return toSelectedValues(result.ids, toOptionValues(row));
  }

  if (editor === TableExternalEditor.Point) {
    const opener = capabilities.pointSelect;

    if (opener === undefined) return undefined;

    const x = Array.isArray(value) && typeof value[0] === 'number' ? value[0] : undefined;
    const y = Array.isArray(value) && typeof value[1] === 'number' ? value[1] : undefined;
    const result = await opener.open({ title, x, y });

    if (result === null) return undefined;

    return [result.x, result.y];
  }

  return undefined;
}

/**
 * 按字段 schema 推导出的控件种类渲染当前值控件
 * @param row 叶子行节点
 * @param disabled 删除模式下控件只读
 * @param onChange 提交解析后的新值
 * @returns 值控件元素
 */
function renderValueControl(row: ITableRowNode, disabled: boolean, onChange: (value: unknown) => void): ReactElement {
  const config = row.config;

  if (config !== undefined) {
    const kind = inferControlKind(config);

    if (kind === TableControlKind.Select) {
      return <SelectInput value={row.value} options={config.enum ?? []} disabled={disabled} onChange={onChange} />;
    }

    if (kind === TableControlKind.Checkbox) {
      return <CheckboxInput value={Boolean(row.value)} disabled={disabled} onChange={onChange} />;
    }

    if (kind === TableControlKind.MultiSelect) {
      const items = config.items;
      const options = items === undefined ? [] : (items.enum ?? []);
      const keys = options.filter(
        (option): option is string | number => typeof option === 'string' || typeof option === 'number',
      );

      return (
        <CheckboxSet
          value={row.value}
          keys={keys}
          prefixStrings={keys.map((key) => `${key}: `)}
          disabled={disabled}
          onChange={onChange}
        />
      );
    }

    if (kind === TableControlKind.Color) {
      return <ColorInput value={row.value} disabled={disabled} onChange={onChange} />;
    }
  }

  return <TextareaInput value={row.value} disabled={disabled} onChange={onChange} />;
}

/**
 * 叶子行：渲染条目 / 注释 / 值 / 操作四栏，值控件按 schema 映射，提交前先校验，双击按模式分发
 *
 * 操作列的「编辑」按 `x-editor` 选择外部编辑器打开器（代码 / 事件走独立面板，素材 / 多选 / 坐标
 * 走弹窗），返回值经上层一度校验后可撤销的提交路径重入；能力缺失时禁用动作并提示。复制经注入的
 * 剪贴板能力，绝不触达浏览器全局。
 * @param props 行 props
 * @returns 叶子行元素
 */
export function TableRow(props: ITableRowProps): ReactElement {
  const row = props.row;
  const capabilities = useTableCapabilities();
  const errorState = useState<string | undefined>(undefined);
  const error = errorState[0];
  const setError = errorState[1];
  const commentState = useState(false);
  const showComment = commentState[0];
  const setShowComment = commentState[1];
  const lastClick = useRef(0);
  const config = row.config;
  const externalEditor = config === undefined ? undefined : config['x-editor'];
  const readOnly = config !== undefined && config.readOnly === true;
  const controlKind = inferControlKind(config);
  const copyText = typeof row.value === 'string' ? row.value : (JSON.stringify(row.value) ?? '');
  const dataAttr = parseFieldPath(row.key).join('-');
  const disabled = props.mode === TableEditMode.Delete;

  const handleValueChange = (value: unknown): void => {
    if (!validateValue(row.config, value)) {
      setError(`${row.key} : 输入的值不合要求，请鼠标放置在注释上查看说明`);
      return;
    }

    setError(undefined);
    props.onChange?.(row.key, value);
  };

  const runExternalEditor = async (): Promise<void> => {
    if (externalEditor === undefined) return;

    const value = await openExternalEditor(externalEditor, capabilities, row);

    if (value === undefined) return;

    props.onChange?.(row.key, value);
  };

  const handleExternalEdit = (): void => {
    if (props.onOpenExternalEditor !== undefined) {
      props.onOpenExternalEditor(row.key);
      return;
    }

    void runExternalEditor();
  };

  const handleCopy = (): void => {
    const copy = capabilities.copy;

    if (copy === undefined) return;

    void copy.copyText(copyText);
  };

  const handleComment = (): void => {
    setShowComment(!showComment);
  };

  const dispatchDoubleClick = (): void => {
    if (props.mode === TableEditMode.Change) {
      handleExternalEdit();
      return;
    }

    if (props.mode === TableEditMode.Add) {
      const name = prompt('请输入新项的名称');

      if (name) props.onAdd?.(getParentFieldPath(row.key), name);

      return;
    }

    if (!validateValue(row.config, null)) {
      setError(`${row.key} : 该值不允许为null，无法删除`);
      return;
    }

    if (confirm('确定要删除吗？')) props.onDelete?.(row.key);
  };

  const handleRowClick = (): void => {
    const now = Date.now();

    if (now - lastClick.current < DOUBLE_CLICK_INTERVAL_MS) {
      lastClick.current = 0;
      dispatchDoubleClick();
      return;
    }

    lastClick.current = now;
  };

  return (
    <>
      <div className="etable-row" data-test-id={`table-row-${dataAttr}`} onClick={handleRowClick}>
        <div className="etable-cell etable-cell-name" title={row.key}>
          {getShortField(row.key)}
        </div>
        <div className="etable-cell etable-cell-comment" title={row.description ?? ''}>
          {row.description ?? ''}
        </div>
        <div className="etable-cell etable-cell-value" data-test-id={`table-input-${dataAttr}`}>
          {renderValueControl(row, disabled, handleValueChange)}
        </div>
        <div
          className="etable-cell etable-cell-action"
          data-test-id={`table-edit-${dataAttr}`}
          onClick={(event): void => event.stopPropagation()}
        >
          <ActionButtons
            description={row.description}
            externalEditor={externalEditor}
            controlKind={controlKind}
            readOnly={readOnly}
            value={copyText}
            editEnabled={externalEditor !== undefined && isExternalEditorAvailable(externalEditor, capabilities)}
            editDisabledHint={externalEditor === undefined ? undefined : externalEditorDisabledHint(externalEditor)}
            copyEnabled={capabilities.copy !== undefined}
            copyDisabledHint="未注入剪贴板能力"
            onCommentClick={handleComment}
            onEditClick={handleExternalEdit}
            onCopyClick={handleCopy}
          />
        </div>
      </div>
      {showComment && row.description !== undefined ? (
        <div className="etable-comment-full" data-test-id={`table-comment-${dataAttr}`}>
          {row.description}
        </div>
      ) : null}
      {error === undefined ? null : (
        <div className="etable-row-error" data-test-id={`table-error-${dataAttr}`}>
          {error}
        </div>
      )}
    </>
  );
}
