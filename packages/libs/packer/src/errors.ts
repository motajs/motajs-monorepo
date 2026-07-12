/**
 * 魔塔构建器错误代码枚举
 */
export enum ErrorCode {
  /** ZIP 文件不存在 */
  ZIP_NOT_FOUND = "ZIP_NOT_FOUND",
  /** 不是有效的 ZIP 文件 */
  ZIP_INVALID = "ZIP_INVALID",
  /** ZIP 文件已损坏 */
  ZIP_CORRUPTED = "ZIP_CORRUPTED",
  /** 找不到游戏根目录 */
  ROOT_NOT_FOUND = "ROOT_NOT_FOUND",
  /** 配置文件缺失 */
  CONFIG_MISSING = "CONFIG_MISSING",
  /** 配置文件格式错误 */
  CONFIG_INVALID = "CONFIG_INVALID",
  /** JS 压缩失败 */
  MINIFY_FAILED = "MINIFY_FAILED",
  /** 资源文件过大 */
  RESOURCE_TOO_LARGE = "RESOURCE_TOO_LARGE",
  /** 图片处理失败 */
  IMAGE_PROCESS_FAILED = "IMAGE_PROCESS_FAILED",
  /** 输出失败 */
  OUTPUT_FAILED = "OUTPUT_FAILED",
}

/**
 * 魔塔构建器自定义错误类
 */
export class MotaBuilderError extends Error {
  public readonly code: ErrorCode;
  public readonly details?: Record<string, unknown>;

  constructor(
    message: string,
    code: ErrorCode,
    details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "MotaBuilderError";
    this.code = code;
    this.details = details;

    // 确保错误堆栈正确显示
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, MotaBuilderError);
    }
  }
}

/**
 * 错误消息模板（中文）
 */
const ERROR_MESSAGES: Record<ErrorCode, string> = {
  [ErrorCode.ZIP_NOT_FOUND]: "压缩文件不存在：{path}",
  [ErrorCode.ZIP_INVALID]: "不是有效的 ZIP 文件：{path}",
  [ErrorCode.ZIP_CORRUPTED]: "ZIP 文件已损坏：{path}",
  [ErrorCode.ROOT_NOT_FOUND]: "找不到游戏根目录（缺少 main.js）",
  [ErrorCode.CONFIG_MISSING]: "配置文件缺失：{file}",
  [ErrorCode.CONFIG_INVALID]: "配置文件格式错误：{file}，{reason}",
  [ErrorCode.MINIFY_FAILED]: "JS 压缩失败：{file}，{reason}",
  [ErrorCode.RESOURCE_TOO_LARGE]: "资源文件过大：{file}（{size}），请启用分块压缩",
  [ErrorCode.IMAGE_PROCESS_FAILED]: "图片处理失败：{file}，{reason}",
  [ErrorCode.OUTPUT_FAILED]: "输出失败：{reason}",
};

/**
 * 格式化错误消息，替换占位符
 */
function formatErrorMessage(template: string, params: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (match, key) => {
    return params[key] || match;
  });
}

/**
 * 创建格式化的错误实例
 */
export function createError(
  code: ErrorCode,
  params: Record<string, string> = {},
  details?: Record<string, unknown>,
): MotaBuilderError {
  const template = ERROR_MESSAGES[code];
  const message = formatErrorMessage(template, params);
  return new MotaBuilderError(message, code, details);
}

/**
 * 便捷的错误创建函数
 */
export const createZipNotFoundError = (path: string) =>
  createError(ErrorCode.ZIP_NOT_FOUND, { path });

export const createZipInvalidError = (path: string) =>
  createError(ErrorCode.ZIP_INVALID, { path });

export const createZipCorruptedError = (path: string) =>
  createError(ErrorCode.ZIP_CORRUPTED, { path });

export const createRootNotFoundError = () =>
  createError(ErrorCode.ROOT_NOT_FOUND);

export const createConfigMissingError = (file: string) =>
  createError(ErrorCode.CONFIG_MISSING, { file });

export const createConfigInvalidError = (file: string, reason: string) =>
  createError(ErrorCode.CONFIG_INVALID, { file, reason });

export const createMinifyFailedError = (file: string, reason: string) =>
  createError(ErrorCode.MINIFY_FAILED, { file, reason });

export const createResourceTooLargeError = (file: string, size: string) =>
  createError(ErrorCode.RESOURCE_TOO_LARGE, { file, size });

export const createImageProcessFailedError = (file: string, reason: string) =>
  createError(ErrorCode.IMAGE_PROCESS_FAILED, { file, reason });

export const createOutputFailedError = (reason: string) =>
  createError(ErrorCode.OUTPUT_FAILED, { reason });
