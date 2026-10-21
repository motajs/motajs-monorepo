import { describe, expect, it } from 'vitest';
import { IMapDirections, IMapDocument, IMapLayer, IMapTileEntry, IMapTilePass } from '../types';
import { IMapRenderView, buildMapRenderModel } from '../model/renderModel';
import { computePassabilityMarks } from '../model/passability';

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
 * 造一个图块条目；裁切与名称固定，通行属性可覆盖
 * @param number 图块编号
 * @param pass 覆盖通行属性字段
 * @returns 图块条目
 */
function createTile(number: number, pass: Partial<IMapTilePass> = {}): IMapTileEntry {
  return {
    number,
    column: 0,
    row: 0,
    crop: { x: 0, y: 0, width: 32, height: 32 },
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
  return { id: 'map', name: '地图', width, height, layers, tileGroups: [] };
}

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
      createLayer('upper', [[0, 0], [1, 0]], false),
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

  // 输出直接喂给渲染模型：大地图小格时降级为红点（dot 为 true）
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

    expect(model.passMarks).toHaveLength(1600);
    expect(model.passMarks.every((mark) => mark.dot)).toBe(true);
  });
});
