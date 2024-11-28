import { useDependentState } from "@/core/state";

export const usePromiseValue = <T>(promise: Promise<T>) => {
  const [result, setResult] = useDependentState<[undefined, true] | [T, false]>(promise, () => {
    promise.then((value) => {
      setResult([value, false]);
    });
    return [void 0, true];
  });
  return result;
};
