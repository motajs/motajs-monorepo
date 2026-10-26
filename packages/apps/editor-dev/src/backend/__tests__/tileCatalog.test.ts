import { MapAutotileType, MapTextureReadType, MapTileCategory, resolveGroupAtlasRect } from '@motajs/editor-impl/map';
import { describe, expect, it } from 'vitest';
import { buildTileCatalog } from '../tileCatalog';

// 宿主图块目录解析器的单元测试：四种条目形状、六类映射、帧数换算、Tileset 逐格枚举与畸形输入。
// 全部用内联的引擎格式文本 + 伪造的图片尺寸，不读盘、不解码图片。

/** 一份覆盖四种条目形状与常见分类的图块表 */
const TILE_TABLE_TEXT = `[
  { "type": 2, "identifier": 1, "name": "草地" },
  { "type": 2, "identifier": 2, "name": "墙", "pass": { "out": { "up": false }, "in": { "up": false }, "onlyEventLayer": true } },
  { "type": 3, "identifier": 10, "name": "水面" },
  { "type": 5, "identifier": 5, "name": "史莱姆" },
  { "type": 6, "identifier": 7, "name": "村民" },
  { "type": 4, "identifier": 8, "name": "宝箱" },
  { "type": 7, "identifier": 90, "name": "石墙" },
  { "type": 7, "identifier": 91, "name": "木墙" },
  { "type": 8, "identifier": 100000 },
  { "type": 8, "identifier": 100001 },
  { "type": 8, "identifier": 100002 },
  { "type": 8, "identifier": 100003 },
  { "type": 8, "identifier": 100004 },
  { "type": 8, "identifier": 100005 },
  { "type": 8, "identifier": 100006 },
  { "type": 8, "identifier": 100007 },
  { "type": 8, "identifier": 100008 },
  { "type": 8, "identifier": 100009 },
  { "type": 8, "identifier": 100010 },
  { "type": 8, "identifier": 100011 },
  { "type": 8, "identifier": 110000 },
  { "type": 8, "identifier": 110001 },
  { "type": 8, "identifier": 110002 },
  { "type": 8, "identifier": 110003 }
]`;

/** 四方向都可通行的期望值 */
const OPEN = { up: true, right: true, down: true, left: true };

