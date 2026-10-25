import { describe, expect, it } from 'vitest';
import {
  IMapDocument,
  IMapLayer,
  IMapPassMark,
  IMapPreview,
  IMapRect,
  IMapTileEntry,
  IMapTilePass,
  MapAutotileType,
  MapFrameAxis,
  MapTextureReadType,
  MapTileCategory,
} from '../types';
import { createMapDocument, createSizedTileGroup, createTileGroup, createWideMapDocument } from './fixtures';
import { resolveMapLayout } from '../model/layout';
import { IMapRenderView, buildMapRenderModel } from '../model/renderModel';

/**
 * 造一份四方向都可通行的通行属性
 * @returns 四方向都为 true 的通行属性
 */
function createOpenPass(): IMapTilePass {
  const directions = { up: true, right: true, down: true, left: true };

  return { out: directions, in: directions, onlyEventLayer: false };
}

/**
 * 造一个带方向的通行度标记
 * @param x 标记所在格横坐标
 * @param y 标记所在格纵坐标
 * @param blocked 不可通行的方向
 * @returns 通行度标记
 */
function createPassMark(x: number, y: number, blocked: Partial<IMapPassMark['blocked']>): IMapPassMark {
  return { x, y, blocked: { up: false, right: false, down: false, left: false, ...blocked }, dot: false };
}

/**
 * 造一份铺满整张地图的通行度标记，四个方向都不可通行
 * @param width 地图宽度（格子数）
 * @param height 地图高度（格子数）
 * @returns 每格一条的通行度标记
 */
function createFullPassMarks(width: number, height: number): readonly IMapPassMark[] {
  const marks: IMapPassMark[] = [];

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1)
      marks.push(createPassMark(x, y, { up: true, right: true, down: true, left: true }));
  }

  return marks;
}

/**
 * 造一个 1 格宽的文档，用于把单个图块放进渲染模型
 * @param value 格子里的图块编号
 * @param tileGroups 图块目录
 * @returns 单格文档
 */
