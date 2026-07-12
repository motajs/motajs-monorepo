/**
 * Canvas 清除工具函数
 */

/**
 * 清空 canvas 内容
 *
 * @param ctx - Canvas 2D 上下文
 */
export const clearCanvas = (ctx: CanvasRenderingContext2D): void => {
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
};
