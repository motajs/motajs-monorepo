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
  return { detach, editor, handlers, server };
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
});
