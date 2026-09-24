// SHIM(phase4)
/**
 * 操作契约（转发 shim，D-10）——`compositeOperation` / `operationPathTarget` / `patchResourceOperation`
 * 与四个操作类型已下沉至 `@motajs/editor-core` 的 `lib/edit/operations.ts`。
 *
 * 视口操作（`navigateFloorOperation` 等）**不在此转发**：它们留在 editor 的 `./viewportOperations`（D-02）。
 * Phase 11 删除本文件与其余 shim。
 */
export { compositeOperation, operationPathTarget, patchResourceOperation } from '@motajs/editor-core';
export type { AppliedOperation, EditorOperation, OperationMeta, OperationTarget } from '@motajs/editor-core';
