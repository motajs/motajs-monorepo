/**
 * 零参 `useOperationHistory` —— 把 core 的 `useOperationHistory(history)` 绑定到编辑器的唯一实例（D-11）。
 *
 * 两个调用点（`AppTopBar.tsx`、`PanelSlot.tsx`）继续以同样的零参名字从 `@/project/history` 导入。
 */
import { useOperationHistory as useCoreUseOperationHistory } from '@motajs/editor-core/react';
import type { OperationHistoryEntry } from '@motajs/editor-core';
import { operationHistory } from '@/appInstances';

export function useOperationHistory(): {
  entries: OperationHistoryEntry[];
  current: number;
  busy: boolean;
} {
  return useCoreUseOperationHistory(operationHistory);
}
