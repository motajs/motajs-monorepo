// SHIM(phase4)
/**
 * 操作历史（转发 shim，D-10）——`OperationHistory` 类与两个状态类型已下沉至 `@motajs/editor-core`
 * 的 `lib/edit/operationHistory.ts`。
 *
 * 实例**不来自 core**：core 只导出 class（D-06），编辑器的唯一实例由 `@/appInstances` 构造并在此转发（D-07）。
 * 刻意**不**用 `export * from '@motajs/editor-core'`——core 的 class 与本文件的 `operationHistory` 实例会
 * 共用一个说明符。Phase 11 删除本文件与其余 shim。
 */
export { OperationHistory } from '@motajs/editor-core';
export type { OperationHistoryEntry, OperationHistoryState } from '@motajs/editor-core';
export { operationHistory } from '@/appInstances';
