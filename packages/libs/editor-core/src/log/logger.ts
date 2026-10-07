import { messages } from './messages';
import { ILogger, LogMessages } from './types';

export class Logger implements ILogger {
  /** 日志消息表 */
  private readonly messageTable: LogMessages;

  constructor(messages: LogMessages) {
    this.messageTable = messages;
  }

  error(id: string, ...params: string[]): void {
    console.error(id, this.resolve(id, params));
  }

  warn(id: string, ...params: string[]): void {
    console.warn(id, this.resolve(id, params));
  }

  /**
   * 按 id 从消息表取模板并替换占位符，未知 id 回退到内置的元消息
   * @param id 日志 id
   * @param params 依次替换 $1、$2 … 的参数
   * @returns 解析后的日志消息
   */
  private resolve(id: string, params: string[]): string {
    const template: string | undefined = this.messageTable[id];

    if (template === undefined) return this.format(this.messageTable['log.unknownId'], [id]);

    return this.format(template, params);
  }

  /**
   * 将模板中的 $1、$2 … 占位符依次替换为参数
   * @param template 含占位符的模板
   * @param params 替换参数
   * @returns 替换后的文本
   */
  private format(template: string, params: string[]): string {
    return template.replace(/\$(\d+)/g, (match, index: string) => params[Number(index) - 1] ?? match);
  }
}

/** editor-core 按消息表输出日志的模块级单例 */
export const logger: ILogger = new Logger(messages);
