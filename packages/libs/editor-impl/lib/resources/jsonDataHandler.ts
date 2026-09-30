import { DataHandler } from './dataHandler';
import { IDataHandler } from './types';
import { FileHandler } from './fileHandler';

// JsonDataHandler —— 纯 JSON 数据处理器
// 继承 DataHandler，实现通用的 parse/stringify：处理标准 JSON 文件
// （非 2.x 风格的 `var xxx = {json}`）
// 泛型 `T` 是解析后的数据类型
export class JsonDataHandler<T> extends DataHandler<T> implements IDataHandler<T> {
  constructor(fileHandler: FileHandler, resourceName: string) {
    super(fileHandler, resourceName);
  }

  /**
   * 解析 JSON 文本为数据对象。
   *
   * @param text 待解析的 JSON 文本。
   */
  protected parse(text: string): T {
    return JSON.parse(text) as T;
  }

  /**
   * 序列化数据对象为 JSON 文本。
   *
   * @param data 待序列化的数据对象。
   */
  protected stringify(data: T): string {
    return JSON.stringify(data);
  }
}