function createSingleCellDocument(value: number, tileGroups: IMapDocument['tileGroups']): IMapDocument {
  const layer: IMapLayer = { id: 'layer-base', name: '基础层', zIndex: 0, isEventLayer: false, cells: [[value]] };

  return createMapDocument({ width: 1, height: 1, layers: [layer], tileGroups });
}

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

  // 普通模式只保留视口内的通行度标记：输出条数只与可见格有关，与文档总格数无关
  it('只保留视口内的通行度标记', () => {
    const document = createWideMapDocument(40, 40);
    const model = buildMapRenderModel(
      document,
      createView({
        width: 416,
        height: 416,
        currentLayerId: 'layer-wide',
        viewport: { left: 3, top: 5 },
        passMarks: [
          createPassMark(0, 0, { up: true }),
          createPassMark(3, 5, { right: true }),
          createPassMark(15, 17, { down: true }),
          createPassMark(16, 17, { left: true }),
        ],
      }),
    );

    expect(model.passMarks).toHaveLength(2);
    expect(model.passMarks.map((mark) => `${mark.x},${mark.y}`)).toEqual(['3,5', '15,17']);
    expect(model.passMarks.every((mark) => mark.dot === false)).toBe(true);
    expect(model.passMarks[0].blocked.right).toBe(true);
    expect(model.passMarks[1].blocked.down).toBe(true);
  });

  // 普通模式输出空的 previewCells，供 Plan 09 的画布在本地覆盖成整条路径
  it('输出空的 previewCells 供画布覆盖整条路径', () => {
    const document = createMapDocument();
    const model = buildMapRenderModel(document, createView());

    expect(model.previewCells).toEqual([]);
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
  // 256 × 256 图在 416 画布上只给缩略描述，不产逐格格子；视口原样透传
  it('只输出缩略描述而不产逐格格子', () => {
    const document = createWideMapDocument(256, 256);
    const model = buildMapRenderModel(
      document,
      createView({
        width: 416,
        height: 416,
        currentLayerId: 'layer-wide',
        viewport: { left: 100, top: 100 },
        bigMap: true,
      }),
    );

    expect(model.cells).toHaveLength(0);
    expect(model.gridLines).toHaveLength(0);
    expect(model.thumbnail).toEqual({
      width: 416,
      height: 416,
      scale: 1.625,
      offsetX: 0,
      offsetY: 0,
      textureWidth: 416,
      textureHeight: 416,
    });
    expect(model.viewport).toEqual({ left: 100, top: 100 });
  });

  // 缩略纹理边长受 512 上限约束，映射到画布仍等比居中
  it('把缩略纹理边长夹到 512', () => {
    const document: IMapDocument = { ...createMapDocument(), width: 600, height: 600 };
    const model = buildMapRenderModel(document, createView({ width: 2000, height: 2000, bigMap: true }));

    expect(model.thumbnail!.textureWidth).toBe(512);
    expect(model.thumbnail!.textureHeight).toBe(512);
    expect(model.thumbnail!.scale).toBeCloseTo(2000 / 600, 6);
  });

  // 缩略格小于 16px 时通行度降级为单色点（D-12 的四色箭头只适用普通模式）
  it('缩略格小于 16px 时把通行度降级为单色点', () => {
    const document = createWideMapDocument(100, 50);
    const marks = [createPassMark(3, 4, { right: true })];
    const model = buildMapRenderModel(
      document,
      createView({ width: 400, height: 400, currentLayerId: 'layer-wide', bigMap: true, passMarks: marks }),
    );

    expect(model.passMarks).toHaveLength(1);
    expect(model.passMarks[0].dot).toBe(true);
    expect(model.passMarks[0].blocked.right).toBe(true);
    expect(model.passMarks[0].x).toBe(0);
    expect(model.passMarks[0].y).toBe(4);
  });

  // 416 画布上的 256 × 256 图：step = 10，65536 条标记被压到不超过 26 × 26 条
  it('把整层通行度按缩略格降采样', () => {
    const document = createWideMapDocument(256, 256);
    const marks = createFullPassMarks(256, 256);
    const model = buildMapRenderModel(
      document,
      createView({ width: 416, height: 416, currentLayerId: 'layer-wide', bigMap: true, passMarks: marks }),
    );

    expect(model.passMarks.length).toBeLessThanOrEqual(26 * 26);
    expect(model.passMarks.length).toBeGreaterThan(0);
    expect(model.passMarks.every((mark) => mark.x % 10 === 0 && mark.y % 10 === 0)).toBe(true);
    expect(model.passMarks.every((mark) => mark.dot)).toBe(true);
  });

  // 画布放大到 4096（缩略格 16px）时 step 退回 1，不做合并
  it('缩略格够大时不合并通行度标记', () => {
    const document = createWideMapDocument(256, 256);
    const marks = createFullPassMarks(256, 256);
    const model = buildMapRenderModel(
      document,
      createView({ width: 4096, height: 4096, currentLayerId: 'layer-wide', bigMap: true, passMarks: marks }),
    );

    expect(model.passMarks).toHaveLength(256 * 256);
    expect(model.passMarks.every((mark) => !mark.dot)).toBe(true);
  });

  // 同一桶内的两个标记只留一条，四个方向取逻辑或
  it('同一缩略桶内的方向取逻辑或', () => {
    const document = createWideMapDocument(256, 256);
    const model = buildMapRenderModel(
      document,
      createView({
        width: 416,
        height: 416,
        currentLayerId: 'layer-wide',
        bigMap: true,
        passMarks: [createPassMark(0, 0, { up: true }), createPassMark(1, 1, { right: true })],
      }),
    );

    expect(model.passMarks).toHaveLength(1);
    expect(model.passMarks[0].x).toBe(0);
    expect(model.passMarks[0].y).toBe(0);
    expect(model.passMarks[0].blocked.up).toBe(true);
    expect(model.passMarks[0].blocked.right).toBe(true);
    expect(model.passMarks[0].dot).toBe(true);
  });

  // 普通模式不带缩略描述
  it('普通模式不带缩略描述', () => {
    const document = createMapDocument();
    const model = buildMapRenderModel(document, createView());

    expect(model.thumbnail).toBeUndefined();
  });
});

