import { detectWhiteBackground } from '@/utils/canvas/detectWhiteBackground';
import { removeWhiteBackground } from '@/utils/canvas/removeWhiteBackground';
import { disableImageSmoothing } from '@/utils/canvas/disableImageSmoothing';
import type { GridPOD } from '@/utils/coordinate';
import { notifyError } from '@/utils/notify';

/**
 * 加载图像（纯函数）
 */
export function loadImageAsync(content: string | HTMLImageElement | HTMLCanvasElement): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    if (content instanceof HTMLImageElement) {
      resolve(content);
      return;
    }
    if (content instanceof HTMLCanvasElement) {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = content.toDataURL();
      return;
    }
    const image = new Image();
    try {
      image.onload = () => resolve(image);
      image.onerror = reject;
      image.src = content;
    } catch (e) {
      reject(e);
    }
  });
}

/**
 * 自动调整图像（纯函数）
 */
export async function autoAdjustImage(image: HTMLImageElement, gridSize: GridPOD): Promise<HTMLImageElement> {
  let changed = false;

  // Step 1: 检测白底
  let tempCanvas = document.createElement('canvas').getContext('2d')!;
  tempCanvas.canvas.width = image.width;
  tempCanvas.canvas.height = image.height;
  disableImageSmoothing(tempCanvas);
  tempCanvas.drawImage(image, 0, 0);
  const imgData = tempCanvas.getImageData(0, 0, image.width, image.height);

  if (detectWhiteBackground(imgData) && confirm('看起来这张图片是以纯白为底色，是否自动调整为透明底色？')) {
    removeWhiteBackground(imgData);
    tempCanvas.clearRect(0, 0, image.width, image.height);
    tempCanvas.putImageData(imgData, 0, 0);
    changed = true;
  }

  // Step 2: 检测长宽比
  const [gridWidth, gridHeight] = gridSize;
  if (
    (image.width % gridWidth !== 0 || image.height % gridHeight !== 0) &&
    image.width <= 128 &&
    image.height <= gridHeight * 4 &&
    confirm('目标长宽不符合条件，是否自动进行调整？')
  ) {
    const ncanvas = document.createElement('canvas').getContext('2d')!;
    ncanvas.canvas.width = 128;
    ncanvas.canvas.height = 4 * gridHeight;
    disableImageSmoothing(ncanvas);
    const w = image.width / 4,
      h = image.height / 4;
    for (let i = 0; i < 4; i++) {
      for (let j = 0; j < 4; j++) {
        ncanvas.drawImage(
          tempCanvas.canvas,
          i * w,
          j * h,
          w,
          h,
          i * gridWidth + (gridWidth - w) / 2,
          j * gridHeight + (gridHeight - h) / 2,
          w,
          h,
        );
      }
    }
    tempCanvas = ncanvas;
    changed = true;
  }

  if (!changed) {
    return image;
  }

  // 返回调整后的图像
  return new Promise((resolve) => {
    const nimg = new Image();
    nimg.onload = () => resolve(nimg);
    nimg.src = tempCanvas.canvas.toDataURL();
  });
}

/**
 * 处理文件内容（纯函数）
 */
export async function processImageFile(
  content: string | HTMLImageElement | HTMLCanvasElement,
  gridSize: GridPOD,
): Promise<HTMLImageElement> {
  try {
    const image = await loadImageAsync(content);
    const adjustedImage = await autoAdjustImage(image, gridSize);
    return adjustedImage;
  } catch (e) {
    notifyError(e);
    throw e;
  }
}
