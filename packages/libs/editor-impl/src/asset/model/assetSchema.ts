import { AssetCategoryKind, IAssetCategory } from '../../react';
import { parseTableText, TableTextParseStatus } from '../../shared/jsonc';
import { ITableSchemaNode } from '../../shared/schemaForm/types';
import { getBuiltInAssetSchema } from '../schemas/builtInSchemas';
import { AssetSchemaSource, IAssetSchemaResolution } from '../types';
import { ASSET_SCHEMA_FILE_NAME } from './assetPaths';

// 分类配置表单的 schema 取自哪：优先读工程内约定的 `.schema.jsonc`，其次用装配方注入的回退 schema，最后才用
// 包内置的新引擎 schema；工程内 schema 存在但解析失败时返回 null，由面板进错误态而不是静默回退。

/**
 * 判断一个未知值是否可作为 schema 节点使用（普通对象）
 * @param value 待判断的值
 * @returns 是普通对象时为 true
 */
function isSchemaObject(value: unknown): value is ITableSchemaNode {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * 按「工程 schema → 注入 schema → 内置 schema」的顺序解析某分类的配置表单 schema
 * @param kind 分类的种类
 * @param projectSchemaText 工程内 `.schema.jsonc` 的原文；没有时传 undefined
 * @param injectedSchema 装配方注入的回退 schema；没有时传 undefined
 * @returns 解析结果与来源；工程 schema 存在但无效或需剥离注释时为 null
 */
export function resolveAssetSchema(
  kind: AssetCategoryKind,
  projectSchemaText: string | undefined,
  injectedSchema: ITableSchemaNode | undefined,
): IAssetSchemaResolution | null {
  if (projectSchemaText !== undefined) {
    const parsed = parseTableText(projectSchemaText);
    if (parsed.status !== TableTextParseStatus.Conforming) return null;
    if (!isSchemaObject(parsed.value)) return null;

    return { schema: parsed.value, source: AssetSchemaSource.ProjectFile };
  }

  if (injectedSchema !== undefined) return { schema: injectedSchema, source: AssetSchemaSource.Injected };

  return { schema: getBuiltInAssetSchema(kind), source: AssetSchemaSource.BuiltIn };
}

/**
 * 由分类推出其「引擎自带 schema」文件路径
 * @param category 素材分类
 * @returns 分类自带 schema 的文件路径；分类未指定时按 `dir + '/.schema.jsonc'` 推导
 */
export function resolveAssetSchemaPath(category: IAssetCategory): string {
  return category.schemaPath ?? `${category.dir}/${ASSET_SCHEMA_FILE_NAME}`;
}
