import { describe, expect, it } from 'vitest';
import {
  MAP_CELL_SIZE,
  MAP_PASS_ARROW_HEAD_HALF_WIDTH,
  MAP_PASS_ARROW_HEAD_LENGTH,
  MAP_PASS_COLOR_DOWN,
  MAP_PASS_COLOR_LEFT,
  MAP_PASS_COLOR_RIGHT,
  MAP_PASS_COLOR_UP,
} from '../constants';
import { IMapDirections, IMapDocument, IMapLayer, IMapTileEntry, IMapTilePass, MapDirection } from '../types';
import { IMapRenderView, buildMapRenderModel } from '../model/renderModel';
import {
  computePassabilityMarks,
  resolvePassArrowColor,
  resolvePassArrowHeadLength,
  resolvePassArrowLength,
} from '../model/passability';

// 只读通行度的用例：覆盖空格 / 全通 / 全阻 / 单方向 / 事件层 / 未知编号 / 多图层，以及输出直接喂给渲染模型。

/**
 * 造一份四方向通行属性；默认四方向都可通行
 * @param overrides 覆盖方向字段
 * @returns 四方向通行属性
 */
function createDirections(overrides: Partial<IMapDirections> = {}): IMapDirections {
  return { up: true, right: true, down: true, left: true, ...overrides };
}

/**
 * 造一个图块条目；名称固定，通行属性可覆盖
 * @param number 图块编号
 * @param pass 覆盖通行属性字段
 * @returns 图块条目
 */
function createTile(number: number, pass: Partial<IMapTilePass> = {}): IMapTileEntry {
  return {
    number,
    column: 0,
    row: 0,
    name: `图块 ${number}`,
    pass: { out: createDirections(), in: createDirections(), onlyEventLayer: false, ...pass },
  };
}

/**
 * 把图块条目列表摊平成编号索引
 * @param tiles 图块条目列表
 * @returns 编号到条目只读索引
 */
function createTileIndex(tiles: readonly IMapTileEntry[]): ReadonlyMap<number, IMapTileEntry> {
  return new Map(tiles.map((tile) => [tile.number, tile]));
}

/**
 * 造一个图层
 * @param id 图层标识
 * @param cells 二维格子
 * @param isEventLayer 是否为事件图层
 * @returns 图层
 */
function createLayer(id: string, cells: readonly (readonly number[])[], isEventLayer: boolean = false): IMapLayer {
  return { id, name: id, zIndex: 0, isEventLayer, cells };
}

/**
 * 造一份中立文档
 * @param layers 图层列表
 * @param width 地图宽度
 * @param height 地图高度
 * @returns 中立文档
 */
function createDocument(layers: readonly IMapLayer[], width: number = 3, height: number = 2): IMapDocument {
  return {
    id: 'map',
    name: '地图',
    width,
    height,
    layers,
    tileGroups: [],
    cellWidth: MAP_CELL_SIZE,
    cellHeight: MAP_CELL_SIZE,
  };
}

describe('resolvePassArrowColor 四色映射', () => {
  // 四个方向的颜色常量互不相同：G-04-2 的「四个方向糊成一个红十字」由这条断言钉住
  it('四个方向的颜色常量互不相同', () => {
    const colors = [MAP_PASS_COLOR_UP, MAP_PASS_COLOR_RIGHT, MAP_PASS_COLOR_DOWN, MAP_PASS_COLOR_LEFT];

    expect(new Set(colors).size).toBe(4);
  });

  // 每个方向拿到自己的颜色，不会串到相邻方向
  it('按方向返回对应颜色', () => {
    expect(resolvePassArrowColor(MapDirection.Up)).toBe(MAP_PASS_COLOR_UP);
    expect(resolvePassArrowColor(MapDirection.Right)).toBe(MAP_PASS_COLOR_RIGHT);
    expect(resolvePassArrowColor(MapDirection.Down)).toBe(MAP_PASS_COLOR_DOWN);
    expect(resolvePassArrowColor(MapDirection.Left)).toBe(MAP_PASS_COLOR_LEFT);
  });
});