describe('buildMapRenderModel 格度量', () => {
  // 文档自报 48 × 24 也只是素材切分的依据：模型上报的显示格恒为 32 × 32
  it('文档声明的格尺寸不进入模型度量', () => {
    const document = createMapDocument({
      cellWidth: 48,
      cellHeight: 24,
      tileGroups: [createSizedTileGroup({ cellWidth: 64, cellHeight: 64 })],
    });
    const model = buildMapRenderModel(document, createView({ width: 192, height: 72 }));
    const first = model.cells[0];

    expect(model.renderScale).toBe(1);
    expect(model.cellWidth).toBe(32);
    expect(model.cellHeight).toBe(32);
    expect({ x: first.x, y: first.y, width: first.width, height: first.height }).toEqual({
      x: 0,
      y: 0,
      width: 32,
      height: 32,
    });
  });

  // 150%：显示格仍是 32，倍率单独上报；屏幕格像素 = 32 × 1.5
  it('把缩放作为整体倍率上报而不乘进格度量', () => {
    const document = createMapDocument({ tileGroups: [createSizedTileGroup({ cellWidth: 64, cellHeight: 64 })] });
    const model = buildMapRenderModel(document, createView({ width: 192, height: 144, zoom: 1.5 }));
    const first = model.cells[0];

    expect(model.renderScale).toBe(1.5);
    expect(model.cellWidth).toBe(32);
    expect(model.cellHeight).toBe(32);
    expect(model.cellWidth * model.renderScale).toBe(48);
    expect({ x: first.x, y: first.y, width: first.width, height: first.height }).toEqual({
      x: 0,
      y: 0,
      width: 32,
      height: 32,
    });
  });

  // 200%：屏幕格 64，模型的显示格基准还是 32
  it('200% 下屏幕格翻倍而模型格基准仍是 32', () => {
    const document = createMapDocument({ tileGroups: [createSizedTileGroup({ cellWidth: 64, cellHeight: 64 })] });
    const model = buildMapRenderModel(document, createView({ width: 256, height: 192, zoom: 2 }));
    const first = model.cells[0];

    expect(model.renderScale).toBe(2);
    expect(model.cellWidth).toBe(32);
    expect(model.cellHeight).toBe(32);
    expect(model.cellWidth * model.renderScale).toBe(64);
    expect({ x: first.x, y: first.y, width: first.width, height: first.height }).toEqual({
      x: 0,
      y: 0,
      width: 32,
      height: 32,
    });
  });

  // 大地图固定 renderScale = 1：缩略图已按画布像素算好，再乘一次就会溢出画布
  it('大地图模式上报固定的格度量与倍率 1', () => {
    const document = createWideMapDocument(100, 50);
    const model = buildMapRenderModel(
      document,
      createView({ width: 400, height: 400, currentLayerId: 'layer-wide', bigMap: true, zoom: 2 }),
    );

    expect(model.renderScale).toBe(1);
    expect(model.cellWidth).toBe(32);
    expect(model.cellHeight).toBe(32);
    expect(model.cells).toHaveLength(0);
    expect(model.thumbnail).toBeDefined();
  });

  // 空模型（大地图但文档尺寸为 0）同样带 renderScale = 1
  it('空模型也带倍率 1', () => {
    const document = createMapDocument({ width: 0, height: 0 });
    const model = buildMapRenderModel(document, createView({ width: 416, height: 416, bigMap: true }));

    expect(model.renderScale).toBe(1);
    expect(model.cells).toHaveLength(0);
  });
});

describe('buildMapRenderModel 可见格数与缩放同源', () => {
  // 13 × 13 的画布在 100% 下看到 13 列：竖直网格线 14 条（夹具放大到 16 × 16 才不会被文档裁掉）
  it('100% 时 416 宽的画布看到 13 列', () => {
    const document = createMapDocument({ cellWidth: 48, cellHeight: 48, width: 16, height: 16 });
    const model = buildMapRenderModel(document, createView({ width: 416, height: 416 }));
    const verticals = model.gridLines.filter((line) => line.vertical);

    expect(model.renderScale).toBe(1);
    expect(verticals).toHaveLength(14);
  });

  // 同样 416 宽的画布在 200% 下只看到 7 列：竖直网格线 8 条
  it('200% 时同一块画布只看到 7 列', () => {
    const document = createMapDocument({ cellWidth: 48, cellHeight: 48, width: 16, height: 16 });
    const model = buildMapRenderModel(document, createView({ width: 416, height: 416, zoom: 2 }));
    const verticals = model.gridLines.filter((line) => line.vertical);

    expect(model.renderScale).toBe(2);
    expect(verticals).toHaveLength(8);
  });

  // 布局与渲染模型同源：屏幕格像素 = 模型格基准 × 模型倍率
  it('布局的格像素等于模型格基准乘倍率', () => {
    const layout = resolveMapLayout({ zoom: 1.5 });
    const document = createMapDocument();
    const model = buildMapRenderModel(
      document,
      createView({ width: layout.canvasWidth, height: layout.canvasHeight, zoom: 1.5 }),
    );

    expect(layout.canvasWidth).toBe(624);
    expect(model.renderScale).toBe(layout.renderScale);
    expect(model.cellWidth * model.renderScale).toBe(layout.cellWidth);
  });
});

