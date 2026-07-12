/**
 * FunctionsDataHandler - 脚本函数数据处理器
 *
 * 职责：
 * - 继承 ScriptDataHandler，复用脚本数据的 parse 和 stringify 逻辑
 * - 提供类型安全的脚本函数数据访问
 *
 * 数据格式：
 * - 文件格式: var functions_d6ad677b_... = \n{ events: { ... }, ui: { ... }, ... }
 * - 叶子节点是函数，解析后转为字符串存储
 */

import {
  ScriptDataHandler,
  toFunctionStrings,
  stringifyScriptData,
  type ScriptData,
  type ScriptRaw,
} from "@/fs/ScriptDataHandler";
import type { FileHandler } from "@/fs/FileHandler";

/** 数据变量名 */
const FUNCTIONS_VAR_NAME = "functions_d6ad677b_427a_4623_b50f_a445a3b0ef8a";

/** 类型别名：兼容旧代码 */
export type { ScriptData as FunctionsData };

// 重导出测试用的工具函数
export { toFunctionStrings, type ScriptRaw as FunctionsRaw };

/**
 * 序列化脚本函数数据为文件内容（使用 Functions 变量名）
 * @internal 导出仅供测试使用
 */
export function stringifyFunctionsData(data: ScriptData): string {
  return stringifyScriptData(data, FUNCTIONS_VAR_NAME);
}

/**
 * FunctionsDataHandler - 脚本函数数据处理器
 */
export class FunctionsDataHandler extends ScriptDataHandler {
  constructor(fileHandler: FileHandler) {
    super(fileHandler, FUNCTIONS_VAR_NAME, "Functions Data");
  }
}
