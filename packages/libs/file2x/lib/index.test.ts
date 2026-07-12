import { describe, expect, test } from "vitest";
import {
  decodeGameData2x,
  decodeGameMapData2x,
  decodeGameScript2x,
  encodeGameData2x,
  encodeGameMapData2x,
  encodeGameScript2x,
} from "./index";

describe("file2x data codecs", () => {
  test("reads comments and JSON5 without executing the wrapper", () => {
    const result = decodeGameData2x<{ title: string; values: number[] }>(`
      // project metadata
      var data_test = { title: 'sample', values: [1, 2,], };
    `);
    expect(result).toEqual({ uuid: "data_test", data: { title: "sample", values: [1, 2] } });
  });

  test("writes mota-js variable files with tab indentation", () => {
    expect(encodeGameData2x({ uuid: "data_test", data: { nested: { value: 1 } } }))
      .toBe('var data_test =\n{\n\t"nested": {\n\t\t"value": 1\n\t}\n}');
  });

  test("reads and writes complete floor member paths", () => {
    const decoded = decodeGameMapData2x<{ floorId: string }>(
      `main.floors.sample0 = { floorId: 'sample0', };`,
    );
    expect(decoded).toEqual({
      prefix: ["main", "floors"],
      mapId: "sample0",
      data: { floorId: "sample0" },
    });
    expect(encodeGameMapData2x(decoded)).toContain("main.floors.sample0 =\n");
  });
});

describe("file2x script codec", () => {
  test("extracts nested functions without executing project code", () => {
    const marker = "__file2x_should_not_execute__";
    delete (globalThis as Record<string, unknown>)[marker];
    const decoded = decodeGameScript2x(`
      ///<reference path='../runtime.d.ts'/>
      var functions_test = {
        events: {
          start: function () { globalThis.${marker} = true; },
          arrow: (value) => value + 1,
        },
      };
    `);
    expect((globalThis as Record<string, unknown>)[marker]).toBeUndefined();
    expect((decoded.data.events as Record<string, string>).start).toContain("function start");
    expect((decoded.data.events as Record<string, string>).arrow).toContain("=>");
  });

  test("round-trips named function leaves as anonymous object values", () => {
    const source = encodeGameScript2x({
      uuid: "functions_test",
      data: {
        events: {
          start: "function start(value) { return value + 1; }",
        },
      },
    });
    expect(source).toContain('"start": function(value)');
    expect(decodeGameScript2x(source).data).toEqual({
      events: { start: "function start(value) { return value + 1; }" },
    });
  });

  test("rejects non-function leaves", () => {
    expect(() => decodeGameScript2x("var functions_test = { invalid: 1 };"))
      .toThrow("Unsupported script value");
  });

  test("rejects unsafe wrapper identifiers", () => {
    expect(() => encodeGameScript2x({ uuid: "bad;name", data: {} }))
      .toThrow("Invalid variable name");
  });
});
