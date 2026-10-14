import { ITableRowNode, ITableSchemaNode } from '../types';

/** 按 (schema, data) 的对象引用缓存 `buildTableTree` 结果：命中即复用同一数组，输入换成新对象即重算（P23） */
const tableTreeCache: WeakMap<object, WeakMap<object, readonly ITableRowNode[]>> = Object.freeze(
  new WeakMap<object, WeakMap<object, readonly ITableRowNode[]>>(),
);

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
 * 读取一个 schema 节点声明的同级呈现顺序，非法或缺失时返回 undefined
 * @param node 字段的 schema 节点
 * @returns 同级字段名列表；未声明或非字符串数组时为 undefined
 */
function readOrder(node: ITableSchemaNode): readonly string[] | undefined {
  const order = node['x-order'];

  if (!Array.isArray(order)) return undefined;

  return order.filter((key): key is string => typeof key === 'string');
}

/**
 * 按 `x-order` 与自然顺序合并出该层字段的展示顺序
 *
 * `x-order` 中列出的键按其次序排在前，其余键（schema 声明但未列出的、以及数据多出的）按自然
 * 顺序追加；`x-order` 缺失时完全保持自然顺序（向后兼容）。
 * @param declared 该层 schema 声明的字段表
 * @param data 该层对应的数据
 * @param order `x-order` 声明的顺序提示，可缺省
 * @returns 该层字段名的展示顺序
 */
function orderKeys(
  declared: Record<string, ITableSchemaNode>,
  data: unknown,
  order: readonly string[] | undefined,
): string[] {
  const natural: string[] = Object.keys(declared);
  const dataKeys = isDataObject(data) ? Object.keys(data) : [];

  for (const key of dataKeys) {
    if (!Object.prototype.hasOwnProperty.call(declared, key)) natural.push(key);
  }

  if (order === undefined) return natural;

  const seen = new Set<string>();
  const ordered: string[] = [];

  for (const key of order) {
    if (seen.has(key) || !natural.includes(key)) continue;

    ordered.push(key);
    seen.add(key);
  }

  for (const key of natural) {
    if (seen.has(key)) continue;

    ordered.push(key);
    seen.add(key);
  }

  return ordered;
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
      children: buildRows(node.properties, readField(data, key), path, readOrder(node)),
      config: node,
    };
  }

  return buildLeafRow(path, readField(data, key), node.description, node);
}

/**
 * 把一层的 schema 声明字段与数据组成行列表：按 `x-order`（缺省时按 properties 顺序）递归展开，
 * 再把 schema 未声明的数据字段补成叶子行（默认兜底，D-29）
 * @param properties 该层 schema 声明的字段表，未声明时为空
 * @param data 与该层字段对应的数据
 * @param prefix 父级路径，顶层为空串
 * @param order 该层 `x-order` 声明的顺序提示，可缺省
 * @returns 该层的行列表
 */
function buildRows(
  properties: Record<string, ITableSchemaNode> | undefined,
  data: unknown,
  prefix: string,
  order: readonly string[] | undefined,
): ITableRowNode[] {
  const declared = properties ?? {};
  const rows: ITableRowNode[] = [];

  for (const key of orderKeys(declared, data, order)) {
    if (Object.prototype.hasOwnProperty.call(declared, key))
      rows.push(buildDeclaredRow(key, declared[key], data, prefix));
    else rows.push(buildLeafRow(joinPath(prefix, key), readField(data, key), undefined, undefined));
  }

  return rows;
}

/**
 * 把标准 JSON Schema 的 properties 与数据组成行树（递归展开嵌套 object，同级按 `x-order` 排序）
 *
 * 结果以 (schema, data) 的对象引用为键缓存：输入引用未变时直接复用同一数组，不再重复构建
 * （P23）；数据或 schema 换成新对象（面板写盘后的情形）即重算。数据非对象时不缓存，直接计算。
 * @param schema 目标表的 JSON Schema 文档；缺失或非对象时不产生任何行
 * @param data 目标表的数据对象
 * @returns 行树节点列表，schema 缺失或非对象时为空数组
 */
export function buildTableTree(schema: unknown, data: unknown): readonly ITableRowNode[] {
  if (!isSchemaObject(schema)) return [];
  if (!isDataObject(data)) return buildRows(schema.properties, data, '', readOrder(schema));

  let byData = tableTreeCache.get(schema);

  if (byData === undefined) {
    byData = new WeakMap<object, readonly ITableRowNode[]>();
    tableTreeCache.set(schema, byData);
  }

  const cached = byData.get(data);
  if (cached !== undefined) return cached;

  const rows = buildRows(schema.properties, data, '', readOrder(schema));
  byData.set(data, rows);
  return rows;
}
