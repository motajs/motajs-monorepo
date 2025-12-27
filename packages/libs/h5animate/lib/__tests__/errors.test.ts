import { describe, test, expect } from "vitest";
import {
  H5AnimateErrorCode,
  H5AnimateError,
  createInvalidSignatureError,
  createInvalidVersionError,
  createCorruptedHeaderError,
  createInvalidImageDataError,
  createInvalidMetadataError,
  createConversionFailedError,
  createWebPProcessingError,
  createValidationError,
  createTypeMismatchError,
  createMissingFieldError,
  createValueOutOfRangeError,
  createInvalidArrayLengthError,
  createFileTruncatedError,
  createSizeMismatchError,
  createJsonParseError,
  createBase64DecodeError,
  createImageMergeError,
  createFrameExtractionError,
  getErrorCodeDescription,
} from "../errors.js";

describe("H5AnimateError", () => {
  test("应该正确创建错误实例", () => {
    const error = new H5AnimateError(
      H5AnimateErrorCode.INVALID_SIGNATURE,
      "测试错误消息",
    );

    expect(error.code).toBe(H5AnimateErrorCode.INVALID_SIGNATURE);
    expect(error.message).toBe("测试错误消息");
    expect(error.name).toBe("H5AnimateError");
  });

  test("应该支持可选的位置参数", () => {
    const error = new H5AnimateError(
      H5AnimateErrorCode.CORRUPTED_HEADER,
      "文件头损坏",
      { position: 16 },
    );

    expect(error.position).toBe(16);
  });

  test("应该支持可选的期望类型参数", () => {
    const error = new H5AnimateError(
      H5AnimateErrorCode.INVALID_SIGNATURE,
      "无效签名",
      { expectedType: "ANIM" },
    );

    expect(error.expectedType).toBe("ANIM");
  });

  test("应该支持可选的实际类型参数", () => {
    const error = new H5AnimateError(
      H5AnimateErrorCode.TYPE_MISMATCH,
      "类型不匹配",
      { expectedType: "number", actualType: "string" },
    );

    expect(error.expectedType).toBe("number");
    expect(error.actualType).toBe("string");
  });

  test("应该支持可选的缺失字段参数", () => {
    const error = new H5AnimateError(
      H5AnimateErrorCode.VALIDATION_ERROR,
      "验证失败",
      { missingFields: ["ratio", "frame"] },
    );

    expect(error.missingFields).toEqual(["ratio", "frame"]);
  });

  test("应该支持可选的字段路径参数", () => {
    const error = new H5AnimateError(
      H5AnimateErrorCode.TYPE_MISMATCH,
      "类型不匹配",
      { fieldPath: "meta.frame[0].objects" },
    );

    expect(error.fieldPath).toBe("meta.frame[0].objects");
  });

  test("getFullDescription 应该返回完整的错误描述", () => {
    const error = new H5AnimateError(
      H5AnimateErrorCode.INVALID_SIGNATURE,
      "无效签名",
      { position: 0, expectedType: "ANIM", missingFields: ["field1"] },
    );

    const description = error.getFullDescription();
    expect(description).toContain("[H5A001]");
    expect(description).toContain("无效签名");
    expect(description).toContain("位置: 0 字节");
    expect(description).toContain("期望类型: ANIM");
    expect(description).toContain("缺失字段: field1");
  });

  test("getFullDescription 应该包含实际类型和字段路径", () => {
    const error = new H5AnimateError(
      H5AnimateErrorCode.TYPE_MISMATCH,
      "类型不匹配",
      { expectedType: "number", actualType: "string", fieldPath: "meta.ratio" },
    );

    const description = error.getFullDescription();
    expect(description).toContain("期望类型: number");
    expect(description).toContain("实际类型: string");
    expect(description).toContain("字段路径: meta.ratio");
  });

  test("toJSON 应该返回正确的 JSON 对象", () => {
    const error = new H5AnimateError(
      H5AnimateErrorCode.TYPE_MISMATCH,
      "类型不匹配",
      {
        position: 10,
        expectedType: "number",
        actualType: "string",
        missingFields: ["field1"],
        fieldPath: "meta.ratio",
      },
    );

    const json = error.toJSON();
    expect(json.name).toBe("H5AnimateError");
    expect(json.code).toBe(H5AnimateErrorCode.TYPE_MISMATCH);
    expect(json.message).toBe("类型不匹配");
    expect(json.position).toBe(10);
    expect(json.expectedType).toBe("number");
    expect(json.actualType).toBe("string");
    expect(json.missingFields).toEqual(["field1"]);
    expect(json.fieldPath).toBe("meta.ratio");
  });
});

