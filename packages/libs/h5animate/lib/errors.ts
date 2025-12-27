/**
 * H5Animate 错误类型和错误代码定义
 */

/**
 * H5Animate 错误代码枚举
 *
 * 错误代码格式: H5AXXX
 * - H5A001-H5A099: 文件格式错误
 * - H5A100-H5A199: 数据验证错误
 * - H5A200-H5A299: 转换错误
 * - H5A300-H5A399: 处理错误
 */
export enum H5AnimateErrorCode {
  // ============ 文件格式错误 (001-099) ============
  /** 无效的文件签名 */
  INVALID_SIGNATURE = "H5A001",
  /** 无效的版本号 */
  INVALID_VERSION = "H5A002",
  /** 损坏的文件头 */
  CORRUPTED_HEADER = "H5A003",
  /** 无效的图像数据 */
  INVALID_IMAGE_DATA = "H5A004",
  /** 无效的元数据 */
  INVALID_METADATA = "H5A005",
  /** 文件截断 */
  FILE_TRUNCATED = "H5A006",
  /** 数据大小不匹配 */
  SIZE_MISMATCH = "H5A007",

  // ============ 数据验证错误 (100-199) ============
  /** 验证错误 */
  VALIDATION_ERROR = "H5A100",
  /** 类型不匹配 */
  TYPE_MISMATCH = "H5A101",
  /** 必需字段缺失 */
  MISSING_REQUIRED_FIELD = "H5A102",
  /** 值超出范围 */
  VALUE_OUT_OF_RANGE = "H5A103",
  /** 无效的数组长度 */
  INVALID_ARRAY_LENGTH = "H5A104",

  // ============ 转换错误 (200-299) ============
  /** 转换失败 */
  CONVERSION_FAILED = "H5A200",
  /** JSON 解析失败 */
  JSON_PARSE_ERROR = "H5A201",
  /** Base64 解码失败 */
  BASE64_DECODE_ERROR = "H5A202",

  // ============ 处理错误 (300-399) ============
  /** WebP 处理错误 */
  WEBP_PROCESSING_ERROR = "H5A300",
  /** 图像合并错误 */
  IMAGE_MERGE_ERROR = "H5A301",
  /** 帧提取错误 */
  FRAME_EXTRACTION_ERROR = "H5A302",

  // ============ 兼容性保留 (旧代码映射) ============
  /** @deprecated 使用 VALIDATION_ERROR 代替 */
  VALIDATION_ERROR_LEGACY = "H5A008",
}

/**
 * H5Animate 自定义错误类
 */
export class H5AnimateError extends Error {
  /** 错误代码 */
  public readonly code: H5AnimateErrorCode;
  /** 错误发生的位置（字节偏移量） */
  public readonly position?: number;
  /** 期望的数据类型 */
  public readonly expectedType?: string;
  /** 实际的数据类型 */
  public readonly actualType?: string;
  /** 缺失的字段列表 */
  public readonly missingFields?: string[];
  /** 字段路径（用于嵌套对象的错误定位） */
  public readonly fieldPath?: string;

  constructor(
    code: H5AnimateErrorCode,
    message: string,
    options?: {
      position?: number;
      expectedType?: string;
      actualType?: string;
      missingFields?: string[];
      fieldPath?: string;
    },
  ) {
    super(message);
    this.name = "H5AnimateError";
    this.code = code;
    this.position = options?.position;
    this.expectedType = options?.expectedType;
    this.actualType = options?.actualType;
    this.missingFields = options?.missingFields;
    this.fieldPath = options?.fieldPath;
  }

  /**
 * 获取完整的错误描述
 */
  getFullDescription(): string {
    let description = `[${this.code}] ${this.message}`;

    if (this.position !== undefined) {
      description += ` (位置: ${this.position} 字节)`;
    }

    if (this.expectedType) {
      description += ` (期望类型: ${this.expectedType})`;
    }

    if (this.actualType) {
      description += ` (实际类型: ${this.actualType})`;
    }

    if (this.missingFields && this.missingFields.length > 0) {
      description += ` (缺失字段: ${this.missingFields.join(", ")})`;
    }

    if (this.fieldPath) {
      description += ` (字段路径: ${this.fieldPath})`;
    }

    return description;
  }

  /**
   * 转换为 JSON 格式，便于日志记录
   */
  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      position: this.position,
      expectedType: this.expectedType,
      actualType: this.actualType,
      missingFields: this.missingFields,
      fieldPath: this.fieldPath,
    };
  }
}

