import { describe, expect, it } from 'vitest';
import { resolveMapLayout } from '../model/layout';

// 布局的纯函数测试：13 × 13 视口、50%–200% 缩放、可用宽度与素材区 / 地图区的宽度分配。
// 全部断言具体数值（不 snapshot）：画布尺寸 = 格数 × 32 × 缩放，与任何地图文档都无关；
// 素材区拿「可用宽度 − 画布宽」，只有最小 240、没有上限。
// 本文件不读窗口尺寸：桩里 window.innerWidth 为 0，另有一条用例把它改成 4000 仍要求结果不变。

describe('resolveMapLayout 默认视口', () => {
  // 默认 13 × 13、缩放 1：格 32、画布 416 × 416；量不到可用宽度时素材区回退 320、地图区等于画布
  it('默认 13 × 13 视口', () => {
    expect(resolveMapLayout({ zoom: 1 })).toEqual({
      viewportColumns: 13,
      viewportRows: 13,
      renderScale: 1,
      cellWidth: 32,
      cellHeight: 32,
      canvasWidth: 416,
      canvasHeight: 416,
      paletteWidth: 320,
      mapPaneWidth: 416,
    });
  });

  // 15 × 9：画布 480 × 288，素材区仍回退 320
  it('长方形视口 15 × 9', () => {
    const layout = resolveMapLayout({ zoom: 1, viewportColumns: 15, viewportRows: 9 });

    expect(layout.viewportColumns).toBe(15);
    expect(layout.viewportRows).toBe(9);
    expect(layout.canvasWidth).toBe(480);
    expect(layout.canvasHeight).toBe(288);
    expect(layout.paletteWidth).toBe(320);
    expect(layout.mapPaneWidth).toBe(480);
  });

  // 只覆盖横向格数时纵向仍取默认 13：画布 480 × 416
  it('只覆盖横向格数时纵向取默认', () => {
    const layout = resolveMapLayout({ zoom: 1, viewportColumns: 15 });

    expect(layout.viewportRows).toBe(13);
    expect(layout.canvasWidth).toBe(480);
    expect(layout.canvasHeight).toBe(416);
  });
});

describe('resolveMapLayout 缩放', () => {
  // 50%：屏幕格 16、画布 208 × 208；素材区不随缩放变化，仍是基准 320
  it('缩放 0.5 时画布 208 × 208', () => {
    const layout = resolveMapLayout({ zoom: 0.5 });

    expect(layout.renderScale).toBe(0.5);
    expect(layout.cellWidth).toBe(16);
    expect(layout.cellHeight).toBe(16);
    expect(layout.canvasWidth).toBe(208);
    expect(layout.canvasHeight).toBe(208);
    expect(layout.paletteWidth).toBe(320);
  });

  // 100%：13 × 13 就是 416 × 416
  it('缩放 1 时画布 416 × 416', () => {
    const layout = resolveMapLayout({ zoom: 1 });

    expect(layout.renderScale).toBe(1);
    expect(layout.cellWidth).toBe(32);
    expect(layout.canvasWidth).toBe(416);
    expect(layout.canvasHeight).toBe(416);
  });

  // 150%：屏幕格 48、画布 624 × 624
  it('缩放 1.5 时画布 624 × 624', () => {
    const layout = resolveMapLayout({ zoom: 1.5 });

    expect(layout.renderScale).toBe(1.5);
    expect(layout.cellWidth).toBe(48);
    expect(layout.cellHeight).toBe(48);
    expect(layout.canvasWidth).toBe(624);
    expect(layout.canvasHeight).toBe(624);
  });

  // 200%：屏幕格 64、画布 832 × 832
  it('缩放 2 时画布 832 × 832', () => {
    const layout = resolveMapLayout({ zoom: 2 });

    expect(layout.renderScale).toBe(2);
    expect(layout.cellWidth).toBe(64);
    expect(layout.cellHeight).toBe(64);
    expect(layout.canvasWidth).toBe(832);
    expect(layout.canvasHeight).toBe(832);
  });

  // 超出范围的缩放被夹取：0.1 等价于 0.5
  it('缩放低于下限时按 0.5 计算', () => {
    expect(resolveMapLayout({ zoom: 0.1 })).toEqual(resolveMapLayout({ zoom: 0.5 }));
  });

  // 超出范围的缩放被夹取：5 等价于 2
  it('缩放高于上限时按 2 计算', () => {
    expect(resolveMapLayout({ zoom: 5 })).toEqual(resolveMapLayout({ zoom: 2 }));
  });

  // 非数缩放回退到默认 1
  it('非数缩放按 1 计算', () => {
    expect(resolveMapLayout({ zoom: Number.NaN })).toEqual(resolveMapLayout({ zoom: 1 }));
  });
});

