import { useEffect, useMemo } from "react";
import { useCurrentFn, useSyncExternalStoreFrom } from "@/core/common";

export interface IEventTarget<M> {
  addEventListener<K extends keyof M>(type: K, listener: (ev: M[K]) => void, options?: boolean | AddEventListenerOptions): void;
  removeEventListener<K extends keyof M>(type: K, listener: (ev: M[K]) => void, options?: boolean | EventListenerOptions): void;
}

export const createUseEvent = <M>() => {
  const useEvent = <K extends keyof M, R>(target: IEventTarget<M>, type: K, mapFn: (target: IEventTarget<M>) => R, options?: AddEventListenerOptions): R => {
    const currentGetSnapshot = useCurrentFn(mapFn);

    return useSyncExternalStoreFrom(useMemo(() => {
      return [
        (onStoreChange) => {
          target.addEventListener(type, onStoreChange, options);
          return () => target.removeEventListener(type, onStoreChange);
        },
        () => currentGetSnapshot(target),
      ];
    }, [target, type]));
  };
  return useEvent;
};

export const useWindowEvent = createUseEvent<WindowEventMap>();
export const useHTMLElementEvent = createUseEvent<HTMLElementEventMap>();
export const useServiceWorkerEvent = createUseEvent<ServiceWorkerContainerEventMap>();

export const createUseEventAsEffect = <M>() => {
  const useEventAsEffect = <K extends keyof M>(target: IEventTarget<M>, type: K, listener: (ev: M[K]) => void, options?: AddEventListenerOptions) => {
    const currentListener = useCurrentFn(listener);

    useEffect(() => {
      target.addEventListener(type, currentListener, options);
      return () => target.removeEventListener(type, currentListener);
    }, [target, type]);
  };
  return useEventAsEffect;
};

export const useWindowEventAsEffect = createUseEventAsEffect<WindowEventMap>();
export const useHTMLElementEventAsEffect = createUseEventAsEffect<HTMLElementEventMap>();
export const useServiceWorkerContainerEventAsEffect = createUseEventAsEffect<ServiceWorkerContainerEventMap>();