/**
 * 创建无效签名错误
 */
export function createInvalidSignatureError(actual: string): H5AnimateError {
  return new H5AnimateError(
    H5AnimateErrorCode.INVALID_SIGNATURE,
    `无效的文件签名: 期望 "ANIM", 实际为 "${actual}"`,
    { position: 0, expectedType: "ANIM" },
  );
}

/**
 * 创建无效版本错误
 */
export function createInvalidVersionError(version: number): H5AnimateError {
  return new H5AnimateError(
    H5AnimateErrorCode.INVALID_VERSION,
    `不支持的版本号: ${version}`,
    { position: 4 },
  );
}

/**
 * 创建损坏的文件头错误
 */
export function createCorruptedHeaderError(position: number, reason: string): H5AnimateError {
  return new H5AnimateError(
    H5AnimateErrorCode.CORRUPTED_HEADER,
    `文件头损坏: ${reason}`,
    { position },
  );
}

/**
 * 创建无效图像数据错误
 */
export function createInvalidImageDataError(reason: string): H5AnimateError {
  return new H5AnimateError(
    H5AnimateErrorCode.INVALID_IMAGE_DATA,
    `无效的图像数据: ${reason}`,
  );
}

/**
 * 创建无效元数据错误
 */
export function createInvalidMetadataError(reason: string, missingFields?: string[]): H5AnimateError {
  return new H5AnimateError(
    H5AnimateErrorCode.INVALID_METADATA,
    `无效的元数据: ${reason}`,
    { missingFields },
  );
}

/**
 * 创建转换失败错误
 */
export function createConversionFailedError(reason: string): H5AnimateError {
  return new H5AnimateError(
    H5AnimateErrorCode.CONVERSION_FAILED,
    `格式转换失败: ${reason}`,
  );
}

/**
 * 创建 WebP 处理错误
 */
export function createWebPProcessingError(reason: string): H5AnimateError {
  return new H5AnimateError(
    H5AnimateErrorCode.WEBP_PROCESSING_ERROR,
    `WebP 处理错误: ${reason}`,
  );
}

/**
 * 创建验证错误
 */
export function createValidationError(reason: string, missingFields?: string[]): H5AnimateError {
  return new H5AnimateError(
    H5AnimateErrorCode.VALIDATION_ERROR,
    `验证错误: ${reason}`,
    { missingFields },
  );
}

/**
 * 创建类型不匹配错误
 */
export function createTypeMismatchError(
  fieldPath: string,
  expectedType: string,
  actualType: string,
): H5AnimateError {
  return new H5AnimateError(
    H5AnimateErrorCode.TYPE_MISMATCH,
    `类型不匹配: 字段 "${fieldPath}" 期望 ${expectedType}，实际为 ${actualType}`,
    { fieldPath, expectedType, actualType },
  );
}

/**
 * 创建必需字段缺失错误
 */
export function createMissingFieldError(missingFields: string[], fieldPath?: string): H5AnimateError {
  const pathPrefix = fieldPath ? `在 "${fieldPath}" 中` : "";
  return new H5AnimateError(
    H5AnimateErrorCode.MISSING_REQUIRED_FIELD,
    `${pathPrefix}缺少必需字段: ${missingFields.join(", ")}`,
    { missingFields, fieldPath },
  );
}

/**
 * 创建值超出范围错误
 */
export function createValueOutOfRangeError(
  fieldPath: string,
  value: number,
  min?: number,
  max?: number,
): H5AnimateError {
  let rangeDesc = "";
  if (min !== undefined && max !== undefined) {
    rangeDesc = `[${min}, ${max}]`;
  } else if (min !== undefined) {
    rangeDesc = `>= ${min}`;
  } else if (max !== undefined) {
    rangeDesc = `<= ${max}`;
  }
  return new H5AnimateError(
    H5AnimateErrorCode.VALUE_OUT_OF_RANGE,
    `值超出范围: 字段 "${fieldPath}" 的值 ${value} 不在有效范围 ${rangeDesc} 内`,
    { fieldPath },
  );
}

/**
 * 创建无效数组长度错误
 */
export function createInvalidArrayLengthError(
  fieldPath: string,
  expectedLength: number,
  actualLength: number,
): H5AnimateError {
  return new H5AnimateError(
    H5AnimateErrorCode.INVALID_ARRAY_LENGTH,
    `无效的数组长度: 字段 "${fieldPath}" 期望长度 ${expectedLength}，实际为 ${actualLength}`,
    { fieldPath, expectedType: `Array[${expectedLength}]`, actualType: `Array[${actualLength}]` },
  );
}

