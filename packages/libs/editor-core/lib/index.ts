// `.` subpath —— `@motajs/editor-core`（底层）的唯一可导入公开面
// 底层只做两件事：定义接口（`./ports`）与做管理（`./kernel`）；默认实现（资源层、编辑层、
// 表格、四种编辑能力与 `react` 层）已整体迁入默认实现包，因此本文件不再引用那些目录
// 根 barrel 只再导出**子目录**一层（`./kernel`/`./ports`），每个子目录各有自己的 `index.ts`；
// 一律 `export *`，不逐个列导出名、不跨目录深路径转发
// 本文件是叶子节点：内核与 port 文件不得 import `../index`（会形成环，`no-circular` 会拒绝）
export * from './kernel';
export * from './ports';

// D-18 旧名过渡别名：四个端口的新名已带 `I` 前缀（D-07），旧名以纯类型别名继续导出，
// 使 `@motajs/editor` 无需改动即可编译；Phase 11 删除
export type {
  IEngineAdapter as EngineAdapter,
  IFsPort as FsPort,
  IHostPort as HostPort,
  IPreviewAdapter as PreviewAdapter,
} from './ports';
// 撤销管理器以**值别名** `OperationHistory` 保留旧类名，编辑器 `new OperationHistory()` 继续可用；Phase 11 删除
export { UndoManager as OperationHistory } from './kernel';
