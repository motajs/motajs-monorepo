/**
 * Json2xDataHandler - 2.x 风格 JSON 数据处理器
 *
 * 用于处理 `var xxx = {json}` 格式的 JS 数据文件
 * 可被 Tower、Items、Enemys、MapsBlocks、Events 等服务复用
 *
 * 职责：
 * - 继承 DataHandler，实现通用的 parse 和 stringify
 * - 通过 varName 参数支持不同的变量名
 */

import { DataHandler } from "./DataHandler";
import type { FileHandler } from "./FileHandler";
import { serializeToJsDataFile } from "@/utils/serialize";
import JSON5 from "json5";

/**
 * Json2xDataHandler - 通用 JSON 数据处理器
 *
 * @typeParam T - 数据类型
 */
export class Json2xDataHandler<T> extends DataHandler<T> {
  private varName: string;

  /**
   * @param fileHandler - 文件处理器
   * @param varName - JS 变量名（用于解析和序列化）
   * @param resourceName - 资源名称（用于错误消息）
   */
  constructor(fileHandler: FileHandler, varName: string, resourceName: string) {
    super(fileHandler, resourceName);
    this.varName = varName;
  }

  /**
   * 解析文本为数据对象
   *
   * 文件格式：var varName = \n{json}
   */
  protected parse(text: string): T {
    try {
      // 移除 "var xxx =" 前缀
      const prefix = `var ${this.varName} =`;
      let jsonStr = text.trim();

      if (jsonStr.startsWith(prefix)) {
        jsonStr = jsonStr.substring(prefix.length).trim();
      }

      // 移除可能的结尾分号
      if (jsonStr.endsWith(";")) {
        jsonStr = jsonStr.slice(0, -1).trim();
      }

      // 解析 JSON
      return JSON5.parse(jsonStr) as T;
    } catch (err) {
      throw new Error(
        `Failed to parse JSON data file: ${(err as Error).message}`,
      );
    }
  }

  /**
   * 序列化数据对象为文本
   *
   * 输出格式：var varName = \n{json}
   */
  protected stringify(data: T): string {
    return serializeToJsDataFile(this.varName, data);
  }
}
