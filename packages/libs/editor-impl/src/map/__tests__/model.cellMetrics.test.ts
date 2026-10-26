import { describe, expect, it } from 'vitest';
import { resolveCellMetrics, resolvePointerCell, resolvePreviewCellRects, resolveTileDest } from '../model/cellMetrics';

// 格子度量的纯函数测试：contain 目标矩形、度量组装与指针换算。
// 全部断言具体数值（不 snapshot）：这些数字是画布、命中与后续自动拼接共同的度量契约。

describe('resolveTileDest 素材 contain', () => {
  // 大素材缩到格内并垂直居中：64 × 32 放进 32 × 32 得到 32 × 16、y 偏移 8
  it('大素材按比例缩进格内并垂直居中', () => {
    expect(resolveTileDest(0, 0, 32, 32, 64, 32)).toEqual({ x: 0, y: 8, width: 32, height: 16 });
  });

  // 小素材保持原尺寸并水平 / 垂直居中：16 × 16 放进 32 × 32 得到偏移 8 / 8
  it('小素材保持原尺寸并居中', () => {
    expect(resolveTileDest(0, 0, 32, 32, 16, 16)).toEqual({ x: 8, y: 8, width: 16, height: 16 });
  });

  // 非正方形格：48 × 24 放 64 × 64 得到 24 × 24、x 偏移 12、y 偏移 0
  it('非正方形格按较紧的一边 contain', () => {
    expect(resolveTileDest(0, 0, 48, 24, 64, 64)).toEqual({ x: 12, y: 0, width: 24, height: 24 });
  });

  // 目标矩形以格子原点为基准，格子位置变化只平移结果
  it('以格子原点平移目标矩形', () => {
    expect(resolveTileDest(96, 48, 48, 24, 64, 64)).toEqual({ x: 108, y: 48, width: 24, height: 24 });
  });

  // 素材尺寸为 0 时退化为整格矩形，不抛错也不产生 NaN
  it('素材尺寸为 0 时退化为整格矩形', () => {
    expect(resolveTileDest(0, 0, 32, 24, 0, 64)).toEqual({ x: 0, y: 0, width: 32, height: 24 });
    expect(resolveTileDest(0, 0, 32, 24, 64, 0)).toEqual({ x: 0, y: 0, width: 32, height: 24 });
  });

  // 默认不放大的回归：52 格里的 32 源格仍按原尺寸居中、四周各留 10px，不被顺手放大
  it('默认不放大地图缩略以外的格子', () => {
    expect(resolveTileDest(0, 0, 52, 52, 32, 32)).toEqual({ x: 10, y: 10, width: 32, height: 32 });
  });

  // 允许放大后铺满：52 × 52 的格子放 32 × 32 的源格得到贴满整格、没有留白
  it('允许放大后小素材铺满整格', () => {
    expect(resolveTileDest(0, 0, 52, 52, 32, 32, true)).toEqual({ x: 0, y: 0, width: 52, height: 52 });
  });

  // 允许放大不等于强行拉伸：96 × 64 仍按 contain 比例，本次宽贴满 52、高约 34.6667、上下居中
  it('允许放大时仍按 contain 比例不拉伸', () => {
    const dest = resolveTileDest(0, 0, 52, 52, 96, 64, true);

    expect(dest.width).toBeCloseTo(52, 6);
    expect(dest.height).toBeCloseTo(104 / 3, 6);
    expect(dest.y).toBeCloseTo(26 / 3, 6);
  });

  // 非法素材尺寸在允许放大时仍退化为整格矩形，不产生 NaN
  it('允许放大时非法素材尺寸仍退化为整格矩形', () => {
    expect(resolveTileDest(0, 0, 52, 52, 0, 64, true)).toEqual({ x: 0, y: 0, width: 52, height: 52 });
    expect(resolveTileDest(0, 0, 52, 52, 64, 0, true)).toEqual({ x: 0, y: 0, width: 52, height: 52 });
  });
});

