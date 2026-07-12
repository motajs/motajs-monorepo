/**
 * Get pixel RGBA values from ImageData at specified coordinates
 * @param imgData - The ImageData object
 * @param x - X coordinate
 * @param y - Y coordinate
 * @returns Array of [r, g, b, a] values
 */
export function getPixel(imgData: ImageData, x: number, y: number): [number, number, number, number] {
  const offset = (x + y * imgData.width) * 4;
  const r = imgData.data[offset + 0];
  const g = imgData.data[offset + 1];
  const b = imgData.data[offset + 2];
  const a = imgData.data[offset + 3];
  return [r, g, b, a];
}

/**
 * Set pixel RGBA values in ImageData at specified coordinates
 * @param imgData - The ImageData object
 * @param x - X coordinate
 * @param y - Y coordinate
 * @param rgba - Array of [r, g, b, a] values
 */
export function setPixel(imgData: ImageData, x: number, y: number, rgba: [number, number, number, number]): void {
  const offset = (x + y * imgData.width) * 4;
  imgData.data[offset + 0] = rgba[0];
  imgData.data[offset + 1] = rgba[1];
  imgData.data[offset + 2] = rgba[2];
  imgData.data[offset + 3] = rgba[3];
}
