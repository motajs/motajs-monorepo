import { ITableRowNode, ITableSchemaNode, IPairedFieldGroup, ISchemaPresentationRule, TableControlKind } from '../types';
import { getShortField } from './fieldPath';

// schema 专用呈现：内建规则集把 schema 文档的关键字排成行布局——成对关键字（minimum/maximum、
// exclusiveMinimum/exclusiveMaximum）合成一行左右两个小输入，紧凑标量为一行单控件。规则集内建、
// 绝不由被编辑的 schema 描述，也不对 schema 做任何表达式求值。

/** schema 资源 id 前缀：命中即表示当前目标是 schema 而非数据（D-04 / D-05） */
const SCHEMA_RESOURCE_PREFIX = 'table#schema.';

/** 内建成对关键字组：两个关键字合成一行呈现（D-25） */
const PAIRED_KEYWORD_GROUPS: readonly IPairedFieldGroup[] = Object.freeze([
  Object.freeze({ keywords: Object.freeze(['minimum', 'maximum']) }),
  Object.freeze({ keywords: Object.freeze(['exclusiveMinimum', 'exclusiveMaximum']) }),
]);

/** 内建紧凑标量关键字：以一行单控件呈现 */
const COMPACT_KEYWORDS: readonly string[] = Object.freeze(['type', 'pattern', 'format', 'title', 'description']);

/** 以数字值呈现的关键字：成对呈现时用两个小数字输入 */
const NUMBER_KEYWORDS: readonly string[] = Object.freeze([
  'minimum',
  'maximum',
  'exclusiveMinimum',
  'exclusiveMaximum',
  'minLength',
  'maxLength',
  'minItems',
  'maxItems',
]);

/**
 * 判断一个值是否为可读写的普通对象
 * @param value 待判断的值
 * @returns 是普通对象时为 true
 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * 拼接 schema 关键字路径，采用与字段路径一致的 `['a']['b']` 括号形式
 * @param prefix 父级路径，顶层为空串
 * @param key 关键字名
 * @returns 拼接后的路径
 */
function joinSchemaPath(prefix: string, key: string): string {
  return `${prefix}['${key}']`;
}

/**
 * 在已出现的成对组里查找以给定关键字打头的组；两个成员都出现才算命中
 * @param keyword 当前关键字名
 * @param present 本层已出现的关键字集合
 * @returns 命中的成对组；未命中时为 undefined
 */
function findPairGroup(keyword: string, present: ReadonlySet<string>): IPairedFieldGroup | undefined {
  for (const group of PAIRED_KEYWORD_GROUPS) {
    if (group.keywords[0] !== keyword) continue;
    if (group.keywords.every((member) => present.has(member))) return group;
  }

  return undefined;
}

/**
 * 内建关键字到合成校验节点的映射：数字关键字用数字、`required` 用字符串数组，其余回退字符串
 * @param keyword 关键字名
 * @returns 供行内控件推导与提交校验使用的合成节点
 */
function keywordConfig(keyword: string): ITableSchemaNode {
  if (NUMBER_KEYWORDS.includes(keyword)) return { type: 'number' };
  if (keyword === 'required') return { type: 'array', items: { type: 'string' } };

  // x-order 的值是字符串数组：按数组校验以免纯重排被误判非法，x-control 让控件仍取文本域
  if (keyword === 'x-order') return { type: 'array', items: { type: 'string' }, 'x-control': TableControlKind.Text };

  return { type: 'string' };
}

/**
 * 把一份 schema 节点的各级关键字组成行；`properties` 与 `items` 的两个对象关键字递归展开
 * @param node schema 节点
 * @param prefix 该节点的路径前缀
 * @returns 该节点的关键字行列表
 */
function buildKeywordRows(node: Record<string, unknown>, prefix: string): ITableRowNode[] {
  const rows: ITableRowNode[] = [];

  for (const keyword of Object.keys(node)) {
    const path = joinSchemaPath(prefix, keyword);
    const value = node[keyword];

    if (keyword === 'properties' && isRecord(value)) {
      rows.push({ key: path, children: buildPropertyRows(value, path), config: { type: 'object' } });
      continue;
    }

    if (keyword === 'items' && isRecord(value)) {
      rows.push({ key: path, children: buildKeywordRows(value, path), config: { type: 'object' } });
      continue;
    }

    rows.push({ key: path, value, config: keywordConfig(keyword) });
  }

  return rows;
}

/**
 * 把 `properties` 里的每个字段名组成一行；字段 schema 为对象时递归成其关键字的分组行
 * @param properties schema 的 properties 表
 * @param prefix properties 关键字自身的路径
 * @returns 字段行列表
 */
function buildPropertyRows(properties: Record<string, unknown>, prefix: string): ITableRowNode[] {
  const rows: ITableRowNode[] = [];

  for (const name of Object.keys(properties)) {
    const path = joinSchemaPath(prefix, name);
    const node = properties[name];

    if (isRecord(node)) {
      rows.push({
        key: path,
        children: buildKeywordRows(node, path),
        description: typeof node.description === 'string' ? node.description : undefined,
      });
      continue;
    }

    rows.push({ key: path, value: node });
  }

  return rows;
}

/**
 * 判断一个资源 id 是否指向 schema 目标
 * @param id 资源标识符字符串
 * @returns id 形如 `table#schema.<name>` 时为 true
 */
export function isSchemaResourceId(id: string): boolean {
  return id.startsWith(SCHEMA_RESOURCE_PREFIX);
}

/**
 * 按内建规则把 schema 文档的一组关键字行重排为呈现布局
 *
 * 成对关键字合成一条带 `pair` 的规则，另一个成员被吸收、不再单独成行；紧凑标量在规则上标记
 * `compact`。规则集内建，绝不读取被编辑的 schema 来决定布局。
 * @param rows 同一层级的关键字行，保持原始顺序
 * @returns 与输入同序的呈现规则；被成对吸收的成员不出现在结果里
 */
export function buildSchemaPresentation(rows: readonly ITableRowNode[]): readonly ISchemaPresentationRule[] {
  const keywords = rows.map((row) => getShortField(row.key));
  const present = new Set(keywords);
  const absorbed = new Set<string>();
  const rules: ISchemaPresentationRule[] = [];

  for (const keyword of keywords) {
    if (absorbed.has(keyword)) continue;

    const pair = findPairGroup(keyword, present);

    if (pair !== undefined) {
      for (const member of pair.keywords) absorbed.add(member);
      rules.push({ keyword, pair });
      continue;
    }

    rules.push(COMPACT_KEYWORDS.includes(keyword) ? { keyword, compact: true } : { keyword });
  }

  return rules;
}

/**
 * 把一份标准 JSON Schema 文档组成行树：各级关键字为行、`properties` 与 `items` 递归展开（D-24）
 * @param schema schema 文档（即 `table#schema.<name>` 的内容）
 * @returns 行树节点列表；schema 缺失或非对象时为空数组
 */
export function buildSchemaTree(schema: unknown): readonly ITableRowNode[] {
  if (!isRecord(schema)) return [];

  return buildKeywordRows(schema, '');
}
