import { describe, expect, it } from 'vitest';
import { resolveMapLayout } from '../model/layout';
import { buildMapRenderModel } from '../model/renderModel';
import { createMapDocument } from './fixtures';

// 布局的纯函数测试：13 × 13 视口、50%–200% 缩放、右栏宽度的夹取。
// 全部断言具体数值（不 snapshot）：画布尺寸、格像素与右栏宽度都只由这个函数给出，视图层不再自己算。
// 本文件不读窗口尺寸：桩里 window.innerWidth 为 0，另有一条用例把它改成 4000 仍要求结果不变。

describe('resolveMapLayout 默认视口', () => {
  // 默认 13 × 13、文档格 32 × 32、缩放 1：格 32、画布 416 × 416、右栏 240
  it('默认 13 × 13 视口', () => {
    expect(resolveMapLayout(createMapDocument(), { zoom: 1 })).toEqual({
      viewportColumns: 13,
      viewportRows: 13,
      cellWidth: 32,
      cellHeight: 32,
      canvasWidth: 416,
      canvasHeight: 416,
      paletteWidth: 240,
    });
  });

  // 宿主给的长方形视口 15 × 9：画布 480 × 288，格数与栏宽不受影响
  it('长方形视口 15 × 9', () => {
    const layout = resolveMapLayout(createMapDocument(), { zoom: 1, viewportColumns: 15, viewportRows: 9 });

    expect(layout.viewportColumns).toBe(15);
    expect(layout.viewportRows).toBe(9);
    expect(layout.canvasWidth).toBe(480);
    expect(layout.canvasHeight).toBe(288);
    expect(layout.paletteWidth).toBe(240);
  });

  // 只覆盖横向格数时纵向仍取默认 13：画布 480 × 416
  it('只覆盖横向格数时纵向取默认', () => {
    const layout = resolveMapLayout(createMapDocument(), { zoom: 1, viewportColumns: 15 });

    expect(layout.viewportRows).toBe(13);
    expect(layout.canvasWidth).toBe(480);
    expect(layout.canvasHeight).toBe(416);
  });
});

describe('resolveMapLayout 缩放', () => {
  // 50%：格 16 × 16、画布 208 × 208；右栏按 240 / 0.5 = 480 计算后夹到上限 360
  it('缩放 0.5 时格变小、画布变小、右栏顶到上限', () => {
    const layout = resolveMapLayout(createMapDocument(), { zoom: 0.5 });

    expect(layout.cellWidth).toBe(16);
    expect(layout.cellHeight).toBe(16);
    expect(layout.canvasWidth).toBe(208);
    expect(layout.canvasHeight).toBe(208);
    expect(layout.paletteWidth).toBe(360);
  });

  // 200%：格 64 × 64、画布 832 × 832；右栏按 240 / 2 = 120 计算后夹到下限 160
  it('缩放 2 时格变大、画布变大、右栏缩到下限', () => {
    const layout = resolveMapLayout(createMapDocument(), { zoom: 2 });

    expect(layout.cellWidth).toBe(64);
    expect(layout.cellHeight).toBe(64);
    expect(layout.canvasWidth).toBe(832);
    expect(layout.canvasHeight).toBe(832);
    expect(layout.paletteWidth).toBe(160);
  });

  // 150%：格 48 × 48、画布 624 × 624；右栏 round(240 / 1.5) = 160
  it('缩放 1.5 时格 48 且右栏 160', () => {
    const layout = resolveMapLayout(createMapDocument(), { zoom: 1.5 });

    expect(layout.cellWidth).toBe(48);
    expect(layout.cellHeight).toBe(48);
    expect(layout.canvasWidth).toBe(624);
    expect(layout.canvasHeight).toBe(624);
    expect(layout.paletteWidth).toBe(160);
  });

  // 超出范围的缩放被夹取：0.1 等价于 0.5
  it('缩放低于下限时按 0.5 计算', () => {
    expect(resolveMapLayout(createMapDocument(), { zoom: 0.1 })).toEqual(
      resolveMapLayout(createMapDocument(), { zoom: 0.5 }),
    );
  });

  // 超出范围的缩放被夹取：5 等价于 2
  it('缩放高于上限时按 2 计算', () => {
    expect(resolveMapLayout(createMapDocument(), { zoom: 5 })).toEqual(resolveMapLayout(createMapDocument(), { zoom: 2 }));
  });

  // 非正方格按各自的边长乘缩放：48 × 24 在 1.5 倍下是 72 × 36
  it('非正方格分别按宽高乘缩放', () => {
    const document = createMapDocument({ cellWidth: 48, cellHeight: 24 });
    const layout = resolveMapLayout(document, { zoom: 1.5 });

    expect(layout.cellWidth).toBe(72);
    expect(layout.cellHeight).toBe(36);
    expect(layout.canvasWidth).toBe(936);
    expect(layout.canvasHeight).toBe(468);
  });
});

