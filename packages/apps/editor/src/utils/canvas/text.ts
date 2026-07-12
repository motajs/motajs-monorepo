/**
 * Canvas 文字绘制工具函数
 */

/**
 * 绘制粗体文字（带可选描边）
 *
 * @param ctx - Canvas 2D 上下文
 * @param text - 要绘制的文字
 * @param x - x 坐标
 * @param y - y 坐标
 * @param fillStyle - 填充颜色
 * @param strokeStyle - 描边颜色（null 表示不描边）
 * @param font - 字体
 */
export const fillBoldText = (
  ctx: CanvasRenderingContext2D,
  text: string | number,
  x: number,
  y: number,
  fillStyle: string,
  strokeStyle: string | null,
  font: string,
): void => {
  ctx.font = font;
  ctx.fillStyle = fillStyle;
  if (strokeStyle) {
    ctx.strokeStyle = strokeStyle;
    ctx.strokeText(String(text), x, y);
  }
  ctx.fillText(String(text), x, y);
};
