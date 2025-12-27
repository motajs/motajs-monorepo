import { describe, test, expect } from "vitest";
import sharp from "sharp";
import {
  convertToWebP,
  createVerticalSpriteSheet,
  base64ToBuffer,
  combineBase64ImagesToWebP,
  extractFrameByIndex,
  extractFrameByPosition,
  extractAllFrames,
} from "../webp.js";
import { H5AnimateError, H5AnimateErrorCode } from "../errors.js";

/**
 * 创建测试用的 PNG 图像
 */
async function createTestPng(
  width: number,
  height: number,
  color: { r: number; g: number; b: number; alpha?: number } = { r: 255, g: 0, b: 0 },
): Promise<Buffer> {
  return sharp({
    create: {
      width,
      height,
      channels: 4,
      background: { ...color, alpha: color.alpha ?? 1 },
    },
  })
    .png()
    .toBuffer();
}

/**
 * 创建带透明度的测试 PNG 图像
 */
async function createTransparentPng(
  width: number,
  height: number,
  alpha: number,
): Promise<Buffer> {
  return sharp({
    create: {
      width,
      height,
      channels: 4,
      background: { r: 255, g: 0, b: 0, alpha },
    },
  })
    .png()
    .toBuffer();
}

describe("convertToWebP", () => {
  test("应该将 PNG 转换为 WebP（无损模式）", async () => {
    const png = await createTestPng(100, 100);

    const webp = await convertToWebP(png, { lossless: true });

    // 验证输出是有效的 WebP
    const metadata = await sharp(webp).metadata();
    expect(metadata.format).toBe("webp");
    expect(metadata.width).toBe(100);
    expect(metadata.height).toBe(100);
  });

  test("应该将 PNG 转换为 WebP（有损模式）", async () => {
    const png = await createTestPng(100, 100);

    const webp = await convertToWebP(png, { lossless: false, quality: 80 });

    const metadata = await sharp(webp).metadata();
    expect(metadata.format).toBe("webp");
  });

  test("应该使用默认的无损模式", async () => {
    const png = await createTestPng(50, 50);

    const webp = await convertToWebP(png);

    const metadata = await sharp(webp).metadata();
    expect(metadata.format).toBe("webp");
  });

  test("应该保持透明度信息", async () => {
    const png = await createTransparentPng(100, 100, 0.5);

    const webp = await convertToWebP(png);

    const metadata = await sharp(webp).metadata();
    expect(metadata.channels).toBe(4); // RGBA
    expect(metadata.hasAlpha).toBe(true);
  });

  test("无效图像数据应该抛出错误", async () => {
    const invalidData = Buffer.from("not an image");

    await expect(convertToWebP(invalidData)).rejects.toThrow(H5AnimateError);
  });
});

describe("createVerticalSpriteSheet", () => {
  test("应该将多个图像垂直合并为精灵图", async () => {
    const img1 = await createTestPng(100, 50, { r: 255, g: 0, b: 0 });
    const img2 = await createTestPng(100, 50, { r: 0, g: 255, b: 0 });
    const img3 = await createTestPng(100, 50, { r: 0, g: 0, b: 255 });

    const result = await createVerticalSpriteSheet([img1, img2, img3]);

    // 验证精灵图尺寸
    const metadata = await sharp(result.webpData).metadata();
    expect(metadata.width).toBe(100);
    expect(metadata.height).toBe(150); // 50 * 3

    // 验证精灵图信息
    expect(result.spriteInfo.count).toBe(1);
    expect(result.spriteInfo.dimensions[0]).toEqual({ width: 100, height: 150 });
  });

  test("应该处理不同宽度的图像（使用最大宽度）", async () => {
    const img1 = await createTestPng(80, 50);
    const img2 = await createTestPng(120, 50);
    const img3 = await createTestPng(100, 50);

    const result = await createVerticalSpriteSheet([img1, img2, img3]);

    const metadata = await sharp(result.webpData).metadata();
    expect(metadata.width).toBe(120); // 最大宽度
    expect(metadata.height).toBe(150);
  });

  test("应该处理单个图像", async () => {
    const img = await createTestPng(100, 100);

    const result = await createVerticalSpriteSheet([img]);

    const metadata = await sharp(result.webpData).metadata();
    expect(metadata.width).toBe(100);
    expect(metadata.height).toBe(100);
    expect(result.spriteInfo.count).toBe(1);
  });

  test("空数组应该抛出错误", async () => {
    await expect(createVerticalSpriteSheet([])).rejects.toThrow(H5AnimateError);
  });

  test("应该保持透明度信息", async () => {
    const img1 = await createTransparentPng(100, 50, 0.5);
    const img2 = await createTransparentPng(100, 50, 0.8);

    const result = await createVerticalSpriteSheet([img1, img2]);

    const metadata = await sharp(result.webpData).metadata();
    expect(metadata.hasAlpha).toBe(true);
  });

  test("应该支持有损压缩模式", async () => {
    const img1 = await createTestPng(100, 50);
    const img2 = await createTestPng(100, 50);

    const result = await createVerticalSpriteSheet([img1, img2], {
      lossless: false,
      quality: 80,
    });

    const metadata = await sharp(result.webpData).metadata();
    expect(metadata.format).toBe("webp");
  });
});

