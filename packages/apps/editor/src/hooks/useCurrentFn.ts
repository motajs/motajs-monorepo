import { useRefFrom } from "./useRefFrom";
import { useCallback } from "react";

export const useCurrentFn = <A extends unknown[], R>(fn: (...args: A) => R) => {
  const fnRef = useRefFrom(fn);
  return useCallback((...args: A) => fnRef.current(...args), [fnRef]);
}
