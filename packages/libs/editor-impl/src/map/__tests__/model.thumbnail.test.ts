import { describe, expect, it } from 'vitest';
import { buildThumbnail } from '../model/thumbnail';
import { createMapDocument } from './fixtures';

// 缩略描述的纯函数测试：纹理按显示像素生成、超过上限才等比缩小，显示尺寸按画布适配并居中。
// 全部断言具体数值（不 snapshot）：这些数字是 Plan 10 建 RenderTexture 与摆放 Sprite 的唯一依据。
// 非二进制可精确表示的小数（10.4 / 270.4 / 72.8）用 toBeCloseTo 固定到小数点后 6 位，避免浮点尾差误报。

describe('buildThumbnail 按画布适配', () => {
  // 256 × 256 的地图放进 416 × 416 画布：缩放 1.625、恰好铺满且无留白；纹理按显示像素 416 × 416
  it('256 × 256 地图铺满画布且纹理等于显示像素', () => {
    expect(buildThumbnail(createMapDocument({ width: 256, height: 256 }), 416, 416)).toEqual({
      width: 416,
      height: 416,
      scale: 1.625,
      offsetX: 0,
      offsetY: 0,
      textureWidth: 416,
      textureHeight: 416,
    });
  });

  // 40 × 26 的扁地图：按较紧的宽边适配，缩放 10.4、高 270.4、垂直留白 72.8；纹理跟着显示像素 416 × 270
  it('扁地图按较紧的宽边适配并垂直居中', () => {
    const thumbnail = buildThumbnail(createMapDocument({ width: 40, height: 26 }), 416, 416);

    expect(thumbnail.scale).toBeCloseTo(10.4, 6);
    expect(thumbnail.width).toBeCloseTo(416, 6);
    expect(thumbnail.height).toBeCloseTo(270.4, 6);
    expect(thumbnail.offsetX).toBe(0);
    expect(thumbnail.offsetY).toBeCloseTo(72.8, 6);
    expect(thumbnail.textureWidth).toBe(416);
    expect(thumbnail.textureHeight).toBe(270);
  });

  // 26 × 40 的竖地图：按较紧的高边适配，宽 270.4、水平留白 72.8；纹理跟着显示像素 270 × 416
  it('竖地图按较紧的高边适配并水平居中', () => {
    const thumbnail = buildThumbnail(createMapDocument({ width: 26, height: 40 }), 416, 416);

    expect(thumbnail.scale).toBeCloseTo(10.4, 6);
    expect(thumbnail.width).toBeCloseTo(270.4, 6);
    expect(thumbnail.height).toBeCloseTo(416, 6);
    expect(thumbnail.offsetX).toBeCloseTo(72.8, 6);
    expect(thumbnail.offsetY).toBe(0);
    expect(thumbnail.textureWidth).toBe(270);
    expect(thumbnail.textureHeight).toBe(416);
  });

  // 长方形画布 480 × 288 放 40 × 20 的地图：缩放 12、高 240、垂直留白 24；纹理 480 × 240
  it('长方形画布按自身宽高比适配', () => {
    expect(buildThumbnail(createMapDocument({ width: 40, height: 20 }), 480, 288)).toEqual({
      width: 480,
      height: 240,
      scale: 12,
      offsetX: 0,
      offsetY: 24,
      textureWidth: 480,
      textureHeight: 240,
    });
  });
});

