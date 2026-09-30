// SHIM(phase4)
/**
 * Action 原语（转发 shim，D-10）——真实实现已下沉至 `@motajs/editor-impl` 的 `lib/edit/action.ts`。
 * 转发根入口的全部五个名字（三个函数 + 值枚举 ActionType + 类型 Action）；Phase 11 删除本文件与其余 shim。
 */
export { applyAction, applyActions, applyActionsWithInverse } from '@motajs/editor-impl';
export { ActionType } from '@motajs/editor-impl';
export type { Action } from '@motajs/editor-impl';
