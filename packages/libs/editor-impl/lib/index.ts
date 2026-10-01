// `.` subpath —— `@motajs/editor-impl`（默认实现层）的唯一可导入公开面
// 默认实现层接收全部「具体编辑功能」：资源层（`./resources`）、编辑层（`./edit`）与表格（`./table`）
// 根 barrel 只再导出**子目录**一层，每个子目录各有自己的 `index.ts`；一律 `export *`，
// 不逐个列导出名、不跨目录深路径转发
// 不再导出能力 subpath（`./code`/`./map`/`./asset`/`./shell`/`./react`）——由
// `editor-impl-root-barrel-must-not-import-capabilities` 规则守
export * from './resources';
export * from './edit';
export * from './table';

// D-18 旧名过渡别名：资源视图新名已带 `I` 前缀（D-07），旧名以纯类型别名继续导出，
// 使 `@motajs/editor` 无需改动即可编译；Phase 11 删除
export type {
  IResourceView as ResourceView,
  ILoadableResource as LoadableResource,
  IRecoverableResource as RecoverableResource,
} from './resources';
export type { IPatchableResource as PatchableResource } from './edit';
