import { describe, expect, it } from "vitest";
import * as Tern from "tern";
import {
  registerSemanticTypesQuery,
  SEMANTIC_TYPES_QUERY,
  type SemanticTypesQueryResult,
} from "../utils/semanticTypesQuery";

function positionAtOffset(source: string, offset: number): Tern.Position {
  const before = source.slice(0, offset).split("\n");
  return { line: before.length - 1, ch: before.at(-1)!.length };
}

describe("semanticTypes Tern query", () => {
  it("returns multiple inferred types from one protocol request", async () => {
    registerSemanticTypesQuery();
    const source = [
      "var count = 1;",
      "var label = 'sample';",
      "function run() {}",
      "run(count);",
      "label;",
    ].join("\n");
    const positions = [
      positionAtOffset(source, source.lastIndexOf("run(") + "run".length),
      positionAtOffset(source, source.lastIndexOf("count);") + "count".length),
      positionAtOffset(source, source.lastIndexOf("label;") + "label".length),
    ];
    const server = new Tern.Server({ defs: [] });
    server.addFile("test.js", source);

    const result = await new Promise<SemanticTypesQueryResult>((resolve, reject) => {
      server.request({
        query: {
          type: SEMANTIC_TYPES_QUERY,
          file: "test.js",
          positions,
          end: positions.at(-1)!,
          lineCharPositions: true,
        },
      }, (error, response) => {
        if (error || !response) reject(new Error(error ?? "Missing response"));
        else resolve(response);
      });
    });

    expect(result.types[0]).toMatch(/^fn\(/);
    expect(result.types[1]).toBe("number");
    expect(result.types[2]).toBe("string");
  });
});
