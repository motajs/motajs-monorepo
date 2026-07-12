/**
 * PluginsDataHandler - 插件数据处理器
 *
 * 职责：
 * - 继承 ScriptDataHandler，复用脚本数据的 parse 和 stringify 逻辑
 * - 提供类型安全的插件数据访问
 *
 * 数据格式：
 * - 文件格式: var plugins_bb40132b_... = \n{ init: { ... }, drawLight: { ... }, ... }
 * - 叶子节点是函数，解析后转为字符串存储
 */

import { ScriptDataHandler } from "@/fs/ScriptDataHandler";
import type { FileHandler } from "@/fs/FileHandler";

/** 数据变量名 */
const PLUGINS_VAR_NAME = "plugins_bb40132b_638b_4a9f_b028_d3fe47acc8d1";

/** 类型别名：语义化 */
export type { ScriptData as PluginsData } from "@/fs/ScriptDataHandler";

/**
 * PluginsDataHandler - 插件数据处理器
 */
export class PluginsDataHandler extends ScriptDataHandler {
  constructor(fileHandler: FileHandler) {
    super(fileHandler, PLUGINS_VAR_NAME, "Plugins Data");
  }
}
