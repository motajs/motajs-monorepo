import convert from "color-convert";

export const hueRotate = (ctx: CanvasRenderingContext2D, degree: number) => {
  const { width, height } = ctx.canvas;
  const imageData = ctx.getImageData(0, 0, width, height);
  const size = imageData.data.length;
  degree = (degree + 360) % 360;
  for (let i = 0; i < size; i += 4) {
    const r = imageData.data[i];
    const g = imageData.data[i + 1];
    const b = imageData.data[i + 2];
    const hsl = convert.rgb.hsl(r, g, b);
    const dh = hsl[0] + degree;
    hsl[0] = dh < 360 ? dh : dh - 360;
    const [nr, ng, nb] = convert.hsl.rgb(hsl);
    imageData.data[i] = nr;
    imageData.data[i + 1] = ng;
    imageData.data[i + 2] = nb;
  }
  ctx.putImageData(imageData, 0, 0);
};
