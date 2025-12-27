import { describe, test, expect } from "vitest";
import {
  validateSoundMeta,
  validateH5AnimateObject,
  validateH5AnimateFrame,
  validateH5AnimateMeta,
  validateSpriteDimension,
  validateSpriteInfo,
  validateLegacyAnimateFile,
  validateH5AnimateMetaSafe,
  validateSpriteInfoSafe,
  validateEncodeInputComplete,
} from "../validation.js";
import { H5AnimateErrorCode, H5AnimateError } from "../errors.js";

describe("validateSoundMeta", () => {
  test("应该验证有效的音效元数据", () => {
    const sound = { name: "attack.mp3" };
    expect(() => validateSoundMeta(sound, "sound")).not.toThrow();
  });

  test("应该验证带可选字段的音效元数据", () => {
    const sound = { name: "attack.mp3", volume: 0.8, pitch: 1.2 };
    expect(() => validateSoundMeta(sound, "sound")).not.toThrow();
  });

  test("应该拒绝 null 值", () => {
    expect(() => validateSoundMeta(null, "sound")).toThrow(H5AnimateError);
  });

  test("应该拒绝缺少 name 字段的对象", () => {
    const sound = { volume: 0.8 };
    expect(() => validateSoundMeta(sound, "sound")).toThrow(H5AnimateError);
  });

  test("应该拒绝 name 类型错误", () => {
    const sound = { name: 123 };
    expect(() => validateSoundMeta(sound, "sound")).toThrow(H5AnimateError);
  });

  test("应该拒绝 volume 类型错误", () => {
    const sound = { name: "test.mp3", volume: "high" };
    expect(() => validateSoundMeta(sound, "sound")).toThrow(H5AnimateError);
  });
});

describe("validateH5AnimateObject", () => {
  test("应该验证有效的对象数据", () => {
    const obj = { index: 0, x: 10, y: 20, scale: 100, opacity: 255 };
    expect(() => validateH5AnimateObject(obj, "obj")).not.toThrow();
  });

  test("应该验证带可选字段的对象数据", () => {
    const obj = { index: 0, x: 10, y: 20, scale: 100, opacity: 255, mirror: 1, rotate: 90 };
    expect(() => validateH5AnimateObject(obj, "obj")).not.toThrow();
  });

  test("应该拒绝缺少必需字段的对象", () => {
    const obj = { index: 0, x: 10 };
    try {
      validateH5AnimateObject(obj, "obj");
      expect.fail("应该抛出错误");
    } catch (error) {
      expect(error).toBeInstanceOf(H5AnimateError);
      expect((error as H5AnimateError).code).toBe(H5AnimateErrorCode.MISSING_REQUIRED_FIELD);
    }
  });

  test("应该拒绝负数的 index", () => {
    const obj = { index: -1, x: 10, y: 20, scale: 100, opacity: 255 };
    try {
      validateH5AnimateObject(obj, "obj");
      expect.fail("应该抛出错误");
    } catch (error) {
      expect(error).toBeInstanceOf(H5AnimateError);
      expect((error as H5AnimateError).code).toBe(H5AnimateErrorCode.VALUE_OUT_OF_RANGE);
    }
  });

  test("应该拒绝超出范围的 opacity", () => {
    const obj = { index: 0, x: 10, y: 20, scale: 100, opacity: 300 };
    try {
      validateH5AnimateObject(obj, "obj");
      expect.fail("应该抛出错误");
    } catch (error) {
      expect(error).toBeInstanceOf(H5AnimateError);
      expect((error as H5AnimateError).code).toBe(H5AnimateErrorCode.VALUE_OUT_OF_RANGE);
    }
  });

  test("应该拒绝类型错误的字段", () => {
    const obj = { index: "0", x: 10, y: 20, scale: 100, opacity: 255 };
    try {
      validateH5AnimateObject(obj, "obj");
      expect.fail("应该抛出错误");
    } catch (error) {
      expect(error).toBeInstanceOf(H5AnimateError);
      expect((error as H5AnimateError).code).toBe(H5AnimateErrorCode.TYPE_MISMATCH);
    }
  });
});

describe("validateH5AnimateFrame", () => {
  test("应该验证空帧", () => {
    const frame = {};
    expect(() => validateH5AnimateFrame(frame, "frame")).not.toThrow();
  });

  test("应该验证带 objects 的帧", () => {
    const frame = {
      objects: [{ index: 0, x: 10, y: 20, scale: 100, opacity: 255 }],
    };
    expect(() => validateH5AnimateFrame(frame, "frame")).not.toThrow();
  });

  test("应该验证带 sound 的帧", () => {
    const frame = {
      sound: [{ name: "attack.mp3" }],
    };
    expect(() => validateH5AnimateFrame(frame, "frame")).not.toThrow();
  });

  test("应该拒绝 objects 不是数组", () => {
    const frame = { objects: "invalid" };
    try {
      validateH5AnimateFrame(frame, "frame");
      expect.fail("应该抛出错误");
    } catch (error) {
      expect(error).toBeInstanceOf(H5AnimateError);
      expect((error as H5AnimateError).code).toBe(H5AnimateErrorCode.TYPE_MISMATCH);
    }
  });

  test("应该拒绝无效的 objects 元素", () => {
    const frame = {
      objects: [{ index: -1, x: 10, y: 20, scale: 100, opacity: 255 }],
    };
    expect(() => validateH5AnimateFrame(frame, "frame")).toThrow(H5AnimateError);
  });
});

