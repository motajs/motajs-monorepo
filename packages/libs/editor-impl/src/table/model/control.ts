import { ITableSchemaNode, TableControlKind } from '../types';

/**
 * 依据字段的标准 JSON Schema 节点推导应使用的行内控件种类
 *
 * `x-control` 存在时以它为准；否则按标准关键字推导：`enum` → 下拉、`type: 'boolean'` → 复选框、
 * `type: 'array'` → 多选、`type: 'number'` / `'integer'` → 数字，其余（含 schema 缺失）→ 文本。
 * @param schema 字段的 JSON Schema 节点；缺省时回退为文本
 * @returns 推导出的行内控件种类
 */
export function inferControlKind(schema: ITableSchemaNode | undefined): TableControlKind {
  if (schema === undefined) return TableControlKind.Text;

  const explicit = schema['x-control'];

  if (explicit !== undefined) return explicit;

  if (schema.enum !== undefined) return TableControlKind.Select;
  if (schema.type === 'boolean') return TableControlKind.Checkbox;
  if (schema.type === 'array') return TableControlKind.MultiSelect;
  if (schema.type === 'number' || schema.type === 'integer') return TableControlKind.Number;

  return TableControlKind.Text;
}
