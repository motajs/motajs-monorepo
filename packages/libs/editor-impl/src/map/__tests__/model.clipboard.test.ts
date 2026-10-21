import { describe, expect, it } from 'vitest';
import { IMapClipboard } from '../types';
import { buildClearWrites, buildPasteWrites, copyMapRegion } from '../model/clipboard';

/** 4 × 3 的样例图层，编号按行列递增，便于核对行主序 */
const SAMPLE_CELLS: readonly (readonly number[])[] = [
  [1, 2, 3, 4],
  [5, 6, 7, 8],
  [9, 10, 11, 12],
];

/** 样例地图尺寸 */
const SAMPLE_SIZE = { width: 4, height: 3 };

/**
 * 造一个剪贴块
 * @param width 剪贴块宽度（格子数）
 * @param height 剪贴块高度（格子数）
 * @param tiles 行主序的图块编号
 * @returns 剪贴块
 */
function createClipboard(width: number, height: number, tiles: readonly number[]): IMapClipboard {
  return { width, height, tiles };
}

describe('copyMapRegion 复制', () => {
  // 复制 3×2 区域时按行主序把编号拷进剪贴板
  it('复制 3×2 区域按行主序', () => {
    const clipboard = copyMapRegion(SAMPLE_CELLS, { x: 1, y: 1, width: 3, height: 2 }, SAMPLE_SIZE);

    expect(clipboard).toEqual({ width: 3, height: 2, tiles: [6, 7, 8, 10, 11, 12] });
  });

  // 矩形越界时先裁到地图内再复制，不会读到地图外的格子
  it('复制时矩形越界被裁剪', () => {
    const clipboard = copyMapRegion(SAMPLE_CELLS, { x: 2, y: 1, width: 3, height: 3 }, SAMPLE_SIZE);

    expect(clipboard).toEqual({ width: 2, height: 2, tiles: [7, 8, 11, 12] });
  });

  // 宽或高为 0 的区域没有内容，得到空剪贴板
  it('复制空区域得到空剪贴板', () => {
    expect(copyMapRegion(SAMPLE_CELLS, { x: 0, y: 0, width: 0, height: 2 }, SAMPLE_SIZE)).toEqual({
      width: 0,
      height: 0,
      tiles: [],
    });
    expect(copyMapRegion(SAMPLE_CELLS, { x: 0, y: 0, width: 2, height: 0 }, SAMPLE_SIZE)).toEqual({
      width: 0,
      height: 0,
      tiles: [],
    });
  });
});

describe('buildPasteWrites 粘贴', () => {
  // 完全落在地图内时逐格写入，没有被跳过的格子
  it('粘贴完全在地图内时没有裁剪', () => {
    const result = buildPasteWrites(createClipboard(2, 2, [1, 2, 3, 4]), { x: 1, y: 1 }, SAMPLE_SIZE);

    expect(result.clipped).toBe(0);
    expect(result.writes).toEqual([
      { x: 1, y: 1, value: 1 },
      { x: 2, y: 1, value: 2 },
      { x: 1, y: 2, value: 3 },
      { x: 2, y: 2, value: 4 },
    ]);
  });

  // 右下角越界时只写地图内的格子，被跳过的格数等于超出格数
  it('粘贴部分越界时裁剪并计数', () => {
    const result = buildPasteWrites(createClipboard(2, 2, [1, 2, 3, 4]), { x: 3, y: 2 }, SAMPLE_SIZE);

    expect(result.writes).toEqual([{ x: 3, y: 2, value: 1 }]);
    expect(result.clipped).toBe(3);
  });

  // 负方向越界同样逐格跳过：只保留落在地图内的那一列
  it('粘贴向左上越界时裁剪并计数', () => {
    const result = buildPasteWrites(createClipboard(2, 2, [1, 2, 3, 4]), { x: -1, y: 0 }, SAMPLE_SIZE);

    expect(result.writes).toEqual([
      { x: 0, y: 0, value: 2 },
      { x: 0, y: 1, value: 4 },
    ]);
    expect(result.clipped).toBe(2);
  });

  // 完全在地图外时没有任何写入，被跳过格数等于剪贴块的全部格子
  it('粘贴完全在外时写入为空', () => {
    const result = buildPasteWrites(createClipboard(2, 2, [1, 2, 3, 4]), { x: -3, y: -3 }, SAMPLE_SIZE);

    expect(result.writes).toEqual([]);
    expect(result.clipped).toBe(4);
  });
});

describe('buildClearWrites 清空', () => {
  // 清空矩形等同把矩形内每格写成 0
  it('清空矩形写 0', () => {
    const writes = buildClearWrites({ x: 0, y: 0, width: 2, height: 2 }, SAMPLE_SIZE);

    expect(writes).toEqual([
      { x: 0, y: 0, value: 0 },
      { x: 1, y: 0, value: 0 },
      { x: 0, y: 1, value: 0 },
      { x: 1, y: 1, value: 0 },
    ]);
  });

  // 清空矩形越界时按地图边界裁剪，不产生越界写入
  it('清空矩形越界时裁剪', () => {
    const writes = buildClearWrites({ x: 3, y: 2, width: 3, height: 3 }, SAMPLE_SIZE);

    expect(writes).toEqual([{ x: 3, y: 2, value: 0 }]);
  });
});
