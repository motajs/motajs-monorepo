import { IMapAutotileQuarters, IMapTileCrop, MapAutotileType } from '../types';

// 自动拼接：由同层格子值与宿主注入的连接集合算出 8 位连接数，再换算出四块象限矩形。
// 连接位顺序与边缘语义逐字复刻引擎：最高位是左上、顺时针到最低位是左；地图外一律视为已连接。
// 引擎用「整表掩码」表达边缘，这里等价地由越界判定给出，1 行 / 1 列 / 单格地图自然得到相同的掩码。
// 3×4 / 2×3 的十个形状常量是引擎的 magic number，原样照抄、不自行推导。
// 不读图片、不建画布、不缓存：编辑器只算矩形，四块怎么画交给画布。

/**
 * 读取一个邻居格的图块编号
 * @param cells 同层格子矩阵（`[y][x]`）
 * @param x 邻居横坐标
 * @param y 邻居纵坐标
 * @param width 矩阵宽度
 * @param height 矩阵高度
 * @returns 邻居的图块编号；地图外返回 undefined
 */
function readNeighbor(
  cells: readonly (readonly number[])[],
  x: number,
  y: number,
  width: number,
  height: number,
): number | undefined {
  if (x < 0 || y < 0 || x >= width || y >= height) return undefined;

  return cells[y]?.[x] ?? 0;
}

/**
 * 判断一个邻居是否与中心格连接
 *
 * 地图外一律算已连接；连接集合为空时按「与中心同值」判定，集合非空时按「是否在集合里」判定单方面连接。
 * @param value 邻居的图块编号；地图外为 undefined
 * @param center 中心格的图块编号
 * @param connections 宿主注入的连接集合
 * @returns 已连接为 1，未连接为 0
 */
function isNeighborConnected(value: number | undefined, center: number, connections: ReadonlySet<number>): number {
  if (value === undefined) return 1;
  if (connections.size > 0) return Number(connections.has(value));

  return Number(value === center);
}

/**
 * 把象限索引换算成源图上的裁切矩形
 * @param index 象限索引（引擎常量给出的 0 基格位）
 * @param columns 每行可容纳的象限数：3×4 为 6，2×3 为 4
 * @param halfWidth 半格宽（源图像素）
 * @param halfHeight 半格高（源图像素）
 * @returns 该象限的源图裁切矩形
 */
function toQuarterCrop(index: number, columns: number, halfWidth: number, halfHeight: number): IMapTileCrop {
  const x = (index % columns) * halfWidth;
  const y = Math.floor(index / columns) * halfHeight;

  return { x, y, width: halfWidth, height: halfHeight };
}

/**
 * 由同层格子值与连接集合算出某一格的 8 位自动拼接连接数
 *
 * 逐字复刻引擎：最高位是左上、顺时针到最低位是左；地图外一律视为已连接，
 * 因此 1 行 / 1 列 / 单格地图得到与引擎相同的掩码。中心格为 0（空格）或坐标越界时返回 0，不抛错。
 * @param cells 同层格子矩阵（`[y][x]`）
 * @param x 目标格横坐标
 * @param y 目标格纵坐标
 * @param connections 宿主注入的单方面连接集合；为空时按与中心同值判定
 * @returns 8 位连接数；非自动元件返回 0
 */
export function computeAutotileConnection(
  cells: readonly (readonly number[])[],
  x: number,
  y: number,
  connections: ReadonlySet<number>,
): number {
  const height = cells.length;
  const width = height > 0 ? (cells[0]?.length ?? 0) : 0;

  if (width <= 0 || x < 0 || y < 0 || x >= width || y >= height) return 0;

  const center = cells[y]?.[x] ?? 0;

  if (center === 0) return 0;

  const left = readNeighbor(cells, x - 1, y, width, height);
  const leftDown = readNeighbor(cells, x - 1, y + 1, width, height);
  const down = readNeighbor(cells, x, y + 1, width, height);
  const rightDown = readNeighbor(cells, x + 1, y + 1, width, height);
  const right = readNeighbor(cells, x + 1, y, width, height);
  const rightUp = readNeighbor(cells, x + 1, y - 1, width, height);
  const up = readNeighbor(cells, x, y - 1, width, height);
  const leftUp = readNeighbor(cells, x - 1, y - 1, width, height);

  return (
    isNeighborConnected(left, center, connections) |
    (isNeighborConnected(leftDown, center, connections) << 1) |
    (isNeighborConnected(down, center, connections) << 2) |
    (isNeighborConnected(rightDown, center, connections) << 3) |
    (isNeighborConnected(right, center, connections) << 4) |
    (isNeighborConnected(rightUp, center, connections) << 5) |
    (isNeighborConnected(up, center, connections) << 6) |
    (isNeighborConnected(leftUp, center, connections) << 7)
  );
}

