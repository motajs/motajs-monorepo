/**
 * FS 层 Hooks
 *
 * 提供 FS 层的所有 React Hooks
 */

import { useMemo, useSyncExternalStore } from 'react';
import { effect } from 'alien-signals';
import type { Content } from '@/fs/types';
import type { FileHandler } from '@/fs/FileHandler';
import type { IContentHandler, ReadonlySignal } from '@/fs/interfaces';

/**
 * 订阅任何 signal
 *
 * 将 alien-signals 的 signal 绑定到 React 组件，实现自动订阅和更新
 *
 * @example
 * function MyComponent() {
 *   const handler = FileHandlerManager.get('file.txt');
 *   const content = useSignal(handler.content);
 *
 *   return match(content)
 *     .with({ status: 'loaded' }, (c) => <div>{c.value}</div>)
 *     .otherwise(() => <Loading />);
 * }
 */
export function useSignal<T>(signal: ReadonlySignal<T>): T {
  return useSyncExternalStore(
    (callback) =>
      effect(() => {
        signal(); // 调用函数触发依赖追踪
        callback();
      }),
    () => signal(), // 调用函数获取值
    () => signal(), // 调用函数获取值
  );
}

export type UpdateFn<T> = {
  (value: T): void;
  (transform: (current: T) => T): void;
  (transform: (current: T) => Promise<T>): Promise<void>;
};

export function useHandlerUpdate<T>(handler: IContentHandler<T>): UpdateFn<T> {
  // useCallback(handler.update.bind(handler), [handler]) 的等价写法：useCallback(fn, deps) 本就是
  // useMemo(() => fn, deps)，返回值与依赖完全一致。因 UpdateFn 是重载类型，内联转发函数无法
  // 无断言地满足全部重载，故用值记忆形式表达。
  return useMemo(() => handler.update.bind(handler), [handler]);
}

/**
 * 订阅 FileHandler（可写）
 *
 * @example
 * function FileEditor({ path }: { path: string }) {
 *   const handler = FileHandlerManager.get(path);
 *   const [content, update] = useFileHandler(handler);
 *   // ...
 * }
 */
export function useFileHandler(handler: FileHandler): [Content<string>, UpdateFn<string>] {
  const content = useSignal(handler.content);
  return [content, useHandlerUpdate(handler)];
}