describe("基础错误工厂函数", () => {
  test("createInvalidSignatureError 应该创建正确的错误", () => {
    const error = createInvalidSignatureError("XXXX");

    expect(error.code).toBe(H5AnimateErrorCode.INVALID_SIGNATURE);
    expect(error.message).toContain("XXXX");
    expect(error.position).toBe(0);
  });

  test("createInvalidVersionError 应该创建正确的错误", () => {
    const error = createInvalidVersionError(99);

    expect(error.code).toBe(H5AnimateErrorCode.INVALID_VERSION);
    expect(error.message).toContain("99");
  });

  test("createCorruptedHeaderError 应该创建正确的错误", () => {
    const error = createCorruptedHeaderError(8, "数据大小无效");

    expect(error.code).toBe(H5AnimateErrorCode.CORRUPTED_HEADER);
    expect(error.position).toBe(8);
  });

  test("createInvalidImageDataError 应该创建正确的错误", () => {
    const error = createInvalidImageDataError("图像数据为空");

    expect(error.code).toBe(H5AnimateErrorCode.INVALID_IMAGE_DATA);
  });

  test("createInvalidMetadataError 应该创建正确的错误", () => {
    const error = createInvalidMetadataError("JSON 解析失败", ["ratio"]);

    expect(error.code).toBe(H5AnimateErrorCode.INVALID_METADATA);
    expect(error.missingFields).toEqual(["ratio"]);
  });

  test("createConversionFailedError 应该创建正确的错误", () => {
    const error = createConversionFailedError("旧格式无效");

    expect(error.code).toBe(H5AnimateErrorCode.CONVERSION_FAILED);
  });

  test("createWebPProcessingError 应该创建正确的错误", () => {
    const error = createWebPProcessingError("编码失败");

    expect(error.code).toBe(H5AnimateErrorCode.WEBP_PROCESSING_ERROR);
  });

  test("createValidationError 应该创建正确的错误", () => {
    const error = createValidationError("必需字段缺失", ["frame", "ratio"]);

    expect(error.code).toBe(H5AnimateErrorCode.VALIDATION_ERROR);
    expect(error.missingFields).toEqual(["frame", "ratio"]);
  });
});

