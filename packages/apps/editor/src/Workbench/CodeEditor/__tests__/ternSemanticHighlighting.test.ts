import type { Editor } from "codemirror";
import { describe, expect, it, vi } from "vitest";
import { attachTernSemanticHighlighting, classifyTernType } from "../utils/ternSemanticHighlighting";
import type { TernServerInstance } from "../utils/createTernServer";

describe("Tern semantic highlighting", () => {
  it.each([
    ["fn(value: number) -> string", "function"],
    ["number", "number"],
    ["string", "string"],
    ["bool", "boolean"],
    ["[number]", "array"],
    ["core", "object"],
    ["number|string", "union"],
  ] as const)("classifies %s as %s", (type, expected) => {
    expect(classifyTernType(type)).toBe(expected);
  });

  it("does not color unknown inference results", () => {
    expect(classifyTernType("?")).toBeUndefined();
    expect(classifyTernType(undefined)).toBeUndefined();
  });

  it("queries all visible identifiers in one batch", async () => {
    vi.useFakeTimers();
    const handlers = new Map<string, () => void>();
    const editor = {
      getViewport: () => ({ from: 0, to: 1 }),
      lineCount: () => 1,
      getLineTokens: () => [
        { start: 0, end: 5, string: "flyTo", type: "def" },
        { start: 6, end: 11, string: "count", type: "variable" },
      ],
      getRange: (from: { ch: number }, to: { ch: number }) => from.ch === 0 && to.ch === 5 ? "flyTo" : "count",
      markText: vi.fn(() => ({ clear: vi.fn() })),
      operation: (callback: () => void) => callback(),
      on: (name: string, handler: () => void) => handlers.set(name, handler),
      off: (name: string) => handlers.delete(name),
    } as unknown as Editor;
    const request = vi.fn((_editor, _query, callback) => callback(undefined, {
      types: ["fn()", "number"],
    }));
    const detach = attachTernSemanticHighlighting({
      editor,
      server: { request } as unknown as TernServerInstance,
      enabled: () => true,
    });

    await vi.runAllTimersAsync();

    expect(request).toHaveBeenCalledTimes(1);
    expect(request.mock.calls[0][1]).toMatchObject({
      type: "semanticTypes",
      positions: [{ line: 0, ch: 5 }, { line: 0, ch: 11 }],
      fullDocs: true,
    });
    expect(editor.markText).toHaveBeenCalledTimes(2);
    detach();
    vi.useRealTimers();
  });

  it("throttles continuous viewport changes instead of waiting for scrolling to stop", async () => {
    vi.useFakeTimers();
    const handlers = new Map<string, () => void>();
    const editor = {
      getViewport: () => ({ from: 0, to: 1 }),
      lineCount: () => 1,
      getLineTokens: () => [
        { start: 0, end: 5, string: "flyTo", type: "def" },
      ],
      getRange: () => "flyTo",
      markText: vi.fn(() => ({ clear: vi.fn() })),
      operation: (callback: () => void) => callback(),
      on: (name: string, handler: () => void) => handlers.set(name, handler),
      off: (name: string) => handlers.delete(name),
    } as unknown as Editor;
    const request = vi.fn((_editor, _query, callback) => callback(undefined, {
      types: ["fn()"],
    }));
    const detach = attachTernSemanticHighlighting({
      editor,
      server: { request } as unknown as TernServerInstance,
      enabled: () => true,
    });
    await vi.runAllTimersAsync();

    handlers.get("viewportChange")?.();
    await vi.advanceTimersByTimeAsync(20);
    handlers.get("viewportChange")?.();
    await vi.advanceTimersByTimeAsync(12);

    expect(request).toHaveBeenCalledTimes(2);
    detach();
    vi.useRealTimers();
  });

  it("keeps the previous semantic marks while a debounced edit is being checked", async () => {
    vi.useFakeTimers();
    const handlers = new Map<string, () => void>();
    const clear = vi.fn();
    const editor = {
      getViewport: () => ({ from: 0, to: 1 }),
      lineCount: () => 1,
      getLineTokens: () => [
        { start: 0, end: 5, string: "flyTo", type: "def" },
      ],
      getRange: () => "flyTo",
      markText: vi.fn(() => ({ clear })),
      operation: (callback: () => void) => callback(),
      on: (name: string, handler: () => void) => handlers.set(name, handler),
      off: (name: string) => handlers.delete(name),
    } as unknown as Editor;
    const request = vi.fn((_editor, _query, callback) => callback(undefined, {
      types: ["fn()"],
    }));
    const detach = attachTernSemanticHighlighting({
      editor,
      server: { request } as unknown as TernServerInstance,
      enabled: () => true,
    });
    await vi.runAllTimersAsync();

    handlers.get("change")?.();
    await vi.advanceTimersByTimeAsync(100);
    expect(clear).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(80);
    expect(clear).toHaveBeenCalledTimes(1);
    detach();
    vi.useRealTimers();
  });

  it("clears old marks and re-queries after swapping Docs", async () => {
    vi.useFakeTimers();
    const handlers = new Map<string, () => void>();
    const clear = vi.fn();
    const editor = {
      getViewport: () => ({ from: 0, to: 1 }),
      lineCount: () => 1,
      getLineTokens: () => [{ start: 0, end: 5, string: "flyTo", type: "def" }],
      getRange: () => "flyTo",
      markText: vi.fn(() => ({ clear })),
      operation: (callback: () => void) => callback(),
      on: (name: string, handler: () => void) => handlers.set(name, handler),
      off: (name: string) => handlers.delete(name),
    } as unknown as Editor;
    const request = vi.fn((_editor, _query, callback) => callback(undefined, {
      types: ["fn()"],
    }));
    const detach = attachTernSemanticHighlighting({
      editor,
      server: { request } as unknown as TernServerInstance,
      enabled: () => true,
    });
    await vi.runAllTimersAsync();

    handlers.get("swapDoc")?.();
    await vi.runAllTimersAsync();

    expect(clear).toHaveBeenCalled();
    expect(request).toHaveBeenCalledTimes(2);
    detach();
    vi.useRealTimers();
  });
});
