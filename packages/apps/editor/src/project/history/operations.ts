// SHIM(phase4)
/**
 * 操作契约（转发 shim，D-10）——`compositeOperation` / `patchResourceOperation` 与三个可撤销操作类型
 * 已分别下沉至 `@motajs/editor-impl` 的 `lib/edit/operations.ts`（值）与 `@motajs/editor-core`
 * 的 `lib/kernel/types.ts`（类型）。
 *
 * 视口操作（`navigateFloorOperation` 等）**不在此转发**：它们留在 editor 的 `./viewportOperations`（D-02）。
 * Phase 11 删除本文件与其余 shim。
 */
export { compositeOperation, patchResourceOperation } from '@motajs/editor-impl';
export type { AppliedOperation, EditorOperation, OperationMeta } from '@motajs/editor-core';