describe("新增错误工厂函数", () => {
  test("createTypeMismatchError 应该创建正确的错误", () => {
    const error = createTypeMismatchError("meta.ratio", "number", "string");

    expect(error.code).toBe(H5AnimateErrorCode.TYPE_MISMATCH);
    expect(error.fieldPath).toBe("meta.ratio");
    expect(error.expectedType).toBe("number");
    expect(error.actualType).toBe("string");
    expect(error.message).toContain("meta.ratio");
    expect(error.message).toContain("number");
    expect(error.message).toContain("string");
  });

  test("createMissingFieldError 应该创建正确的错误", () => {
    const error = createMissingFieldError(["ratio", "frame"], "meta");

    expect(error.code).toBe(H5AnimateErrorCode.MISSING_REQUIRED_FIELD);
    expect(error.missingFields).toEqual(["ratio", "frame"]);
    expect(error.fieldPath).toBe("meta");
    expect(error.message).toContain("ratio");
    expect(error.message).toContain("frame");
  });

  test("createMissingFieldError 无路径时应该正确创建", () => {
    const error = createMissingFieldError(["ratio"]);

    expect(error.code).toBe(H5AnimateErrorCode.MISSING_REQUIRED_FIELD);
    expect(error.missingFields).toEqual(["ratio"]);
    expect(error.fieldPath).toBeUndefined();
  });

  test("createValueOutOfRangeError 应该创建正确的错误（带范围）", () => {
    const error = createValueOutOfRangeError("meta.opacity", 300, 0, 255);

    expect(error.code).toBe(H5AnimateErrorCode.VALUE_OUT_OF_RANGE);
    expect(error.fieldPath).toBe("meta.opacity");
    expect(error.message).toContain("300");
    expect(error.message).toContain("[0, 255]");
  });

  test("createValueOutOfRangeError 应该创建正确的错误（仅最小值）", () => {
    const error = createValueOutOfRangeError("meta.index", -1, 0);

    expect(error.code).toBe(H5AnimateErrorCode.VALUE_OUT_OF_RANGE);
    expect(error.message).toContain(">= 0");
  });

  test("createValueOutOfRangeError 应该创建正确的错误（仅最大值）", () => {
    const error = createValueOutOfRangeError("meta.value", 100, undefined, 50);

    expect(error.code).toBe(H5AnimateErrorCode.VALUE_OUT_OF_RANGE);
    expect(error.message).toContain("<= 50");
  });

  test("createInvalidArrayLengthError 应该创建正确的错误", () => {
    const error = createInvalidArrayLengthError("meta.frame", 10, 5);

    expect(error.code).toBe(H5AnimateErrorCode.INVALID_ARRAY_LENGTH);
    expect(error.fieldPath).toBe("meta.frame");
    expect(error.expectedType).toBe("Array[10]");
    expect(error.actualType).toBe("Array[5]");
  });

  test("createFileTruncatedError 应该创建正确的错误", () => {
    const error = createFileTruncatedError(100, 200, 150);

    expect(error.code).toBe(H5AnimateErrorCode.FILE_TRUNCATED);
    expect(error.position).toBe(100);
    expect(error.message).toContain("100");
    expect(error.message).toContain("200");
    expect(error.message).toContain("150");
  });

  test("createSizeMismatchError 应该创建正确的错误", () => {
    const error = createSizeMismatchError("imageData", 1000, 800, 16);

    expect(error.code).toBe(H5AnimateErrorCode.SIZE_MISMATCH);
    expect(error.position).toBe(16);
    expect(error.message).toContain("imageData");
    expect(error.message).toContain("1000");
    expect(error.message).toContain("800");
  });

  test("createJsonParseError 应该创建正确的错误", () => {
    const error = createJsonParseError("意外的字符", 50);

    expect(error.code).toBe(H5AnimateErrorCode.JSON_PARSE_ERROR);
    expect(error.position).toBe(50);
    expect(error.message).toContain("意外的字符");
  });

  test("createBase64DecodeError 应该创建正确的错误", () => {
    const error = createBase64DecodeError("无效的 Base64 字符", "bitmaps[0]");

    expect(error.code).toBe(H5AnimateErrorCode.BASE64_DECODE_ERROR);
    expect(error.fieldPath).toBe("bitmaps[0]");
    expect(error.message).toContain("无效的 Base64 字符");
  });

  test("createImageMergeError 应该创建正确的错误", () => {
    const error = createImageMergeError("图像尺寸不兼容");

    expect(error.code).toBe(H5AnimateErrorCode.IMAGE_MERGE_ERROR);
    expect(error.message).toContain("图像尺寸不兼容");
  });

  test("createFrameExtractionError 应该创建正确的错误", () => {
    const error = createFrameExtractionError("帧索引超出范围", 10);

    expect(error.code).toBe(H5AnimateErrorCode.FRAME_EXTRACTION_ERROR);
    expect(error.message).toContain("帧索引超出范围");
    expect(error.message).toContain("帧索引: 10");
  });

  test("createFrameExtractionError 无帧索引时应该正确创建", () => {
    const error = createFrameExtractionError("无法提取帧");

    expect(error.code).toBe(H5AnimateErrorCode.FRAME_EXTRACTION_ERROR);
    expect(error.message).not.toContain("帧索引:");
  });
});

describe("getErrorCodeDescription", () => {
  test("应该返回正确的错误代码描述", () => {
    expect(getErrorCodeDescription(H5AnimateErrorCode.INVALID_SIGNATURE))
      .toContain("文件签名无效");

    expect(getErrorCodeDescription(H5AnimateErrorCode.INVALID_VERSION))
      .toContain("版本不受支持");

    expect(getErrorCodeDescription(H5AnimateErrorCode.TYPE_MISMATCH))
      .toContain("类型不匹配");

    expect(getErrorCodeDescription(H5AnimateErrorCode.MISSING_REQUIRED_FIELD))
      .toContain("缺少必需的字段");
  });
});

describe("错误代码唯一性", () => {
  test("所有错误代码应该是唯一的", () => {
    const codes = Object.values(H5AnimateErrorCode);
    const uniqueCodes = new Set(codes);
    expect(uniqueCodes.size).toBe(codes.length);
  });

  test("错误代码应该遵循 H5AXXX 格式", () => {
    const codes = Object.values(H5AnimateErrorCode);
    for (const code of codes) {
      expect(code).toMatch(/^H5A\d{3}$/);
    }
  });
});
