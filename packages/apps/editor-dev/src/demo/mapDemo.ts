import { EditorCore, IEditorFileSystem } from '@motajs/editor-core';
import { readImageDimensions } from '@motajs/editor-impl/asset';
import { createMapPanelType, IMapEditorCapabilities, IMapTileGroup } from '@motajs/editor-impl/map';
import { ITableSchemaNode, serializeTableText } from '@motajs/editor-impl/shared';
import { createMapCapabilities, IMapFileRecord, mapFilePath, MAP_LIST_PATH } from '../backend/mapFiles';
import { buildTileCatalog } from '../backend/tileCatalog';
import { IMapDemoOverrides, IMemoryBackend } from '../backend/types';

// 开发宿主的地图演示数据：两张尺幅不同的地图、七张真实图集、一份两字段的属性 schema。
// 图块目录不是手写数组：宿主把引擎格式的两份文本（纹理清单 + 图块表）交给 `buildTileCatalog` 现场解析，
// 六类素材、动画、两种自动元件、Tileset、大 / 小素材都从同一份素材数据里长出来；能力包只拿到中立目录。

/** 地形图集相对项目根的路径：4×2、每格 32×32 的高对比色块 */
const DEMO_TERRAIN_IMAGE_PATH = 'content/map/tiles-terrain.png';

/** 横向动画图集的路径：4×1、每格 32×32 的四帧渐变色 */
const DEMO_ANIMATE_IMAGE_PATH = 'content/map/tiles-animate.png';

/** 3×4 自动元件图集的路径：192×128、两帧并排（每帧 96×128） */
const DEMO_AUTOTILE_BIG_IMAGE_PATH = 'content/map/tiles-autotile-big.png';

/** 2×3 自动元件图集的路径：128×96、两帧并排（每帧 64×96） */
const DEMO_AUTOTILE_SMALL_IMAGE_PATH = 'content/map/tiles-autotile-small.png';

/** Tileset 图集的路径：4×2、每格 32×32 */
const DEMO_TILESET_IMAGE_PATH = 'content/map/tiles-tileset.png';

/** 大素材图集的路径：192×64、两块 96×64 的素材，比 48 的地图格更大 */
const DEMO_LARGE_IMAGE_PATH = 'content/map/tiles-large.png';

/** 小素材图集的路径：64×32、八块 16×16 的素材，比 48 的地图格更小 */
const DEMO_SMALL_IMAGE_PATH = 'content/map/tiles-small.png';

/** 演示工程里纹理清单的路径：放在地图演示自己的目录下，不覆盖素材面板的清单 */
const DEMO_TEXTURE_LIST_PATH = 'content/map/texture/.list.jsonc';

/** 演示工程里图块表的路径 */
const DEMO_TILE_TABLE_PATH = 'content/map/tiles.jsonc';

/** PNG 每个像素的字节数：8 位 RGBA */
const PNG_BYTES_PER_PIXEL = 4;

/** PNG 位深：8 位 */
const PNG_BIT_DEPTH = 8;

/** PNG 颜色类型：真彩色带 alpha */
const PNG_COLOR_TYPE_RGBA = 6;

/** PNG 扫描行的滤波类型：不滤波 */
const PNG_FILTER_NONE = 0;

/** 完全不透明的 alpha 值 */
const PNG_ALPHA_OPAQUE = 255;

/** 单个 stored deflate 块能容纳的最大字节数 */
const DEFLATE_STORED_MAX = 65535;

/** zlib 头的压缩方法 / 标志字节：32K 窗口、无预置字典、最快压缩级 */
const ZLIB_HEADER: readonly number[] = Object.freeze([0x78, 0x01]);

/** Adler-32 的模数 */
const ADLER_MODULUS = 65521;

/** CRC-32 的多项式（反射形式） */
const CRC_POLYNOMIAL = 0xedb88320;

/** CRC-32 的初值 / 终值掩码 */
const CRC_MASK = 0xffffffff;

/** 一个字节的位宽 */
const BITS_PER_BYTE = 8;

/** 颜色通道的位移量：红 / 绿 / 蓝 */
const COLOR_SHIFT_RED = 16;

/** 绿色通道的位移量 */
const COLOR_SHIFT_GREEN = 8;

/** 蓝色通道的位移量 */
const COLOR_SHIFT_BLUE = 0;

