import { Grid, type GridPOD, type LocPOD } from "@/utils/coordinate";
import { createEmptyCanvas } from "@/utils/canvas/create";

/**
 * 从源图像的格子坐标绘制到目标 canvas 的像素坐标
 * @param ctx 目标 canvas 上下文
 * @param source 源图像（HTMLImageElement 或 HTMLCanvasElement）
 * @param srcPos 源格子坐标 [x, y]
 * @param srcGrid 源格子尺寸 [width, height]
 * @param destPos 目标像素坐标 [x, y]
 * @param destGrid 目标格子尺寸（可选，默认与源相同）
 */
export const drawImageFromGrid = (
  ctx: CanvasRenderingContext2D,
  source: HTMLImageElement | HTMLCanvasElement,
  srcPos: LocPOD,
  srcGrid: GridPOD,
  destPos: LocPOD,
  destGrid?: GridPOD
): void => {
  const [srcPixelX, srcPixelY] = Grid.mapLoc(srcPos, srcGrid);
  const [srcWidth, srcHeight] = srcGrid;
  const [destX, destY] = destPos;
  const [destWidth, destHeight] = destGrid || srcGrid;

  ctx.drawImage(
    source,
    srcPixelX,
    srcPixelY,
    srcWidth,
    srcHeight, // 源区域
    destX,
    destY,
    destWidth,
    destHeight, // 目标区域
  );
};

/**
 * 创建用于导出的 sprite canvas
 * @param targetImage 目标素材图片（用于获取尺寸）
 * @param gridHeight 追加的格子高度
 * @returns { canvas, ctx } canvas 和 context
 */
export const createSpriteCanvas = (
  targetImage: HTMLImageElement,
  gridHeight: number
): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } => {
  const ctx = createEmptyCanvas([targetImage.width, targetImage.height + gridHeight]);
  const canvas = ctx.canvas;

  // 绘制现有内容
  ctx.drawImage(targetImage, 0, 0);

  return { canvas, ctx };
};

/**
 * 计算追加位置的坐标（在 sprite 底部追加）
 * @param index 帧索引
 * @param canvasHeight sprite canvas 总高度
 * @param gridSize 格子尺寸 [width, height]
 * @returns 目标位置 [x, y]
 */
export const getAppendPos = (index: number, canvasHeight: number, gridSize: GridPOD): LocPOD => {
  const [gridWidth, gridHeight] = gridSize;
  return [index * gridWidth, canvasHeight - gridHeight];
};