describe('computePassabilityMarks', () => {
  // 空格子（编号 0）不产生通行度标记
  it('空格子不产生标记', () => {
    const tile = createTile(1, { out: createDirections({ up: false }), in: createDirections({ up: false }) });
    const document = createDocument([createLayer('layer-a', [[0, 0, 0]])], 3, 1);
    const marks = computePassabilityMarks(document, 'layer-a', createTileIndex([tile]));

    expect(marks).toEqual([]);
  });

  // 四方向都可通行的图块不产生任何标记
  it('四方向全通不产生标记', () => {
    const document = createDocument([createLayer('layer-a', [[1, 1, 1]])], 3, 1);
    const marks = computePassabilityMarks(document, 'layer-a', createTileIndex([createTile(1)]));

    expect(marks).toEqual([]);
  });

  // 四方向都不可通行时，一格输出四个方向
  it('四方向全阻产生四个方向', () => {
    const blocked = createDirections({ up: false, right: false, down: false, left: false });
    const tile = createTile(1, { out: blocked, in: blocked });
    const document = createDocument([createLayer('layer-a', [[1]])], 1, 1);
    const marks = computePassabilityMarks(document, 'layer-a', createTileIndex([tile]));

    expect(marks).toHaveLength(1);
    expect(marks[0].x).toBe(0);
    expect(marks[0].y).toBe(0);
    expect(marks[0].blocked).toEqual({ up: true, right: true, down: true, left: true });
    expect(marks[0].dot).toBe(false);
  });

  // 只有「不能离开」缺一个方向时，只标那一个方向
  it('只有不能离开缺一个方向时只标该方向', () => {
    const tile = createTile(1, { out: createDirections({ right: false }) });
    const document = createDocument([createLayer('layer-a', [[1]])], 1, 1);
    const marks = computePassabilityMarks(document, 'layer-a', createTileIndex([tile]));

    expect(marks).toHaveLength(1);
    expect(marks[0].blocked).toEqual({ up: false, right: true, down: false, left: false });
  });

  // 只有「不能进入」缺一个方向时，同样只标那一个方向
  it('只有不能进入缺一个方向时只标该方向', () => {
    const tile = createTile(1, { in: createDirections({ down: false }) });
    const document = createDocument([createLayer('layer-a', [[1]])], 1, 1);
    const marks = computePassabilityMarks(document, 'layer-a', createTileIndex([tile]));

    expect(marks).toHaveLength(1);
    expect(marks[0].blocked).toEqual({ up: false, right: false, down: true, left: false });
  });

  // 标了 onlyEventLayer 的图块落在普通层时不参与通行度显示
  it('只在事件层生效的图块在普通层不产生标记', () => {
    const tile = createTile(1, { out: createDirections({ up: false }), onlyEventLayer: true });
    const document = createDocument([createLayer('layer-a', [[1]])], 1, 1);
    const marks = computePassabilityMarks(document, 'layer-a', createTileIndex([tile]));

    expect(marks).toEqual([]);
  });

  // 标了 onlyEventLayer 的图块落在事件层时正常参与
  it('只在事件层生效的图块在事件层产生标记', () => {
    const tile = createTile(1, { out: createDirections({ up: false }), onlyEventLayer: true });
    const document = createDocument([createLayer('layer-a', [[1]], true)], 1, 1);
    const marks = computePassabilityMarks(document, 'layer-a', createTileIndex([tile]));

    expect(marks).toHaveLength(1);
    expect(marks[0].blocked.up).toBe(true);
  });

  // 目录里没有的编号被跳过，且不抛错
  it('目录里没有的编号被跳过', () => {
    const tile = createTile(1, { out: createDirections({ up: false }) });
    const document = createDocument([createLayer('layer-a', [[1, 9]])], 2, 1);
    const marks = computePassabilityMarks(document, 'layer-a', createTileIndex([tile]));

    expect(marks).toHaveLength(1);
    expect(marks[0].x).toBe(0);
  });

  // 图层不存在时返回空数组，不抛错
  it('图层不存在时返回空数组', () => {
    const document = createDocument([createLayer('layer-a', [[1]])], 1, 1);
    const marks = computePassabilityMarks(document, 'missing', createTileIndex([createTile(1)]));

    expect(marks).toEqual([]);
  });

  // 多个图层分别计算，坐标只来自各自图层
  it('多个图层分别计算互不污染', () => {
    const blockedTile = createTile(1, { out: createDirections({ up: false }) });
    const tileIndex = createTileIndex([blockedTile]);
    const document = createDocument([
      createLayer('lower', [[1, 0]], false),
      createLayer(
        'upper',
        [
          [0, 0],
          [1, 0],
        ],
        false,
      ),
    ]);

    const lower = computePassabilityMarks(document, 'lower', tileIndex);
    const upper = computePassabilityMarks(document, 'upper', tileIndex);

    expect(lower).toHaveLength(1);
    expect(lower[0]).toMatchObject({ x: 0, y: 0 });
    expect(upper).toHaveLength(1);
    expect(upper[0]).toMatchObject({ x: 0, y: 1 });
  });

  // 输出直接喂给渲染模型：普通模式得到逐方向箭头（dot 为 false）
  it('输出直接喂给渲染模型的普通模式得到箭头', () => {
    const tile = createTile(1, { out: createDirections({ left: false }) });
    const document = createDocument([createLayer('layer-a', [[1]])], 1, 1);
    const passMarks = computePassabilityMarks(document, 'layer-a', createTileIndex([tile]));
    const view: IMapRenderView = {
      width: 32,
      height: 32,
      currentLayerId: 'layer-a',
      aboveLayerOpacity: 0.3,
      viewport: { left: 0, top: 0 },
      bigMap: false,
      passMarks,
    };
    const model = buildMapRenderModel(document, view);

    expect(model.passMarks).toHaveLength(1);
    expect(model.passMarks[0].blocked.left).toBe(true);
    expect(model.passMarks[0].dot).toBe(false);
  });

  // 输出直接喂给渲染模型：大地图按缩略格降采样为红点（40 × 40 图在 400 画布上 step = 2，剩 20 × 20 = 400 条）
  it('输出直接喂给渲染模型的大地图小格得到红点', () => {
    const tile = createTile(1, { out: createDirections({ right: false }) });
    const rows: number[][] = [];

    for (let y = 0; y < 40; y += 1) rows.push(new Array<number>(40).fill(1));

    const document = createDocument([createLayer('layer-a', rows)], 40, 40);
    const passMarks = computePassabilityMarks(document, 'layer-a', createTileIndex([tile]));
    const view: IMapRenderView = {
      width: 400,
      height: 400,
      currentLayerId: 'layer-a',
      aboveLayerOpacity: 0.3,
      viewport: { left: 0, top: 0 },
      bigMap: true,
      passMarks,
    };
    const model = buildMapRenderModel(document, view);

    expect(model.passMarks).toHaveLength(400);
    expect(model.passMarks.every((mark) => mark.dot)).toBe(true);
  });
});