describe("validateH5AnimateMeta", () => {
  test("应该验证有效的元数据", () => {
    const meta = {
      ratio: 2,
      frame: [{ objects: [{ index: 0, x: 0, y: 0, scale: 100, opacity: 255 }] }],
    };
    expect(() => validateH5AnimateMeta(meta)).not.toThrow();
  });

  test("应该验证空帧数组的元数据", () => {
    const meta = { ratio: 1, frame: [] };
    expect(() => validateH5AnimateMeta(meta)).not.toThrow();
  });

  test("应该拒绝缺少 ratio 的元数据", () => {
    const meta = { frame: [] };
    try {
      validateH5AnimateMeta(meta);
      expect.fail("应该抛出错误");
    } catch (error) {
      expect(error).toBeInstanceOf(H5AnimateError);
      expect((error as H5AnimateError).code).toBe(H5AnimateErrorCode.MISSING_REQUIRED_FIELD);
    }
  });

  test("应该拒绝缺少 frame 的元数据", () => {
    const meta = { ratio: 2 };
    try {
      validateH5AnimateMeta(meta);
      expect.fail("应该抛出错误");
    } catch (error) {
      expect(error).toBeInstanceOf(H5AnimateError);
      expect((error as H5AnimateError).code).toBe(H5AnimateErrorCode.MISSING_REQUIRED_FIELD);
    }
  });

  test("应该拒绝 ratio 为 0 或负数", () => {
    const meta = { ratio: 0, frame: [] };
    try {
      validateH5AnimateMeta(meta);
      expect.fail("应该抛出错误");
    } catch (error) {
      expect(error).toBeInstanceOf(H5AnimateError);
      expect((error as H5AnimateError).code).toBe(H5AnimateErrorCode.VALUE_OUT_OF_RANGE);
    }
  });

  test("应该拒绝 frame 不是数组", () => {
    const meta = { ratio: 2, frame: "invalid" };
    try {
      validateH5AnimateMeta(meta);
      expect.fail("应该抛出错误");
    } catch (error) {
      expect(error).toBeInstanceOf(H5AnimateError);
      expect((error as H5AnimateError).code).toBe(H5AnimateErrorCode.TYPE_MISMATCH);
    }
  });

  test("应该拒绝 null 值", () => {
    try {
      validateH5AnimateMeta(null);
      expect.fail("应该抛出错误");
    } catch (error) {
      expect(error).toBeInstanceOf(H5AnimateError);
      expect((error as H5AnimateError).code).toBe(H5AnimateErrorCode.TYPE_MISMATCH);
    }
  });
});

describe("validateSpriteDimension", () => {
  test("应该验证有效的尺寸", () => {
    const dimension = { width: 100, height: 200 };
    expect(() => validateSpriteDimension(dimension, "dim")).not.toThrow();
  });

  test("应该拒绝缺少字段的尺寸", () => {
    const dimension = { width: 100 };
    try {
      validateSpriteDimension(dimension, "dim");
      expect.fail("应该抛出错误");
    } catch (error) {
      expect(error).toBeInstanceOf(H5AnimateError);
      expect((error as H5AnimateError).code).toBe(H5AnimateErrorCode.MISSING_REQUIRED_FIELD);
    }
  });

  test("应该拒绝非正数的宽度", () => {
    const dimension = { width: 0, height: 100 };
    try {
      validateSpriteDimension(dimension, "dim");
      expect.fail("应该抛出错误");
    } catch (error) {
      expect(error).toBeInstanceOf(H5AnimateError);
      expect((error as H5AnimateError).code).toBe(H5AnimateErrorCode.VALUE_OUT_OF_RANGE);
    }
  });
});

describe("validateSpriteInfo", () => {
  test("应该验证有效的精灵图信息", () => {
    const spriteInfo = {
      count: 1,
      dimensions: [{ width: 100, height: 200 }],
    };
    expect(() => validateSpriteInfo(spriteInfo)).not.toThrow();
  });

  test("应该拒绝缺少字段的精灵图信息", () => {
    const spriteInfo = { count: 1 };
    try {
      validateSpriteInfo(spriteInfo);
      expect.fail("应该抛出错误");
    } catch (error) {
      expect(error).toBeInstanceOf(H5AnimateError);
      expect((error as H5AnimateError).code).toBe(H5AnimateErrorCode.MISSING_REQUIRED_FIELD);
    }
  });

  test("应该拒绝负数的 count", () => {
    const spriteInfo = { count: -1, dimensions: [] };
    try {
      validateSpriteInfo(spriteInfo);
      expect.fail("应该抛出错误");
    } catch (error) {
      expect(error).toBeInstanceOf(H5AnimateError);
      expect((error as H5AnimateError).code).toBe(H5AnimateErrorCode.VALUE_OUT_OF_RANGE);
    }
  });
});

