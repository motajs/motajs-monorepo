import { describe, test, expect } from "vitest";
import {
  parseHeader,
  parseSpriteInfo,
  getSpriteInfoSize,
  convertArraysToObjects,
  decodeH5Animate,
} from "../decoder.js";
import { BinaryParser, BinaryWriter } from "../binary.js";
import { H5AnimateError, H5AnimateErrorCode } from "../errors.js";

describe("parseHeader", () => {
  test("应该正确解析有效的文件头", () => {
    const writer = new BinaryWriter(16);
    writer.writeString("ANIM");
    writer.writeUInt32LE(1); // version
    writer.writeUInt32LE(100); // imageDataSize
    writer.writeUInt32LE(50); // metaDataSize

    const parser = new BinaryParser(writer.getBuffer());
    const header = parseHeader(parser);

    expect(header.signature).toBe("ANIM");
    expect(header.version).toBe(1);
    expect(header.imageDataSize).toBe(100);
    expect(header.metaDataSize).toBe(50);
  });

  test("无效签名应该抛出错误", () => {
    const writer = new BinaryWriter(16);
    writer.writeString("XXXX");
    writer.writeUInt32LE(1);
    writer.writeUInt32LE(100);
    writer.writeUInt32LE(50);

    const parser = new BinaryParser(writer.getBuffer());

    expect(() => parseHeader(parser)).toThrow(H5AnimateError);
    try {
      const parser2 = new BinaryParser(writer.getBuffer());
      parseHeader(parser2);
    } catch (error) {
      expect((error as H5AnimateError).code).toBe(H5AnimateErrorCode.INVALID_SIGNATURE);
    }
  });
});

describe("parseSpriteInfo", () => {
  test("应该正确解析单个精灵图信息", () => {
    const writer = new BinaryWriter(12);
    writer.writeUInt32LE(1); // count
    writer.writeUInt32LE(100); // width
    writer.writeUInt32LE(200); // height

    const parser = new BinaryParser(writer.getBuffer());
    const spriteInfo = parseSpriteInfo(parser);

    expect(spriteInfo.count).toBe(1);
    expect(spriteInfo.dimensions).toHaveLength(1);
    expect(spriteInfo.dimensions[0]).toEqual({ width: 100, height: 200 });
  });

  test("应该正确解析多个精灵图信息", () => {
    const writer = new BinaryWriter(20);
    writer.writeUInt32LE(2); // count
    writer.writeUInt32LE(100); // sprite 1 width
    writer.writeUInt32LE(200); // sprite 1 height
    writer.writeUInt32LE(150); // sprite 2 width
    writer.writeUInt32LE(250); // sprite 2 height

    const parser = new BinaryParser(writer.getBuffer());
    const spriteInfo = parseSpriteInfo(parser);

    expect(spriteInfo.count).toBe(2);
    expect(spriteInfo.dimensions).toHaveLength(2);
    expect(spriteInfo.dimensions[0]).toEqual({ width: 100, height: 200 });
    expect(spriteInfo.dimensions[1]).toEqual({ width: 150, height: 250 });
  });
});

describe("getSpriteInfoSize", () => {
  test("应该正确计算单个精灵图的大小", () => {
    const spriteInfo = {
      count: 1,
      dimensions: [{ width: 100, height: 200 }],
    };

    // 4 bytes for count + 8 bytes for one sprite
    expect(getSpriteInfoSize(spriteInfo)).toBe(12);
  });

  test("应该正确计算多个精灵图的大小", () => {
    const spriteInfo = {
      count: 3,
      dimensions: [
        { width: 100, height: 200 },
        { width: 150, height: 250 },
        { width: 200, height: 300 },
      ],
    };

    // 4 bytes for count + 24 bytes for three sprites
    expect(getSpriteInfoSize(spriteInfo)).toBe(28);
  });
});

describe("convertArraysToObjects", () => {
  test("应该正确转换数组格式到对象格式", () => {
    const rawMeta = {
      ratio: 2,
      frame: [
        {
          objects: [[0, 10, 20, 100, 255, 0, 0]],
        },
      ],
    };

    const result = convertArraysToObjects(rawMeta);

    expect(result.ratio).toBe(2);
    expect(result.frame).toHaveLength(1);
    expect(result.frame[0].objects).toHaveLength(1);
    expect(result.frame[0].objects![0]).toEqual({
      index: 0,
      x: 10,
      y: 20,
      scale: 100,
      opacity: 255,
      mirror: 0,
      rotate: 0,
    });
  });

  test("应该为缺失的可选字段提供默认值", () => {
    const rawMeta = {
      ratio: 2,
      frame: [
        {
          objects: [[0, 10, 20, 100, 255]], // 没有 mirror 和 rotate
        },
      ],
    };

    const result = convertArraysToObjects(rawMeta);

    expect(result.frame[0].objects![0].mirror).toBe(0);
    expect(result.frame[0].objects![0].rotate).toBe(0);
  });

  test("应该保留音效数据", () => {
    const rawMeta = {
      ratio: 2,
      frame: [
        {
          sound: [{ name: "attack.mp3", volume: 0.8 }],
          objects: [[0, 10, 20, 100, 255]],
        },
      ],
    };

    const result = convertArraysToObjects(rawMeta);

    expect(result.frame[0].sound).toEqual([{ name: "attack.mp3", volume: 0.8 }]);
  });

  test("应该处理空帧", () => {
    const rawMeta = {
      ratio: 2,
      frame: [
        {}, // 空帧
        { objects: [[0, 0, 0, 100, 255]] },
      ],
    };

    const result = convertArraysToObjects(rawMeta);

    expect(result.frame).toHaveLength(2);
    expect(result.frame[0].objects).toBeUndefined();
    expect(result.frame[1].objects).toHaveLength(1);
  });
});

