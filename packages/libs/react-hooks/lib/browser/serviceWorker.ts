import { useMemo, useState } from "react";
import { useOnCreate, usePromiseValue } from "@motajs/react-hooks";
import { useServiceWorkerContainerEventAsEffect } from "./event";

export const useServiceWorker = (path: string, options?: RegistrationOptions) => {
  useOnCreate(() => {
    window.navigator.serviceWorker.register(path, options);
  });

  const [controller, setController] = useState(navigator.serviceWorker.controller);

  useServiceWorkerContainerEventAsEffect(navigator.serviceWorker, "controllerchange", () => {
    setController(navigator.serviceWorker.controller);
  });

  const controllerReady = useMemo(() => navigator.serviceWorker.ready, []);

  const [registration, isLoading] = usePromiseValue(controllerReady);

  return {
    controller,
    registration,
    ready: controllerReady,
    isReady: !isLoading,
  };
};
