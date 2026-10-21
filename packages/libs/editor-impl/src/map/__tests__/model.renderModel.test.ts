import { describe, expect, it } from 'vitest';
import { IMapDocument, IMapLayer, IMapPreview, IMapRect } from '../types';
import { createMapDocument, createWideMapDocument } from './fixtures';
import { IMapRenderView, buildMapRenderModel } from '../model/renderModel';

/**
 * 造一个普通模式的视图参数：画布 128 × 96（4 列 × 3 行），视口在左上角
 * @param overrides 覆盖视图字段
 * @returns 视图参数
 */
function createView(overrides: Partial<IMapRenderView> = {}): IMapRenderView {
  return {
    width: 128,
    height: 96,
    currentLayerId: 'layer-base',
    aboveLayerOpacity: 0.3,
    viewport: { left: 0, top: 0 },
    bigMap: false,
    passMarks: [],
    ...overrides,
  };
}

describe('buildMapRenderModel 普通模式', () => {
  // 大地图 + 小视口：只输出视口覆盖的行列范围，不输出整图
  it('只输出视口内的格子', () => {
    const document = createWideMapDocument(40, 40);
    const model = buildMapRenderModel(document, createView({ width: 64, height: 96, currentLayerId: 'layer-wide' }));

    expect(model.cells).toHaveLength(6);
    expect(model.cells[0].key).toBe('layer-wide:0:0');
    expect(model.cells[0].width).toBe(32);
    expect(model.cells[0].height).toBe(32);
  });

  // 视口偏移时格子 key 与目标像素都以偏移后的行列计算
  it('按视口偏移取格子并归零像素坐标', () => {
    const document = createWideMapDocument(40, 40);
    const model = buildMapRenderModel(
      document,
      createView({ width: 64, height: 64, currentLayerId: 'layer-wide', viewport: { left: 5, top: 7 } }),
    );

    expect(model.cells).toHaveLength(4);
    expect(model.cells[0].key).toBe('layer-wide:5:7');
    expect(model.cells[0].x).toBe(0);
    expect(model.cells[0].y).toBe(0);
  });

  // 层按 zIndex 从低到高输出：低于 / 等于当前层为 1，高于当前层取传入值
  it('按 zIndex 排列图层并区分透明度', () => {
    const document = createMapDocument();
    const currentBase = buildMapRenderModel(document, createView({ aboveLayerOpacity: 0.5 }));

    expect(currentBase.cells).toHaveLength(24);
    expect(currentBase.cells[0].key).toBe('layer-base:0:0');
    expect(currentBase.cells[0].opacity).toBe(1);
    expect(currentBase.cells[12].key).toBe('layer-upper:0:0');
    expect(currentBase.cells[12].opacity).toBe(0.5);

    const currentUpper = buildMapRenderModel(document, createView({ currentLayerId: 'layer-upper' }));

    expect(currentUpper.cells[0].opacity).toBe(1);
    expect(currentUpper.cells[12].opacity).toBe(1);
  });

  // 不同层的同一格 key 不同，避免画布子节点互相覆盖
  it('格子 key 同时含层标识与坐标', () => {
    const document = createMapDocument();
    const model = buildMapRenderModel(document, createView());
    const keys = new Set(model.cells.map((cell) => cell.key));

    expect(keys.size).toBe(model.cells.length);
  });

  // 空格子省略图片且 missing 为 false；目录里查不到的编号 missing 为 true；查到的图块带图片与裁切
  it('区分空格、未知编号与已查到的图块', () => {
    const document = createMapDocument();
    const base = document.layers[0];
    const cells = base.cells.map((row) => [...row]);
    const layers: readonly IMapLayer[] = [{ ...base, cells: cells }, document.layers[1]];
    cells[0][2] = 99;
    const modified: IMapDocument = { ...document, layers };
    const model = buildMapRenderModel(modified, createView());

    const found = model.cells.find((cell) => cell.key === 'layer-base:0:0')!;
    const unknown = model.cells.find((cell) => cell.key === 'layer-base:2:0')!;
    const empty = model.cells.find((cell) => cell.key === 'layer-base:0:1')!;

    expect(found.missing).toBe(false);
    expect(found.imagePath).toBe('content/map/tiles-a.png');
    expect(found.crop).toEqual({ x: 0, y: 0, width: 32, height: 32 });
    expect(unknown.missing).toBe(true);
    expect(unknown.imagePath).toBeUndefined();
    expect(unknown.crop).toBeUndefined();
    expect(empty.missing).toBe(false);
    expect(empty.imagePath).toBeUndefined();
    expect(empty.crop).toBeUndefined();
  });

  // 普通模式按可见范围生成横竖线
  it('按可见行列生成网格线', () => {
    const document = createMapDocument();
    const model = buildMapRenderModel(document, createView());
    const verticals = model.gridLines.filter((line) => line.vertical);
    const horizontals = model.gridLines.filter((line) => !line.vertical);

    expect(model.gridLines).toHaveLength(9);
    expect(verticals).toHaveLength(5);
    expect(horizontals).toHaveLength(4);
    expect(verticals[0].length).toBe(96);
    expect(horizontals[0].length).toBe(128);
  });

  // 视口落在地图之外时没有可见格，也就没有网格线
  it('没有可见格时不生成网格线', () => {
    const document = createMapDocument();
    const model = buildMapRenderModel(document, createView({ width: 64, height: 96, viewport: { left: 10, top: 0 } }));

    expect(model.cells).toHaveLength(0);
    expect(model.gridLines).toHaveLength(0);
  });

  // 普通模式把传入的通行度标记保持为逐方向箭头（dot 为 false）
  it('普通模式不把通行度标记降级为红点', () => {
    const document = createMapDocument();
    const model = buildMapRenderModel(
      document,
      createView({
        passMarks: [
          {
            x: 0,
            y: 0,
            blocked: { up: true, right: false, down: false, left: false },
            dot: true,
          },
        ],
      }),
    );

    expect(model.passMarks).toHaveLength(1);
    expect(model.passMarks[0].dot).toBe(false);
    expect(model.passMarks[0].blocked.up).toBe(true);
  });

  // 框选 / 预览 / 悬停原样透传
  it('透传框选、预览与悬停', () => {
    const document = createMapDocument();
    const selection: IMapRect = { x: 1, y: 1, width: 2, height: 1 };
    const preview: IMapPreview = { rect: { x: 0, y: 0, width: 2, height: 2 }, patternWidth: 2, patternHeight: 2 };
    const hover = { x: 3, y: 2 };
    const model = buildMapRenderModel(document, createView({ selection, preview, hover }));

    expect(model.selection).toEqual(selection);
    expect(model.preview).toEqual(preview);
    expect(model.hover).toEqual(hover);
  });
});

