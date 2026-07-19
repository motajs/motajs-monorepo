import { describe, expect, it } from "vitest";
import {
  collectFunctionDiagnostics,
  formatFunctionSource,
  validateFunctionSource,
} from "./validation";

describe("script workspace save gate", () => {
  it.each([
    "function () { return 1; }",
    "async function load() { return 1; }",
    "function* iterate() { yield 1; }",
    "(value) => value + 1",
    "async value => value",
  ])("accepts a complete function expression: %s", (source) => {
    expect(() => validateFunctionSource(source)).not.toThrow();
  });

  it.each([
    "const value = 1",
    "({ value: 1 })",
    "function () {",
    "() => 1; throw new Error()",
  ])("rejects non-function or trailing source: %s", (source) => {
    expect(() => validateFunctionSource(source)).toThrow();
  });

  it("formats a function expression without changing its meaning", () => {
    const formatted = formatFunctionSource("function(){const value=1;return value;}");
    expect(formatted).toContain("function () {");
    expect(formatted).toContain("\tconst value = 1;");
    expect(formatted).toContain("\treturn value;");
    expect(() => validateFunctionSource(formatted)).not.toThrow();
  });

  it("keeps style diagnostics as warnings", () => {
    const diagnostics = collectFunctionDiagnostics("function value() { return new Date; }");
    expect(diagnostics).toEqual(expect.arrayContaining([
      expect.objectContaining({ severity: "warning", message: expect.stringContaining("()") }),
    ]));
    expect(diagnostics).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ severity: "error" }),
    ]));
  });

  it("keeps semantic warnings and syntax errors separate", () => {
    const warning = collectFunctionDiagnostics("function value(input) { if (input = 1) return input; }");
    expect(warning).toEqual(expect.arrayContaining([
      expect.objectContaining({ severity: "warning" }),
    ]));
    expect(warning).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ severity: "error" }),
    ]));

    const error = collectFunctionDiagnostics("function value() { const result = ; }");
    expect(error).toEqual(expect.arrayContaining([
      expect.objectContaining({ severity: "error" }),
    ]));
  });
});