/**
 * 由自动拼接类型与连接数算出铺到目标格四个象限的源图矩形
 *
 * 每块取素材单格的一半：象限索引由引擎的十个形状常量算出，再按每行 6（3×4）或 4（2×3）格换算。
 * 格尺寸非法（小于等于 0）时返回四个零矩形，连接数越界时夹到 0..255，都不抛错。
 * @param type 自动拼接素材的形状
 * @param connection 8 位连接数
 * @param cellWidth 素材单格的源像素宽
 * @param cellHeight 素材单格的源像素高
 * @returns 左上 / 右上 / 右下 / 左下四块源图矩形
 */
export function resolveAutotileQuarters(
  type: MapAutotileType,
  connection: number,
  cellWidth: number,
  cellHeight: number,
): IMapAutotileQuarters {
  const halfWidth = Number.isFinite(cellWidth) && cellWidth > 0 ? Math.trunc(cellWidth / 2) : 0;
  const halfHeight = Number.isFinite(cellHeight) && cellHeight > 0 ? Math.trunc(cellHeight / 2) : 0;

  if (halfWidth <= 0 || halfHeight <= 0) {
    const zeroRect: IMapTileCrop = { x: 0, y: 0, width: 0, height: 0 };

    return { lt: zeroRect, rt: zeroRect, rb: zeroRect, lb: zeroRect };
  }

  const isBig = type === MapAutotileType.Big3x4;
  const value = Number.isFinite(connection) ? Math.max(0, Math.min(0b1111_1111, Math.trunc(connection))) : 0;

  const h = isBig ? 2 : 1; // 横向偏移因子
  const v = isBig ? 12 : 4; // 纵向偏移因子
  const luo = isBig ? 12 : 8; // leftup origin
  const ruo = isBig ? 17 : 11; // rightup origin
  const ldo = isBig ? 42 : 20; // leftdown origin
  const rdo = isBig ? 47 : 23; // rightdown origin
  const luc = isBig ? 4 : 2; // leftup corner
  const ruc = isBig ? 5 : 3; // rightup corner
  const rdc = isBig ? 11 : 7; // rightdown corner
  const ldc = isBig ? 10 : 6; // leftdown corner
  const columns = isBig ? 6 : 4; // 每行可容纳的象限数

  let leftUp = luo;
  let rightUp = ruo;
  let leftDown = ldo;
  let rightDown = rdo;

  if (value & 0b0000_0001) {
    // 左侧有连接，左侧两块向右偏移两个因子
    leftUp += h * 2;
    leftDown += h * 2;

    if (value & 0b0001_0000) {
      rightUp += h;
      rightDown += h;
    }
  }

  if (value & 0b0000_0100) {
    // 下侧有连接，下侧两块向上偏移两个因子
    leftDown -= v * 2;
    rightDown -= v * 2;

    if (value & 0b0100_0000) {
      leftUp -= v;
      rightUp -= v;
    }
  }

  if (value & 0b0001_0000) {
    // 右侧有连接，右侧两块向左偏移两个因子
    rightUp -= h * 2;
    rightDown -= h * 2;

    if (value & 0b0000_0001) {
      leftUp -= h;
      leftDown -= h;
    }
  }

  if (value & 0b0100_0000) {
    // 上侧有连接，上侧两块向下偏移两个因子
    leftUp += v * 2;
    rightUp += v * 2;

    if (value & 0b0000_0100) {
      leftDown += v;
      rightDown += v;
    }
  }

  // 斜角：只与相邻两个方向连接时改用十字内容
  if ((value & 0b1100_0001) === 0b0100_0001) leftUp = luc;
  if ((value & 0b0111_0000) === 0b0101_0000) rightUp = ruc;
  if ((value & 0b0001_1100) === 0b0001_0100) rightDown = rdc;
  if ((value & 0b0000_0111) === 0b0000_0101) leftDown = ldc;

  return {
    lt: toQuarterCrop(leftUp, columns, halfWidth, halfHeight),
    rt: toQuarterCrop(rightUp, columns, halfWidth, halfHeight),
    rb: toQuarterCrop(rightDown, columns, halfWidth, halfHeight),
    lb: toQuarterCrop(leftDown, columns, halfWidth, halfHeight),
  };
}
