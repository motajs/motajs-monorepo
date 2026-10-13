import { ReactElement, useRef, useState } from 'react';
import { ITableRowNode, TableControlKind, TableEditMode } from '../types';
import { inferControlKind } from '../model/control';
import { validateValue } from '../model/validation';
import { getParentFieldPath, getShortField, parseFieldPath } from '../model/fieldPath';
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
  /** 请求打开该字段的外部编辑器（由 plan 02-09 分发） */
  readonly onOpenExternalEditor?: (key: string) => void;
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
 * @param props 行 props
 * @returns 叶子行元素
 */
export function TableRow(props: ITableRowProps): ReactElement {
  const row = props.row;
  const errorState = useState<string | undefined>(undefined);
  const error = errorState[0];
  const setError = errorState[1];
  const lastClick = useRef(0);
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

  const dispatchDoubleClick = (): void => {
    if (props.mode === TableEditMode.Change) {
      props.onOpenExternalEditor?.(row.key);
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
        <div className="etable-cell etable-cell-action" data-test-id={`table-edit-${dataAttr}`} />
      </div>
      {error === undefined ? null : (
        <div className="etable-row-error" data-test-id={`table-error-${dataAttr}`}>
          {error}
        </div>
      )}
    </>
  );
}
