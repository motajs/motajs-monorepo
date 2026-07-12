import { describe, expect, it } from "vitest";
import { createTableMetaRuntimeContext } from "../TableMetaRuntimeContext";

describe("TableMetaRuntimeContext", () => {
  it("implements mota-js prefix-based subarray semantics", () => {
    const { subarray } = createTableMetaRuntimeContext().core;

    expect(subarray(["a", "b", "c"], ["a", "b"])).toEqual(["c"]);
    expect(subarray(["a", "b"], ["a", "b"])).toEqual([]);
    expect(subarray(["b", "a"], ["a", "b"])).toBeNull();
    expect(subarray(["a"], ["a", "b"])).toBeNull();
  });
});