describe('resolveCellMetrics 度量组装', () => {
  // 四个字段原样落到度量上，不在这里做任何换算
  it('原样组装格宽高与第一格原点', () => {
    expect(resolveCellMetrics(48, 24, 12, 6)).toEqual({ cellWidth: 48, cellHeight: 24, left: 12, top: 6 });
  });
});

describe('resolvePreviewCellRects 整条路径矩形', () => {
  // 视口 (3,5)、格 48 × 24 时，格子 (5,7) 落在 (96, 48)，正好是「减视口再乘格尺寸」
  it('把视口换算进整条路径的每个矩形', () => {
    expect(resolvePreviewCellRects([{ x: 5, y: 7 }], { left: 3, top: 5 }, 48, 24)).toEqual([
      { x: 96, y: 48, width: 48, height: 24 },
    ]);
  });

  // 空路径返回空数组，画布据此不创建预览图形
  it('空数组返回空数组', () => {
    expect(resolvePreviewCellRects([], { left: 3, top: 5 }, 48, 24)).toEqual([]);
  });

  // 视口在原点时矩形就是格坐标乘格尺寸，不做任何偏移
  it('视口在原点时矩形就是格坐标乘格尺寸', () => {
    expect(
      resolvePreviewCellRects(
        [
          { x: 0, y: 0 },
          { x: 2, y: 1 },
        ],
        { left: 0, top: 0 },
        32,
        32,
      ),
    ).toEqual([
      { x: 0, y: 0, width: 32, height: 32 },
      { x: 64, y: 32, width: 32, height: 32 },
    ]);
  });

  // 越界格照样输出矩形（裁剪交给画布），不在纯函数里丢弃
  it('越界格照样输出矩形', () => {
    expect(resolvePreviewCellRects([{ x: 0, y: 0 }], { left: 2, top: 2 }, 32, 32)).toEqual([
      { x: -64, y: -64, width: 32, height: 32 },
    ]);
  });
});

describe('resolvePointerCell 指针换算', () => {
  // 普通换算：格 48 × 24、视口 (3, 5)、指针 (100, 60) 落在第 5 列第 7 行
  it('按格尺寸换算并叠加视口', () => {
    expect(
      resolvePointerCell(100, 60, { left: 0, top: 0 }, resolveCellMetrics(48, 24, 0, 0), { left: 3, top: 5 }),
    ).toEqual({ x: 5, y: 7 });
  });

  // 画布容器有偏移时先减掉容器原点：同样指针落在第 4 列第 6 行
  it('先减掉画布容器原点', () => {
    expect(
      resolvePointerCell(100, 60, { left: 20, top: 30 }, resolveCellMetrics(48, 24, 0, 0), { left: 3, top: 5 }),
    ).toEqual({ x: 4, y: 6 });
  });

  // 大地图留白原点：40 × 26 图在 416 画布上 top ≈ 72.8，指针 (5, 88) 落在第 1 行而不是第 8 行
  it('减掉大地图留白原点后落在第 1 行', () => {
    expect(
      resolvePointerCell(5, 88, { left: 0, top: 0 }, resolveCellMetrics(10.4, 10.4, 0, 72.8), { left: 0, top: 0 }),
    ).toEqual({ x: 0, y: 1 });
  });

  // 缩放只改变格尺寸：格宽高翻倍后，同一指针换算出的格数减半
  it('格宽高翻倍时换算结果减半', () => {
    const single = resolvePointerCell(100, 60, { left: 0, top: 0 }, resolveCellMetrics(48, 24, 0, 0), {
      left: 0,
      top: 0,
    });
    const doubled = resolvePointerCell(100, 60, { left: 0, top: 0 }, resolveCellMetrics(96, 48, 0, 0), {
      left: 0,
      top: 0,
    });

    expect(single).toEqual({ x: 2, y: 2 });
    expect(doubled).toEqual({ x: 1, y: 1 });
  });

  // 格尺寸为 0 时退回视口原点，不产生 Infinity 或 NaN
  it('格尺寸为 0 时退回视口原点', () => {
    expect(
      resolvePointerCell(100, 60, { left: 0, top: 0 }, resolveCellMetrics(0, 0, 0, 0), { left: 3, top: 5 }),
    ).toEqual({ x: 3, y: 5 });
  });
});
