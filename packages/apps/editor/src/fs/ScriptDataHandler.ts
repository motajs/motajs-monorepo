/**
 * ScriptDataHandler - 通用脚本数据处理器
 *
 * 职责：
 * - 继承 DataHandler，实现脚本数据的 parse 和 stringify
 * - 提供类型安全的脚本数据访问
 * - 支持不同变量名的脚本文件（functions.js, plugins.js）
 *
 * 数据格式：
 * - 文件格式: var xxx_uuid = \n{ key: { ... }, ... }
 * - 叶子节点是函数，解析后转为字符串存储
 */

import { DataHandler } from './DataHandler';
import type { FileHandler } from './FileHandler';
import { decodeGameScript2x, encodeGameScript2x, type ScriptDataObject } from '@motajs/file2x';

/** 嵌套 Record 类型，叶子节点为字符串（函数文本） */
export type ScriptData = ScriptDataObject;

/**
 * 序列化脚本数据为文件内容
 * @internal 导出仅供测试使用
 */
export function stringifyScriptData(data: ScriptData, varName: string): string {
  return encodeGameScript2x({ uuid: varName, data });
}

/**
 * ScriptDataHandler - 通用脚本数据处理器
 *
 * 子类只需要传入不同的变量名即可
 */
export class ScriptDataHandler extends DataHandler<ScriptData> {
  private varName: string;

  constructor(fileHandler: FileHandler, varName: string, resourceName: string) {
    super(fileHandler, resourceName);
    this.varName = varName;
  }

  /**
   * 解析文本为脚本数据
   *
   * 使用静态 AST codec 提取函数文本，不执行工程代码
   */
  protected parse(text: string): ScriptData {
    try {
      const decoded = decodeGameScript2x(text);
      if (decoded.uuid !== this.varName) {
        throw new Error(`Expected ${this.varName}, received ${decoded.uuid}`);
      }
      return decoded.data;
    } catch (err) {
      throw new Error(`解析脚本数据失败: ${(err as Error).message}`);
    }
  }

  /**
   * 序列化脚本数据为文本
   */
  protected stringify(data: ScriptData): string {
    return stringifyScriptData(data, this.varName);
  }
}