describe("validateLegacyAnimateFile", () => {
  test("应该验证有效的旧格式文件", () => {
    const data = {
      ratio: 2,
      bitmaps: ["data:image/png;base64,abc"],
      frame_max: 1,
      frames: [[[0, 0, 0, 100, 255]]],
    };
    expect(() => validateLegacyAnimateFile(data)).not.toThrow();
  });

  test("应该验证带可选字段的旧格式文件", () => {
    const data = {
      ratio: 2,
      bitmaps: ["data:image/png;base64,abc"],
      frame_max: 1,
      frames: [[[0, 0, 0, 100, 255]]],
      se: "attack.mp3",
      pitch: { 0: 1.2 },
    };
    expect(() => validateLegacyAnimateFile(data)).not.toThrow();
  });

  test("应该拒绝缺少必需字段的数据", () => {
    const data = { ratio: 2 };
    try {
      validateLegacyAnimateFile(data);
      expect.fail("应该抛出错误");
    } catch (error) {
      expect(error).toBeInstanceOf(H5AnimateError);
      expect((error as H5AnimateError).code).toBe(H5AnimateErrorCode.MISSING_REQUIRED_FIELD);
    }
  });

  test("应该拒绝 null 值", () => {
    try {
      validateLegacyAnimateFile(null);
      expect.fail("应该抛出错误");
    } catch (error) {
      expect(error).toBeInstanceOf(H5AnimateError);
      expect((error as H5AnimateError).code).toBe(H5AnimateErrorCode.TYPE_MISMATCH);
    }
  });

  test("应该拒绝负数的 frame_max", () => {
    const data = {
      ratio: 2,
      bitmaps: [],
      frame_max: -1,
      frames: [],
    };
    try {
      validateLegacyAnimateFile(data);
      expect.fail("应该抛出错误");
    } catch (error) {
      expect(error).toBeInstanceOf(H5AnimateError);
      expect((error as H5AnimateError).code).toBe(H5AnimateErrorCode.VALUE_OUT_OF_RANGE);
    }
  });
});

describe("validateH5AnimateMetaSafe", () => {
  test("有效数据应该返回 valid: true", () => {
    const meta = { ratio: 2, frame: [] };
    const result = validateH5AnimateMetaSafe(meta);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  test("无效数据应该返回 valid: false 和错误信息", () => {
    const meta = { frame: [] };
    const result = validateH5AnimateMetaSafe(meta);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });
});

describe("validateSpriteInfoSafe", () => {
  test("有效数据应该返回 valid: true", () => {
    const spriteInfo = { count: 1, dimensions: [{ width: 100, height: 100 }] };
    const result = validateSpriteInfoSafe(spriteInfo);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  test("无效数据应该返回 valid: false 和错误信息", () => {
    const spriteInfo = { count: 1 };
    const result = validateSpriteInfoSafe(spriteInfo);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });
});

describe("validateEncodeInputComplete", () => {
  test("应该验证有效的编码输入", () => {
    const meta = { ratio: 2, frame: [] };
    const spriteInfo = { count: 1, dimensions: [{ width: 100, height: 100 }] };
    const webpData = Buffer.from("fake-webp-data");

    expect(() => validateEncodeInputComplete(meta, spriteInfo, webpData)).not.toThrow();
  });

  test("应该拒绝无效的 meta", () => {
    const meta = { frame: [] };
    const spriteInfo = { count: 1, dimensions: [{ width: 100, height: 100 }] };
    const webpData = Buffer.from("fake-webp-data");

    expect(() => validateEncodeInputComplete(meta, spriteInfo, webpData)).toThrow(H5AnimateError);
  });

  test("应该拒绝无效的 spriteInfo", () => {
    const meta = { ratio: 2, frame: [] };
    const spriteInfo = { count: 1 };
    const webpData = Buffer.from("fake-webp-data");

    expect(() => validateEncodeInputComplete(meta, spriteInfo, webpData)).toThrow(H5AnimateError);
  });

  test("应该拒绝非 Buffer 的 webpData", () => {
    const meta = { ratio: 2, frame: [] };
    const spriteInfo = { count: 1, dimensions: [{ width: 100, height: 100 }] };
    const webpData = "not-a-buffer";

    expect(() => validateEncodeInputComplete(meta, spriteInfo, webpData)).toThrow(H5AnimateError);
  });

  test("应该拒绝空的 webpData", () => {
    const meta = { ratio: 2, frame: [] };
    const spriteInfo = { count: 1, dimensions: [{ width: 100, height: 100 }] };
    const webpData = Buffer.alloc(0);

    expect(() => validateEncodeInputComplete(meta, spriteInfo, webpData)).toThrow(H5AnimateError);
  });
});
