// 表格资源的类型号与 id 约定：数据表资源 id 形如 `table.<name>`，其 schema 资源 id 形如
// `table#schema.<name>`；数据表与 schema 表共用一个资源类型号，靠 id 区分。
// 生成 id 的函数留待后续计划实现，本文件只声明类型号。

export const enum TableResourceType {
  /** 表格资源类型号：数据表与 schema 表共用此号 */
  Table,
}
