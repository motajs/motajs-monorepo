import { Rect, type RectPOD } from "../coordinate";

export const strokeByRect = (ctx: CanvasRenderingContext2D, rect: RectPOD, lineWidth: number, style: string) => {
  ctx.strokeStyle = style;
  ctx.lineWidth = lineWidth;
  const [sx, sy, dx, dy] = Rect.toQuadruple(rect);
  const w = dx - sx - lineWidth;
  const h = dy - sy - lineWidth;
  ctx.strokeRect(sx + lineWidth / 2, sy + lineWidth / 2, w, h);
};
