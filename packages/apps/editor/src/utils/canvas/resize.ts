import type { LocPOD } from "../coordinate";

export const resizeAsSource = (ctx: CanvasRenderingContext2D, source: HTMLImageElement | HTMLCanvasElement) => {
  ctx.canvas.width = source.width;
  ctx.canvas.height = source.height;
};

export const resizeWithContent = (ctx: CanvasRenderingContext2D, [dw, dh]: LocPOD) => {
  const { width, height } = ctx.canvas;
  const kw = Math.min(width, dw);
  const kh = Math.min(height, dh);
  const keep = ctx.getImageData(0, 0, kw, kh);
  ctx.canvas.width = dw;
  ctx.canvas.height = dh;
  ctx.putImageData(keep, 0, 0);
};
