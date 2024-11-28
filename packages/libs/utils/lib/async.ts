export const idempotentByKey = <T, R>(action: (key: T) => Promise<R>) => {
  const execuationMap = new Map<T, Promise<R>>();
  return (key: T) => {
    const prevExecuation = execuationMap.get(key);
    if (prevExecuation) return prevExecuation;
    const execuation = action(key);
    execuationMap.set(key, execuation);
    execuation.finally(() => {
      execuationMap.delete(key);
    });
    return execuation;
  };
};