describe("decodeH5Animate", () => {
  /**
   * 创建一个有效的 h5animate 测试文件
   */
  function createValidH5AnimateBuffer(
    meta: object,
    spriteInfo: { count: number; dimensions: Array<{ width: number; height: number }> },
    webpData: Buffer,
  ): Buffer {
    const metaJson = JSON.stringify(meta);
    const metaBuffer = Buffer.from(metaJson, "utf8");

    // 计算精灵图信息大小
    const spriteInfoSize = 4 + spriteInfo.count * 8;
    const imageDataSize = spriteInfoSize + webpData.length;

    // 计算总大小
    const headerSize = 16;
    const totalSize = headerSize + imageDataSize + metaBuffer.length;

    const writer = new BinaryWriter(totalSize);

    // 写入文件头
    writer.writeString("ANIM");
    writer.writeUInt32LE(1); // version
    writer.writeUInt32LE(imageDataSize);
    writer.writeUInt32LE(metaBuffer.length);

    // 写入精灵图信息
    writer.writeUInt32LE(spriteInfo.count);
    for (const dim of spriteInfo.dimensions) {
      writer.writeUInt32LE(dim.width);
      writer.writeUInt32LE(dim.height);
    }

    // 写入 WebP 数据
    writer.writeBuffer(webpData);

    // 写入元信息
    writer.writeBuffer(metaBuffer);

    return writer.getBuffer();
  }

  test("应该正确解码有效的 h5animate 文件", () => {
    const meta = {
      ratio: 2,
      frame: [
        {
          objects: [[0, 10, 20, 100, 255, 0, 0]],
        },
      ],
    };
    const spriteInfo = {
      count: 1,
      dimensions: [{ width: 100, height: 200 }],
    };
    const webpData = Buffer.from("fake-webp-data");

    const buffer = createValidH5AnimateBuffer(meta, spriteInfo, webpData);
    const result = decodeH5Animate(buffer);

    expect(result.meta.ratio).toBe(2);
    expect(result.meta.frame).toHaveLength(1);
    expect(result.meta.frame[0].objects![0]).toEqual({
      index: 0,
      x: 10,
      y: 20,
      scale: 100,
      opacity: 255,
      mirror: 0,
      rotate: 0,
    });
    expect(result.spriteInfo).toEqual(spriteInfo);
    expect(result.webpData).toEqual(webpData);
  });

  test("应该正确解码包含音效的文件", () => {
    const meta = {
      ratio: 2,
      frame: [
        {
          sound: [{ name: "attack.mp3", pitch: 1.2 }],
          objects: [[0, 0, 0, 100, 255]],
        },
      ],
    };
    const spriteInfo = {
      count: 1,
      dimensions: [{ width: 50, height: 50 }],
    };
    const webpData = Buffer.from("webp");

    const buffer = createValidH5AnimateBuffer(meta, spriteInfo, webpData);
    const result = decodeH5Animate(buffer);

    expect(result.meta.frame[0].sound).toEqual([{ name: "attack.mp3", pitch: 1.2 }]);
  });

  test("无效签名应该抛出错误", () => {
    const buffer = Buffer.alloc(32);
    buffer.write("XXXX", 0, "ascii");

    expect(() => decodeH5Animate(buffer)).toThrow(H5AnimateError);
  });

  test("无效 JSON 元数据应该抛出错误", () => {
    // 创建一个带有无效 JSON 的文件
    const invalidJson = Buffer.from("{ invalid json }");
    const spriteInfoSize = 12; // 1 sprite
    const webpData = Buffer.from("webp");
    const imageDataSize = spriteInfoSize + webpData.length;

    const headerSize = 16;
    const totalSize = headerSize + imageDataSize + invalidJson.length;

    const writer = new BinaryWriter(totalSize);
    writer.writeString("ANIM");
    writer.writeUInt32LE(1);
    writer.writeUInt32LE(imageDataSize);
    writer.writeUInt32LE(invalidJson.length);
    writer.writeUInt32LE(1); // sprite count
    writer.writeUInt32LE(100); // width
    writer.writeUInt32LE(100); // height
    writer.writeBuffer(webpData);
    writer.writeBuffer(invalidJson);

    expect(() => decodeH5Animate(writer.getBuffer())).toThrow(H5AnimateError);
    try {
      decodeH5Animate(writer.getBuffer());
    } catch (error) {
      expect((error as H5AnimateError).code).toBe(H5AnimateErrorCode.INVALID_METADATA);
    }
  });

  test("应该正确处理多帧动画", () => {
    const meta = {
      ratio: 1,
      frame: [
        { objects: [[0, 0, 0, 100, 255]] },
        { objects: [[0, 10, 10, 100, 200]] },
        { objects: [[1, 20, 20, 50, 128, 1, 90]] },
      ],
    };
    const spriteInfo = {
      count: 1,
      dimensions: [{ width: 64, height: 192 }],
    };
    const webpData = Buffer.from("multi-frame-webp");

    const buffer = createValidH5AnimateBuffer(meta, spriteInfo, webpData);
    const result = decodeH5Animate(buffer);

    expect(result.meta.frame).toHaveLength(3);
    expect(result.meta.frame[2].objects![0]).toEqual({
      index: 1,
      x: 20,
      y: 20,
      scale: 50,
      opacity: 128,
      mirror: 1,
      rotate: 90,
    });
  });
});
