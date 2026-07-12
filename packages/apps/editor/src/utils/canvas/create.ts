import { type LocPOD } from '../coordinate';

export const createEmptyCanvas = ([x, y]: LocPOD) => {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d')!;
  ctx.canvas.width = x;
  ctx.canvas.height = y;
  return ctx;
};
