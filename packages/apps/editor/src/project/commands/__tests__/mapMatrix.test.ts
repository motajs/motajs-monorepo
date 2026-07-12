import { describe, expect, it } from "vitest";

import { formatMapMatrixText, parseMapMatrixText } from "../mapMatrix";

describe("map matrix text helpers", () => {
  it("parses full JSON matrix text", () => {
    expect(parseMapMatrixText("[[0,1],[2,3]]", { width: 2, height: 2 })).toEqual([
      [0, 1],
      [2, 3],
    ]);
  });

  it("parses row-list text without outer brackets and trailing comma", () => {
    expect(parseMapMatrixText("[  0, 21],\n[  2,  3],", { width: 2, height: 2 })).toEqual([
      [0, 21],
      [2, 3],
    ]);
  });

  it("formats matrix text in editor row-list shape", () => {
    expect(formatMapMatrixText([[0, 21], [2, 300]])).toBe("[   0,  21],\n[   2, 300]");
  });

  it("rejects invalid cell values", () => {
    expect(() => parseMapMatrixText("[[0,\"x\"]]")).toThrow("Invalid map idnum");
  });

  it("rejects mismatched dimensions", () => {
    expect(() => parseMapMatrixText("[[0,1,2]]", { width: 2, height: 1 })).toThrow("width mismatch");
  });
});