/**
 * 创建文件截断错误
 */
export function createFileTruncatedError(position: number, expectedSize: number, actualSize: number): H5AnimateError {
  return new H5AnimateError(
    H5AnimateErrorCode.FILE_TRUNCATED,
    `文件截断: 在位置 ${position} 期望至少 ${expectedSize} 字节，但文件只有 ${actualSize} 字节`,
    { position },
  );
}

/**
 * 创建数据大小不匹配错误
 */
export function createSizeMismatchError(
  fieldName: string,
  expectedSize: number,
  actualSize: number,
  position?: number,
): H5AnimateError {
  return new H5AnimateError(
    H5AnimateErrorCode.SIZE_MISMATCH,
    `数据大小不匹配: ${fieldName} 声明大小为 ${expectedSize} 字节，实际为 ${actualSize} 字节`,
    { position },
  );
}

/**
 * 创建 JSON 解析错误
 */
export function createJsonParseError(reason: string, position?: number): H5AnimateError {
  return new H5AnimateError(
    H5AnimateErrorCode.JSON_PARSE_ERROR,
    `JSON 解析失败: ${reason}`,
    { position },
  );
}

/**
 * 创建 Base64 解码错误
 */
export function createBase64DecodeError(reason: string, fieldPath?: string): H5AnimateError {
  return new H5AnimateError(
    H5AnimateErrorCode.BASE64_DECODE_ERROR,
    `Base64 解码失败: ${reason}`,
    { fieldPath },
  );
}

/**
 * 创建图像合并错误
 */
export function createImageMergeError(reason: string): H5AnimateError {
  return new H5AnimateError(
    H5AnimateErrorCode.IMAGE_MERGE_ERROR,
    `图像合并错误: ${reason}`,
  );
}

/**
 * 创建帧提取错误
 */
export function createFrameExtractionError(reason: string, frameIndex?: number): H5AnimateError {
  const indexInfo = frameIndex !== undefined ? ` (帧索引: ${frameIndex})` : "";
  return new H5AnimateError(
    H5AnimateErrorCode.FRAME_EXTRACTION_ERROR,
    `帧提取错误: ${reason}${indexInfo}`,
  );
}

/**
 * 获取错误类型的描述
 */
export function getErrorCodeDescription(code: H5AnimateErrorCode): string {
  const descriptions: Record<H5AnimateErrorCode, string> = {
    [H5AnimateErrorCode.INVALID_SIGNATURE]: "文件签名无效，不是有效的 h5animate 文件",
    [H5AnimateErrorCode.INVALID_VERSION]: "文件版本不受支持",
    [H5AnimateErrorCode.CORRUPTED_HEADER]: "文件头数据损坏",
    [H5AnimateErrorCode.INVALID_IMAGE_DATA]: "图像数据无效或损坏",
    [H5AnimateErrorCode.INVALID_METADATA]: "元数据格式无效",
    [H5AnimateErrorCode.FILE_TRUNCATED]: "文件不完整，数据被截断",
    [H5AnimateErrorCode.SIZE_MISMATCH]: "声明的数据大小与实际不符",
    [H5AnimateErrorCode.VALIDATION_ERROR]: "数据验证失败",
    [H5AnimateErrorCode.TYPE_MISMATCH]: "数据类型不匹配",
    [H5AnimateErrorCode.MISSING_REQUIRED_FIELD]: "缺少必需的字段",
    [H5AnimateErrorCode.VALUE_OUT_OF_RANGE]: "数值超出有效范围",
    [H5AnimateErrorCode.INVALID_ARRAY_LENGTH]: "数组长度不符合要求",
    [H5AnimateErrorCode.CONVERSION_FAILED]: "格式转换失败",
    [H5AnimateErrorCode.JSON_PARSE_ERROR]: "JSON 解析失败",
    [H5AnimateErrorCode.BASE64_DECODE_ERROR]: "Base64 解码失败",
    [H5AnimateErrorCode.WEBP_PROCESSING_ERROR]: "WebP 图像处理失败",
    [H5AnimateErrorCode.IMAGE_MERGE_ERROR]: "图像合并失败",
    [H5AnimateErrorCode.FRAME_EXTRACTION_ERROR]: "帧提取失败",
    [H5AnimateErrorCode.VALIDATION_ERROR_LEGACY]: "数据验证失败（旧版）",
  };
  return descriptions[code] || "未知错误";
}
