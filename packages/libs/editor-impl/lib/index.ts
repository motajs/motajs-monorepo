/**
 * `.` subpath —— `@motajs/editor-impl`（默认实现层）的唯一可导入公开面。
 *
 * 默认实现层接收全部「具体编辑功能」：资源层（`./resources/*`）、编辑层（`./edit/*`）与表格
 * （`./table`）。它依赖底层 `@motajs/editor-core`；反向依赖被 `editor-core-must-not-import-editor-impl`
 * 规则禁止。
 *
 * 一律用**具名**再导出（不用 `export *`）：根 barrel 是包唯一的可导入面，导出的每个名字都会成为
 * 冻结契约。**不**再导出能力 subpath（`./code`/`./map`/`./asset`/`./shell`/`./react`）——由
 * `editor-impl-root-barrel-must-not-import-capabilities` 规则守；根 barrel 合法地再导出 `./table`
 * 的公开名（表格类型随根 `.` 暴露，`./table` 仍是空 barrel）。
 */
// 资源层叶子模块（Phase 4 D-09：`lib/resources/*` 是包内目录，公开面由本根入口汇总）。
// 一律**具名**再导出；类型经 `export type`（消费方 editor 开着 verbatimModuleSyntax）。
export type { Content, FileContent, ExecutorStatus, PersistFailure, PersistenceIntent } from './resources/types';
export type {
  ReadonlySignal,
  IContentView,
  IContentHandler,
  IDataHandler,
  IResourceView,
  ILoadableResource,
  IRecoverableResource,
  IFileHandlerManager,
  IPersistExecutor,
  IPersistenceMonitor,
  IResourceRegistry,
  FileHandlerDependencies,
  ResourceRegistryEntry,
} from './resources/interfaces';
export { isFileNotFoundError } from './resources/errors';
export { waitUntil } from './resources/waitUntil';
export { ContentUtils } from './resources/contentUtils';
export { PersistExecutor } from './resources/persistExecutor';
export { PersistenceMonitor } from './resources/persistenceMonitor';
export { FileHandler } from './resources/fileHandler';
export { FileHandlerManager } from './resources/fileHandlerManager';
export { FileResource } from './resources/fileResource';
export { DataHandler } from './resources/dataHandler';
export { JsonDataHandler } from './resources/jsonDataHandler';
export { BinaryFileHandler } from './resources/binaryFileHandler';
export { ComputedResource, aggregateResource, computedResource, optional } from './resources/combinators';
// D-18 旧名过渡别名：资源视图新名已带 `I` 前缀（D-07），旧名以纯类型别名继续导出，
// 使 `@motajs/editor` 无需改动即可编译；Phase 11 删除。
export type {
  IResourceView as ResourceView,
  ILoadableResource as LoadableResource,
  IRecoverableResource as RecoverableResource,
} from './resources/interfaces';
export { ResourceRegistry } from './resources/resourceRegistry';

// 编辑层（Phase 4 D-09：`lib/edit/*` 是包内目录，公开面由本根入口汇总）。
// 根 barrel 是每个被搬模块**导出集合并集**，绝不手挑子集——editor 的 shim 只能转发根导出的名字（D-04）。
export {
  deleteByFieldPath,
  buildFieldPath,
  fieldToDataAttr,
  getByFieldPath,
  getParentField,
  getParentFieldPath,
  getShortField,
  parseFieldPath,
  setByFieldPath,
} from './table/fieldPath';
export { applyAction, applyActions, applyActionsWithInverse } from './table/action';
export type { Action, ActionType } from './table/types';
export { compositeOperation } from './edit/operations';
export { patchResourceOperation } from './table/patchResourceOperation';

// Plan 02 的默认实现层契约：可 patch 资源的最小契约（落点 `./edit/types`）。
export type { IPatchableResource } from './edit/types';
// D-18 旧名过渡别名：编辑器靠 `PatchableResource` 继续编译，Phase 11 删除。
export type { IPatchableResource as PatchableResource } from './edit/types';