/** 调色板每个通道的基础偏移，保证颜色足够亮 */
const PALETTE_CHANNEL_BASE = 48;

/** 调色板每个通道的步进，令相邻序号的颜色明显不同 */
const PALETTE_CHANNEL_SPAN = 160;

/** 两种棋盘色之间的通道差，令同一格里也有对比 */
const PALETTE_VARIANT_SPAN = 60;

/** 棋盘格的边长（像素） */
const CHECKER_SIZE = 8;

/** 演示地图的默认格子边长（像素） */
const DEMO_MAP_CELL_SIZE = 32;

/**
 * 计算一段字节的 CRC-32 校验值（PNG 每个块尾部都要带）
 * @param bytes 参与校验的字节（块类型 + 块数据）
 * @returns 32 位无符号校验值
 */
function crc32(bytes: Uint8Array): number {
  let crc = CRC_MASK;

  for (let index = 0; index < bytes.length; index += 1) {
    crc ^= bytes[index];

    for (let bit = 0; bit < BITS_PER_BYTE; bit += 1) {
      const mask = -(crc & 1) & CRC_MASK;
      crc = (crc >>> 1) ^ (CRC_POLYNOMIAL & mask);
    }
  }

  return (crc ^ CRC_MASK) >>> 0;
}

/**
 * 计算一段字节的 Adler-32 校验值（zlib 流尾部要带）
 * @param bytes 参与校验的字节（未压缩扫描行数据）
 * @returns 32 位无符号校验值
 */
function adler32(bytes: Uint8Array): number {
  let low = 1;
  let high = 0;

  for (let index = 0; index < bytes.length; index += 1) {
    low = (low + bytes[index]) % ADLER_MODULUS;
    high = (high + low) % ADLER_MODULUS;
  }

  return ((high << 16) | low) >>> 0;
}

/**
 * 拼装一个 PNG 块：长度 + 类型 + 数据 + CRC
 * @param type 四个 ASCII 字符的块类型
 * @param data 块数据
 * @returns 完整的块字节
 */
function createPngChunk(type: string, data: Uint8Array): Uint8Array {
  const chunk = new Uint8Array(12 + data.length);
  const view = new DataView(chunk.buffer);

  view.setUint32(0, data.length, false);

  for (let index = 0; index < type.length; index += 1) chunk[4 + index] = type.charCodeAt(index);

  chunk.set(data, 8);
  view.setUint32(8 + data.length, crc32(chunk.subarray(4, 8 + data.length)), false);

  return chunk;
}

/**
 * 把未压缩数据包成合法的 zlib 流：头 + 若干 stored deflate 块 + Adler-32
 * @param data 未压缩数据（PNG 扫描行）
 * @returns 合法的 zlib 流字节
 */
function createZlibStream(data: Uint8Array): Uint8Array {
  const blockCount = Math.max(1, Math.ceil(data.length / DEFLATE_STORED_MAX));
  const stream = new Uint8Array(2 + data.length + blockCount * 5 + 4);

  stream[0] = ZLIB_HEADER[0];
  stream[1] = ZLIB_HEADER[1];

  let offset = 2;

  for (let index = 0; index < blockCount; index += 1) {
    const start = index * DEFLATE_STORED_MAX;
    const length = Math.min(DEFLATE_STORED_MAX, data.length - start);
    const inverse = ~length & 0xffff;

    stream[offset] = index === blockCount - 1 ? 0x01 : 0x00;
    stream[offset + 1] = length & 0xff;
    stream[offset + 2] = (length >>> 8) & 0xff;
    stream[offset + 3] = inverse & 0xff;
    stream[offset + 4] = (inverse >>> 8) & 0xff;
    stream.set(data.subarray(start, start + length), offset + 5);
    offset += 5 + length;
  }

  const checksum = adler32(data);

  stream[offset] = (checksum >>> 24) & 0xff;
  stream[offset + 1] = (checksum >>> 16) & 0xff;
  stream[offset + 2] = (checksum >>> 8) & 0xff;
  stream[offset + 3] = checksum & 0xff;

  return stream;
}

/**
 * 生成 PNG 的 IHDR 块数据：宽、高、位深、颜色类型与三个保留字节
 * @param width 图片宽度（像素）
 * @param height 图片高度（像素）
 * @returns 13 字节的 IHDR 数据
 */
