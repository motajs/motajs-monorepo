import type { Editor, EditorChange } from "codemirror";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { TernServerInstance } from "../utils/createTernServer";

vi.mock("../utils/ternSemanticHighlighting", () => ({
  attachTernSemanticHighlighting: () => vi.fn(),
}));

import { attachTernEditorInteractions } from "../utils/ternEditorInteractions";

function setup() {
  const handlers = new Map<string, (...args: unknown[]) => void>();
  const wrapper = document.createElement("div");
  const editor = {
    state: {},
    getWrapperElement: () => wrapper,
    addKeyMap: vi.fn(),
    removeKeyMap: vi.fn(),
    on: vi.fn((name: string, handler: (...args: unknown[]) => void) => handlers.set(name, handler)),
    off: vi.fn((name: string) => handlers.delete(name)),
    closeHint: vi.fn(),
  } as unknown as Editor;
  const getHint = Object.assign(vi.fn(), { async: true as const });
  const server = {
    getHint,
    complete: vi.fn(),
    updateArgHints: vi.fn(),
  } as unknown as TernServerInstance;
  const detach = attachTernEditorInteractions({
    editor,
    server,
    getAutocomplete: () => true,
  });
  return { detach, editor, handlers, server, wrapper };
}

function inputChange(text: string): EditorChange {
  return { text: [text] } as EditorChange;
}

describe("Tern editor interactions", () => {
  afterEach(() => vi.useRealTimers());

  it("opens member completion from CodeMirror inputRead without relying on keyup", () => {
    const { detach, editor, handlers, server } = setup();

    handlers.get("inputRead")?.(editor, inputChange("."));

    expect(server.complete).toHaveBeenCalledWith(editor);
    detach();
  });

  it("debounces identifier completion from CodeMirror inputRead", async () => {
    vi.useFakeTimers();
    const { detach, editor, handlers, server } = setup();

    handlers.get("inputRead")?.(editor, inputChange("r"));
    expect(server.complete).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(120);
    expect(server.complete).toHaveBeenCalledWith(editor);
    detach();
  });

  it("queries hover types through the registered CodeMirror document", async () => {
    vi.useFakeTimers();
    const { detach, editor, server, wrapper } = setup();
    Object.assign(editor, {
      coordsChar: () => ({ line: 0, ch: 4 }),
      getTokenAt: () => ({ start: 0, end: 4, string: "core", type: "variable" }),
      charCoords: (position: { ch: number }) => ({
        left: 10 + position.ch * 8,
        right: 18 + position.ch * 8,
        top: 10,
        bottom: 26,
      }),
    });
    const request = vi.fn((_editor, _query, callback) => callback(undefined, {
      type: "core",
      doc: "游戏运行时 API",
    }));
    Object.assign(server, { request });

    wrapper.dispatchEvent(new MouseEvent("mousemove", { clientX: 20, clientY: 18 }));
    await vi.advanceTimersByTimeAsync(280);

    expect(request).toHaveBeenCalledWith(
      editor,
      expect.objectContaining({ type: "type", end: { line: 0, ch: 4 } }),
      expect.any(Function),
      { line: 0, ch: 4 },
    );
    expect(document.querySelector(".editorTernHoverTooltip")?.textContent).toContain("游戏运行时 API");
    detach();
  });
});
