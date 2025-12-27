/**
 * 往返一致性测试
 *
 * 测试编解码和格式转换的数据一致性
 */

import { describe, test, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { encodeH5Animate } from "../encoder.js";
import { decodeH5Animate } from "../decoder.js";
import { convertToH5Animate, convertMetadata } from "../converter.js";
import type { H5AnimateMeta, SpriteInfo, LegacyAnimateFile } from "../types.js";

// 读取真实的 .animate 测试文件
const sampleAnimatePath = join(__dirname, "../../sample/hand.animate");
const sampleAnimateContent = readFileSync(sampleAnimatePath, "utf-8");
const sampleAnimateData: LegacyAnimateFile = JSON.parse(sampleAnimateContent);

describe("编解码往返测试", () => {
  test("简单动画数据的往返一致性", () => {
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

    const webpData = Buffer.from("fake-webp-data-for-roundtrip-test");

    // 编码
    const encoded = encodeH5Animate(meta, spriteInfo, webpData);

    // 解码
    const decoded = decodeH5Animate(encoded);

    // 验证一致性
    expect(decoded.meta).toEqual(meta);
    expect(decoded.spriteInfo).toEqual(spriteInfo);
    expect(decoded.webpData).toEqual(webpData);
  });

  test("包含音效数据的往返一致性", () => {
    const meta: H5AnimateMeta = {
      ratio: 1,
      frame: [
        {
          sound: [{ name: "attack.mp3", pitch: 1.2, volume: 0.8 }],
          objects: [
            { index: 0, x: 0, y: 0, scale: 100, opacity: 255, mirror: 0, rotate: 0 },
          ],
        },
        {
          sound: [{ name: "hit.mp3" }],
          objects: [
            { index: 1, x: 10, y: 10, scale: 80, opacity: 200, mirror: 1, rotate: 45 },
          ],
        },
      ],
    };

    const spriteInfo: SpriteInfo = {
      count: 1,
      dimensions: [{ width: 64, height: 128 }],
    };

    const webpData = Buffer.from("webp-with-sound-test");

    const encoded = encodeH5Animate(meta, spriteInfo, webpData);
    const decoded = decodeH5Animate(encoded);

    expect(decoded.meta).toEqual(meta);
    expect(decoded.spriteInfo).toEqual(spriteInfo);
    expect(decoded.webpData).toEqual(webpData);
  });

  test("多帧动画的往返一致性", () => {
    const meta: H5AnimateMeta = {
      ratio: 2,
      frame: [
        { objects: [{ index: 0, x: 0, y: 0, scale: 100, opacity: 255, mirror: 0, rotate: 0 }] },
        { objects: [{ index: 0, x: 5, y: 5, scale: 100, opacity: 240, mirror: 0, rotate: 0 }] },
        { objects: [{ index: 0, x: 10, y: 10, scale: 100, opacity: 220, mirror: 0, rotate: 0 }] },
        { objects: [{ index: 1, x: 15, y: 15, scale: 90, opacity: 200, mirror: 0, rotate: 0 }] },
        { objects: [{ index: 1, x: 20, y: 20, scale: 80, opacity: 180, mirror: 1, rotate: 30 }] },
      ],
    };

    const spriteInfo: SpriteInfo = {
      count: 1,
      dimensions: [{ width: 128, height: 640 }],
    };

    const webpData = Buffer.from("multi-frame-animation-webp-data");

    const encoded = encodeH5Animate(meta, spriteInfo, webpData);
    const decoded = decodeH5Animate(encoded);

    expect(decoded.meta).toEqual(meta);
    expect(decoded.meta.frame).toHaveLength(5);
    expect(decoded.spriteInfo).toEqual(spriteInfo);
    expect(decoded.webpData).toEqual(webpData);
  });

  test("多精灵图的往返一致性", () => {
    const meta: H5AnimateMeta = {
      ratio: 1,
      frame: [
        {
          objects: [
            { index: 0, x: 0, y: 0, scale: 100, opacity: 255, mirror: 0, rotate: 0 },
            { index: 1, x: 50, y: 50, scale: 100, opacity: 255, mirror: 0, rotate: 0 },
          ],
        },
      ],
    };

    const spriteInfo: SpriteInfo = {
      count: 3,
      dimensions: [
        { width: 100, height: 200 },
        { width: 150, height: 250 },
        { width: 200, height: 300 },
      ],
    };

    const webpData = Buffer.from("multi-sprite-webp-data");

    const encoded = encodeH5Animate(meta, spriteInfo, webpData);
    const decoded = decodeH5Animate(encoded);

    expect(decoded.meta).toEqual(meta);
    expect(decoded.spriteInfo).toEqual(spriteInfo);
    expect(decoded.spriteInfo.count).toBe(3);
    expect(decoded.spriteInfo.dimensions).toHaveLength(3);
    expect(decoded.webpData).toEqual(webpData);
  });

  test("包含空帧的往返一致性", () => {
    const meta: H5AnimateMeta = {
      ratio: 2,
      frame: [
        { objects: [{ index: 0, x: 0, y: 0, scale: 100, opacity: 255, mirror: 0, rotate: 0 }] },
        {}, // 空帧
        {}, // 空帧
        { objects: [{ index: 1, x: 10, y: 10, scale: 50, opacity: 128, mirror: 0, rotate: 0 }] },
      ],
    };

    const spriteInfo: SpriteInfo = {
      count: 1,
      dimensions: [{ width: 64, height: 256 }],
    };

    const webpData = Buffer.from("animation-with-empty-frames");

    const encoded = encodeH5Animate(meta, spriteInfo, webpData);
    const decoded = decodeH5Animate(encoded);

    expect(decoded.meta.frame).toHaveLength(4);
    expect(decoded.meta.frame[0].objects).toBeDefined();
    expect(decoded.meta.frame[1].objects).toBeUndefined();
    expect(decoded.meta.frame[2].objects).toBeUndefined();
    expect(decoded.meta.frame[3].objects).toBeDefined();
  });

  test("包含所有可选字段的往返一致性", () => {
    const meta: H5AnimateMeta = {
      ratio: 3,
      frame: [
        {
          sound: [
            { name: "sound1.mp3", volume: 0.5, pitch: 1.0 },
            { name: "sound2.mp3", volume: 1.0, pitch: 0.8 },
          ],
          objects: [
            { index: 0, x: -10, y: -20, scale: 150, opacity: 128, mirror: 1, rotate: 180 },
            { index: 1, x: 100, y: 200, scale: 50, opacity: 64, mirror: 0, rotate: 270 },
          ],
        },
      ],
    };

    const spriteInfo: SpriteInfo = {
      count: 2,
      dimensions: [
        { width: 256, height: 256 },
        { width: 128, height: 128 },
      ],
    };

    const webpData = Buffer.from("complex-animation-with-all-optional-fields");

    const encoded = encodeH5Animate(meta, spriteInfo, webpData);
    const decoded = decodeH5Animate(encoded);

    expect(decoded.meta).toEqual(meta);
    expect(decoded.spriteInfo).toEqual(spriteInfo);
    expect(decoded.webpData).toEqual(webpData);
  });

  test("大型 WebP 数据的往返一致性", () => {
    const meta: H5AnimateMeta = {
      ratio: 1,
      frame: [
        { objects: [{ index: 0, x: 0, y: 0, scale: 100, opacity: 255, mirror: 0, rotate: 0 }] },
      ],
    };

    const spriteInfo: SpriteInfo = {
      count: 1,
      dimensions: [{ width: 1024, height: 1024 }],
    };

    // 创建一个较大的 WebP 数据（1MB）
    const webpData = Buffer.alloc(1024 * 1024);
    for (let i = 0; i < webpData.length; i++) {
      webpData[i] = i % 256;
    }

    const encoded = encodeH5Animate(meta, spriteInfo, webpData);
    const decoded = decodeH5Animate(encoded);

    expect(decoded.meta).toEqual(meta);
    expect(decoded.spriteInfo).toEqual(spriteInfo);
    expect(decoded.webpData).toEqual(webpData);
  });

  test("边界值的往返一致性", () => {
    const meta: H5AnimateMeta = {
      ratio: 0, // 最小值
      frame: [
        {
          objects: [
            { index: 0, x: 0, y: 0, scale: 0, opacity: 0, mirror: 0, rotate: 0 },
            { index: 255, x: 65535, y: 65535, scale: 65535, opacity: 255, mirror: 1, rotate: 360 },
          ],
        },
      ],
    };

    const spriteInfo: SpriteInfo = {
      count: 1,
      dimensions: [{ width: 1, height: 1 }],
    };

    const webpData = Buffer.from([0]); // 最小的 WebP 数据

    const encoded = encodeH5Animate(meta, spriteInfo, webpData);
    const decoded = decodeH5Animate(encoded);

    expect(decoded.meta).toEqual(meta);
    expect(decoded.spriteInfo).toEqual(spriteInfo);
    expect(decoded.webpData).toEqual(webpData);
  });
});


describe("转换往返测试", () => {
  test("真实 .animate 文件转换后的数据完整性", async () => {
    // 转换为 h5animate 格式
    const h5animateBuffer = await convertToH5Animate(sampleAnimateData);

    // 解码转换后的数据
    const decoded = decodeH5Animate(h5animateBuffer);

    // 验证 ratio 一致
    expect(decoded.meta.ratio).toBe(sampleAnimateData.ratio);

    // 验证帧数一致
    expect(decoded.meta.frame).toHaveLength(sampleAnimateData.frame_max);

    // 验证每一帧的对象数据
    for (let i = 0; i < sampleAnimateData.frame_max; i++) {
      const originalFrame = sampleAnimateData.frames[i] || [];
      const convertedFrame = decoded.meta.frame[i];

      if (originalFrame.length === 0) {
        // 空帧
        expect(convertedFrame.objects).toBeUndefined();
      } else {
        // 非空帧，验证对象数量
        expect(convertedFrame.objects).toHaveLength(originalFrame.length);

        // 验证每个对象的属性
        for (let j = 0; j < originalFrame.length; j++) {
          const originalLayer = originalFrame[j];
          const convertedObject = convertedFrame.objects![j];

          expect(convertedObject.index).toBe(originalLayer[0]);
          expect(convertedObject.x).toBe(originalLayer[1]);
          expect(convertedObject.y).toBe(originalLayer[2]);
          expect(convertedObject.scale).toBe(originalLayer[3]);
          expect(convertedObject.opacity).toBe(originalLayer[4]);
          expect(convertedObject.mirror).toBe(originalLayer[5] ?? 0);
          expect(convertedObject.rotate).toBe(originalLayer[6] ?? 0);
        }
      }
    }
  });

  test("音效数据的完整映射", async () => {
    const h5animateBuffer = await convertToH5Animate(sampleAnimateData);
    const decoded = decodeH5Animate(h5animateBuffer);

    // 验证全局音效（字符串类型的 se）只在第一帧
    if (typeof sampleAnimateData.se === "string") {
      expect(decoded.meta.frame[0].sound).toEqual([{ name: sampleAnimateData.se }]);

      // 其他帧不应该有音效
      for (let i = 1; i < decoded.meta.frame.length; i++) {
        expect(decoded.meta.frame[i].sound).toBeUndefined();
      }
    }
  });

  test("帧特定音效的完整映射", async () => {
    // 创建带有帧特定音效的测试数据
    const legacyWithFrameSounds: LegacyAnimateFile = {
      ratio: 2,
      se: { 0: "start.mp3", 2: "hit.mp3", 4: "end.mp3" },
      pitch: { 0: 1.0, 2: 1.5, 4: 0.8 },
      bitmaps: sampleAnimateData.bitmaps, // 使用真实的图片数据
      frame_max: 5,
      frames: [
        [[0, 0, 0, 100, 255]],
        [[0, 5, 5, 100, 240]],
        [[0, 10, 10, 100, 220]],
        [[0, 15, 15, 100, 200]],
        [[0, 20, 20, 100, 180]],
      ],
    };

    const h5animateBuffer = await convertToH5Animate(legacyWithFrameSounds);
    const decoded = decodeH5Animate(h5animateBuffer);

    // 验证帧 0 的音效
    expect(decoded.meta.frame[0].sound).toEqual([{ name: "start.mp3", pitch: 1.0 }]);

    // 验证帧 1 没有音效
    expect(decoded.meta.frame[1].sound).toBeUndefined();

    // 验证帧 2 的音效
    expect(decoded.meta.frame[2].sound).toEqual([{ name: "hit.mp3", pitch: 1.5 }]);

    // 验证帧 3 没有音效
    expect(decoded.meta.frame[3].sound).toBeUndefined();

    // 验证帧 4 的音效
    expect(decoded.meta.frame[4].sound).toEqual([{ name: "end.mp3", pitch: 0.8 }]);
  });

  test("精灵图信息的正确生成", async () => {
    const h5animateBuffer = await convertToH5Animate(sampleAnimateData);
    const decoded = decodeH5Animate(h5animateBuffer);

    // 验证精灵图数量
    expect(decoded.spriteInfo.count).toBe(1);

    // 验证精灵图尺寸存在且有效
    expect(decoded.spriteInfo.dimensions).toHaveLength(1);
    expect(decoded.spriteInfo.dimensions[0].width).toBeGreaterThan(0);
    expect(decoded.spriteInfo.dimensions[0].height).toBeGreaterThan(0);
  });

  test("WebP 数据的有效性", async () => {
    const h5animateBuffer = await convertToH5Animate(sampleAnimateData);
    const decoded = decodeH5Animate(h5animateBuffer);

    // 验证 WebP 数据存在且非空
    expect(Buffer.isBuffer(decoded.webpData)).toBe(true);
    expect(decoded.webpData.length).toBeGreaterThan(0);
  });

  test("元数据转换的一致性", () => {
    // 直接测试 convertMetadata 函数
    const convertedMeta = convertMetadata(sampleAnimateData);

    // 验证 ratio
    expect(convertedMeta.ratio).toBe(sampleAnimateData.ratio);

    // 验证帧数
    expect(convertedMeta.frame).toHaveLength(sampleAnimateData.frame_max);

    // 验证所有帧的对象数据
    for (let i = 0; i < sampleAnimateData.frame_max; i++) {
      const originalFrame = sampleAnimateData.frames[i] || [];
      const convertedFrame = convertedMeta.frame[i];

      if (originalFrame.length === 0) {
        expect(convertedFrame.objects).toBeUndefined();
      } else {
        expect(convertedFrame.objects).toHaveLength(originalFrame.length);

        for (let j = 0; j < originalFrame.length; j++) {
          const originalLayer = originalFrame[j];
          const convertedObject = convertedFrame.objects![j];

          expect(convertedObject).toEqual({
            index: originalLayer[0],
            x: originalLayer[1],
            y: originalLayer[2],
            scale: originalLayer[3],
            opacity: originalLayer[4],
            mirror: originalLayer[5] ?? 0,
            rotate: originalLayer[6] ?? 0,
          });
        }
      }
    }
  });

  test("复杂动画数据的完整转换", async () => {
    // 创建一个复杂的测试数据
    const complexLegacy: LegacyAnimateFile = {
      ratio: 3,
      se: { 0: "start.mp3", 3: "middle.mp3" },
      pitch: { 0: 1.2, 3: 0.9 },
      bitmaps: sampleAnimateData.bitmaps,
      frame_max: 6,
      frames: [
        [[0, 0, 0, 100, 255, 0, 0], [1, 50, 50, 80, 200, 1, 45]],
        [[0, 5, 5, 100, 240]],
        [[0, 10, 10, 100, 220, 0, 90]],
        [[1, 15, 15, 90, 200, 1, 135]],
        [], // 空帧
        [[0, 20, 20, 100, 180, 0, 180], [1, 70, 70, 60, 150, 1, 270]],
      ],
    };

    const h5animateBuffer = await convertToH5Animate(complexLegacy);
    const decoded = decodeH5Animate(h5animateBuffer);

    // 验证基本属性
    expect(decoded.meta.ratio).toBe(3);
    expect(decoded.meta.frame).toHaveLength(6);

    // 验证第一帧（两个对象 + 音效）
    expect(decoded.meta.frame[0].objects).toHaveLength(2);
    expect(decoded.meta.frame[0].sound).toEqual([{ name: "start.mp3", pitch: 1.2 }]);
    expect(decoded.meta.frame[0].objects![0]).toEqual({
      index: 0, x: 0, y: 0, scale: 100, opacity: 255, mirror: 0, rotate: 0,
    });
    expect(decoded.meta.frame[0].objects![1]).toEqual({
      index: 1, x: 50, y: 50, scale: 80, opacity: 200, mirror: 1, rotate: 45,
    });

    // 验证空帧
    expect(decoded.meta.frame[4].objects).toBeUndefined();

    // 验证最后一帧
    expect(decoded.meta.frame[5].objects).toHaveLength(2);
  });

  test("二次编解码的一致性", async () => {
    // 第一次转换
    const firstBuffer = await convertToH5Animate(sampleAnimateData);
    const firstDecoded = decodeH5Animate(firstBuffer);

    // 使用解码后的数据重新编码
    const secondBuffer = encodeH5Animate(
      firstDecoded.meta,
      firstDecoded.spriteInfo,
      firstDecoded.webpData,
    );
    const secondDecoded = decodeH5Animate(secondBuffer);

    // 验证两次解码的结果一致
    expect(secondDecoded.meta).toEqual(firstDecoded.meta);
    expect(secondDecoded.spriteInfo).toEqual(firstDecoded.spriteInfo);
    expect(secondDecoded.webpData).toEqual(firstDecoded.webpData);
  });
});
