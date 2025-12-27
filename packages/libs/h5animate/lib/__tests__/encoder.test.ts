import { describe, test, expect } from "vitest";
import {
  convertObjectToArray,
  convertObjectsToArrays,
  metaReplacer,
  validateEncodeInput,
  encodeH5Animate,
} from "../encoder.js";
import { decodeH5Animate } from "../decoder.js";
import { H5AnimateError, H5AnimateErrorCode } from "../errors.js";
import type { H5AnimateMeta, SpriteInfo, H5AnimateObject } from "../types.js";

describe("convertObjectToArray", () => {
  test("应该正确转换完整的对象到数组", () => {
    const obj: H5AnimateObject = {
      index: 0,
      x: 10,
      y: 20,
      scale: 100,
      opacity: 255,
      mirror: 1,
      rotate: 90,
    };

    const result = convertObjectToArray(obj);

    expect(result).toEqual([0, 10, 20, 100, 255, 1, 90]);
  });

  test("应该为缺失的可选字段使用默认值 0", () => {
    const obj: H5AnimateObject = {
      index: 1,
      x: 5,
      y: 15,
      scale: 50,
      opacity: 128,
    };

    const result = convertObjectToArray(obj);

    expect(result).toEqual([1, 5, 15, 50, 128, 0, 0]);
  });
});

describe("convertObjectsToArrays", () => {
  test("应该正确转换元数据中的对象格式到数组格式", () => {
    const meta: H5AnimateMeta = {
      ratio: 2,
      frame: [
        {
          objects: [
            { index: 0, x: 10, y: 20, scale: 100, opacity: 255, mirror: 0, rotate: 0 },
          ],
        },
      ],
    };

    const result = convertObjectsToArrays(meta);

    expect(result.ratio).toBe(2);
    expect(result.frame).toHaveLength(1);
    expect(result.frame[0].objects).toEqual([[0, 10, 20, 100, 255, 0, 0]]);
  });

  test("应该保留音效数据", () => {
    const meta: H5AnimateMeta = {
      ratio: 2,
      frame: [
        {
          sound: [{ name: "attack.mp3", volume: 0.8 }],
          objects: [{ index: 0, x: 0, y: 0, scale: 100, opacity: 255 }],
        },
      ],
    };

    const result = convertObjectsToArrays(meta);

    expect(result.frame[0].sound).toEqual([{ name: "attack.mp3", volume: 0.8 }]);
  });

  test("应该处理空帧", () => {
    const meta: H5AnimateMeta = {
      ratio: 1,
      frame: [
        {},
        { objects: [{ index: 0, x: 0, y: 0, scale: 100, opacity: 255 }] },
      ],
    };

    const result = convertObjectsToArrays(meta);

    expect(result.frame).toHaveLength(2);
    expect(result.frame[0].objects).toBeUndefined();
    expect(result.frame[1].objects).toEqual([[0, 0, 0, 100, 255, 0, 0]]);
  });
});

describe("metaReplacer", () => {
  test("应该转换 objects 数组", () => {
    const objects: H5AnimateObject[] = [
      { index: 0, x: 10, y: 20, scale: 100, opacity: 255 },
    ];

    const result = metaReplacer("objects", objects);

    expect(result).toEqual([[0, 10, 20, 100, 255, 0, 0]]);
  });

  test("应该保持非 objects 键的值不变", () => {
    expect(metaReplacer("ratio", 2)).toBe(2);
    expect(metaReplacer("sound", [{ name: "test.mp3" }])).toEqual([{ name: "test.mp3" }]);
  });

  test("应该在 JSON.stringify 中正确工作", () => {
    const meta: H5AnimateMeta = {
      ratio: 2,
      frame: [
        {
          objects: [{ index: 0, x: 10, y: 20, scale: 100, opacity: 255 }],
        },
      ],
    };

    const json = JSON.stringify(meta, metaReplacer);
    const parsed = JSON.parse(json);

    expect(parsed.frame[0].objects).toEqual([[0, 10, 20, 100, 255, 0, 0]]);
  });
});

