import { once } from "es-toolkit";
import { createEmptyCanvas } from "./create";

const createCheckboardPattern = once(() => {
  const ctx = createEmptyCanvas([16, 16]);
  ctx.fillStyle = 'rgba(203, 203, 203, 0.5)';
  ctx.fillRect(0, 0, 8, 8);
  ctx.fillRect(8, 8, 16, 16);
  return ctx.createPattern(ctx.canvas, 'repeat')!;
});

export const drawCheckboard = (ctx: CanvasRenderingContext2D) => {
  const pattern = createCheckboardPattern();
  ctx.fillStyle = pattern;
  ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
};