function createIhdrData(width: number, height: number): Uint8Array {
  const header = new Uint8Array(13);
  const headerView = new DataView(header.buffer);

  headerView.setUint32(0, width, false);
  headerView.setUint32(4, height, false);
  header[8] = PNG_BIT_DEPTH;
  header[9] = PNG_COLOR_TYPE_RGBA;
  header[10] = 0;
  header[11] = 0;
  header[12] = 0;

  return header;
}

/**
 * 由调色板序号与棋盘色变体算出一个 0xRRGGBB 颜色
 * @param palette 调色板序号
 * @param variant 变体：0 为底色、1 为棋盘亮色
 * @returns 打包成 24 位的 RGB 值
 */
function paletteColor(palette: number, variant: number): number {
  const red = PALETTE_CHANNEL_BASE + ((palette * 53 + variant * PALETTE_VARIANT_SPAN) % PALETTE_CHANNEL_SPAN);
  const green = PALETTE_CHANNEL_BASE + ((palette * 97 + variant * PALETTE_VARIANT_SPAN + 40) % PALETTE_CHANNEL_SPAN);
  const blue = PALETTE_CHANNEL_BASE + ((palette * 29 + variant * PALETTE_VARIANT_SPAN + 80) % PALETTE_CHANNEL_SPAN);

  return (red << COLOR_SHIFT_RED) | (green << COLOR_SHIFT_GREEN) | (blue << COLOR_SHIFT_BLUE);
}

/**
 * 取一个像素属于棋盘格的哪一半
 * @param x 像素横坐标
 * @param y 像素纵坐标
 * @returns 0 或 1
 */
function checkerVariant(x: number, y: number): number {
  return (Math.floor(x / CHECKER_SIZE) + Math.floor(y / CHECKER_SIZE)) % 2;
}

/**
 * 生成 PNG 的扫描行缓冲：8 位 RGBA、每行首字节滤波 0、逐像素取 `colorAt`、完全不透明
 * @param width 图片宽度（像素）
 * @param height 图片高度（像素）
 * @param colorAt 按像素坐标求 0xRRGGBB 颜色的函数
 * @returns 未压缩的扫描行字节
 */
function createScanlines(width: number, height: number, colorAt: (x: number, y: number) => number): Uint8Array {
  const rowLength = width * PNG_BYTES_PER_PIXEL + 1;
  const pixels = new Uint8Array(rowLength * height);
  let offset = 0;

  for (let y = 0; y < height; y += 1) {
    pixels[offset] = PNG_FILTER_NONE;
    offset += 1;

    for (let x = 0; x < width; x += 1) {
      const color = colorAt(x, y);

      pixels[offset] = (color >> COLOR_SHIFT_RED) & 0xff;
      pixels[offset + 1] = (color >> COLOR_SHIFT_GREEN) & 0xff;
      pixels[offset + 2] = (color >> COLOR_SHIFT_BLUE) & 0xff;
      pixels[offset + 3] = PNG_ALPHA_OPAQUE;
      offset += PNG_BYTES_PER_PIXEL;
    }
  }

  return pixels;
}

/**
 * 用 8 位 RGBA 现场编码一张可被浏览器解码的 PNG
 * @param width 图片宽度（像素）
 * @param height 图片高度（像素）
 * @param colorAt 按像素坐标求 0xRRGGBB 颜色的函数
 * @returns 完整的 PNG 字节
 */
function encodeDemoPng(width: number, height: number, colorAt: (x: number, y: number) => number): Uint8Array {
  const signature = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const chunks = [
    createPngChunk('IHDR', createIhdrData(width, height)),
    createPngChunk('IDAT', createZlibStream(createScanlines(width, height, colorAt))),
    createPngChunk('IEND', new Uint8Array(0)),
  ];
  const totalLength = signature.length + chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const png = new Uint8Array(totalLength);
  let pngOffset = signature.length;

  png.set(signature, 0);

  for (const chunk of chunks) {
    png.set(chunk, pngOffset);
    pngOffset += chunk.length;
  }

  return png;
}

/**
 * 编码地形图集：128×64、4×2、每格 32×32，八个高对比色块
 * @returns 完整的 PNG 字节
 */
export function encodeDemoTileAtlas(): Uint8Array {
  return encodeDemoPng(128, 64, (x, y) => {
    const column = Math.floor(x / 32);
    const row = Math.floor(y / 32);

    return paletteColor(row * 4 + column, checkerVariant(x, y));
  });
}

