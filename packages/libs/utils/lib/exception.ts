export function tryDo<R>(fn: () => R): R | undefined;
export function tryDo<R, C>(fn: () => R, onError?: (e: unknown) => C): R | C;
export function tryDo<R, C>(fn: () => R, onError?: (e: unknown) => C) {
  try {
    return fn();
  } catch (e) {
    return onError?.(e);
  }
}