describe('宿主图块目录解析器', () => {
  // grid 条目的编号来自 map 数组，行列按整个数组的位置铺格
  it('grid 条目按 map 数组铺格', () => {
    const groups = buildTileCatalog({
      textureText: `[{ "type": "grid", "source": "a.png", "cellWidth": 32, "cellHeight": 32, "map": [1, 2] }]`,
      tileText: TILE_TABLE_TEXT,
      dimensions: { 'a.png': { width: 64, height: 32 } },
      connections: {},
    });

    expect(groups).toHaveLength(1);
    expect(groups[0].category).toBe(MapTileCategory.Terrain);
    expect(groups[0].read).toBe(MapTextureReadType.Grid);
    expect(groups[0].frames).toBe(1);
    expect(groups[0].columns).toBe(2);
    expect(groups[0].tiles.map((tile) => [tile.column, tile.row])).toEqual([
      [0, 0],
      [1, 0],
    ]);
  });

  // rowAnimate 的编号来自 map 数组，帧数由图片宽 ÷ 单格宽得出
  it('rowAnimate 用 map 数组的编号与图片宽度算帧数', () => {
    const groups = buildTileCatalog({
      textureText: `[{ "type": "rowAnimate", "source": "anim.png", "cellWidth": 32, "cellHeight": 32, "map": [10] }]`,
      tileText: TILE_TABLE_TEXT,
      dimensions: { 'anim.png': { width: 128, height: 32 } },
      connections: {},
    });

    expect(groups).toHaveLength(1);
    expect(groups[0].read).toBe(MapTextureReadType.RowAnimate);
    expect(groups[0].frames).toBe(4);
    expect(groups[0].tiles).toHaveLength(1);
    expect(groups[0].tiles[0].number).toBe(10);
    expect([groups[0].tiles[0].column, groups[0].tiles[0].row]).toEqual([0, 0]);
  });

  // 帧数超过上限时夹到 255
  it('帧数夹在 1..255', () => {
    const groups = buildTileCatalog({
      textureText: `[{ "type": "rowAnimate", "source": "long.png", "cellWidth": 32, "cellHeight": 32, "map": [10] }]`,
      tileText: TILE_TABLE_TEXT,
      dimensions: { 'long.png': { width: 8192, height: 32 } },
      connections: {},
    });

    expect(groups[0].frames).toBe(255);
  });

  // 自动元件只有 1 个图块、read 为 Grid、帧数为图片宽 ÷ 整块宽，连接来自输入表
  it('autotile 条目生成单格素材组且 read 为 Grid', () => {
    const groups = buildTileCatalog({
      textureText: `[{ "type": "autotile", "source": "auto.png", "cellWidth": 32, "cellHeight": 32, "identifier": 90, "autotileType": "Big3x4" }]`,
      tileText: TILE_TABLE_TEXT,
      dimensions: { 'auto.png': { width: 192, height: 128 } },
      connections: { 90: [1, 2] },
    });

    expect(groups).toHaveLength(1);
    expect(groups[0].category).toBe(MapTileCategory.Autotile);
    expect(groups[0].read).toBe(MapTextureReadType.Grid);
    expect(groups[0].frames).toBe(2);
    expect(groups[0].tiles).toHaveLength(1);
    expect([groups[0].tiles[0].column, groups[0].tiles[0].row]).toEqual([0, 0]);
    expect(groups[0].autotile).toEqual({ type: MapAutotileType.Big3x4, connections: [1, 2] });
  });

  // 2×3 自动元件的帧数按 2 格宽算，形状落在规则里
  it('autotile 2×3 的帧数与形状正确', () => {
    const groups = buildTileCatalog({
      textureText: `[{ "type": "autotile", "source": "auto-small.png", "cellWidth": 32, "cellHeight": 32, "identifier": 91, "autotileType": "Small2x3" }]`,
      tileText: TILE_TABLE_TEXT,
      dimensions: { 'auto-small.png': { width: 128, height: 96 } },
      connections: {},
    });

    expect(groups[0].frames).toBe(2);
    expect(groups[0].autotile?.type).toBe(MapAutotileType.Small2x3);
    expect(groups[0].autotile?.connections).toEqual([]);
  });

  // Tileset 逐格枚举编号、read 必须是 Grid，且第 0 帧矩形就是该格自己
  it('tileset 逐格编号且 read 为 Grid', () => {
    const groups = buildTileCatalog({
      textureText: `[{ "type": "tileset", "source": "set.png", "cellWidth": 32, "cellHeight": 32 }]`,
      tileText: TILE_TABLE_TEXT,
      dimensions: { 'set.png': { width: 128, height: 64 } },
      connections: {},
      tilesetReserve: 100000,
      tilesetUnit: 10000,
    });

    expect(groups).toHaveLength(1);
    expect(groups[0].category).toBe(MapTileCategory.Tileset);
    expect(groups[0].read).toBe(MapTextureReadType.Grid);
    expect(groups[0].tiles).toHaveLength(8);
    expect(groups[0].tiles.map((tile) => tile.number)).toEqual([
      100000, 100001, 100002, 100003, 100004, 100005, 100006, 100007,
    ]);
    expect(groups[0].tiles.map((tile) => [tile.column, tile.row])).toEqual([
      [0, 0],
      [1, 0],
      [2, 0],
      [3, 0],
      [0, 1],
      [1, 1],
      [2, 1],
      [3, 1],
    ]);
    expect(groups[0].tileset).toEqual({ cellWidth: 32, cellHeight: 32, columns: 4, rows: 2 });

    // 编号 100005 落在 (1,1)：条目只带图集位置，帧矩形由读取规则现算
    const entry = groups[0].tiles[5];

    expect(entry.column).toBe(1);
    expect(entry.row).toBe(1);
  });

  // 两张 Tileset 各占一段：第二张的起点 = 100000 + 1 × 10000
  it('两张 Tileset 占用连续的编号段', () => {
    const groups = buildTileCatalog({
      textureText: `[
        { "type": "tileset", "source": "set-a.png", "cellWidth": 32, "cellHeight": 32 },
        { "type": "tileset", "source": "set-b.png", "cellWidth": 48, "cellHeight": 48 }
      ]`,
      tileText: TILE_TABLE_TEXT,
      dimensions: {
        'set-a.png': { width: 128, height: 64 },
        'set-b.png': { width: 96, height: 96 },
      },
      connections: {},
      tilesetReserve: 100000,
      tilesetUnit: 10000,
    });

    expect(groups.map((group) => group.imagePath)).toEqual(['set-a.png', 'set-b.png']);
    expect(groups.flatMap((group) => group.tiles.map((tile) => tile.number)).slice(8)).toEqual([
      110000, 110001, 110002, 110003,
    ]);
  });

  // 一张图超过一段容量时，下一张图的起点要跳过整段：8 格 / 每段 4 格 → 占 2 段
  it('一张图超过一段容量时下一张跳过整段', () => {
    const groups = buildTileCatalog({
      textureText: `[
        { "type": "tileset", "source": "wide.png", "cellWidth": 32, "cellHeight": 32 },
        { "type": "tileset", "source": "small.png", "cellWidth": 48, "cellHeight": 48 }
      ]`,
      tileText: TILE_TABLE_TEXT,
      dimensions: {
        'wide.png': { width: 128, height: 64 },
        'small.png': { width: 96, height: 96 },
      },
      connections: {},
      tilesetReserve: 100000,
      tilesetUnit: 4,
    });

    expect(groups.flatMap((group) => group.tiles.map((tile) => tile.number))).toEqual([
      100000, 100001, 100002, 100003, 100004, 100005, 100006, 100007, 100008, 100009, 100010, 100011,
    ]);
  });

  // 宿主不传 reserve / unit 时用引擎默认值 100000 / 10000
  it('缺省编号段参数时使用引擎默认值', () => {
    const groups = buildTileCatalog({
      textureText: `[{ "type": "tileset", "source": "set.png", "cellWidth": 32, "cellHeight": 32 }]`,
      tileText: TILE_TABLE_TEXT,
      dimensions: { 'set.png': { width: 128, height: 64 } },
      connections: {},
    });

    expect(groups[0].tiles[0].number).toBe(100000);
    expect(groups[0].tiles.at(-1)?.number).toBe(100007);
  });

  // 同一个 grid 数组里混有多个分类时各生成一个组，图块保留它在整个数组里的行列
  it('同一个 grid 数组跨分类时按类型分组并保留行列', () => {
    const groups = buildTileCatalog({
      textureText: `[{ "type": "grid", "source": "mix.png", "cellWidth": 32, "cellHeight": 32, "map": [1, 5, 7] }]`,
      tileText: TILE_TABLE_TEXT,
      dimensions: { 'mix.png': { width: 128, height: 32 } },
      connections: {},
    });

    expect(groups).toHaveLength(3);
    expect(groups.map((group) => group.category)).toEqual([
      MapTileCategory.Terrain,
      MapTileCategory.Enemy,
      MapTileCategory.Npc,
    ]);

    for (const group of groups) expect(group.read).toBe(MapTextureReadType.Grid);

    expect(groups.map((group) => [group.tiles[0].column, group.tiles[0].row])).toEqual([
      [0, 0],
      [1, 0],
      [2, 0],
    ]);
  });

  // 分类映射覆盖 2 / 3 / 4 / 5 / 6 / 7 / 8，未知类型跳过
  it('分类映射覆盖六类且未知类型跳过', () => {
    const groups = buildTileCatalog({
      textureText: `[{ "type": "grid", "source": "cat.png", "cellWidth": 32, "cellHeight": 32, "map": [1, 2, 3, 4, 5, 6, 7, 8] }]`,
      tileText: `[
        { "type": 2, "identifier": 1 },
        { "type": 3, "identifier": 2 },
        { "type": 4, "identifier": 3 },
        { "type": 5, "identifier": 4 },
        { "type": 6, "identifier": 5 },
        { "type": 7, "identifier": 6 },
        { "type": 8, "identifier": 7 },
        { "type": 9, "identifier": 8 }
      ]`,
      dimensions: { 'cat.png': { width: 256, height: 32 } },
      connections: {},
    });

    expect(groups.map((group) => group.category)).toEqual([
      MapTileCategory.Terrain,
      MapTileCategory.Item,
      MapTileCategory.Enemy,
      MapTileCategory.Npc,
      MapTileCategory.Autotile,
      MapTileCategory.Tileset,
    ]);
    expect(groups.flatMap((group) => group.tiles.map((tile) => tile.number))).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  // 图片尺寸缺失时整条跳过，不猜尺寸
  it('图片尺寸缺失时跳过该条目', () => {
    const groups = buildTileCatalog({
      textureText: `[{ "type": "grid", "source": "missing.png", "cellWidth": 32, "cellHeight": 32, "map": [1] }]`,
      tileText: TILE_TABLE_TEXT,
      dimensions: {},
      connections: {},
    });

    expect(groups).toEqual([]);
  });

  // 编号在图块表里找不到时跳过该编号，其余编号照常
  it('图块表里没有的编号跳过', () => {
    const groups = buildTileCatalog({
      textureText: `[{ "type": "grid", "source": "a.png", "cellWidth": 32, "cellHeight": 32, "map": [1, 999] }]`,
      tileText: TILE_TABLE_TEXT,
      dimensions: { 'a.png': { width: 64, height: 32 } },
      connections: {},
    });

    expect(groups).toHaveLength(1);
    expect(groups[0].tiles.map((tile) => tile.number)).toEqual([1]);
  });

  // 通行属性原样保留；缺失时按四方向可通行
  it('通行属性来自图块表，缺失按全通处理', () => {
    const groups = buildTileCatalog({
      textureText: `[{ "type": "grid", "source": "a.png", "cellWidth": 32, "cellHeight": 32, "map": [1, 2] }]`,
      tileText: TILE_TABLE_TEXT,
      dimensions: { 'a.png': { width: 64, height: 32 } },
      connections: {},
    });

    expect(groups[0].tiles[0].pass).toEqual({ out: OPEN, in: OPEN, onlyEventLayer: false });
    expect(groups[0].tiles[1].pass.out.up).toBe(false);
    expect(groups[0].tiles[1].pass.out.right).toBe(true);
    expect(groups[0].tiles[1].pass.in.up).toBe(false);
    expect(groups[0].tiles[1].pass.onlyEventLayer).toBe(true);
  });

  // 根可以是带 textures / tiles 的对象；畸形文本不抛错
  it('根对象与畸形输入都能安全处理', () => {
    const groups = buildTileCatalog({
      textureText: `{ "textures": [{ "type": "grid", "source": "a.png", "cellWidth": 32, "cellHeight": 32, "map": [1] }] }`,
      tileText: `{ "tiles": [{ "type": 2, "identifier": 1 }] }`,
      dimensions: { 'a.png': { width: 32, height: 32 } },
      connections: {},
    });

    expect(groups).toHaveLength(1);

    const broken = buildTileCatalog({
      textureText: 'not json',
      tileText: 'also not json',
      dimensions: { 'a.png': { width: 32, height: 32 } },
      connections: {},
    });

    expect(broken).toEqual([]);
  });
});

describe('宿主图块目录的真实行数', () => {
  // grid：图片两行高时，即使只收录第 0 行，真实行数仍是 2（不能按目录最大行号推算）
  it('grid 按图片高交出真实行数', () => {
    const groups = buildTileCatalog({
      textureText: `[{ "type": "grid", "source": "a.png", "cellWidth": 32, "cellHeight": 32, "map": [1, 2] }]`,
      tileText: TILE_TABLE_TEXT,
      dimensions: { 'a.png': { width: 64, height: 64 } },
      connections: {},
    });

    expect(groups[0].rows).toBe(2);
  });

  // U-25 回归：地形图集 128×64 被分类分桶后地形组只含第 0 行，图集矩形必须仍是整张 128×64
  it('只收录第 0 行的 128×64 地形组图集矩形仍是 128×64', () => {
    const groups = buildTileCatalog({
      textureText: `[{ "type": "grid", "source": "terrain.png", "cellWidth": 32, "cellHeight": 32, "map": [1, 2, 3, 4] }]`,
      tileText: `[
        { "type": 2, "identifier": 1 },
        { "type": 2, "identifier": 2 },
        { "type": 2, "identifier": 3 },
        { "type": 2, "identifier": 4 }
      ]`,
      dimensions: { 'terrain.png': { width: 128, height: 64 } },
      connections: {},
    });

    expect(groups).toHaveLength(1);
    expect(groups[0].tiles.map((tile) => [tile.column, tile.row])).toEqual([
      [0, 0],
      [1, 0],
      [2, 0],
      [3, 0],
    ]);
    expect(groups[0].rows).toBe(2);
    expect(resolveGroupAtlasRect(groups[0])).toEqual({ x: 0, y: 0, width: 128, height: 64 });
  });

  // rowAnimate：128×32 只有一行，真实行数是 1
  it('rowAnimate 图片只有一行时 rows 为 1', () => {
    const groups = buildTileCatalog({
      textureText: `[{ "type": "rowAnimate", "source": "anim.png", "cellWidth": 32, "cellHeight": 32, "map": [10] }]`,
      tileText: TILE_TABLE_TEXT,
      dimensions: { 'anim.png': { width: 128, height: 32 } },
      connections: {},
    });

    expect(groups[0].rows).toBe(1);
  });

  // autotile：192×128 的 Big3x4 图片是四行高
  it('autotile 按图片高交出四行', () => {
    const groups = buildTileCatalog({
      textureText: `[{ "type": "autotile", "source": "auto.png", "cellWidth": 32, "cellHeight": 32, "identifier": 90, "autotileType": "Big3x4" }]`,
      tileText: TILE_TABLE_TEXT,
      dimensions: { 'auto.png': { width: 192, height: 128 } },
      connections: {},
    });

    expect(groups[0].rows).toBe(4);
  });

  // tileset：128×64 的图集每一组都是两行（逐格枚举不改变真实行数）
  it('tileset 每组都是两行', () => {
    const groups = buildTileCatalog({
      textureText: `[{ "type": "tileset", "source": "set.png", "cellWidth": 32, "cellHeight": 32 }]`,
      tileText: TILE_TABLE_TEXT,
      dimensions: { 'set.png': { width: 128, height: 64 } },
      connections: {},
      tilesetReserve: 100000,
      tilesetUnit: 10000,
    });

    expect(groups.length).toBeGreaterThan(0);

    for (const group of groups) expect(group.rows).toBe(2);
  });

  // 图片高小于素材格高时夹到 1 行，不出现 0 或负数
  it('图片高小于素材格高时 rows 为 1', () => {
    const groups = buildTileCatalog({
      textureText: `[{ "type": "autotile", "source": "short.png", "cellWidth": 32, "cellHeight": 32, "identifier": 90, "autotileType": "Big3x4" }]`,
      tileText: TILE_TABLE_TEXT,
      dimensions: { 'short.png': { width: 64, height: 16 } },
      connections: {},
    });

    expect(groups).toHaveLength(1);
    expect(groups[0].rows).toBe(1);
  });
});