describe("validateEncodeInput", () => {
  const validMeta: H5AnimateMeta = {
    ratio: 2,
    frame: [],
  };

  const validSpriteInfo: SpriteInfo = {
    count: 1,
    dimensions: [{ width: 100, height: 100 }],
  };

  const validWebpData = Buffer.from("webp");

  test("有效输入不应该抛出错误", () => {
    expect(() => validateEncodeInput(validMeta, validSpriteInfo, validWebpData)).not.toThrow();
  });

  test("缺少 meta 应该抛出错误", () => {
    expect(() => validateEncodeInput(null as unknown as H5AnimateMeta, validSpriteInfo, validWebpData))
      .toThrow(H5AnimateError);
  });

  test("缺少 meta.ratio 应该抛出错误", () => {
    const invalidMeta = { frame: [] } as unknown as H5AnimateMeta;
    expect(() => validateEncodeInput(invalidMeta, validSpriteInfo, validWebpData))
      .toThrow(H5AnimateError);
  });

  test("缺少 meta.frame 应该抛出错误", () => {
    const invalidMeta = { ratio: 2 } as unknown as H5AnimateMeta;
    expect(() => validateEncodeInput(invalidMeta, validSpriteInfo, validWebpData))
      .toThrow(H5AnimateError);
  });

  test("缺少 spriteInfo 应该抛出错误", () => {
    expect(() => validateEncodeInput(validMeta, null as unknown as SpriteInfo, validWebpData))
      .toThrow(H5AnimateError);
  });

  test("缺少 webpData 应该抛出错误", () => {
    expect(() => validateEncodeInput(validMeta, validSpriteInfo, null as unknown as Buffer))
      .toThrow(H5AnimateError);
  });

  test("错误应该包含缺失字段列表", () => {
    try {
      validateEncodeInput(null as unknown as H5AnimateMeta, null as unknown as SpriteInfo, null as unknown as Buffer);
    } catch (error) {
      expect((error as H5AnimateError).code).toBe(H5AnimateErrorCode.VALIDATION_ERROR);
      expect((error as H5AnimateError).missingFields).toContain("meta");
      expect((error as H5AnimateError).missingFields).toContain("spriteInfo");
      expect((error as H5AnimateError).missingFields).toContain("webpData");
    }
  });
});