describe("base64ToBuffer", () => {
  test("应该转换带 data URI 前缀的 Base64", () => {
    const base64 = "data:image/png;base64,iVBORw0KGgo=";

    const buffer = base64ToBuffer(base64);

    expect(Buffer.isBuffer(buffer)).toBe(true);
    expect(buffer.length).toBeGreaterThan(0);
  });

  test("应该转换不带前缀的 Base64", () => {
    const base64 = "iVBORw0KGgo=";

    const buffer = base64ToBuffer(base64);

    expect(Buffer.isBuffer(buffer)).toBe(true);
  });
});

describe("combineBase64ImagesToWebP", () => {
  test("应该将 Base64 图像合并为 WebP", async () => {
    // 创建测试图像并转换为 Base64
    const img1 = await createTestPng(50, 50);
    const img2 = await createTestPng(50, 50);

    const base64_1 = `data:image/png;base64,${img1.toString("base64")}`;
    const base64_2 = `data:image/png;base64,${img2.toString("base64")}`;

    const result = await combineBase64ImagesToWebP([base64_1, base64_2]);

    const metadata = await sharp(result.webpData).metadata();
    expect(metadata.format).toBe("webp");
    expect(metadata.height).toBe(100); // 50 + 50
  });

  test("应该过滤空字符串", async () => {
    const img = await createTestPng(50, 50);
    const base64 = `data:image/png;base64,${img.toString("base64")}`;

    const result = await combineBase64ImagesToWebP(["", base64, ""]);

    const metadata = await sharp(result.webpData).metadata();
    expect(metadata.height).toBe(50);
  });
});

describe("extractFrameByIndex", () => {
  test("应该按索引提取帧", async () => {
    // 创建一个 100x150 的精灵图（3 帧，每帧 50 高）
    const img1 = await createTestPng(100, 50, { r: 255, g: 0, b: 0 });
    const img2 = await createTestPng(100, 50, { r: 0, g: 255, b: 0 });
    const img3 = await createTestPng(100, 50, { r: 0, g: 0, b: 255 });

    const { webpData } = await createVerticalSpriteSheet([img1, img2, img3]);

    // 提取第二帧（索引 1）
    const frame = await extractFrameByIndex(webpData, 1, { height: 50 });

    const metadata = await sharp(frame).metadata();
    expect(metadata.width).toBe(100);
    expect(metadata.height).toBe(50);
  });

  test("应该提取第一帧", async () => {
    const img1 = await createTestPng(100, 50);
    const img2 = await createTestPng(100, 50);

    const { webpData } = await createVerticalSpriteSheet([img1, img2]);

    const frame = await extractFrameByIndex(webpData, 0, { height: 50 });

    const metadata = await sharp(frame).metadata();
    expect(metadata.height).toBe(50);
  });

  test("超出范围的索引应该抛出错误", async () => {
    const img = await createTestPng(100, 50);
    const { webpData } = await createVerticalSpriteSheet([img]);

    await expect(
      extractFrameByIndex(webpData, 2, { height: 50 }),
    ).rejects.toThrow(H5AnimateError);
  });
});

describe("extractFrameByPosition", () => {
  test("应该按位置提取帧", async () => {
    const img1 = await createTestPng(100, 50);
    const img2 = await createTestPng(100, 50);

    const { webpData } = await createVerticalSpriteSheet([img1, img2]);

    const frame = await extractFrameByPosition(webpData, 50, 0, 100, 50);

    const metadata = await sharp(frame).metadata();
    expect(metadata.width).toBe(100);
    expect(metadata.height).toBe(50);
  });

  test("应该支持提取部分区域", async () => {
    const img = await createTestPng(100, 100);
    const { webpData } = await createVerticalSpriteSheet([img]);

    const frame = await extractFrameByPosition(webpData, 25, 25, 50, 50);

    const metadata = await sharp(frame).metadata();
    expect(metadata.width).toBe(50);
    expect(metadata.height).toBe(50);
  });
});

describe("extractAllFrames", () => {
  test("应该提取所有帧", async () => {
    const img1 = await createTestPng(100, 50);
    const img2 = await createTestPng(100, 50);
    const img3 = await createTestPng(100, 50);

    const { webpData } = await createVerticalSpriteSheet([img1, img2, img3]);

    const frames = await extractAllFrames(webpData, 50);

    expect(frames).toHaveLength(3);

    for (const frame of frames) {
      const metadata = await sharp(frame).metadata();
      expect(metadata.height).toBe(50);
    }
  });

  test("应该支持指定帧数量", async () => {
    const img1 = await createTestPng(100, 50);
    const img2 = await createTestPng(100, 50);
    const img3 = await createTestPng(100, 50);

    const { webpData } = await createVerticalSpriteSheet([img1, img2, img3]);

    const frames = await extractAllFrames(webpData, 50, 2);

    expect(frames).toHaveLength(2);
  });

  test("应该自动计算帧数量", async () => {
    const img1 = await createTestPng(100, 40);
    const img2 = await createTestPng(100, 40);

    const { webpData } = await createVerticalSpriteSheet([img1, img2]);

    const frames = await extractAllFrames(webpData, 40);

    expect(frames).toHaveLength(2);
  });
});
