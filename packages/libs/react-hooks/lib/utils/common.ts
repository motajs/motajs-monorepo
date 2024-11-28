import { isFunction } from "lodash-es";

export const calValue = <A extends unknown[], R>(fn: R | ((...args: A) => R), ...args: A): R => {
  if (isFunction(fn)) return fn(...args);
  return fn;
};
