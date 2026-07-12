/**
 * useEditorConfig - 编辑器配置 React Hooks
 *
 * 提供两种使用方式：
 * - useConfigItem(key, defaultValue) - 获取单个配置项（推荐）
 * - useEditorConfig() - 获取整个配置对象（Suspense 模式）
 */

import { useSyncExternalStore, useCallback } from "react";
import {
  editorConfigService,
  type EditorConfig,
} from "@/services/editorConfig";

/**
 * 获取单个配置项
 *
 * loading 时返回 defaultValue，无需 Suspense
 *
 * @param key 配置键
 * @param defaultValue 默认值
 * @returns [value, setValue] 元组
 *
 * @example
 * ```tsx
 * function FontSizeControl() {
 *   const [fontSize, setFontSize] = useConfigItem('fontSize', 14);
 *   return (
 *     <input
 *       type="number"
 *       value={fontSize}
 *       onChange={e => setFontSize(Number(e.target.value))}
 *     />
 *   );
 * }
 * ```
 */
export function useConfigItem<T>(
  key: string,
  defaultValue: T,
): [T, (value: T) => void] {
  const config = useSyncExternalStore(
    editorConfigService.subscribe,
    editorConfigService.getSnapshot,
  );

  const value = config === null ? defaultValue : ((config[key] as T) ?? defaultValue);

  const setValue = useCallback(
    (newValue: T) => {
      editorConfigService.set(key, newValue);
    },
    [key],
  );

  return [value, setValue];
}

/**
 * 获取整个配置对象
 *
 * 在 Suspense 边界内使用，loading 时会挂起
 *
 * @returns 配置对象
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const config = useEditorConfig();
 *   return <div>Theme: {config.theme}</div>;
 * }
 *
 * // 使用时需要包裹 Suspense
 * <Suspense fallback={<Loading />}>
 *   <MyComponent />
 * </Suspense>
 * ```
 */
export function useEditorConfig(): EditorConfig {
  const config = useSyncExternalStore(
    editorConfigService.subscribe,
    editorConfigService.getSnapshot,
  );

  if (config === null) {
    throw editorConfigService.waitForLoaded(); // Suspense: 抛 Promise
  }

  return config;
}
