import { Dispatch, SetStateAction, useMemo, useState } from "react";
import { calValue } from "@/utils/common";
import { State } from "@/utils/type";
import { useCurrentFn, useForceUpdate } from "./common";

export const useStatic = <T>(initializer: () => T) => {
  const [data] = useState(initializer);
  return data;
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
