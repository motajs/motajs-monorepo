export const combine = <A extends unknown[], M, R>(fn1: (...args: A) => M, fn2: (arg: M) => R) => {
  return (...args: A) => {
    const arg = fn1(...args);
    return fn2(arg);
  };
};
