import { useDependentState } from "@/core/state";
import { useRef, useEffect, useMemo } from "react";

export const usePromiseValue = <T>(promise: Promise<T>) => {
  const [result, setResult] = useDependentState<[undefined, true] | [T, false]>(promise, () => {
    promise.then((value) => {
      setResult([value, false]);
    });
    return [void 0, true];
  });
  return result;
};

/**
 * usePromiseValue 的逆操作：将 React state 转换为 Promise
 * 等待状态满足某个条件时 resolve
 */
export const useStateAsPromise = <T>(value: T | null | undefined) => {
  const pendingRef = useRef<[Promise<T>, (value: T) => void] | null>(null);

  useEffect(() => {
    // 当状态有值时，resolve 等待中的 Promise
    if (value != null && pendingRef.current) {
      const [, resolve] = pendingRef.current;
      resolve(value);
      pendingRef.current = null;
    }
  }, [value]);

  const waitUntil = useMemo(() => {
    if (value != null) {
      return Promise.resolve(value);
    }

    // 如果已有等待中的 Promise，复用它
    if (pendingRef.current) {
      return pendingRef.current[0];
    }

    // 创建新 Promise 并缓存
    const { promise, resolve } = Promise.withResolvers<T>();
    pendingRef.current = [promise, resolve];

    return promise;
  }, [value]);

  return waitUntil;
};
