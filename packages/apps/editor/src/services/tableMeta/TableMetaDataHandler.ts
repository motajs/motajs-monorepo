/**
 * TableMetaDataHandler - 表格元数据数据处理器
 *
 * 职责：
 * - 继承 DataHandler，提供表格元数据的 parse 和 stringify
 * - 使用 computed 自动追踪 FileHandler
 */

import { DataHandler } from '@/fs/DataHandler';
import type { FileHandler } from '@/fs/FileHandler';
import type { CommentObject } from '@/components/Table';
import { parseTableMetaSource } from '@/project/tableMeta/TableMetaEvaluator';

/**
 * TableMetaDataHandler 类
 *
 * 处理表格元数据文件（*.comment.js）的解析和序列化
 */
export class TableMetaDataHandler extends DataHandler<CommentObject> {
  private varName: string;

  constructor(fileHandler: FileHandler, varName: string, resourceName: string) {
    super(fileHandler, resourceName);
    this.varName = varName;
  }

  /**
   * 解析 JS 文件内容为元数据对象
   *
   * 使用 new Function 在隔离的作用域中执行，防止泄露到全局
   */
  protected parse(text: string): CommentObject {
    try {
      return parseTableMetaSource(text, this.varName);
    } catch (err) {
      throw new Error(`解析元数据内容失败: ${(err as Error).message}`);
    }
  }

  /**
   * 序列化元数据对象为 JS 文件内容
   *
   * 注意：这里简单地使用 JSON.stringify，实际项目中可能需要更复杂的序列化逻辑
   */
  protected stringify(data: CommentObject): string {
    // 简单实现：使用 JSON.stringify
    // 实际项目中可能需要保留注释、格式等
    return `var ${this.varName} = ${JSON.stringify(data, null, 2)};`;
  }
}