describe('resolveMapLayout 素材区与地图区宽度', () => {
  // 可用 1200、画布 416：素材区拿剩余 784，不被任何上限截断
  it('可用宽度 1200 时素材区 784、地图区 416', () => {
    const layout = resolveMapLayout({ zoom: 1, availableWidth: 1200 });

    expect(layout.canvasWidth).toBe(416);
    expect(layout.paletteWidth).toBe(784);
    expect(layout.mapPaneWidth).toBe(416);
  });

  // 可用 600 小于画布 + 最小素材区：素材区被最小宽度顶住 240，地图区只剩 360（允许横向滚动）
  it('可用宽度 600 时素材区被最小宽度顶住', () => {
    const layout = resolveMapLayout({ zoom: 1, availableWidth: 600 });

    expect(layout.paletteWidth).toBe(240);
    expect(layout.mapPaneWidth).toBe(360);
    expect(layout.mapPaneWidth).toBeLessThan(layout.canvasWidth);
  });

  // 可用 3000：素材区 2584，仍然没有上限
  it('可用宽度 3000 时素材区 2584', () => {
    const layout = resolveMapLayout({ zoom: 1, availableWidth: 3000 });

    expect(layout.paletteWidth).toBe(2584);
    expect(layout.mapPaneWidth).toBe(416);
  });

  // 缩放变大画布也变大：可用 1200、200% 时画布 832，素材区只剩 368（仍高于最小 240）
  it('放大到 200% 时素材区按剩余宽度收窄', () => {
    const layout = resolveMapLayout({ zoom: 2, availableWidth: 1200 });

    expect(layout.canvasWidth).toBe(832);
    expect(layout.paletteWidth).toBe(368);
    expect(layout.mapPaneWidth).toBe(832);
  });

  // 可用宽度越大素材区越宽：始终等于「可用宽度 − 画布宽」，且从不低于 240
  it('素材区宽度随可用宽度线性增长且从不低于最小宽度', () => {
    const availableWidths = [0, 100, 655, 1200, 1600, 2000, 3000];

    for (const availableWidth of availableWidths) {
      const layout = resolveMapLayout({ zoom: 1, availableWidth });

      expect(layout.paletteWidth).toBeGreaterThanOrEqual(240);

      if (availableWidth > 0) {
        const mapPaneWidth = layout.mapPaneWidth;

        expect(layout.paletteWidth).toBe(Math.max(240, availableWidth - layout.canvasWidth));
        expect(layout.paletteWidth + mapPaneWidth).toBe(availableWidth);
      }
    }
  });

  // 量不到可用宽度（0 / 负数 / 非数）时回退基准 320，地图区等于画布
  it('可用宽度缺省或非法时素材区回退 320', () => {
    const expected = resolveMapLayout({ zoom: 1 });

    expect(resolveMapLayout({ zoom: 1, availableWidth: 0 })).toEqual(expected);
    expect(resolveMapLayout({ zoom: 1, availableWidth: -120 })).toEqual(expected);
    expect(resolveMapLayout({ zoom: 1, availableWidth: Number.NaN })).toEqual(expected);
    expect(expected.paletteWidth).toBe(320);
    expect(expected.mapPaneWidth).toBe(expected.canvasWidth);
  });
});

describe('resolveMapLayout 退化输入', () => {
  // 视口格数非法（0 / 负数 / 小数）时退回默认 13 × 13
  it('视口格数非正整数时退回默认值', () => {
    const expected = resolveMapLayout({ zoom: 1 });

    expect(resolveMapLayout({ zoom: 1, viewportColumns: 0, viewportRows: 0 })).toEqual(expected);
    expect(resolveMapLayout({ zoom: 1, viewportColumns: -4, viewportRows: -4 })).toEqual(expected);
    expect(resolveMapLayout({ zoom: 1, viewportColumns: 2.5, viewportRows: 2.5 })).toEqual(expected);
  });
});

describe('resolveMapLayout 不依赖窗口尺寸', () => {
  // 桩里 window.innerWidth 为 0；把它改成 4000 后结果必须一字不差
  it('window.innerWidth 变化不影响结果', () => {
    const before = window.innerWidth;
    const original = resolveMapLayout({ zoom: 1 });

    expect(before).toBe(0);

    Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: 4000 });

    try {
      expect(resolveMapLayout({ zoom: 1 })).toEqual(original);
      expect(resolveMapLayout({ zoom: 1 }).canvasWidth).toBe(416);
    } finally {
      Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: before });
    }
  });
});
