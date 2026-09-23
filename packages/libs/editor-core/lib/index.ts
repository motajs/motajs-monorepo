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
