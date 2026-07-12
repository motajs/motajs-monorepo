/**
 * TowerDataHandler - 全塔数据处理器
 *
 * 使用 Json2xDataHandler 处理 project/data.js 文件
 */

import { Json2xDataHandler } from "@/fs/Json2xDataHandler";
import type { FileHandler } from "@/fs/FileHandler";
import type { TowerData } from "./towerService";

/** 数据变量名 */
const DATA_VAR_NAME = "data_a1e2fb4a_e986_4524_b0da_9b7ba7c0874d";

/**
 * TowerDataHandler - 全塔数据处理器
 */
export class TowerDataHandler extends Json2xDataHandler<TowerData> {
  constructor(fileHandler: FileHandler) {
    super(fileHandler, DATA_VAR_NAME, "Tower Data");
  }
}