describe('resolveMapLayout 右栏宽度', () => {
  // 基准宽度可被宿主覆盖：480 在缩放 1 时夹到上限 360
  it('基准宽度大于上限时夹到 360', () => {
    expect(resolveMapLayout(createMapDocument(), { zoom: 1, paletteBaseWidth: 480 }).paletteWidth).toBe(360);
  });

  // 基准宽度小于下限时夹到 160
  it('基准宽度小于下限时夹到 160', () => {
    expect(resolveMapLayout(createMapDocument(), { zoom: 1, paletteBaseWidth: 100 }).paletteWidth).toBe(160);
  });

  // 基准宽度落在区间内时原样使用：300 在缩放 1 时就是 300
  it('基准宽度落在区间内时原样使用', () => {
    expect(resolveMapLayout(createMapDocument(), { zoom: 1, paletteBaseWidth: 300 }).paletteWidth).toBe(300);
  });

  // 任意缩放与基准宽度下，右栏都不会跑出 160..360
  it('右栏宽度始终落在最小与最大之间', () => {
    const zooms = [0.1, 0.5, 0.75, 1, 1.25, 1.5, 2, 5];
    const bases = [0, 100, 240, 300, 480, 1000];

    for (const zoom of zooms) {
      for (const paletteBaseWidth of bases) {
        const paletteWidth = resolveMapLayout(createMapDocument(), { zoom, paletteBaseWidth }).paletteWidth;

        expect(paletteWidth).toBeGreaterThanOrEqual(160);
        expect(paletteWidth).toBeLessThanOrEqual(360);
      }
    }
  });
});

describe('resolveMapLayout 退化输入', () => {
  // 文档格尺寸缺省或非法时按 32：缺省、0、负数三种情况结果一致
  it('文档格尺寸缺省或非法时按 32', () => {
    const expected = resolveMapLayout(createMapDocument(), { zoom: 1 });

    expect(resolveMapLayout(createMapDocument({ cellWidth: undefined, cellHeight: undefined }), { zoom: 1 })).toEqual(
      expected,
    );
    expect(resolveMapLayout(createMapDocument({ cellWidth: 0, cellHeight: 0 }), { zoom: 1 })).toEqual(expected);
    expect(resolveMapLayout(createMapDocument({ cellWidth: -16, cellHeight: -16 }), { zoom: 1 })).toEqual(expected);
  });

  // 视口格数非法（0 / 负数 / 小数）时退回默认 13 × 13
  it('视口格数非正整数时退回默认值', () => {
    const expected = resolveMapLayout(createMapDocument(), { zoom: 1 });

    expect(resolveMapLayout(createMapDocument(), { zoom: 1, viewportColumns: 0, viewportRows: 0 })).toEqual(expected);
    expect(resolveMapLayout(createMapDocument(), { zoom: 1, viewportColumns: -4, viewportRows: -4 })).toEqual(
      expected,
    );
    expect(resolveMapLayout(createMapDocument(), { zoom: 1, viewportColumns: 2.5, viewportRows: 2.5 })).toEqual(
      expected,
    );
  });
});

describe('resolveMapLayout 不依赖窗口尺寸', () => {
  // 桩里 window.innerWidth 为 0；把它改成 4000 后结果必须一字不差
  it('window.innerWidth 变化不影响结果', () => {
    const document = createMapDocument();
    const before = window.innerWidth;
    const original = resolveMapLayout(document, { zoom: 1 });

    expect(before).toBe(0);

    Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: 4000 });

    try {
      expect(resolveMapLayout(document, { zoom: 1 })).toEqual(original);
      expect(resolveMapLayout(document, { zoom: 1 }).canvasWidth).toBe(416);
    } finally {
      Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: before });
    }
  });
});

describe('resolveMapLayout 与渲染模型同源', () => {
  // 同一个 zoom 下，布局报的格像素与渲染模型报的格像素必须相同（32 在 1.5 倍下两边都是 48）
  it('1.5 倍下布局与渲染模型的格像素一致', () => {
    const document = createMapDocument();
    const layout = resolveMapLayout(document, { zoom: 1.5 });
    const model = buildMapRenderModel(document, {
      width: layout.canvasWidth,
      height: layout.canvasHeight,
      currentLayerId: 'layer-base',
      aboveLayerOpacity: 0.3,
      viewport: { left: 0, top: 0 },
      bigMap: false,
      zoom: 1.5,
      passMarks: [],
    });

    expect(layout.cellWidth).toBe(48);
    expect(model.cellWidth).toBe(layout.cellWidth);
    expect(model.cellHeight).toBe(layout.cellHeight);
  });
});
