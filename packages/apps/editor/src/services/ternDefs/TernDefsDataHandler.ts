/**
 * TernDefsDataHandler - Tern 类型定义数据处理器
 *
 * 用于处理 `_server/CodeMirror/defs.js` 文件
 * 文件格式：var terndefs_xxx = [...]
 *
 * 职责：
 * - 继承 Json2xDataHandler，复用 JSON 数据的 parse 和 stringify 逻辑
 * - 提供类型安全的 Tern 定义数据访问
 */

import { Json2xDataHandler } from "@/fs/Json2xDataHandler";
import type { FileHandler } from "@/fs/FileHandler";
import type * as Tern from "tern";

/** 数据变量名 */
const TERN_DEFS_VAR_NAME = "terndefs_f6783a0a_522d_417e_8407_94c67b692e50";

/** Tern 定义数据类型 */
export type TernDefsData = Tern.Def[];

/**
 * TernDefsDataHandler - Tern 类型定义数据处理器
 */
export class TernDefsDataHandler extends Json2xDataHandler<TernDefsData> {
  constructor(fileHandler: FileHandler) {
    super(fileHandler, TERN_DEFS_VAR_NAME, "Tern Definitions");
  }
}
