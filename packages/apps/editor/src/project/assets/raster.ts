import type { RasterImage } from './types';

function assertRaster(image: RasterImage): void {
  if (!Number.isInteger(image.width) || image.width <= 0) throw new Error('Invalid raster width');
  if (!Number.isInteger(image.height) || image.height <= 0) throw new Error('Invalid raster height');
  if (image.data.length !== image.width * image.height * 4) {
    throw new Error('Invalid raster pixel data length');
  }
}

export function cloneRaster(image: RasterImage): RasterImage {
  assertRaster(image);
  return {
    width: image.width,
    height: image.height,
    data: new Uint8ClampedArray(image.data),
  };
}

export function cropRaster(image: RasterImage, x: number, y: number, width: number, height: number): RasterImage {
  assertRaster(image);
  if (x < 0 || y < 0 || width <= 0 || height <= 0 || x + width > image.width || y + height > image.height) {
    throw new Error('Raster crop is outside the source image');
  }
  const data = new Uint8ClampedArray(width * height * 4);
  for (let row = 0; row < height; row += 1) {
    const sourceStart = ((y + row) * image.width + x) * 4;
    const targetStart = row * width * 4;
    data.set(image.data.subarray(sourceStart, sourceStart + width * 4), targetStart);
  }
  return { width, height, data };
}

export function appendRasterRow(base: RasterImage, row: RasterImage): RasterImage {
  assertRaster(base);
  assertRaster(row);
  if (base.width !== row.width) throw new Error('Material row width does not match the sprite sheet');
  const data = new Uint8ClampedArray(base.data.length + row.data.length);
  data.set(base.data, 0);
  data.set(row.data, base.data.length);
  return { width: base.width, height: base.height + row.height, data };
}

export function insertRasterRow(
  base: RasterImage,
  rowHeight: number,
  row: number,
  inserted: RasterImage,
): { image: RasterImage; rowRemap: Map<number, number> } {
  assertRaster(base);
  assertRaster(inserted);
  const rowCount = assertSheetShape(base, rowHeight);
  if (!Number.isInteger(row) || row < 0 || row > rowCount) throw new Error('Material row is out of range');
  if (inserted.width !== base.width || inserted.height !== rowHeight) {
    throw new Error('Inserted material row has an incompatible size');
  }

  const offset = row * base.width * rowHeight * 4;
  const data = new Uint8ClampedArray(base.data.length + inserted.data.length);
  data.set(base.data.subarray(0, offset), 0);
  data.set(inserted.data, offset);
  data.set(base.data.subarray(offset), offset + inserted.data.length);

  const rowRemap = new Map<number, number>();
  for (let index = 0; index < rowCount; index += 1) {
    rowRemap.set(index, index < row ? index : index + 1);
  }
  return {
    image: { width: base.width, height: base.height + rowHeight, data },
    rowRemap,
  };
}

export function replaceRasterRow(
  base: RasterImage,
  rowHeight: number,
  row: number,
  replacement: RasterImage,
): RasterImage {
  assertRaster(base);
  assertRaster(replacement);
  const rowCount = assertSheetShape(base, rowHeight);
  if (!Number.isInteger(row) || row < 0 || row >= rowCount) throw new Error('Material row is out of range');
  if (replacement.width !== base.width || replacement.height !== rowHeight) {
    throw new Error('Replacement material row has an incompatible size');
  }
  const next = cloneRaster(base);
  next.data.set(replacement.data, row * base.width * rowHeight * 4);
  return next;
}

export function removeRasterRow(
  base: RasterImage,
  rowHeight: number,
  row: number,
): { image: RasterImage; rowRemap: Map<number, number> } {
  assertRaster(base);
  const rowCount = assertSheetShape(base, rowHeight);
  if (rowCount <= 1) throw new Error('The sprite sheet must keep at least one material row');
  if (!Number.isInteger(row) || row < 0 || row >= rowCount) throw new Error('Material row is out of range');

  const beforeLength = row * base.width * rowHeight * 4;
  const removedLength = base.width * rowHeight * 4;
  const data = new Uint8ClampedArray(base.data.length - removedLength);
  data.set(base.data.subarray(0, beforeLength), 0);
  data.set(base.data.subarray(beforeLength + removedLength), beforeLength);

  const rowRemap = new Map<number, number>();
  for (let index = 0; index < rowCount; index += 1) {
    if (index < row) rowRemap.set(index, index);
    if (index > row) rowRemap.set(index, index - 1);
  }
  return {
    image: { width: base.width, height: base.height - rowHeight, data },
    rowRemap,
  };
}

export function assertSheetShape(image: Pick<RasterImage, 'width' | 'height'>, rowHeight: number): number {
  if (!Number.isInteger(rowHeight) || rowHeight <= 0) throw new Error('Invalid material row height');
  if (image.width <= 0 || image.width % 32 !== 0)
    throw new Error('Material sheet width must be a positive multiple of 32');
  if (image.height <= 0 || image.height % rowHeight !== 0) {
    throw new Error(`Material sheet height must be a positive multiple of ${rowHeight}`);
  }
  return image.height / rowHeight;
}

export function readPngDimensions(bytes: Uint8Array): { width: number; height: number } {
  if (bytes.length < 24) throw new Error('Invalid PNG: missing IHDR');
  const signature = [137, 80, 78, 71, 13, 10, 26, 10];
  if (!signature.every((value, index) => bytes[index] === value)) throw new Error('Invalid PNG signature');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const width = view.getUint32(16);
  const height = view.getUint32(20);
  if (width <= 0 || height <= 0) throw new Error('Invalid PNG dimensions');
  return { width, height };
}
