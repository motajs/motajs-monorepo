export interface ILogger {
  /**
   * 输出错误级别的日志
   * @param id 日志消息表中对应的键
   * @param params 按顺序替换模板中 $1、$2 … 占位符的参数
   */
  error(id: string, ...params: string[]): void;

  /**
   * 输出警告级别的日志
   * @param id 日志消息表中对应的键
   * @param params 按顺序替换模板中 $1、$2 … 占位符的参数
   */
  warn(id: string, ...params: string[]): void;
}

/** 日志消息表，将日志 id 映射到带 $1、$2 … 占位符的英文模板 */
export type LogMessages = Readonly<Record<string, string>>;
