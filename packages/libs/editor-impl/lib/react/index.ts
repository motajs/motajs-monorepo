import { useStore } from '@tanstack/react-store';
import type { OperationHistory, OperationHistoryEntry } from '../edit/operationHistory';

export { CoreProbe } from './CoreProbe';

/**
 * 订阅某个 `OperationHistory` 实例（D-11）。core 只接受实例，不持有任何实例——编辑器在
 * `src/appInstances.ts` 构造唯一实例并用零参包装 hook 绑定它。
 *
 * 选择器刻意每次返回**新对象**，不做 shallow 比较、不手动记忆化：现有渲染次数就是针对
 * 「每次分配新对象」标定的，编辑器开着 React Compiler，自行处理记忆化。
 */
export function useOperationHistory(history: OperationHistory): {
  entries: OperationHistoryEntry[];
  current: number;
  busy: boolean;
} {
  return useStore(history.store, (state) => ({
    entries: state.entries.map(({ id, label, timestamp, paths }) => ({
      id,
      label,
      timestamp,
      paths,
    })),
    current: state.current,
    busy: state.busy,
  }));
}
