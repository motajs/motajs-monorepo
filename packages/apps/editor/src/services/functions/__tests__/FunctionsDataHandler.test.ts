/**
 * FunctionsDataHandler 单元测试
 *
 * 测试函数数据转换功能：
 * - toFunctionStrings: 函数对象 -> 函数字符串对象
 * - stringifyFunctionsData: 函数字符串对象 -> JS 文件内容
 */

import { describe, expect, it } from "vitest";

import {
  type FunctionsData,
  type FunctionsRaw,
  stringifyFunctionsData,
  toFunctionStrings,
} from "../FunctionsDataHandler";

describe("toFunctionStrings", () => {
  it("应该将单个函数转为带名称的字符串", () => {
    const input: FunctionsRaw = {
      myFunc: function () {
        return 1;
      },
    };

    const result = toFunctionStrings(input);

    expect(result.myFunc).toContain("function myFunc");
    expect(result.myFunc).toContain("return 1");
  });

  it("应该处理空对象", () => {
    const input: FunctionsRaw = {};

    const result = toFunctionStrings(input);

    expect(result).toEqual({});
  });

  it("应该递归处理嵌套对象", () => {
    const input: FunctionsRaw = {
      events: {
        onStart: function () {
          console.log("start");
        },
        onEnd: function () {
          console.log("end");
        },
      },
    };

    const result = toFunctionStrings(input);

    expect(result.events).toBeDefined();
    expect(typeof result.events).toBe("object");

    const events = result.events as FunctionsData;
    expect(events.onStart).toContain("function onStart");
    expect(events.onEnd).toContain("function onEnd");
  });

  it("应该处理多层嵌套", () => {
    const input: FunctionsRaw = {
      level1: {
        level2: {
          deepFunc: function () {
            return "deep";
          },
        },
      },
    };

    const result = toFunctionStrings(input);

    const level1 = result.level1 as FunctionsData;
    const level2 = level1.level2 as FunctionsData;
    expect(level2.deepFunc).toContain("function deepFunc");
    expect(level2.deepFunc).toContain('return "deep"');
  });

  it("应该处理混合结构（同级包含函数和嵌套对象）", () => {
    const input: FunctionsRaw = {
      directFunc: function () {
        return "direct";
      },
      nested: {
        nestedFunc: function () {
          return "nested";
        },
      },
    };

    const result = toFunctionStrings(input);

    expect(result.directFunc).toContain("function directFunc");
    expect((result.nested as FunctionsData).nestedFunc).toContain(
      "function nestedFunc"
    );
  });

  it("应该正确处理箭头函数（虽然原代码用 function 关键字检测）", () => {
    // 注意：箭头函数的 toString() 不包含 "function"，所以 replace 不会生效
    // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
    const arrowFn = () => 42;
    const input: FunctionsRaw = {
      arrowFunc: arrowFn as Function,
    };

    const result = toFunctionStrings(input);

    // 箭头函数转字符串后，replace "function" 不会匹配，原样返回
    expect(typeof result.arrowFunc).toBe("string");
  });
});

describe("stringifyFunctionsData", () => {
  it("应该生成正确的变量声明", () => {
    const input: FunctionsData = {
      test: "function test() {}",
    };

    const result = stringifyFunctionsData(input);

    expect(result).toContain(
      "var functions_d6ad677b_427a_4623_b50f_a445a3b0ef8a ="
    );
  });

  it("应该正确格式化单个函数", () => {
    const input: FunctionsData = {
      myFunc: "function myFunc() { return 1; }",
    };

    const result = stringifyFunctionsData(input);

    // 函数字符串不应该被引号包裹
    expect(result).toContain('"myFunc": function() { return 1; }');
  });

  it("应该使用 tab 缩进", () => {
    const input: FunctionsData = {
      func1: "function func1() {}",
      func2: "function func2() {}",
    };

    const result = stringifyFunctionsData(input);

    // 检查 tab 缩进
    expect(result).toContain('\t"func1"');
    expect(result).toContain('\t"func2"');
  });

  it("应该正确处理嵌套对象", () => {
    const input: FunctionsData = {
      events: {
        onStart: "function onStart() {}",
      },
    };

    const result = stringifyFunctionsData(input);

    // 嵌套结构应该有正确的缩进
    expect(result).toContain('"events":');
    expect(result).toContain('"onStart":');
    // 嵌套层级应该有更深的缩进
    expect(result).toMatch(/\t"events":\s*\{[\s\S]*\t\t"onStart"/);
  });

  it("应该生成合法的 JS 代码", () => {
    const input: FunctionsData = {
      events: {
        action: "function action() { return 42; }",
      },
      ui: {
        render: "function render() { return 'ui'; }",
      },
    };

    const result = stringifyFunctionsData(input);

    // 生成的代码应该可以被 JS 解析
    // 使用 new Function 验证语法正确性
    expect(() => {
      new Function(`
        "use strict";
        ${result}
        return functions_d6ad677b_427a_4623_b50f_a445a3b0ef8a;
      `)();
    }).not.toThrow();
  });

  it("应该处理空对象", () => {
    const input: FunctionsData = {};

    const result = stringifyFunctionsData(input);

    expect(result).toContain(
      "var functions_d6ad677b_427a_4623_b50f_a445a3b0ef8a ="
    );
    expect(result).toContain("{\n\n}");
  });

  it("生成的代码执行后应该返回正确的结构", () => {
    const input: FunctionsData = {
      events: {
        myAction: "function myAction(a, b) { return a + b; }",
      },
    };

    const result = stringifyFunctionsData(input);

    // 执行生成的代码
    const fn = new Function(`
      "use strict";
      ${result}
      return functions_d6ad677b_427a_4623_b50f_a445a3b0ef8a;
    `);
    const parsed = fn() as Record<string, unknown>;

    // 验证结构
    expect(parsed.events).toBeDefined();
    const events = parsed.events as Record<string, unknown>;
    expect(typeof events.myAction).toBe("function");

    // 验证函数可执行
    const myAction = events.myAction as (a: number, b: number) => number;
    expect(myAction(1, 2)).toBe(3);
  });
});

describe("toFunctionStrings + stringifyFunctionsData 集成", () => {
  it("完整流程：函数对象 -> 字符串对象 -> JS 代码 -> 可执行", () => {
    // 输入：真实的函数对象
    const input: FunctionsRaw = {
      events: {
        calculate: function (x: number) {
          return x * 2;
        },
      },
    };

    // 第一步：转为函数字符串
    const stringsData = toFunctionStrings(input);

    // 第二步：序列化为 JS 代码
    const jsCode = stringifyFunctionsData(stringsData);

    // 第三步：执行并验证
    const fn = new Function(`
      "use strict";
      ${jsCode}
      return functions_d6ad677b_427a_4623_b50f_a445a3b0ef8a;
    `);
    const parsed = fn() as Record<string, Record<string, unknown>>;

    // 验证函数名被正确添加
    const calculate = parsed.events.calculate as (x: number) => number;
    expect(typeof calculate).toBe("function");
    expect(calculate.name).toBe("calculate");
    expect(calculate(5)).toBe(10);
  });
});