describe('buildThumbnail 纹理上限', () => {
  // 放得下的地图不再无条件降采样：40 × 26 的地图放到 416 画布里，纹理就是显示像素
  it('显示尺寸不超过上限时纹理与显示像素 1:1', () => {
    const thumbnail = buildThumbnail(createMapDocument({ width: 40, height: 26 }), 416, 416);

    expect(thumbnail.textureWidth).toBe(Math.round(thumbnail.width));
    expect(thumbnail.textureHeight).toBe(Math.round(thumbnail.height));
    expect(thumbnail.textureWidth).toBeLessThanOrEqual(512);
  });

  // 画布极大（2000 × 2000）时显示尺寸远超上限：纹理按最长边等比夹到 512 × 512，显示仍按画布适配
  it('显示尺寸超过上限时夹到 512 × 512', () => {
    expect(buildThumbnail(createMapDocument({ width: 256, height: 256 }), 2000, 2000)).toEqual({
      width: 2000,
      height: 2000,
      scale: 7.8125,
      offsetX: 0,
      offsetY: 0,
      textureWidth: 512,
      textureHeight: 512,
    });
  });

  // 600 × 300 的大显示尺寸只按最长边等比缩小：纹理 512 × 256，比例与地图一致（不会被压成正方形）
  it('非正方文档夹取后纹理比例不变', () => {
    const thumbnail = buildThumbnail(createMapDocument({ width: 600, height: 300 }), 2000, 2000);

    expect(thumbnail.textureWidth).toBe(512);
    expect(thumbnail.textureHeight).toBe(256);
    expect(thumbnail.width).toBeCloseTo(2000, 6);
    expect(thumbnail.height).toBeCloseTo(1000, 6);
  });

  // 恰好等于上限的显示尺寸不缩小：512 × 512 画布里的 512 × 512 地图纹理保持 512 × 512
  it('等于上限的显示尺寸保持原纹理尺寸', () => {
    const thumbnail = buildThumbnail(createMapDocument({ width: 512, height: 512 }), 512, 512);

    expect(thumbnail.textureWidth).toBe(512);
    expect(thumbnail.textureHeight).toBe(512);
  });
});

describe('buildThumbnail 参数无关性', () => {
  // 同一文档 + 同一画布重复调用：结果逐字段相同，说明它是纯函数
  it('同文档同画布的输出稳定', () => {
    const document = createMapDocument({ width: 256, height: 256 });

    expect(buildThumbnail(document, 416, 416)).toEqual(buildThumbnail(document, 416, 416));
  });

  // 文档对象上挂着视口 / 缩放 / 选区 / 悬停等视图字段时不参与计算：输出与干净文档完全一致
  it('视口 / 缩放 / 选区 / 悬停字段不影响输出', () => {
    const document = createMapDocument({ width: 256, height: 256 });
    const noisy = {
      ...document,
      viewport: { left: 100, top: 100 },
      zoom: 2,
      selection: { x: 1, y: 2, width: 3, height: 4 },
      hover: { x: 5, y: 6 },
    };

    expect(buildThumbnail(noisy, 416, 416)).toEqual(buildThumbnail(document, 416, 416));
  });

  // 描述里只有七个尺寸字段：没有逐格 cells，也没有任何重建键
  it('描述只含七个尺寸字段', () => {
    const thumbnail = buildThumbnail(createMapDocument({ width: 256, height: 256 }), 416, 416);

    expect(Object.keys(thumbnail).sort()).toEqual([
      'height',
      'offsetX',
      'offsetY',
      'scale',
      'textureHeight',
      'textureWidth',
      'width',
    ]);
  });
});

describe('buildThumbnail 退化输入', () => {
  // 文档宽或高为 0 / 负数：返回全零描述，不抛错、不除零
  it('文档尺寸非正时返回全零描述', () => {
    const zero = { width: 0, height: 0, scale: 0, offsetX: 0, offsetY: 0, textureWidth: 0, textureHeight: 0 };

    expect(buildThumbnail(createMapDocument({ width: 0, height: 256 }), 416, 416)).toEqual(zero);
    expect(buildThumbnail(createMapDocument({ width: 256, height: 0 }), 416, 416)).toEqual(zero);
    expect(buildThumbnail(createMapDocument({ width: -8, height: 256 }), 416, 416)).toEqual(zero);
  });

  // 画布尺寸为 0：同样退化为全零描述，结果里不出现 NaN / Infinity
  it('画布尺寸非正时返回全零描述', () => {
    const zero = { width: 0, height: 0, scale: 0, offsetX: 0, offsetY: 0, textureWidth: 0, textureHeight: 0 };

    expect(buildThumbnail(createMapDocument({ width: 256, height: 256 }), 0, 0)).toEqual(zero);
    expect(buildThumbnail(createMapDocument({ width: 256, height: 256 }), 416, 0)).toEqual(zero);
  });
});
