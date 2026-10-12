import { IResourceIdentifier } from '@motajs/editor-core';

// 表格资源的类型号与 id 约定：数据表资源 id 形如 `table.<name>`，其 schema 资源 id 形如
// `table#schema.<name>`；数据表与 schema 表共用一个资源类型号，靠 id 区分。

export const enum TableResourceType {
  /** 表格资源类型号：数据表与 schema 表共用此号 */
  Table,
}

/**
 * 生成数据表资源标识
 * @param name 表格名，不透明字符串，不做任何路径拼接
 * @returns 数据表资源标识，id 形如 `table.<name>`
 */
export function tableDataResourceId(name: string): IResourceIdentifier {
  return { type: TableResourceType.Table, id: `table.${name}` };
}

/**
 * 生成 schema 资源标识
 * @param name 表格名，不透明字符串，不做任何路径拼接
 * @returns schema 资源标识，id 形如 `table#schema.<name>`
 */
export function tableSchemaResourceId(name: string): IResourceIdentifier {
  return { type: TableResourceType.Table, id: `table#schema.${name}` };
}
