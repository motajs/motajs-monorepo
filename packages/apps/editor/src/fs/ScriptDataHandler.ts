/**
 * ScriptDataHandler - 通用脚本数据处理器
 *
 * 职责：
 * - 继承 DataHandler，实现脚本数据的 parse 和 stringify
 * - 提供类型安全的脚本数据访问
 * - 支持不同变量名的脚本文件（functions.js, plugins.js）
 *
 * 数据格式：
 * - 文件格式: var xxx_uuid = \n{ key: { ... }, ... }
 * - 叶子节点是函数，解析后转为字符串存储
 */

import { DataHandler } from "./DataHandler";
import type { FileHandler } from "./FileHandler";

/** 嵌套 Record 类型，叶子节点为字符串（函数文本） */
export type ScriptData = {
  [key: string]: string | ScriptData;
};

/**
 * 内部类型：解析后的函数对象
 * @internal 导出仅供测试使用
 */
export type ScriptRaw = {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
  [key: string]: Function | ScriptRaw;
};

/**
 * 递归将函数对象转为函数字符串对象
 *
 * 每个函数转为带名称的字符串: function() {} -> "function name() {}"
 * @internal 导出仅供测试使用
 */
export function toFunctionStrings(obj: ScriptRaw): ScriptData {
  const result: ScriptData = {};

  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === "function") {
      // 函数转字符串，并添加函数名
      result[key] = value.toString().replace("function", `function ${key}`);
    } else if (typeof value === "object" && value !== null) {
      // 递归处理嵌套对象
      result[key] = toFunctionStrings(value as ScriptRaw);
    }
  }

  return result;
}

/**
 * 递归序列化函数字符串对象为 JS 代码
 *
 * 保持函数格式（不加引号），使用 tab 缩进
 */
function serializeScriptData(data: ScriptData, indent: string): string {
  const INDENT = "\t";
  const nextIndent = indent + INDENT;

  const lines = Object.entries(data).map(([key, value]) => {
    const keyStr = `${nextIndent}"${key}": `;

    if (typeof value === "string") {
      // 叶子节点是函数字符串，去掉函数名后输出（不加引号）
      const anonymousFunc = value.replace(`function ${key}`, "function");
      return `${keyStr}${anonymousFunc}`;
    } else {
      // 递归处理嵌套对象
      return `${keyStr}${serializeScriptData(value, nextIndent)}`;
    }
  });

  return [`{`, lines.join(",\n"), `${indent}}`].join("\n");
}

/**
 * 序列化脚本数据为文件内容
 * @internal 导出仅供测试使用
 */
export function stringifyScriptData(data: ScriptData, varName: string): string {
  const dataJSON = serializeScriptData(data, "");
  return `var ${varName} =\n${dataJSON}`;
}

/**
 * ScriptDataHandler - 通用脚本数据处理器
 *
 * 子类只需要传入不同的变量名即可
 */
export class ScriptDataHandler extends DataHandler<ScriptData> {
  private varName: string;

  constructor(fileHandler: FileHandler, varName: string, resourceName: string) {
    super(fileHandler, resourceName);
    this.varName = varName;
  }

  /**
   * 解析文本为脚本数据
   *
   * 使用 new Function() 执行 JS 代码，然后递归转换函数为字符串
   */
  protected parse(text: string): ScriptData {
    try {
      // 使用 new Function() 替代 eval，更安全
      const fn = new Function(`
        "use strict";
        ${text}
        return ${this.varName};
      `);
      const obj = fn() as ScriptRaw;

      // 递归将函数转为带名称的字符串
      return toFunctionStrings(obj);
    } catch (err) {
      throw new Error(`解析脚本数据失败: ${(err as Error).message}`);
    }
  }

  /**
   * 序列化脚本数据为文本
   */
  protected stringify(data: ScriptData): string {
    return stringifyScriptData(data, this.varName);
  }
}
