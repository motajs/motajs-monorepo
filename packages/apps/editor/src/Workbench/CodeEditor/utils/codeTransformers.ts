/**
 * 代码转换工具
 *
 * 提供 JSON 与含函数对象之间的序列化/反序列化功能。
 */

import type { CodeTransformOptions } from "../types/index";

// 从通用模块导入
import { generateGuid } from "@/utils/json";
import { isFunctionString } from "@/utils/string";

// 重导出 GUID 生成器（保持兼容）
export { generateGuid as defaultGuidGenerator } from "@/utils/json";

/**
 * 将含函数的对象序列化为字符串
 *
 * 处理对象中的函数值，将函数转换为其字符串表示形式。
 * 函数会被识别为以 "function" 开头的字符串值，或实际的 Function 对象。
 *
 * @param obj - 要序列化的对象
 * @param options - 序列化选项
 * @returns 序列化后的字符串
 *
 * @example
 * ```ts
 * const obj = {
 *   name: "test",
 *   handler: function() { return 1; }
 * };
 * const str = serializeWithFunctions(obj);
 * // 结果: { "name": "test", handler: function() { return 1; } }
 * ```
 */
export function serializeWithFunctions(
  obj: unknown,
  options: CodeTransformOptions = {}
): string {
  const { indent = "\t", guidGenerator = generateGuid } = options;

  if (obj === null || obj === undefined) {
    return "null";
  }

  const tmap: Record<string, string> = {};

  const tstr = JSON.stringify(
    obj,
    (_k, v) => {
      // 处理实际的 Function 对象
      if (v instanceof Function) {
        const id = guidGenerator();
        tmap[id] = v.toString();
        return id;
      }
      // 处理以 "function" 开头的字符串（已序列化的函数）
      if (isFunctionString(v)) {
        const id = guidGenerator();
        tmap[id] = v.toString();
        return id;
      }
      return v;
    },
    indent
  );

  // 将占位符替换为实际的函数字符串（不带引号）
  let result = tstr;
  for (const id in tmap) {
    result = result.replace('"' + id + '"', tmap[id]);
  }

  return result;
}

/**
 * 将含函数的对象序列化为存储格式字符串
 *
 * 与 serializeWithFunctions 类似，但函数会被序列化为 JSON 字符串格式，
 * 适合存储到表格字段中。
 *
 * @param obj - 要序列化的对象
 * @param options - 序列化选项
 * @returns 序列化后的字符串
 */
export function serializeForStorage(
  obj: unknown,
  options: CodeTransformOptions = {}
): string {
  const { indent = 4, guidGenerator = generateGuid } = options;

  if (obj === null || obj === undefined) {
    return "null";
  }

  const tmap: Record<string, string> = {};

  const tstr = JSON.stringify(
    obj,
    (_k, v) => {
      if (v instanceof Function) {
        const id = guidGenerator();
        tmap[id] = v.toString();
        return id;
      }
      return v;
    },
    indent
  );

  // 将占位符替换为 JSON 字符串化的函数
  let result = tstr;
  for (const id in tmap) {
    result = result.replace('"' + id + '"', JSON.stringify(tmap[id]));
  }

  return result;
}

/**
 * 反序列化含函数字符串的对象
 *
 * 使用 eval 将字符串解析为对象，支持内联函数。
 * 注意：此函数使用 eval，存在安全风险，仅应用于受信任的输入。
 *
 * @param str - 要反序列化的字符串
 * @returns 解析后的对象
 *
 * @example
 * ```ts
 * const str = '{ "name": "test", handler: function() { return 1; } }';
 * const obj = deserializeWithFunctions(str);
 * // obj.handler() === 1
 * ```
 */
export function deserializeWithFunctions(str: string): unknown {
  if (!str || str === "null") {
    return null;
  }

  try {
    // 使用 eval 解析含函数的对象字面量
    // eslint-disable-next-line no-eval
    return eval(`(${str})`);
  } catch {
    // 如果 eval 失败，尝试 JSON.parse
    try {
      return JSON.parse(str);
    } catch {
      return null;
    }
  }
}
