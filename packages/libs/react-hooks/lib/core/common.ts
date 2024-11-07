import { calValue } from "@/utils/common";
import { Dispatch, SetStateAction, useEffect, useMemo, useReducer, useRef, useState, useSyncExternalStore } from "react";
import { State } from "../utils/type";

export const useStatic = <T>(initializer: () => T) => {
  const [data] = useState(initializer);
  return data;
};

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

export const useSetStateWithOnChange = <S>(setState: Dispatch<SetStateAction<S>>, onChange: (value: S) => void): Dispatch<SetStateAction<S>> => {
  return useCurrentFn((value) => {
    setState((prev) => {
      const newValue = calValue(value, prev);
      if (!Object.is(newValue, prev)) {
        onChange(newValue);
      }
      return newValue;
    });
  });
};

export const useDependentState = <S>(dep: unknown, initialState: S | (() => S)): State<S> => {
  const forceUpdate = useForceUpdate();

  const [stateRef, setState] = useMemo(() => {
    const stateRef = { current: calValue(initialState) };

    const setState: Dispatch<SetStateAction<S>> = (value) => {
      const newValue = calValue(value, stateRef.current);
      if (!Object.is(newValue, stateRef.current)) {
        stateRef.current = newValue;
        forceUpdate();
      }
    };

    return [stateRef, setState];
  }, [dep]);

  return [stateRef.current, useCurrentFn(setState)];
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

export type SyncExternalStore<Snapshot> = [(onStoreChange: () => void) => () => void, () => Snapshot];

export const emptySyncExternalStore: SyncExternalStore<undefined> = [() => () => void 0, () => void 0];

export function useSyncExternalStoreFromMemo<Snapshot>(store: SyncExternalStore<Snapshot>): Snapshot;
export function useSyncExternalStoreFromMemo<Snapshot>(store?: SyncExternalStore<Snapshot>): Snapshot | undefined;
export function useSyncExternalStoreFromMemo<Snapshot>(store?: SyncExternalStore<Snapshot>) {
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
