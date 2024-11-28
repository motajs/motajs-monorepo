export interface Size {
  width: number;
  height: number;
}

export const scaleSize = (size: Size, scale: number) => {
  return {
    width: size.width * scale,
    height: size.height * scale,
  };
};
