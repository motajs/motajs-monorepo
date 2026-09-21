import { useEffect, useMemo, useState } from 'react';
import { usePromiseValue } from '@motajs/react-hooks';
import { useServiceWorkerContainerEventAsEffect } from './event';

export const useServiceWorker = (path: string, options?: RegistrationOptions) => {
  useEffect(() => {
    void window.navigator.serviceWorker.register(path, options).catch((error) => {
      console.error('Failed to register Service Worker', error);
    });
  }, [path, options?.scope, options?.type, options?.updateViaCache]);

  const [controller, setController] = useState(navigator.serviceWorker.controller);

  useServiceWorkerContainerEventAsEffect(navigator.serviceWorker, 'controllerchange', () => {
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