describe('buildMapRenderModel 动画帧', () => {
  // 逐行扫描的动画只给帧轴 / 步长 / 帧数 / 行格数，不把 255 个矩形塞进模型
  it('动画格带帧轴、帧步长、帧数与行格数', () => {
    const group = createTileGroup({
      id: 'group-animate',
      frames: 255,
      read: MapTextureReadType.ScanAnimate,
      columns: 3,
    });
    const document = createMapDocument({ tileGroups: [group] });
    const model = buildMapRenderModel(document, createView());
    const cell = model.cells.find((item) => item.key === 'layer-base:0:0')!;

    expect(cell.frameAxis).toBe(MapFrameAxis.Scan);
    expect(cell.frameStride).toBe(32);
    expect(cell.frameCount).toBe(255);
    expect(cell.frameColumns).toBe(3);
    expect(cell.defaultFrame).toBe(-1);
    expect(model.cells).toHaveLength(24);
  });

  // 静态格不带帧轴与帧数，画布按「没有动画」处理
  it('静态格不带帧轴', () => {
    const document = createMapDocument();
    const model = buildMapRenderModel(document, createView());
    const cell = model.cells.find((item) => item.key === 'layer-base:0:0')!;

    expect(cell.frameAxis).toBeUndefined();
    expect(cell.frameStride).toBeUndefined();
    expect(cell.frameCount).toBeUndefined();
    expect(cell.defaultFrame).toBe(-1);
  });

  // 条目声明的固定帧原样带进模型
  it('固定帧来自图块条目', () => {
    const entry: IMapTileEntry = {
      number: 7,
      column: 0,
      row: 0,
      name: '固定帧图块',
      pass: createOpenPass(),
      defaultFrame: 3,
    };
    const document = createSingleCellDocument(7, [
      createTileGroup({ tiles: [entry], frames: 4, read: MapTextureReadType.RowAnimate, columns: 4 }),
    ]);
    const model = buildMapRenderModel(document, createView({ width: 32, height: 32 }));

    expect(model.cells).toHaveLength(1);
    expect(model.cells[0].defaultFrame).toBe(3);
    expect(model.cells[0].frameCount).toBe(4);
  });
});

describe('buildMapRenderModel 自动拼接', () => {
  // 自动元件格带四块象限矩形，裁切取左上那一块
  it('自动元件格带四块象限矩形', () => {
    const group = createSizedTileGroup({
      id: 'group-autotile',
      autotile: { type: MapAutotileType.Small2x3, connections: [] },
    });
    const document = createMapDocument({ tileGroups: [group] });
    const model = buildMapRenderModel(document, createView());
    const cell = model.cells.find((item) => item.key === 'layer-base:0:0')!;
    const quarters = cell.autotileQuarters!;

    expect(quarters.lt.width).toBe(16);
    expect(quarters.lt.height).toBe(16);
    expect(quarters.rt.width).toBe(16);
    expect(quarters.rb.height).toBe(16);
    expect(quarters.lb.width).toBe(16);
    expect(cell.crop).toEqual(quarters.lt);
  });

  // 连接数由同层邻居算出：右邻居相同值时左上块落在另一位置
  it('连接数随邻居变化', () => {
    const group = createSizedTileGroup({
      id: 'group-autotile',
      autotile: { type: MapAutotileType.Small2x3, connections: [] },
    });
    const connectedLayer: IMapLayer = {
      id: 'layer-base',
      name: '基础层',
      zIndex: 0,
      isEventLayer: false,
      cells: [[1, 1]],
    };
    const isolatedLayer: IMapLayer = {
      id: 'layer-base',
      name: '基础层',
      zIndex: 0,
      isEventLayer: false,
      cells: [[1, 0]],
    };
    const connected = buildMapRenderModel(
      createMapDocument({ width: 2, height: 1, layers: [connectedLayer], tileGroups: [group] }),
      createView({ width: 64, height: 32 }),
    );
    const isolated = buildMapRenderModel(
      createMapDocument({ width: 2, height: 1, layers: [isolatedLayer], tileGroups: [group] }),
      createView({ width: 64, height: 32 }),
    );

    expect(connected.cells[0].autotileQuarters).not.toEqual(isolated.cells[0].autotileQuarters);
  });
});

describe('buildMapRenderModel Tileset', () => {
  // Tileset 声明的读取方式是 Grid：编号 1005 的 (1,1) 格裁切就是它自己那一格，不是整张图集
  it('Grid 规则下取图集里自己那一格', () => {
    const entry: IMapTileEntry = {
      number: 1005,
      column: 1,
      row: 1,
      name: 'Tileset 格',
      pass: createOpenPass(),
    };
    const group = createSizedTileGroup({
      id: 'group-tileset',
      category: MapTileCategory.Tileset,
      read: MapTextureReadType.Grid,
      cellWidth: 32,
      cellHeight: 32,
      tileset: { cellWidth: 32, cellHeight: 32, columns: 8, rows: 8 },
      tiles: [entry],
    });
    const document = createSingleCellDocument(1005, [group]);
    const model = buildMapRenderModel(document, createView({ width: 32, height: 32 }));

    expect(model.cells).toHaveLength(1);
    expect(model.cells[0].crop).toEqual({ x: 32, y: 32, width: 32, height: 32 });
    expect(model.cells[0].autotileQuarters).toBeUndefined();
  });
});