describe('buildMapRenderModel 大地图模式', () => {
  // 整图按保持宽高比缩放到画布内并居中
  it('按保持宽高比缩放并居中', () => {
    const document = createWideMapDocument(100, 50);
    const model = buildMapRenderModel(
      document,
      createView({ width: 400, height: 400, currentLayerId: 'layer-wide', bigMap: true }),
    );

    expect(model.cells).toHaveLength(5000);
    expect(model.cells[0].key).toBe('layer-wide:0:0');
    expect(model.cells[0].x).toBe(0);
    expect(model.cells[0].y).toBe(100);
    expect(model.cells[0].width).toBe(4);
    expect(model.cells[0].height).toBe(4);
    expect(model.cells[4999].x).toBe(396);
    expect(model.cells[4999].y).toBe(296);
  });

  // 格边长小于 16px 时通行度标记降级为红点
  it('格边长小于 16px 时把通行度降级为红点', () => {
    const document = createWideMapDocument(100, 50);
    const marks = [{ x: 3, y: 4, blocked: { up: false, right: true, down: false, left: false }, dot: false }];
    const model = buildMapRenderModel(
      document,
      createView({ width: 400, height: 400, currentLayerId: 'layer-wide', bigMap: true, passMarks: marks }),
    );

    expect(model.passMarks).toHaveLength(1);
    expect(model.passMarks[0].dot).toBe(true);
    expect(model.passMarks[0].blocked.right).toBe(true);
  });

  // 大地图模式不生成网格线
  it('不生成网格线', () => {
    const document = createWideMapDocument(20, 10);
    const model = buildMapRenderModel(
      document,
      createView({ width: 400, height: 400, currentLayerId: 'layer-wide', bigMap: true }),
    );

    expect(model.gridLines).toHaveLength(0);
  });

  // 图元总数超过上限时只输出当前层
  it('超过图元上限时只输出当前层', () => {
    const document = createWideMapDocument(120, 60);
    const wide = document.layers[0];
    const layers: readonly IMapLayer[] = [wide, { ...wide, id: 'layer-extra', zIndex: 1 }];
    const model = buildMapRenderModel(
      { ...document, layers },
      createView({ width: 240, height: 120, currentLayerId: 'layer-wide', bigMap: true }),
    );

    expect(model.cells).toHaveLength(7200);
    expect(model.cells.every((cell) => cell.key.startsWith('layer-wide:'))).toBe(true);
  });
});
