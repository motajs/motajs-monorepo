/**
 * Signal 相关工具函数
 */

import { effect } from "alien-signals";

/**
 * 等待条件满足
 *
 * @param predicate 判断条件（内部读取 signal），返回 true 时 Promise resolve
 * @returns Promise，在条件满足时 resolve
 *
 * @example
 * ```ts
 * const status = signal<'idle' | 'loading'>('idle');
 * await waitUntil(() => status() === 'idle');
 * ```
 */
export function waitUntil(predicate: () => boolean): Promise<void> {
  // 如果当前值已经满足条件，立即返回
  if (predicate()) {
    return Promise.resolve();
  }

  // 等待条件满足
  return new Promise((resolve) => {
    const unsubscribe = effect(() => {
      if (predicate()) {
        unsubscribe();
        resolve();
      }
    });
  });
}
