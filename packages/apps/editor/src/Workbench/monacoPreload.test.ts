import { afterEach, describe, expect, it, vi } from "vitest";

const preloadRuntime = vi.hoisted(() => vi.fn(async () => undefined));
vi.mock("@motajs/react-monaco-editor", () => ({ preloadMonacoRuntime: preloadRuntime }));

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("Monaco preload", () => {
  it("starts after the shell task and reuses one runtime promise", async () => {
    vi.useFakeTimers();
    vi.resetModules();
    preloadRuntime.mockClear();
    const { preloadMonaco, scheduleMonacoPreload } = await import("./monacoPreload");
    const cancel = scheduleMonacoPreload();
    expect(preloadRuntime).not.toHaveBeenCalled();
    await vi.runAllTimersAsync();
    await Promise.all([preloadMonaco(), preloadMonaco()]);
    expect(preloadRuntime).toHaveBeenCalledTimes(1);
    cancel();
  });
});