/**
 * 编码横向动画图集：128×32、4×1、每格 32×32，四帧渐变色
 * @returns 完整的 PNG 字节
 */
export function encodeDemoAnimateAtlas(): Uint8Array {
  return encodeDemoPng(128, 32, (x, y) => {
    const frame = Math.floor(x / 32);

    return paletteColor(frame * 3, checkerVariant(x, y));
  });
}

/**
 * 编码 3×4 自动元件图集：192×128、两帧并排（每帧 96×128、每格 32×32）
 * @returns 完整的 PNG 字节
 */
export function encodeDemoAutotileBigAtlas(): Uint8Array {
  return encodeDemoPng(192, 128, (x, y) => {
    const frame = Math.floor(x / 96);
    const column = Math.floor((x % 96) / 32);
    const row = Math.floor(y / 32);

    return paletteColor(frame * 12 + row * 3 + column, checkerVariant(x, y));
  });
}

/**
 * 编码 2×3 自动元件图集：128×96、两帧并排（每帧 64×96、每格 32×32）
 * @returns 完整的 PNG 字节
 */
export function encodeDemoAutotileSmallAtlas(): Uint8Array {
  return encodeDemoPng(128, 96, (x, y) => {
    const frame = Math.floor(x / 64);
    const column = Math.floor((x % 64) / 32);
    const row = Math.floor(y / 32);

    return paletteColor(frame * 12 + row * 2 + column, checkerVariant(x, y));
  });
}

/**
 * 编码 Tileset 图集：128×64、4×2、每格 32×32
 * @returns 完整的 PNG 字节
 */
export function encodeDemoTilesetAtlas(): Uint8Array {
  return encodeDemoPng(128, 64, (x, y) => {
    const column = Math.floor(x / 32);
    const row = Math.floor(y / 32);

    return paletteColor(10 + row * 4 + column, checkerVariant(x, y));
  });
}

/**
 * 编码大素材图集：192×64、2×1、每格 96×64，两块都比 48 的地图格更大
 * @returns 完整的 PNG 字节
 */
export function encodeDemoLargeTileAtlas(): Uint8Array {
  return encodeDemoPng(192, 64, (x, y) => {
    const column = Math.floor(x / 96);

    return paletteColor(20 + column, checkerVariant(x, y));
  });
}

/**
 * 编码小素材图集：64×32、4×2、每格 16×16，八块都比 48 的地图格更小
 * @returns 完整的 PNG 字节
 */
export function encodeDemoSmallTileAtlas(): Uint8Array {
  return encodeDemoPng(64, 32, (x, y) => {
    const column = Math.floor(x / 16);
    const row = Math.floor(y / 16);

    return paletteColor(30 + row * 4 + column, checkerVariant(x, y));
  });
}

/** 演示工程纹理清单的原始数据：引擎 `.list.jsonc` 的形状，只服务开发宿主 */
const DEMO_TEXTURE_LIST: readonly Record<string, unknown>[] = [
  {
    type: 'grid',
    source: DEMO_TERRAIN_IMAGE_PATH,
    cellWidth: DEMO_MAP_CELL_SIZE,
    cellHeight: DEMO_MAP_CELL_SIZE,
    map: [1, 2, 3, 4, 5, 6, 7, 8],
  },
  {
    type: 'rowAnimate',
    source: DEMO_ANIMATE_IMAGE_PATH,
    cellWidth: DEMO_MAP_CELL_SIZE,
    cellHeight: DEMO_MAP_CELL_SIZE,
    map: [10],
  },
  {
    type: 'grid',
    source: DEMO_LARGE_IMAGE_PATH,
    cellWidth: 96,
    cellHeight: 64,
    map: [20, 21],
  },
  {
    type: 'grid',
    source: DEMO_SMALL_IMAGE_PATH,
    cellWidth: 16,
    cellHeight: 16,
    map: [30, 31, 32, 33, 34, 35, 36, 37],
  },
  {
    type: 'autotile',
    source: DEMO_AUTOTILE_BIG_IMAGE_PATH,
    cellWidth: DEMO_MAP_CELL_SIZE,
    cellHeight: DEMO_MAP_CELL_SIZE,
    autotileType: 'Big3x4',
    identifier: 90,
  },
  {
    type: 'autotile',
    source: DEMO_AUTOTILE_SMALL_IMAGE_PATH,
    cellWidth: DEMO_MAP_CELL_SIZE,
    cellHeight: DEMO_MAP_CELL_SIZE,
    autotileType: 'Small2x3',
    identifier: 91,
  },
  {
    type: 'tileset',
    source: DEMO_TILESET_IMAGE_PATH,
    cellWidth: DEMO_MAP_CELL_SIZE,
    cellHeight: DEMO_MAP_CELL_SIZE,
    identifier: 1000,
  },
];

