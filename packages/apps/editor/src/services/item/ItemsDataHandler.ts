/**
 * ItemsDataHandler - 道具数据处理器
 *
 * 使用 Json2xDataHandler 处理 project/items.js 文件
 */

import { Json2xDataHandler } from "@/fs/Json2xDataHandler";
import type { FileHandler } from "@/fs/FileHandler";
import type { ItemsData } from "./itemService";

/** 数据变量名 */
const DATA_VAR_NAME = "items_296f5d02_12fd_4166_a7c1_b5e830c9ee3a";

/**
 * ItemsDataHandler - 道具数据处理器
 */
export class ItemsDataHandler extends Json2xDataHandler<ItemsData> {
  constructor(fileHandler: FileHandler) {
    super(fileHandler, DATA_VAR_NAME, "Items Data");
  }
}
