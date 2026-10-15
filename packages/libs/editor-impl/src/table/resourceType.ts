// 表格的路径约定：数据文件为 `xxx.json` / `xxx.jsonc`，schema 文件为 `xxx.schema.json` /
// `xxx.schema.jsonc`（把 `.schema` 插在扩展名前）。表格面板目标只给数据文件路径，schema 路径一律
// 由此推导、不单独存储（D-14 / D-15）。本模块只做纯字符串推导，越界由注入的文件系统负责。

/**
 * 判断一个路径是否为 schema 约定文件
 * @param path 相对项目根、以 `/` 分隔、无前导斜线的文件路径
 * @returns 以 `.schema.json` 或 `.schema.jsonc` 结尾时为 true
 */
export function isSchemaPath(path: string): boolean {
  return path.endsWith('.schema.json') || path.endsWith('.schema.jsonc');
}

/**
 * 由数据文件路径推导其 schema 文件路径：把 `.schema` 插在扩展名前
 * @param dataPath 数据文件的相对路径
 * @returns schema 文件路径；入参本身已是 schema 路径时原样返回
 */
export function deriveSchemaPath(dataPath: string): string {
  if (isSchemaPath(dataPath)) return dataPath;
  if (dataPath.endsWith('.jsonc')) return `${dataPath.slice(0, -'.jsonc'.length)}.schema.jsonc`;
  if (dataPath.endsWith('.json')) return `${dataPath.slice(0, -'.json'.length)}.schema.json`;

  return `${dataPath}.schema.json`;
}

/**
 * 判断一个路径是否可作为表格打开的数据文件
 * @param path 相对项目根、以 `/` 分隔、无前导斜线的文件路径
 * @returns 扩展名为 `json` / `jsonc` 且不是 schema 约定文件时为 true
 */
export function isTableDataPath(path: string): boolean {
  if (isSchemaPath(path)) return false;

  return path.endsWith('.json') || path.endsWith('.jsonc');
}
