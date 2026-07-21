import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import { buildTernDeclaration } from "../ternDeclaration";

describe("Tern declaration compatibility layer", () => {
  it("preserves aliases, documentation, function signatures and object returns", () => {
    const result = buildTernDeclaration(`var defs = [{
      "!name": "core",
      "!define": {
        "image": { "width": "number", "src": "string" },
        "flag": { "hard": { "!type": "number", "!doc": "当前难度" } }
      },
      "core": {
        "material": { "images": "[image]" },
        "getStatus": {
          "!type": "fn(name: string, fallback?: flag) -> {value: number, ok: bool}",
          "!doc": "读取状态"
        }
      }
    }];`);

    expect(result.diagnostics).toEqual([]);
    expect(result.declaration).toContain("type __MotaTern_image = {");
    expect(result.declaration).toContain('"images": Array<__MotaTern_image>');
    expect(result.declaration).toContain("fallback?: __MotaTern_flag");
    expect(result.declaration).toContain('=> { "value": number; "ok": boolean }');
    expect(result.declaration).toContain("读取状态");
  });

  it("converts the template's complete Tern JSON to valid TypeScript syntax", () => {
    const source = readFileSync(resolve(
      process.cwd(),
      "../../external/mota-js/_server/CodeMirror/defs.js",
    ), "utf8");
    const result = buildTernDeclaration(source);
    const file = ts.createSourceFile(
      "tern-compatibility.d.ts",
      result.declaration,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TS,
    );

    expect(result.declaration.length).toBeGreaterThan(80_000);
    expect(result.declaration).toContain("type __MotaTern_flag");
    expect(result.declaration).toContain('"getSpecials"');
    expect(file.parseDiagnostics.map((diagnostic) => ({
      message: ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n"),
      start: diagnostic.start,
    }))).toEqual([]);
  });
});
