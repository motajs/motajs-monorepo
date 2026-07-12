/**
 * 日志级别
 */
export type LogLevel = "log" | "success" | "warn" | "error";

/**
 * 日志输出回调类型
 */
export type LogOutput = (message: string) => void;

/**
 * Logger 类 - 提供格式化的构建进度输出
 * 使用 group/groupEnd 模式管理层级缩进
 */
export class Logger {
  private depth = 0;
  private output: LogOutput;

  constructor(output?: LogOutput) {
    this.output = output ?? console.log;
  }

  /**
   * 开始一个分组（自动增加缩进）
   */
  group(title: string): void {
    this.output(this.indent(`[${title}]`));
    this.depth++;
  }

  /**
   * 结束当前分组（自动减少缩进）
   */
  groupEnd(): void {
    if (this.depth > 0) {
      this.depth--;
    }
  }

  /**
   * 普通日志
   */
  log(text: string): void {
    this.output(this.indent(text));
  }

  /**
   * 成功消息
   */
  success(text: string): void {
    this.output(this.indent(`======> ${text}`));
  }

  /**
   * 警告消息
   */
  warn(text: string): void {
    this.output(this.indent(`⚠ ${text}`));
  }

  /**
   * 错误消息
   */
  error(text: string): void {
    this.output(this.indent(`✖ ${text}`));
  }

  /**
   * 根据当前深度添加缩进
   */
  private indent(text: string): string {
    const prefix = "  ".repeat(this.depth);
    return `${prefix}${text}`;
  }
}

/**
 * 格式化文件大小
 * @param bytes 字节数
 * @returns 格式化后的字符串，如 "1.23MB"
 */
export function formatSize(bytes: number): string {
  if (bytes < 0) {
    return "0B";
  }

  const units = ["B", "KB", "MB", "GB"];
  let unitIndex = 0;
  let size = bytes;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }

  // 小于 1KB 时不显示小数
  if (unitIndex === 0) {
    return `${Math.round(size)}${units[unitIndex]}`;
  }

  return `${size.toFixed(2)}${units[unitIndex]}`;
}

/**
 * 格式化时间戳
 * @returns 格式化后的时间戳字符串，如 "[2024-01-01 12:00:00]"
 */
export function formatTimestamp(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const hours = String(now.getHours()).padStart(2, "0");
  const minutes = String(now.getMinutes()).padStart(2, "0");
  const seconds = String(now.getSeconds()).padStart(2, "0");

  return `[${year}-${month}-${day} ${hours}:${minutes}:${seconds}]`;
}