/** 演示工程图块表的原始数据：只给编号与类型，不带 `map` / `source` */
const DEMO_TILE_TABLE: readonly Record<string, unknown>[] = [
  { type: 2, identifier: 1 },
  { type: 2, identifier: 2 },
  { type: 2, identifier: 3 },
  { type: 2, identifier: 4 },
  { type: 3, identifier: 10 },
  { type: 5, identifier: 5 },
  { type: 5, identifier: 6 },
  { type: 6, identifier: 7 },
  { type: 4, identifier: 8 },
  { type: 4, identifier: 20 },
  { type: 4, identifier: 21 },
  { type: 4, identifier: 30 },
  { type: 4, identifier: 31 },
  { type: 4, identifier: 32 },
  { type: 4, identifier: 33 },
  { type: 4, identifier: 34 },
  { type: 4, identifier: 35 },
  { type: 4, identifier: 36 },
  { type: 4, identifier: 37 },
  { type: 7, identifier: 90 },
  { type: 7, identifier: 91 },
  { type: 8, identifier: 1000 },
  { type: 8, identifier: 1001 },
  { type: 8, identifier: 1002 },
  { type: 8, identifier: 1003 },
  { type: 8, identifier: 1004 },
  { type: 8, identifier: 1005 },
  { type: 8, identifier: 1006 },
  { type: 8, identifier: 1007 },
];

/** 演示用的纹理清单文本：引擎 `.list.jsonc` 的形状，交给 `buildTileCatalog` 解析 */
export const DEMO_TEXTURE_LIST_TEXT: string = JSON.stringify(DEMO_TEXTURE_LIST, null, 2);

/** 演示用的图块表文本：引擎 `tile.jsonc` 的形状，交给 `buildTileCatalog` 解析 */
export const DEMO_TILE_TABLE_TEXT: string = JSON.stringify(DEMO_TILE_TABLE, null, 2);

/**
 * 由七张演示图集与两份引擎文本生成中立图块目录
 *
 * 图片尺寸用 `readImageDimensions` 从编码结果现算，宿主不需要在运行时解码图片；
 * 自动元件只给单方面连接编号，切片与四象限拼接由能力包现算。
 * @returns 六类图块目录
 */
export function buildDemoTileCatalog(): readonly IMapTileGroup[] {
  const dimensions = {
    [DEMO_TERRAIN_IMAGE_PATH]: readImageDimensions(encodeDemoTileAtlas()),
    [DEMO_ANIMATE_IMAGE_PATH]: readImageDimensions(encodeDemoAnimateAtlas()),
    [DEMO_AUTOTILE_BIG_IMAGE_PATH]: readImageDimensions(encodeDemoAutotileBigAtlas()),
    [DEMO_AUTOTILE_SMALL_IMAGE_PATH]: readImageDimensions(encodeDemoAutotileSmallAtlas()),
    [DEMO_TILESET_IMAGE_PATH]: readImageDimensions(encodeDemoTilesetAtlas()),
    [DEMO_LARGE_IMAGE_PATH]: readImageDimensions(encodeDemoLargeTileAtlas()),
    [DEMO_SMALL_IMAGE_PATH]: readImageDimensions(encodeDemoSmallTileAtlas()),
  };

  return buildTileCatalog({
    textureText: DEMO_TEXTURE_LIST_TEXT,
    tileText: DEMO_TILE_TABLE_TEXT,
    dimensions,
    connections: { 90: [1, 2], 91: [1, 2] },
    tilesetBase: 1000,
  });
}

/** 演示地图属性 Schema：一个字符串字段（名称）与一个数字字段（初始金币），按 x-order 排列 */
export const MAP_DEMO_PROPERTY_SCHEMA: ITableSchemaNode = {
  type: 'object',
  properties: {
    name: { type: 'string', description: '地图名称' },
    initialGold: { type: 'number', description: '初始金币' },
  },
  'x-order': ['name', 'initialGold'],
};