describe("encodeH5Animate", () => {
  test("应该正确编码简单的动画数据", () => {
    const meta: H5AnimateMeta = {
      ratio: 2,
      frame: [
        {
          objects: [{ index: 0, x: 10, y: 20, scale: 100, opacity: 255 }],
        },
      ],
    };

    const spriteInfo: SpriteInfo = {
      count: 1,
      dimensions: [{ width: 100, height: 100 }],
    };

    const webpData = Buffer.from("fake-webp-data");

    const encoded = encodeH5Animate(meta, spriteInfo, webpData);

    // 验证文件头
    expect(encoded.subarray(0, 4).toString("ascii")).toBe("ANIM");
    expect(encoded.readUInt32LE(4)).toBe(1); // version
  });

  test("编码后解码应该得到等价的数据（往返测试）", () => {
    const meta: H5AnimateMeta = {
      ratio: 2,
      frame: [
        {
          objects: [
            { index: 0, x: 10, y: 20, scale: 100, opacity: 255, mirror: 0, rotate: 0 },
          ],
        },
      ],
    };

    const spriteInfo: SpriteInfo = {
      count: 1,
      dimensions: [{ width: 100, height: 100 }],
    };

    const webpData = Buffer.from("fake-webp-data");

    const encoded = encodeH5Animate(meta, spriteInfo, webpData);
    const decoded = decodeH5Animate(encoded);

    expect(decoded.meta).toEqual(meta);
    expect(decoded.spriteInfo).toEqual(spriteInfo);
    expect(decoded.webpData).toEqual(webpData);
  });

  test("应该正确处理包含音效的数据", () => {
    const meta: H5AnimateMeta = {
      ratio: 1,
      frame: [
        {
          sound: [{ name: "attack.mp3", pitch: 1.2 }],
          objects: [{ index: 0, x: 0, y: 0, scale: 100, opacity: 255 }],
        },
      ],
    };

    const spriteInfo: SpriteInfo = {
      count: 1,
      dimensions: [{ width: 50, height: 50 }],
    };

    const webpData = Buffer.from("webp");

    const encoded = encodeH5Animate(meta, spriteInfo, webpData);
    const decoded = decodeH5Animate(encoded);

    expect(decoded.meta.frame[0].sound).toEqual([{ name: "attack.mp3", pitch: 1.2 }]);
  });

  test("应该正确处理多帧动画", () => {
    const meta: H5AnimateMeta = {
      ratio: 1,
      frame: [
        { objects: [{ index: 0, x: 0, y: 0, scale: 100, opacity: 255, mirror: 0, rotate: 0 }] },
        { objects: [{ index: 0, x: 10, y: 10, scale: 100, opacity: 200, mirror: 0, rotate: 0 }] },
        { objects: [{ index: 1, x: 20, y: 20, scale: 50, opacity: 128, mirror: 1, rotate: 90 }] },
      ],
    };

    const spriteInfo: SpriteInfo = {
      count: 1,
      dimensions: [{ width: 64, height: 192 }],
    };

    const webpData = Buffer.from("multi-frame-webp");

    const encoded = encodeH5Animate(meta, spriteInfo, webpData);
    const decoded = decodeH5Animate(encoded);

    expect(decoded.meta.frame).toHaveLength(3);
    expect(decoded.meta.frame[2].objects![0]).toEqual({
      index: 1,
      x: 20,
      y: 20,
      scale: 50,
      opacity: 128,
      mirror: 1,
      rotate: 90,
    });
  });

  test("应该正确处理多个精灵图", () => {
    const meta: H5AnimateMeta = {
      ratio: 2,
      frame: [{ objects: [{ index: 0, x: 0, y: 0, scale: 100, opacity: 255, mirror: 0, rotate: 0 }] }],
    };

    const spriteInfo: SpriteInfo = {
      count: 2,
      dimensions: [
        { width: 100, height: 200 },
        { width: 150, height: 250 },
      ],
    };

    const webpData = Buffer.from("multi-sprite-webp");

    const encoded = encodeH5Animate(meta, spriteInfo, webpData);
    const decoded = decodeH5Animate(encoded);

    expect(decoded.spriteInfo.count).toBe(2);
    expect(decoded.spriteInfo.dimensions).toEqual([
      { width: 100, height: 200 },
      { width: 150, height: 250 },
    ]);
  });

  test("应该正确处理空帧", () => {
    const meta: H5AnimateMeta = {
      ratio: 1,
      frame: [
        {},
        { objects: [{ index: 0, x: 0, y: 0, scale: 100, opacity: 255, mirror: 0, rotate: 0 }] },
      ],
    };

    const spriteInfo: SpriteInfo = {
      count: 1,
      dimensions: [{ width: 32, height: 32 }],
    };

    const webpData = Buffer.from("webp");

    const encoded = encodeH5Animate(meta, spriteInfo, webpData);
    const decoded = decodeH5Animate(encoded);

    expect(decoded.meta.frame).toHaveLength(2);
    expect(decoded.meta.frame[0].objects).toBeUndefined();
  });

  test("无效输入应该抛出验证错误", () => {
    expect(() => encodeH5Animate(
      null as unknown as H5AnimateMeta,
      { count: 1, dimensions: [{ width: 100, height: 100 }] },
      Buffer.from("webp"),
    )).toThrow(H5AnimateError);
  });
});
