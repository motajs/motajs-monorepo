const deferredLoads = new WeakMap<object, Promise<void>>();

/**
 * Ensure an idle resource is loaded outside React's render stack.
 *
 * Several resource implementations synchronously publish their `loading`
 * state when `ensureLoaded()` is called. Deferring that call avoids notifying
 * other components while React is rendering the current one, while the returned
 * promise still gives Suspense the exact load to await.
 */
export function deferredEnsureLoaded(resource: object & { ensureLoaded(): Promise<void> }): Promise<void> {
  const pending = deferredLoads.get(resource);
  if (pending) return pending;

  const loading = Promise.resolve()
    .then(() => resource.ensureLoaded())
    .finally(() => {
      if (deferredLoads.get(resource) === loading) deferredLoads.delete(resource);
    });
  deferredLoads.set(resource, loading);
  return loading;
}
