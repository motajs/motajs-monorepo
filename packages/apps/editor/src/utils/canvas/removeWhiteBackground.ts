import { getPixel, setPixel } from "./pixel";

/**
 * Remove white background from ImageData by converting white pixels to transparent
 * @param imgData - The ImageData to process (will be modified in place)
 */
export function removeWhiteBackground(imgData: ImageData): void {
  for (let i = 0; i < imgData.width; i++) {
    for (let j = 0; j < imgData.height; j++) {
      const pixel = getPixel(imgData, i, j);
      if (pixel[0] === 255 && pixel[1] === 255 && pixel[2] === 255 && pixel[3] === 255) {
        setPixel(imgData, i, j, [0, 0, 0, 0]);
      }
    }
  }
}
