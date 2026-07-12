import { describe, expect, it } from "vitest";
import { type FunctionsData, stringifyFunctionsData } from "../FunctionsDataHandler";

describe("stringifyFunctionsData", () => {
  it("生成正确的变量声明和匿名对象函数字面量", () => {
    const result = stringifyFunctionsData({
      myFunc: "function myFunc() { return 1; }",
    });

    expect(result).toContain("var functions_d6ad677b_427a_4623_b50f_a445a3b0ef8a =");
    expect(result).toContain('"myFunc": function() { return 1; }');
  });

  it("使用 tab 缩进并保持嵌套结构", () => {
    const input: FunctionsData = {
      events: {
        onStart: "function onStart() {}",
      },
    };

    const result = stringifyFunctionsData(input);
    expect(result).toMatch(/\t"events":\s*\{[\s\S]*\t\t"onStart"/);
  });

  it("生成合法且可执行的 JavaScript", () => {
    const result = stringifyFunctionsData({
      events: {
        action: "function action(value) { return value + 1; }",
      },
    });
    const load = new Function(`
      "use strict";
      ${result}
      return functions_d6ad677b_427a_4623_b50f_a445a3b0ef8a;
    `) as () => { events: { action(value: number): number } };

    expect(load().events.action(1)).toBe(2);
  });

  it("处理空对象", () => {
    expect(stringifyFunctionsData({})).toContain("{\n\n}");
  });
});
