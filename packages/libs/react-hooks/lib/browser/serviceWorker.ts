import { useMemo, useState } from "react";
import { useOnCreate, usePromiseValue } from "@motajs/react-hooks";
import { useServiceWorkerContainerEvent } from "./event";

export const useServiceWorker = (path: string, options?: RegistrationOptions) => {
  useOnCreate(() => {
    window.navigator.serviceWorker.register(path, options);
  });

  const [controller, setController] = useState(navigator.serviceWorker.controller);

  useServiceWorkerContainerEvent(navigator.serviceWorker, "controllerchange", () => {
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
