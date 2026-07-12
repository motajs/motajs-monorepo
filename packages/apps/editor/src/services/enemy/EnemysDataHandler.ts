/**
 * EnemysDataHandler - 怪物数据处理器
 *
 * 使用 Json2xDataHandler 处理 project/enemys.js 文件
 */

import { Json2xDataHandler } from "@/fs/Json2xDataHandler";
import type { FileHandler } from "@/fs/FileHandler";
import type { EnemysData } from "./enemyService";

/** 数据变量名 */
const DATA_VAR_NAME = "enemys_fcae963b_31c9_42b4_b48c_bb48d09f3f80";

/**
 * EnemysDataHandler - 怪物数据处理器
 */
export class EnemysDataHandler extends Json2xDataHandler<EnemysData> {
  constructor(fileHandler: FileHandler) {
    super(fileHandler, DATA_VAR_NAME, "Enemys Data");
  }
}
