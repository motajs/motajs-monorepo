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

import { DataHandler } from './DataHandler';
import type { FileHandler } from './FileHandler';
import { decodeGameData2x, encodeGameData2x } from '@motajs/file2x';

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
      const decoded = decodeGameData2x<T>(text);
      if (decoded.uuid !== this.varName) {
        throw new Error(`Expected ${this.varName}, received ${decoded.uuid}`);
      }
      return decoded.data;
    } catch (err) {
      throw new Error(`Failed to parse JSON data file: ${(err as Error).message}`);
    }
  }

  /**
   * 序列化数据对象为文本
   *
   * 输出格式：var varName = \n{json}
   */
  protected stringify(data: T): string {
    return encodeGameData2x({ uuid: this.varName, data });
  }
}
