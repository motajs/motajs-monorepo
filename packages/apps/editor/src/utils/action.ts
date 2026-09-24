// SHIM(phase4)
/**
 * Action 原语（转发 shim，D-10）——真实实现已下沉至 `@motajs/editor-core` 的 `lib/edit/action.ts`。
 * 转发 core 根入口的全部五个名字（三个函数 + 两个类型）；Phase 11 删除本文件与其余 shim。
 */
export { applyAction, applyActions, applyActionsWithInverse } from '@motajs/editor-core';
export type { Action, ActionType } from '@motajs/editor-core';
