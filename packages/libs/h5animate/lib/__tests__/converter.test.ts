import { describe, test, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import {
  validateLegacyFormat,
  parseLegacyAnimateFile,
  convertSoundData,
  convertFrameLayer,
  convertMetadata,
  convertToH5Animate,
  convertFromJsonString,
} from "../converter.js";
import { decodeH5Animate } from "../decoder.js";
import { H5AnimateError, H5AnimateErrorCode } from "../errors.js";
import type { LegacyAnimateFile } from "../types.js";

// 读取真实的 .animate 测试文件
const sampleAnimatePath = join(__dirname, "../../sample/hand.animate");
const sampleAnimateContent = readFileSync(sampleAnimatePath, "utf-8");
const sampleAnimateData: LegacyAnimateFile = JSON.parse(sampleAnimateContent);

describe("validateLegacyFormat", () => {
  test("有效的旧格式数据应该通过验证", () => {
    expect(() => validateLegacyFormat(sampleAnimateData)).not.toThrow();
  });

  test("null 输入应该抛出错误", () => {
    expect(() => validateLegacyFormat(null)).toThrow(H5AnimateError);
  });

  test("非对象输入应该抛出错误", () => {
    expect(() => validateLegacyFormat("string")).toThrow(H5AnimateError);
    expect(() => validateLegacyFormat(123)).toThrow(H5AnimateError);
  });

  test("缺少必需字段应该抛出错误并列出缺失字段", () => {
    const invalidData = { ratio: 2 };
    try {
      validateLegacyFormat(invalidData);
      expect.fail("应该抛出错误");
    } catch (error) {
      expect((error as H5AnimateError).code).toBe(H5AnimateErrorCode.VALIDATION_ERROR);
      expect((error as H5AnimateError).missingFields).toContain("bitmaps");
      expect((error as H5AnimateError).missingFields).toContain("frame_max");
      expect((error as H5AnimateError).missingFields).toContain("frames");
    }
  });

  test("ratio 不是数字应该抛出错误", () => {
    const invalidData = {
      ratio: "2",
      bitmaps: [],
      frame_max: 1,
      frames: [],
    };
    expect(() => validateLegacyFormat(invalidData)).toThrow(H5AnimateError);
  });

  test("bitmaps 不是数组应该抛出错误", () => {
    const invalidData = {
      ratio: 2,
      bitmaps: "not-array",
      frame_max: 1,
      frames: [],
    };
    expect(() => validateLegacyFormat(invalidData)).toThrow(H5AnimateError);
  });

  test("frame_max 为负数应该抛出错误", () => {
    const invalidData = {
      ratio: 2,
      bitmaps: [],
      frame_max: -1,
      frames: [],
    };
    expect(() => validateLegacyFormat(invalidData)).toThrow(H5AnimateError);
  });
});

describe("parseLegacyAnimateFile", () => {
  test("应该正确解析有效的 JSON 字符串", () => {
    const result = parseLegacyAnimateFile(sampleAnimateContent);
    expect(result.ratio).toBe(2);
    expect(result.se).toBe("attack.mp3");
    expect(result.frame_max).toBe(8);
    expect(result.bitmaps).toHaveLength(10);
    expect(result.frames).toHaveLength(8);
  });

  test("无效的 JSON 应该抛出错误", () => {
    expect(() => parseLegacyAnimateFile("invalid json")).toThrow(H5AnimateError);
  });

  test("错误应该包含正确的错误代码", () => {
    try {
      parseLegacyAnimateFile("invalid json");
      expect.fail("应该抛出错误");
    } catch (error) {
      expect((error as H5AnimateError).code).toBe(H5AnimateErrorCode.CONVERSION_FAILED);
    }
  });
});

describe("convertSoundData", () => {
  test("字符串类型的 se 应该只在第一帧返回音效", () => {
    const legacy: LegacyAnimateFile = {
      ratio: 2,
      se: "attack.mp3",
      bitmaps: [],
      frame_max: 3,
      frames: [],
    };

    expect(convertSoundData(legacy, 0)).toEqual([{ name: "attack.mp3" }]);
    expect(convertSoundData(legacy, 1)).toBeUndefined();
    expect(convertSoundData(legacy, 2)).toBeUndefined();
  });

  test("对象类型的 se 应该按帧返回音效", () => {
    const legacy: LegacyAnimateFile = {
      ratio: 2,
      se: { 0: "start.mp3", 2: "hit.mp3" },
      bitmaps: [],
      frame_max: 3,
      frames: [],
    };

    expect(convertSoundData(legacy, 0)).toEqual([{ name: "start.mp3" }]);
    expect(convertSoundData(legacy, 1)).toBeUndefined();
    expect(convertSoundData(legacy, 2)).toEqual([{ name: "hit.mp3" }]);
  });

  test("应该包含 pitch 信息", () => {
    const legacy: LegacyAnimateFile = {
      ratio: 2,
      se: { 0: "sound.mp3" },
      pitch: { 0: 1.5 },
      bitmaps: [],
      frame_max: 1,
      frames: [],
    };

    expect(convertSoundData(legacy, 0)).toEqual([{ name: "sound.mp3", pitch: 1.5 }]);
  });

  test("没有 se 字段应该返回 undefined", () => {
    const legacy: LegacyAnimateFile = {
      ratio: 2,
      bitmaps: [],
      frame_max: 1,
      frames: [],
    };

    expect(convertSoundData(legacy, 0)).toBeUndefined();
  });
});

describe("convertFrameLayer", () => {
  test("应该正确转换完整的图层数据", () => {
    const layer: [number, number, number, number, number, number, number] = [0, 10, 20, 100, 255, 1, 90];
    const result = convertFrameLayer(layer);

    expect(result).toEqual({
      index: 0,
      x: 10,
      y: 20,
      scale: 100,
      opacity: 255,
      mirror: 1,
      rotate: 90,
    });
  });

  test("应该为缺失的可选字段使用默认值", () => {
    const layer: [number, number, number, number, number] = [1, 5, 15, 50, 128];
    const result = convertFrameLayer(layer);

    expect(result).toEqual({
      index: 1,
      x: 5,
      y: 15,
      scale: 50,
      opacity: 128,
      mirror: 0,
      rotate: 0,
    });
  });
});

describe("convertMetadata", () => {
  test("应该正确转换真实的 .animate 文件元数据", () => {
    const result = convertMetadata(sampleAnimateData);

    expect(result.ratio).toBe(2);
    expect(result.frame).toHaveLength(8);

    // 验证第一帧有音效
    expect(result.frame[0].sound).toEqual([{ name: "attack.mp3" }]);

    // 验证第一帧的对象数据
    expect(result.frame[0].objects).toHaveLength(1);
    expect(result.frame[0].objects![0]).toEqual({
      index: 0,
      x: 0,
      y: 0,
      scale: 30,
      opacity: 120,
      mirror: 0,
      rotate: 0,
    });
  });

  test("应该正确处理空帧", () => {
    const result = convertMetadata(sampleAnimateData);

    // 第 7 帧和第 8 帧是空的
    expect(result.frame[6].objects).toBeUndefined();
    expect(result.frame[7].objects).toBeUndefined();
  });

  test("应该正确转换多个对象的帧", () => {
    const legacy: LegacyAnimateFile = {
      ratio: 1,
      bitmaps: [],
      frame_max: 1,
      frames: [
        [
          [0, 0, 0, 100, 255],
          [1, 10, 20, 50, 128, 1, 45],
        ],
      ],
    };

    const result = convertMetadata(legacy);

    expect(result.frame[0].objects).toHaveLength(2);
    expect(result.frame[0].objects![1]).toEqual({
      index: 1,
      x: 10,
      y: 20,
      scale: 50,
      opacity: 128,
      mirror: 1,
      rotate: 45,
    });
  });
});

describe("convertToH5Animate", () => {
  test("应该成功转换真实的 .animate 文件", async () => {
    const result = await convertToH5Animate(sampleAnimateData);

    // 验证结果是有效的 Buffer
    expect(Buffer.isBuffer(result)).toBe(true);

    // 验证可以解码
    const decoded = decodeH5Animate(result);
    expect(decoded.meta.ratio).toBe(2);
    expect(decoded.meta.frame).toHaveLength(8);
  });

  test("转换后的数据应该保持元数据一致性", async () => {
    const result = await convertToH5Animate(sampleAnimateData);
    const decoded = decodeH5Animate(result);

    // 验证 ratio
    expect(decoded.meta.ratio).toBe(sampleAnimateData.ratio);

    // 验证帧数
    expect(decoded.meta.frame).toHaveLength(sampleAnimateData.frame_max);

    // 验证第一帧的音效
    expect(decoded.meta.frame[0].sound).toEqual([{ name: "attack.mp3" }]);

    // 验证第一帧的对象数据
    expect(decoded.meta.frame[0].objects![0]).toEqual({
      index: 0,
      x: 0,
      y: 0,
      scale: 30,
      opacity: 120,
      mirror: 0,
      rotate: 0,
    });
  });

  test("应该生成有效的精灵图信息", async () => {
    const result = await convertToH5Animate(sampleAnimateData);
    const decoded = decodeH5Animate(result);

    expect(decoded.spriteInfo.count).toBe(1);
    expect(decoded.spriteInfo.dimensions).toHaveLength(1);
    expect(decoded.spriteInfo.dimensions[0].width).toBeGreaterThan(0);
    expect(decoded.spriteInfo.dimensions[0].height).toBeGreaterThan(0);
  });

  test("无效输入应该抛出错误", async () => {
    const invalidData = { ratio: 2 } as unknown as LegacyAnimateFile;

    await expect(convertToH5Animate(invalidData)).rejects.toThrow(H5AnimateError);
  });

  test("没有有效图片的数据应该抛出错误", async () => {
    const noImagesData: LegacyAnimateFile = {
      ratio: 2,
      bitmaps: ["", "", ""],
      frame_max: 1,
      frames: [[[0, 0, 0, 100, 255]]],
    };

    await expect(convertToH5Animate(noImagesData)).rejects.toThrow(H5AnimateError);
  });
});

describe("convertFromJsonString", () => {
  test("应该成功从 JSON 字符串转换", async () => {
    const result = await convertFromJsonString(sampleAnimateContent);

    expect(Buffer.isBuffer(result)).toBe(true);

    const decoded = decodeH5Animate(result);
    expect(decoded.meta.ratio).toBe(2);
  });

  test("无效的 JSON 应该抛出错误", async () => {
    await expect(convertFromJsonString("invalid json")).rejects.toThrow(H5AnimateError);
  });
});
