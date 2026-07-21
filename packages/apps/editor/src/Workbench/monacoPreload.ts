let preloadTask: Promise<void> | undefined;

export function preloadMonaco(): Promise<void> {
  preloadTask ??= import("@motajs/react-monaco-editor")
    .then((module) => module.preloadMonacoRuntime());
  return preloadTask;
}

interface BackgroundScheduler {
  postTask(callback: () => void, options: { priority: "background" }): Promise<unknown>;
}

export function scheduleMonacoPreload(): () => void {
  let cancelled = false;
  const start = () => {
    if (cancelled) return;
    void preloadMonaco().catch((error) => console.debug("Monaco preload failed", error));
  };
  const scheduler = (globalThis as { scheduler?: BackgroundScheduler }).scheduler;
  if (scheduler?.postTask) {
    void scheduler.postTask(start, { priority: "background" });
    return () => {
      cancelled = true;
    };
  }
  if (typeof requestIdleCallback === "function") {
    const handle = requestIdleCallback(start, { timeout: 2_000 });
    return () => {
      cancelled = true;
      cancelIdleCallback(handle);
    };
  }
  const handle = window.setTimeout(start, 0);
  return () => {
    cancelled = true;
    window.clearTimeout(handle);
  };
}
