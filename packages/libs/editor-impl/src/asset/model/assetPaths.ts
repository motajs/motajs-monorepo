// 素材的目录 / 文件命名约定：分类列表文件名、分类自带 schema 文件名，以及「保留旧文件」的改名后缀。
// 后续实现（列表读写 / schema 解析 / 转码改名）统一从这里取，避免各写各的字符串。

/** 每个分类目录下列表文件的固定名 */
export const ASSET_LIST_FILE_NAME = '.list.jsonc';

/** 分类目录下「引擎自带 schema」的固定名 */
export const ASSET_SCHEMA_FILE_NAME = '.schema.jsonc';

/** 不覆盖旧文件时旧文件的改名后缀 */
export const ASSET_ORIGIN_SUFFIX = '-origin';
