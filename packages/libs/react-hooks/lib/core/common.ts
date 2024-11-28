import { useEffect, useMemo, useReducer, useRef, useState, useSyncExternalStore } from "react";

export const useRefFrom = <S>(source: S) => {
  const ref = useRef(source);
  ref.current = source;

  return ref;
};

export const useCurrentFn = <A extends unknown[], R>(fn: (...args: A) => R) => {
  const fnRef = useRefFrom(fn);

  return (...args: A) => fnRef.current(...args);
};

const updater = (x: number) => x + 1;

export const useForceUpdate = () => {
  const [_, forceUpdate] = useReducer(updater, 0);

  return forceUpdate;
};

export const useNode = <T>() => {
  const [node, setNode] = useState<T | null>(null);

  const mount = (val: T | null) => {
    setNode(val);
  };

  return [node, mount] as const;
};

export const useNodeAsEffect = <T>(effect: (node: T) => void | (() => void)) => {
  const [node, setNode] = useState<T | null>(null);

  useEffect(() => {
    if (node === null) return;
    return effect(node);
  }, [node]);

  return setNode;
};

export const useComputed = <T, R>(input: T, fn: (input: T) => R) => {
  return useMemo(() => fn(input), [input]);
};

export type SyncExternalStore<Snapshot> = [(onStoreChange: () => void) => () => void, () => Snapshot];

export const emptySyncExternalStore: SyncExternalStore<undefined> = [() => () => void 0, () => void 0];

export function useSyncExternalStoreFrom<Snapshot>(store: SyncExternalStore<Snapshot>): Snapshot;
export function useSyncExternalStoreFrom<Snapshot>(store?: SyncExternalStore<Snapshot>): Snapshot | undefined;
export function useSyncExternalStoreFrom<Snapshot>(store?: SyncExternalStore<Snapshot>) {
  const [subscribe, getSnapshot] = store ?? emptySyncExternalStore;
  return useSyncExternalStore(subscribe, getSnapshot);
}

export const useWatch = <T>(source: T, handler: (newValue: T, oldValue?: T) => void) => {
  const oldValueRef = useRef<T>();

  if (!Object.is(source, oldValueRef.current)) {
    handler(source, oldValueRef.current);
    oldValueRef.current = source;
  }
};
