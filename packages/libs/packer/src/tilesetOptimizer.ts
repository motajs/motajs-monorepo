import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createTransparentImage, getImageSize, compositeVerticalRegions } from './utils/image-utils';
import type { GameData } from './types';
import { Logger } from './logger';

/** 每个 tileset 的起始 ID 间隔 */
const TILESET_ID_INTERVAL = 10000;

/** 每个 tile 的尺寸（像素） */
const TILE_SIZE = 32;

/**
 * Tileset 信息
 */
export interface TilesetInfo {
  /** 文件名 */
  filename: string;
  /** 使用的 tile ID 列表 */
  usedTileIds: number[];
  /** 起始索引 */
  startIndex: number;
}

/**
 * 从 floors.min.js 内容中提取所有使用的 tileset ID
 * 提取所有 5 位及以上的数字作为潜在的 tileset ID
 *
 * @param floorsContent floors.min.js 的内容
 * @returns 使用的 tileset ID 集合
 */
export function extractUsedTileIds(floorsContent: string): Set<number> {
  // 匹配所有 5 位及以上的数字
  const regex = /\b(\d{5,})\b/g;
  const usedIds = new Set<number>();

  let match: RegExpExecArray | null;
  while ((match = regex.exec(floorsContent)) !== null) {
    const id = parseInt(match[1], 10);
    usedIds.add(id);
  }

  return usedIds;
}

/**
 * 获取指定 tileset 索引的 ID 范围
 * 每个 tileset 从 10000 * (index + 1) 开始编号
 *
 * @param tilesetIndex tileset 索引（从 0 开始）
 * @returns [起始 ID, 结束 ID)
 */
export function getTilesetIdRange(tilesetIndex: number): [number, number] {
  const startId = TILESET_ID_INTERVAL * (tilesetIndex + 1);
  const endId = startId + TILESET_ID_INTERVAL;
  return [startId, endId];
}

/**
 * 从全局使用的 ID 集合中筛选出属于指定 tileset 的 ID
 *
 * @param allUsedIds 所有使用的 tileset ID
 * @param tilesetIndex tileset 索引
 * @returns 属于该 tileset 的 ID 列表（相对于该 tileset 的偏移量）
 */
export function filterTilesetIds(allUsedIds: Set<number>, tilesetIndex: number): number[] {
  const [startId, endId] = getTilesetIdRange(tilesetIndex);
  const ids: number[] = [];

  for (const id of allUsedIds) {
    if (id >= startId && id < endId) {
      // 转换为相对于该 tileset 的偏移量
      ids.push(id - startId);
    }
  }

  return ids.sort((a, b) => a - b);
}

/**
 * 根据 tile ID 计算其在图片中的行号
 * 假设每行有 N 个 tile，ID 从 0 开始
 *
 * @param tileId tile ID（相对偏移量）
 * @param tilesPerRow 每行的 tile 数量
 * @returns 行号（从 0 开始）
 */
export function getTileRow(tileId: number, tilesPerRow: number): number {
  return Math.floor(tileId / tilesPerRow);
}

/**
 * 计算需要保留的行区域
 *
 * @param usedTileIds 使用的 tile ID 列表（相对偏移量）
 * @param tilesPerRow 每行的 tile 数量
 * @param totalRows 总行数
 * @returns 需要保留的行区域列表
 */
export function calculateUsedRows(usedTileIds: number[], tilesPerRow: number, totalRows: number): number[] {
  const usedRows = new Set<number>();

  for (const tileId of usedTileIds) {
    const row = getTileRow(tileId, tilesPerRow);
    if (row < totalRows) {
      usedRows.add(row);
    }
  }

  return Array.from(usedRows).sort((a, b) => a - b);
}

/**
 * 优化单个 tileset 图片
 * 裁剪未使用的 tile 区域，如果没有使用任何 tile 则替换为 32x32 透明图
 *
 * @param tilesetPath tileset 图片路径
 * @param usedIds 全局使用的 tileset ID 集合
 * @param tilesetIndex tileset 索引（从 0 开始）
 * @returns 是否进行了优化
 */
