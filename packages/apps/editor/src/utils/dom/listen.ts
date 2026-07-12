export const listenOnce = async <T extends keyof HTMLElementEventMap>(elm: HTMLElement, type: T) => {
  const { promise, resolve } = Promise.withResolvers<HTMLElementEventMap[T]>();
  const listener = (e: HTMLElementEventMap[T]) => {
    resolve(e);
    elm.removeEventListener(type, listener);
  };
  elm.addEventListener(type, listener);
  return promise;
};
