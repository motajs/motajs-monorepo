import { ITableRowNode, ITableSchemaNode } from '../types';

/**
 * 判断一个值是否可作为 JSON Schema 对象节点参与行树构建
 * @param value 待判断的值
 * @returns 是普通对象时为 true
 */
function isSchemaObject(value: unknown): value is ITableSchemaNode {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * 判断一个值是否可作为数据对象读取字段
 * @param value 待判断的值
 * @returns 是普通对象时为 true
 */
function isDataObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * 判断一个 schema 节点是否为可折叠的分组行
 * @param node 待判断的 schema 节点
 * @returns 节点为 object 且自带 properties 时为 true
 */
function isGroupNode(node: ITableSchemaNode): boolean {
  return node.type === 'object' && isSchemaObject(node.properties);
}

/**
 * 取数据对象上某个字段的值
 * @param data 数据对象
 * @param key 字段名
 * @returns 字段值，数据对象缺失时为 undefined
 */
function readField(data: unknown, key: string): unknown {
  return isDataObject(data) ? data[key] : undefined;
}

/**
 * 拼接字段路径，采用 legacy 的 `['a']['b']` 括号形式（与 `parseFieldPath` 一致）
 * @param prefix 父级路径，顶层为空串
 * @param key 当前字段名
 * @returns 拼接后的字段路径，如 `['nested']['inner']`
 */
function joinPath(prefix: string, key: string): string {
  return `${prefix}['${key}']`;
}

/**
 * 构造一个叶子行
 * @param path 字段路径，作为行的稳定标识
 * @param value 字段值
 * @param description 字段描述
 * @param config 对应的 schema 节点，无对应项时为 undefined
 * @returns 叶子行节点
 */
function buildLeafRow(
  path: string,
  value: unknown,
  description: string | undefined,
  config: ITableSchemaNode | undefined,
): ITableRowNode {
  return { key: path, value, description, children: undefined, config };
}

/**
 * 构造一个 schema 声明字段对应的行：带 properties 的 object 为分组行，其余为叶子行
 * @param key 字段名
 * @param node 字段的 schema 节点
 * @param data 与该层字段对应的数据
 * @param prefix 父级路径，顶层为空串
 * @returns 该字段的行节点
 */
function buildDeclaredRow(key: string, node: ITableSchemaNode, data: unknown, prefix: string): ITableRowNode {
  const path = joinPath(prefix, key);

  if (isGroupNode(node)) {
    return {
      key: path,
      value: undefined,
      description: node.description,
      children: buildRows(node.properties, readField(data, key), path),
      config: node,
    };
  }

  return buildLeafRow(path, readField(data, key), node.description, node);
}

/**
 * 把一层的 schema 声明字段与数据组成行列表：先按 properties 递归展开，再把 schema 未声明的
 * 数据字段补成叶子行（默认兜底，D-29）
 * @param properties 该层 schema 声明的字段表，未声明时为空
 * @param data 与该层字段对应的数据
 * @param prefix 父级路径，顶层为空串
 * @returns 该层的行列表
 */
function buildRows(
  properties: Record<string, ITableSchemaNode> | undefined,
  data: unknown,
  prefix: string,
): ITableRowNode[] {
  const declared = properties ?? {};
  const rows: ITableRowNode[] = [];

  for (const key of Object.keys(declared)) rows.push(buildDeclaredRow(key, declared[key], data, prefix));

  const dataKeys = isDataObject(data) ? Object.keys(data) : [];

  for (const key of dataKeys) {
    if (Object.prototype.hasOwnProperty.call(declared, key)) continue;

    rows.push(buildLeafRow(joinPath(prefix, key), readField(data, key), undefined, undefined));
  }

  return rows;
}

/**
 * 把标准 JSON Schema 的 properties 与数据组成行树（递归展开嵌套 object）
 * @param schema 目标表的 JSON Schema 文档；缺失或非对象时不产生任何行
 * @param data 目标表的数据对象
 * @returns 行树节点列表，schema 缺失或非对象时为空数组
 */
export function buildTableTree(schema: unknown, data: unknown): readonly ITableRowNode[] {
  if (!isSchemaObject(schema)) return [];

  return buildRows(schema.properties, data, '');
}
