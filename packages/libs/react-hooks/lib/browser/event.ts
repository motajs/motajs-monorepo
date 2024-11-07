import { useEffect } from "react";
import { useCurrentFn } from "@/core/common";

export interface IEventTarget<M> {
  addEventListener<K extends keyof M>(type: K, listener: (ev: M[K]) => void, options?: boolean | AddEventListenerOptions): void;
  removeEventListener<K extends keyof M>(type: K, listener: (ev: M[K]) => void, options?: boolean | EventListenerOptions): void;
}

export const createUseEvent = <M>() => {
  const useEvent = <K extends keyof M>(target: IEventTarget<M>, type: K, listener: (ev: M[K]) => void, options?: AddEventListenerOptions) => {
    const currentListener = useCurrentFn(listener);

    useEffect(() => {
      target.addEventListener(type, currentListener, options);
      return () => target.removeEventListener(type, currentListener);
    }, [target, type]);
  };
  return useEvent;
};

export const useWindowEvent = createUseEvent<WindowEventMap>();
export const useHTMLElementEvent = createUseEvent<HTMLElementEventMap>();
export const useServiceWorkerContainerEvent = createUseEvent<ServiceWorkerContainerEventMap>();