export async function optimizeTileset(
  tilesetPath: string,
  usedIds: Set<number>,
  tilesetIndex: number,
): Promise<boolean> {
  // 获取属于该 tileset 的 ID
  const tileIds = filterTilesetIds(usedIds, tilesetIndex);

  // 如果没有使用任何 tile，替换为最小透明图
  if (tileIds.length === 0) {
    await createTransparentImage(tilesetPath, TILE_SIZE, TILE_SIZE);
    return true;
  }

  // 获取图片尺寸
  const { width, height } = await getImageSize(tilesetPath);

  // 计算每行的 tile 数量和总行数
  const tilesPerRow = Math.floor(width / TILE_SIZE);
  const totalRows = Math.floor(height / TILE_SIZE);

  if (tilesPerRow === 0 || totalRows === 0) {
    return false;
  }

  // 计算使用的行
  const usedRows = calculateUsedRows(tileIds, tilesPerRow, totalRows);

  // 如果所有行都被使用，不需要优化
  if (usedRows.length === totalRows) {
    return false;
  }

  // 构建需要保留的区域
  const regions: Array<{ y: number; height: number }> = usedRows.map((row) => ({
    y: row * TILE_SIZE,
    height: TILE_SIZE,
  }));

  // 合并连续的区域以减少拼接次数
  const mergedRegions = mergeConsecutiveRegions(regions);

  // 拼接保留的区域
  await compositeVerticalRegions(tilesetPath, mergedRegions, width, tilesetPath);

  return true;
}

/**
 * 合并连续的区域
 *
 * @param regions 区域列表
 * @returns 合并后的区域列表
 */
function mergeConsecutiveRegions(regions: Array<{ y: number; height: number }>): Array<{ y: number; height: number }> {
  if (regions.length === 0) {
    return [];
  }

  const sorted = [...regions].sort((a, b) => a.y - b.y);
  const merged: Array<{ y: number; height: number }> = [];

  let current = { ...sorted[0] };

  for (let i = 1; i < sorted.length; i++) {
    const next = sorted[i];
    // 检查是否连续
    if (current.y + current.height === next.y) {
      // 合并
      current.height += next.height;
    } else {
      merged.push(current);
      current = { ...next };
    }
  }

  merged.push(current);
  return merged;
}

/**
 * 优化所有 tileset 图片
 *
 * @param rootDir 游戏根目录
 * @param tilesets tileset 文件名列表
 * @param floorsContent floors.min.js 的内容
 * @param logger 日志记录器
 * @returns 优化的 tileset 数量
 */
export async function optimizeAll(
  rootDir: string,
  tilesets: string[],
  floorsContent: string,
  logger?: Logger,
): Promise<number> {
  if (tilesets.length === 0) {
    return 0;
  }

  logger?.group('优化 Tileset 图片');

  // 提取所有使用的 tileset ID
  const usedIds = extractUsedTileIds(floorsContent);
  logger?.log(`从地图数据中提取到 ${usedIds.size} 个潜在 tileset ID`);

  const tilesetsDir = join(rootDir, 'project', 'tilesets');
  let optimizedCount = 0;

  for (let i = 0; i < tilesets.length; i++) {
    const filename = tilesets[i];
    const tilesetPath = join(tilesetsDir, `${filename}.png`);

    try {
      const optimized = await optimizeTileset(tilesetPath, usedIds, i);
      if (optimized) {
        optimizedCount++;
        logger?.log(`优化 ${filename}.png`);
      }
    } catch (error) {
      logger?.warn(`无法优化 ${filename}.png: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  logger?.groupEnd();

  if (optimizedCount > 0) {
    logger?.success(`已优化 ${optimizedCount} 个 tileset 图片`);
  }

  return optimizedCount;
}

/**
 * 从游戏数据中优化所有 tileset
 *
 * @param rootDir 游戏根目录
 * @param gameData 游戏数据
 * @param logger 日志记录器
 * @returns 优化的 tileset 数量
 */
export async function optimizeFromGameData(rootDir: string, gameData: GameData, logger?: Logger): Promise<number> {
  // 读取 floors.min.js 内容
  const floorsMinPath = join(rootDir, 'project', 'floors.min.js');

  let floorsContent: string;
  try {
    floorsContent = await readFile(floorsMinPath, 'utf-8');
  } catch {
    logger?.warn('floors.min.js 不存在，跳过 tileset 优化');
    return 0;
  }

  return optimizeAll(rootDir, gameData.tilesets, floorsContent, logger);
}
