/**
 * `.` subpath —— `@motajs/editor-core` 的唯一可导入公开面。
 *
 * Phase 3 让它成为一个**真实的公开聚合**：再导出内核（`./kernel/*`）的公开名与四个 port 契约
 * （`./ports/index`）。刻意**不**再导出任何能力 subpath（`./code`、`./table`、`./map`、`./asset`、
 * `./shell`、`./react`）——顶层 barrel 把每个 subpath 都拉进来会反转 D-06 的单向依赖 DAG
 * （PITFALLS §16 反模式）。
 *
 * 一律用**具名**再导出（不用 `export *`）：根 barrel 是包唯一的可导入面，导出的每个名字都会成为
 * 冻结契约，具名导出让「公开面增长」这件事可见、可审（T-03-06）。本文件是叶子节点：内核与 port
 * 文件**不得** import `../index`（会形成环，`no-circular` 会拒绝）。
 */
export { createEditorCore, EDITOR_CORE_API_VERSION } from './kernel/core';
export type { EditorCore, EditorCoreConfig, CapabilityRegistrar } from './kernel/core';
export type { CapabilityRef, RegisterCapabilityOptions, RegisterCapabilityResult } from './kernel/registry';
export { createDiagnosticBus, DIAGNOSTIC_CODES } from './kernel/diagnostics';
export type { Diagnostic, DiagnosticSeverity, DiagnosticBus, DiagnosticCode } from './kernel/diagnostics';
export { EditorCoreStartupError } from './kernel/errors';
export type { EngineAdapter, FsPort, HostPort, PreviewAdapter } from './ports/index';

// Phase 5 适配器契约（D-03/D-04/D-05/D-09）：`./ports/engine` 是引擎无关契约的唯一落点。
// 一律具名再导出；值面与类型面分开，`isValidResourceId` 在此与其在 `resourceRegistry.ts` 的定义共用同一谓词。
export { defineEngine, ENGINE_ADAPTER_API_VERSION, EngineDefinitionError, isValidResourceId } from './ports/engine';
export type {
  EngineDescription,
  PreloadStrategy,
  ResourceDependencies,
  ResourceDescriptor,
} from './ports/engine';

// 资源层叶子模块（Phase 4 D-09：`lib/resources/*` 是包内目录，公开面由本根入口汇总）。
// 与上面一致，一律**具名**再导出；类型经 `export type`（消费方 editor 开着 verbatimModuleSyntax）。
export type { Content, FileContent } from './resources/types';
export type {
  ReadonlySignal,
  IContentView,
  IContentHandler,
  IDataHandler,
  RecoverableResource,
} from './resources/interfaces';
export { isFileNotFoundError } from './resources/errors';
export { waitUntil } from './resources/waitUntil';
export { ContentUtils } from './resources/contentUtils';
export { PersistExecutor } from './resources/persistExecutor';
export type { PersistenceIntent, ExecutorStatus } from './resources/persistExecutor';
export { PersistenceMonitor } from './resources/persistenceMonitor';
export type { PersistFailure } from './resources/persistenceMonitor';
export { FileHandler } from './resources/fileHandler';
export type { FileHandlerDependencies } from './resources/fileHandler';
export { FileHandlerManager } from './resources/fileHandlerManager';
export { DataHandler } from './resources/dataHandler';
export { JsonDataHandler } from './resources/jsonDataHandler';
export { BinaryFileHandler } from './resources/binaryFileHandler';
export { ComputedResource, aggregateResource, computedResource, optional } from './resources/combinators';
export type { LoadableResource, ResourceView } from './resources/combinators';
export { ResourceRegistry } from './resources/resourceRegistry';
export type { ResourceRegistryEntry } from './resources/resourceRegistry';

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
} from './edit/fieldPath';
export { applyAction, applyActions, applyActionsWithInverse } from './edit/action';
export type { Action, ActionType } from './edit/action';
export { compositeOperation, operationPathTarget, patchResourceOperation } from './edit/operations';
export type {
  AppliedOperation,
  EditorOperation,
  OperationMeta,
  OperationTarget,
  PatchableResource,
} from './edit/operations';
export type { UndoSystem } from './edit/undoSystem';
export { OperationHistory } from './edit/operationHistory';
export type { OperationHistoryEntry, OperationHistoryState } from './edit/operationHistory';
