/**
 * `.` subpath —— `@motajs/editor-core`（底层）的唯一可导入公开面。
 *
 * 底层只做两件事：**定义接口**（`./ports/*`）与**做管理**（`./kernel/*`）。默认实现（资源层、
 * 编辑层、表格、四种编辑能力与 `react` 层）已整体迁入默认实现包，因此本文件不再引用已不在本包的
 * 资源层与编辑层目录。
 *
 * 一律用**具名**再导出（不用 `export *`）：根 barrel 是包唯一的可导入面，导出的每个名字都会成为
 * 冻结契约，具名导出让「公开面增长」这件事可见、可审（T-03-06）。本文件是叶子节点：内核与 port
 * 文件**不得** import `../index`（会形成环，`no-circular` 会拒绝）。
 */
export { createEditorCore, EDITOR_CORE_API_VERSION } from './kernel/core';

// 撤销操作栈管理器的实现（D-04/D-05）：只记操作先后、不保存快照。
// 同时以**值别名** `OperationHistory` 保留旧类名，编辑器 `new OperationHistory()` 继续可用，Phase 11 删除（D-18）。
export { UndoManager } from './kernel/undoManager';
export { UndoManager as OperationHistory } from './kernel/undoManager';

// 底层的唯一对外类型出口（D-08）：内核三接口 + 能力登记 + 诊断 + 撤销契约类型都来自 `./kernel/types`。
export type {
  AppliedOperation,
  CapabilityRef,
  CapabilityRegistrar,
  Diagnostic,
  DiagnosticBus,
  EditorCore,
  EditorCoreConfig,
  EditorOperation,
  IEditorOperation,
  IUndoManager,
  OperationHistoryEntry,
  OperationHistoryState,
  OperationMeta,
  RegisterCapabilityOptions,
  RegisterCapabilityResult,
} from './kernel/types';
// 诊断级别是数字枚举（D-06），按**值**导出，供消费者比较 `severity`。
export { DiagnosticSeverity } from './kernel/types';
export { createDiagnosticBus, DIAGNOSTIC_CODES } from './kernel/diagnostics';
export type { DiagnosticCode } from './kernel/diagnostics';
export { EditorCoreStartupError } from './kernel/errors';

// ports 层类型出口（D-07）：四个契约 + 资源描述符类型都来自 `./ports/types`。
export type {
  EngineDescription,
  IEngineAdapter,
  IFsPort,
  IHostPort,
  IPreviewAdapter,
  PreloadStrategy,
  ResourceDependencies,
  ResourceDescriptor,
} from './ports/types';

// D-18 旧名过渡别名：四个端口的新名已带 `I` 前缀（D-07），旧名以纯类型别名继续导出，
// 使 `@motajs/editor` 无需改动即可编译；Phase 11 删除。
export type {
  IEngineAdapter as EngineAdapter,
  IFsPort as FsPort,
  IHostPort as HostPort,
  IPreviewAdapter as PreviewAdapter,
} from './ports/types';

// Phase 5 适配器契约（D-03/D-04/D-05/D-09）：`./ports/engine` 是引擎无关**逻辑/值**的唯一落点。
// 一律具名再导出；值面与类型面分开，`isValidResourceId`/`RESERVED_IDS` 由底层自持并被默认实现层反向引用。
export {
  defineEngine,
  ENGINE_ADAPTER_API_VERSION,
  EngineDefinitionError,
  isValidResourceId,
  RESERVED_IDS,
  resolvePreloadOrder,
} from './ports/engine';
