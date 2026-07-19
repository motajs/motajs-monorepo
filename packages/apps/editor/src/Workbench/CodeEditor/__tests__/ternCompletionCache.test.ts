import type CodeMirror from "codemirror";
import { describe, expect, it, vi } from "vitest";
import { createLocallyFilteredHint } from "../utils/ternCompletionCache";

function editorFor(lineRef: { value: string }): CodeMirror.Editor {
  const doc = {} as CodeMirror.Doc;
  return {
    closeHint: vi.fn(),
    getCursor: () => ({ line: 0, ch: lineRef.value.length }),
    getDoc: () => doc,
    getLine: () => lineRef.value,
  } as unknown as CodeMirror.Editor;
}

describe("locally filtered Tern completions", () => {
  it("fetches once and filters subsequent identifier edits locally", () => {
    const line = { value: "fl" };
    const editor = editorFor(line);
    const fetchHints = vi.fn((_editor, callback) => callback({
      from: { line: 0, ch: 0 },
      to: { line: 0, ch: 2 },
      list: [
        { text: "flyTo" },
        { text: "floorId" },
        { text: "core" },
      ],
    })) as unknown as Parameters<typeof createLocallyFilteredHint>[0];
    fetchHints.async = true;
    const completion = createLocallyFilteredHint(fetchHints);
    const first = vi.fn();

    completion.hint(editor, first);
    expect(first.mock.calls[0][0].list.map((item: CodeMirror.Hint) => item.text)).toEqual(["flyTo", "floorId"]);

    line.value = "fly";
    const second = vi.fn();
    completion.hint(editor, second);
    expect(fetchHints).toHaveBeenCalledTimes(1);
    expect(second.mock.calls[0][0].list.map((item: CodeMirror.Hint) => item.text)).toEqual(["flyTo"]);

    completion.clear();
    completion.hint(editor, vi.fn());
    expect(fetchHints).toHaveBeenCalledTimes(2);
  });

  it("ends an empty filtered completion so later typing can request hints", async () => {
    const line = { value: "fl" };
    const editor = editorFor(line);
    const fetchHints = vi.fn((_editor, callback) => callback({
      from: { line: 0, ch: 0 },
      to: { line: 0, ch: 2 },
      list: [{ text: "flyTo" }],
    })) as unknown as Parameters<typeof createLocallyFilteredHint>[0];
    fetchHints.async = true;
    const completion = createLocallyFilteredHint(fetchHints);

    completion.hint(editor, vi.fn());
    line.value = "flx";
    const emptyResult = vi.fn();
    completion.hint(editor, emptyResult);
    await Promise.resolve();

    expect(emptyResult.mock.calls[0][0].list).toEqual([]);
    expect(editor.closeHint).toHaveBeenCalledOnce();
  });
});
