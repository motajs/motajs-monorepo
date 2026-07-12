/**
 * JsonDataHandler - 纯 JSON 数据处理器
 *
 * 用于处理纯 JSON 格式的数据文件
 *
 * 职责：
 * - 继承 DataHandler，实现通用的 parse 和 stringify
 * - 处理标准 JSON 文件（非 2.x 风格的 var xxx = {json}）
 */

import { DataHandler } from "./DataHandler";
import type { FileHandler } from "./FileHandler";

/**
 * JsonDataHandler - 通用纯 JSON 数据处理器
 *
 * @typeParam T - 数据类型
 */
export class JsonDataHandler<T> extends DataHandler<T> {
  /**
   * @param fileHandler - 文件处理器
   * @param resourceName - 资源名称（用于错误消息）
   */
  constructor(fileHandler: FileHandler, resourceName: string) {
    super(fileHandler, resourceName);
  }

  /**
   * 解析 JSON 文本为数据对象
   */
  protected parse(text: string): T {
    return JSON.parse(text) as T;
  }

  /**
   * 序列化数据对象为 JSON 文本
   */
  protected stringify(data: T): string {
    return JSON.stringify(data);
  }
}