/**
 * 按格子生成器造一层扁平行主序格子
 * @param width 地图宽度
 * @param height 地图高度
 * @param create 按横纵坐标求格子值的生成器
 * @returns 长度为宽 × 高的扁平数组
 */
function createLayer(width: number, height: number, create: (x: number, y: number) => number): number[] {
  const cells: number[] = [];

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) cells.push(create(x, y));
  }

  return cells;
}

/** 小地图的宽度：小于视口，能一次看全边界 */
const DEMO_SMALL_WIDTH = 8;

/** 小地图的高度 */
const DEMO_SMALL_HEIGHT = 6;

/** 大地图的宽度：大于视口，用来验收视口移动与大地图模式 */
const DEMO_WIDE_WIDTH = 40;

/** 大地图的高度 */
const DEMO_WIDE_HEIGHT = 26;

/** 细节图的宽度（格子数）：16×14，用来观察大 / 小素材在 48×48 格里的留空 */
const DEMO_DETAIL_WIDTH = 16;

/** 细节图的高度 */
const DEMO_DETAIL_HEIGHT = 14;

/** 细节图的格子边长（像素）：与素材源尺寸不同，才能看出 contain 的留空 */
const DEMO_DETAIL_CELL_SIZE = 48;

/** 巨型地图的边长（格子数）：256×256，用来验收大地图缩略 */
const DEMO_HUGE_SIZE = 256;

/** 演示地图记录：小图、大图、细节图与巨型地图，都带非空格子与要保留的事件 / 额外字段 */
export const MAP_DEMO_MAPS: readonly IMapFileRecord[] = [
  {
    id: 'small',
    name: '小营地',
    width: DEMO_SMALL_WIDTH,
    layers: {
      0: createLayer(DEMO_SMALL_WIDTH, DEMO_SMALL_HEIGHT, (x, y) => {
        const border = x === 0 || y === 0 || x === DEMO_SMALL_WIDTH - 1 || y === DEMO_SMALL_HEIGHT - 1;

        if (border) return 2;
        if ((x === 1 && y === 1) || (x === 6 && y === 4)) return 10;
        if (x >= 4 && x <= 6 && y >= 2 && y <= 3) return 90;
        if (x >= 1 && x <= 2 && y >= 2 && y <= 3) return 91;

        return 1;
      }),
      1: createLayer(DEMO_SMALL_WIDTH, DEMO_SMALL_HEIGHT, (x, y) =>
        (x === 3 && y === 2) || (x === 4 && y === 3) ? 5 : 0,
      ),
    },
    layerNames: { 0: '地面层', 1: '遮挡层' },
    properties: { name: '小营地', initialGold: 30 },
    events: { '3,2': { type: 'battle', enemyId: 'greenSlime', once: true } },
    extra: { note: '演示地图：保存时必须原样保留', order: 1 },
    cellWidth: DEMO_MAP_CELL_SIZE,
    cellHeight: DEMO_MAP_CELL_SIZE,
  },
  {
    id: 'wide',
    name: '大平原',
    width: DEMO_WIDE_WIDTH,
    layers: {
      0: createLayer(DEMO_WIDE_WIDTH, DEMO_WIDE_HEIGHT, (x, y) => {
        const border = x === 0 || y === 0 || x === DEMO_WIDE_WIDTH - 1 || y === DEMO_WIDE_HEIGHT - 1;

        if (border) return 2;

        return (x * 3 + y * 5) % 7 === 0 ? 4 : 1;
      }),
    },
    layerNames: { 0: '地面层' },
    properties: { name: '大平原', initialGold: 120 },
    events: { '20,13': { type: 'trigger', script: 'onEnter' } },
    extra: { note: '大地图：验收视口移动', order: 2 },
    cellWidth: DEMO_MAP_CELL_SIZE,
    cellHeight: DEMO_MAP_CELL_SIZE,
  },
  {
    id: 'detail',
    name: '细节图',
    width: DEMO_DETAIL_WIDTH,
    layers: {
      0: createLayer(DEMO_DETAIL_WIDTH, DEMO_DETAIL_HEIGHT, (x, y) => {
        const border = x === 0 || y === 0 || x === DEMO_DETAIL_WIDTH - 1 || y === DEMO_DETAIL_HEIGHT - 1;

        if (border) return 2;
        if (y === 1 && x === 1) return 20;
        if (y === 1 && x === 2) return 21;
        if (y === 3 && x >= 1 && x <= 8) return 29 + x;

        return (x + y) % 5 === 0 ? 4 : 1;
      }),
    },
    layerNames: { 0: '地面层' },
    properties: { name: '细节图', initialGold: 0 },
    events: {},
    extra: { note: '大素材 96×64 缩成 48×32、上下各留 8px；小素材 16×16 原尺寸居中', order: 3 },
    cellWidth: DEMO_DETAIL_CELL_SIZE,
    cellHeight: DEMO_DETAIL_CELL_SIZE,
  },
  {
    id: 'huge',
    name: '巨型地图',
    width: DEMO_HUGE_SIZE,
    layers: {
      0: createLayer(DEMO_HUGE_SIZE, DEMO_HUGE_SIZE, (x, y) => {
        const border = x === 0 || y === 0 || x === DEMO_HUGE_SIZE - 1 || y === DEMO_HUGE_SIZE - 1;

        if (border) return 2;

        return (x * 5 + y * 7) % 11 === 0 ? 4 : 1;
      }),
    },
    layerNames: { 0: '地面层' },
    properties: { name: '巨型地图', initialGold: 0 },
    events: {},
    extra: { note: '256×256：验收大地图缩略与一屏看全', order: 4 },
    cellWidth: DEMO_MAP_CELL_SIZE,
    cellHeight: DEMO_MAP_CELL_SIZE,
  },
];

