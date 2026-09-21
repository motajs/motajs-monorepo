import { getPixel } from './pixel';

/**
 * Detect if an image has a white background
 * @param imgData - The ImageData to analyze
 * @returns True if the image appears to have a white background
 */
export function detectWhiteBackground(imgData: ImageData): boolean {
  let trans = 0,
    white = 0;
  // 黑像素分支当前被禁用，故 black 恒为 0，声明为常量。保留与 black 的比较以使返回值不变。
  const black = 0;

  for (let i = 0; i < imgData.width; i++) {
    for (let j = 0; j < imgData.height; j++) {
      const pixel = getPixel(imgData, i, j);
      if (pixel[3] === 0) trans++;
      if (pixel[0] === 255 && pixel[1] === 255 && pixel[2] === 255 && pixel[3] === 255) white++;
      // if (pixel[0] === 0 && pixel[1] === 0 && pixel[2] === 0 && pixel[3] === 255) black++;
    }
  }

  return white > black && white > trans * 10;
}
