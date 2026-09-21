import type { RasterCodec, RasterImage } from './types';

function canvasContext(width: number, height: number): CanvasRenderingContext2D {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) throw new Error('Canvas 2D context unavailable');
  context.imageSmoothingEnabled = false;
  return context;
}

function dataUrlBytes(dataUrl: string): Uint8Array {
  const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1);
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function loadImage(bytes: Uint8Array): Promise<CanvasImageSource & { width: number; height: number }> {
  const copy = new Uint8Array(bytes);
  const blob = new Blob([copy.buffer], { type: 'image/png' });
  if (typeof createImageBitmap === 'function') return createImageBitmap(blob);
  const url = URL.createObjectURL(blob);
  try {
    const image = new Image();
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error('Failed to decode PNG image'));
      image.src = url;
    });
    return image;
  } finally {
    URL.revokeObjectURL(url);
  }
}

export class CanvasRasterCodec implements RasterCodec {
  async decode(bytes: Uint8Array): Promise<RasterImage> {
    const image = await loadImage(bytes);
    const context = canvasContext(image.width, image.height);
    context.drawImage(image, 0, 0);
    const imageData = context.getImageData(0, 0, image.width, image.height);
    return { width: image.width, height: image.height, data: new Uint8ClampedArray(imageData.data) };
  }

  async encode(image: RasterImage): Promise<Uint8Array> {
    const context = canvasContext(image.width, image.height);
    context.putImageData(new ImageData(new Uint8ClampedArray(image.data), image.width, image.height), 0, 0);
    const blob = await new Promise<Blob | null>((resolve) => context.canvas.toBlob(resolve, 'image/png'));
    if (blob) return new Uint8Array(await blob.arrayBuffer());
    return dataUrlBytes(context.canvas.toDataURL('image/png'));
  }

  fromSource(source: CanvasImageSource): RasterImage {
    const dimensions = source as { width?: number; height?: number; videoWidth?: number; videoHeight?: number };
    const width = dimensions.width ?? dimensions.videoWidth ?? 0;
    const height = dimensions.height ?? dimensions.videoHeight ?? 0;
    if (width <= 0 || height <= 0) throw new Error('Image source has invalid dimensions');
    const context = canvasContext(width, height);
    context.drawImage(source, 0, 0);
    const imageData = context.getImageData(0, 0, width, height);
    return { width, height, data: new Uint8ClampedArray(imageData.data) };
  }
}