/**
 * 把演示地图文件、清单、七张图集与两份引擎文本写进内存后端
 * @param backend 开发宿主的内存后端
 */
export async function seedMapDemo(backend: IMemoryBackend): Promise<void> {
  const maps = MAP_DEMO_MAPS.map((record) => ({ id: record.id, name: record.name }));

  backend.seed(MAP_LIST_PATH, serializeTableText({ maps }, ''));

  for (const record of MAP_DEMO_MAPS) {
    backend.seed(mapFilePath(record.id), serializeTableText(record, ''));
  }

  backend.seed(DEMO_TERRAIN_IMAGE_PATH, encodeDemoTileAtlas());
  backend.seed(DEMO_ANIMATE_IMAGE_PATH, encodeDemoAnimateAtlas());
  backend.seed(DEMO_AUTOTILE_BIG_IMAGE_PATH, encodeDemoAutotileBigAtlas());
  backend.seed(DEMO_AUTOTILE_SMALL_IMAGE_PATH, encodeDemoAutotileSmallAtlas());
  backend.seed(DEMO_TILESET_IMAGE_PATH, encodeDemoTilesetAtlas());
  backend.seed(DEMO_LARGE_IMAGE_PATH, encodeDemoLargeTileAtlas());
  backend.seed(DEMO_SMALL_IMAGE_PATH, encodeDemoSmallTileAtlas());
  backend.seed(DEMO_TEXTURE_LIST_PATH, DEMO_TEXTURE_LIST_TEXT);
  backend.seed(DEMO_TILE_TABLE_PATH, DEMO_TILE_TABLE_TEXT);
}

/**
 * 注册开发宿主的地图面板类型，并把图块目录、属性 schema、尺寸上限与可选覆盖一并注入
 * @param core 开发宿主的编辑器核心，经其外壳系统注册面板类型
 * @param backend 开发宿主的内存后端，地图能力的全部读写都经它
 * @param overrides 可选的视口格数与帧速覆盖；不传时用能力的默认值
 * @returns 注入给地图面板的能力对象
 */
export function registerMapDemo(
  core: EditorCore,
  backend: IEditorFileSystem,
  overrides?: IMapDemoOverrides,
): IMapEditorCapabilities {
  const capabilities: IMapEditorCapabilities = {
    ...createMapCapabilities(backend, {
      tileGroups: buildDemoTileCatalog(),
      propertiesSchema: MAP_DEMO_PROPERTY_SCHEMA,
      maxMapSize: { maxWidth: 256, maxHeight: 256 },
    }),
    ...(overrides ?? {}),
  };

  // 素材 demo 已订阅同一条「无法撤销」提示，这里不再重复订阅，避免一次撤销弹两次
  core.shellSystem.registerPanelType(createMapPanelType(capabilities));

  return capabilities;
}