describe('通行度箭头几何', () => {
  // 32×32 的格子箭头伸到 15px（半个格再留 1px 余量），16×16 相应变成 7px
  it('箭头长度按格尺寸现算', () => {
    expect(resolvePassArrowLength(32, 32)).toBe(15);
    expect(resolvePassArrowLength(16, 16)).toBe(7);
  });

  // 非法格尺寸不抛错，长度仍不小于 2px
  it('非法格尺寸退回最短长度', () => {
    expect(resolvePassArrowLength(0, 0)).toBe(2);
    expect(resolvePassArrowLength(Number.NaN, Number.NaN)).toBe(2);
  });

  // 头长取「常量上限」与「全长一半」的较小值，保证头不会超过箭头本身
  it('头长夹取在常量上限与全长一半之间', () => {
    expect(resolvePassArrowHeadLength(15)).toBe(MAP_PASS_ARROW_HEAD_LENGTH);
    expect(resolvePassArrowHeadLength(4)).toBe(2);
    expect(resolvePassArrowHeadLength(0)).toBe(0);
  });

  // 常量落在 4..6px 区间：整头宽 5px，头长 6px
  it('常量边界落在 4..6px 区间', () => {
    expect(MAP_PASS_ARROW_HEAD_LENGTH).toBeGreaterThanOrEqual(4);
    expect(MAP_PASS_ARROW_HEAD_LENGTH).toBeLessThanOrEqual(6);
    expect(MAP_PASS_ARROW_HEAD_HALF_WIDTH * 2).toBeGreaterThanOrEqual(4);
    expect(MAP_PASS_ARROW_HEAD_HALF_WIDTH * 2).toBeLessThanOrEqual(6);
  });

  // 32×32 下三角底离中心还有 9px，远大于半宽 2.5px：四支箭头的轴向带互不相交
  it('32×32 格内四方向头部互不重叠', () => {
    const length = resolvePassArrowLength(32, 32);
    const headLength = resolvePassArrowHeadLength(length);

    expect(length - headLength).toBeGreaterThan(MAP_PASS_ARROW_HEAD_HALF_WIDTH);
    expect(MAP_PASS_ARROW_HEAD_HALF_WIDTH * 2).toBeLessThanOrEqual(6);
    expect(MAP_PASS_ARROW_HEAD_HALF_WIDTH * 2).toBeLessThan(length);
  });
});
