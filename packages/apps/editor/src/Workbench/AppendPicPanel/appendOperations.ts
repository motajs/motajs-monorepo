import type { LocPOD } from '@/utils/coordinate';
import { getGridSizeForMaterial } from '@/utils/appendPic/materialConfig';
import { drawImageFromGrid } from '@/utils/appendPic/draw';
import { createEmptyCanvas } from '@/utils/canvas/create';
import { projectAssets } from '@/project/assets';
import { materialCommands, type MaterialAppendResult } from '@/project/commands';
import { notifyCommandResult, notifyError, notifySuccess } from '@/utils/notify';

type ImageSource = HTMLImageElement | HTMLCanvasElement;

interface AppendMaterialParams {
  sourceImage: ImageSource;
  materialType: string;
  frameSelections: LocPOD[];
  autoRegister: boolean;
}

interface QuickAppendMaterialParams {
  sourceImage: ImageSource;
  materialType: string;
  autoRegister: boolean;
}

async function ensureCollection(materialType: string) {
  const collection = projectAssets.materialCollection(materialType);
  await collection.ensureLoaded();
  collection.value();
  return collection;
}

function throwCommandError(result: MaterialAppendResult): never {
  if (!result.ok) throw result.error;
  throw new Error('Unexpected material command result');
}

function assertFrameSelections(frameSelections: LocPOD[], expected: number): void {
  if (frameSelections.length < expected) {
    throw new Error(`请先选择 ${expected} 帧素材位置`);
  }
  for (let i = 0; i < expected; i += 1) {
    if (!frameSelections[i]) throw new Error(`请先选择 ${expected} 帧素材位置`);
  }
}

/**
 * 追加 Autotile 素材
 */
export async function appendAutotileMaterial(sourceImage: ImageSource): Promise<void> {
  if (sourceImage.width % 96 !== 0 || sourceImage.height !== 128) {
    notifyError('不合法的Autotile图片！');
    return;
  }

  const result = await materialCommands.append({
    images: 'autotile',
    image: projectAssets.rasterCodec().fromSource(sourceImage),
    autoRegister: true,
  });
  if (result.ok) {
    notifySuccess(`自动元件${result.filename ?? ''}注册成功`);
  } else {
    notifyCommandResult(result, '');
  }
}

/**
 * 追加普通素材
 */
export async function appendMaterial(params: AppendMaterialParams): Promise<void> {
  const { sourceImage, materialType, frameSelections, autoRegister } = params;

  const gridSize = getGridSizeForMaterial(materialType);
  const [, gridHeight] = gridSize;
  const collection = await ensureCollection(materialType);
  const targetWidth = collection.entries()[0]?.width;
  if (!targetWidth) throw new Error(`素材表为空：${materialType}`);
  const frameCount = targetWidth / 32;
  assertFrameSelections(frameSelections, frameCount);
  const spriteCtx = createEmptyCanvas([targetWidth, gridHeight]);

  frameSelections.forEach((pos, index) => {
    drawImageFromGrid(spriteCtx, sourceImage, pos, gridSize, [index * 32, 0]);
  });

  try {
    const result = await materialCommands.append({
      images: materialType,
      image: projectAssets.rasterCodec().fromSource(spriteCtx.canvas),
      autoRegister,
    });
    if (notifyCommandResult(result, autoRegister ? '追加素材并自动注册成功！' : '追加素材成功！')) {
      notifySuccess('你可以继续追加其他素材。');
    }
  } catch (err) {
    notifyError(err);
    throw err;
  }
}

/**
 * 快速追加素材
 */
export async function quickAppendMaterial(params: QuickAppendMaterialParams): Promise<void> {
  const { sourceImage, materialType, autoRegister } = params;

  if (!['items', 'enemys', 'enemy48', 'npcs', 'npc48'].includes(materialType)) {
    notifyError('只有怪物或NPC才能快速导入！');
    return;
  }

  const gridSize = getGridSizeForMaterial(materialType);
  const [, gridHeight] = gridSize;
  let sw = sourceImage.width,
    sh = sourceImage.height;
  if (materialType === 'items') {
    if (sw % 32 || sh % 32) {
      notifyError('只有长宽都是32的倍数的道具图才可以快速导入！');
      return;
    }
  } else {
    if ((sw !== 128 && sw !== 96) || sh !== 4 * gridHeight) {
      notifyError('只有 3*4 或 4*4 的素材图片才可以快速导入！');
      return;
    }
  }
  sw = sw / 32;
  sh = sh / gridHeight;

  const collection = await ensureCollection(materialType);
  const targetWidth = collection.entries()[0]?.width;
  if (!targetWidth) throw new Error(`素材表为空：${materialType}`);
  const sourceCtx = createEmptyCanvas([sourceImage.width, sourceImage.height]);
  const sourceCanvas = sourceCtx.canvas;
  sourceCtx.drawImage(sourceImage, 0, 0);
  const rows: HTMLCanvasElement[] = [];
  if (targetWidth === 32) {
    for (let i = 0; i < sw * sh; ++i) {
      const row = createEmptyCanvas([targetWidth, gridHeight]);
      const srcGridX = i % sw;
      const srcGridY = Math.floor(i / sw);
      drawImageFromGrid(row, sourceCanvas, [srcGridX, srcGridY], [32, gridHeight], [0, 0]);
      rows.push(row.canvas);
    }
  } else {
    const frameColumns = targetWidth === 64 ? (sw === 3 ? [0, 2] : [1, 2]) : sw === 3 ? [1, 0, 1, 2] : [0, 1, 2, 3];
    if (targetWidth !== frameColumns.length * 32) {
      throw new Error(`不支持宽度为 ${targetWidth} 的素材表`);
    }
    for (let direction = 0; direction < sh; direction += 1) {
      const row = createEmptyCanvas([targetWidth, gridHeight]);
      frameColumns.forEach((column, frame) => {
        drawImageFromGrid(row, sourceCanvas, [column, direction], [32, gridHeight], [frame * 32, 0]);
      });
      rows.push(row.canvas);
    }
  }

  try {
    let result: MaterialAppendResult | undefined;
    for (let index = 0; index < rows.length; index += 1) {
      result = await materialCommands.append({
        images: materialType,
        image: projectAssets.rasterCodec().fromSource(rows[index]),
        autoRegister: autoRegister && index === rows.length - 1,
      });
      if (!result.ok) throwCommandError(result);
    }
    if (!result) throw new Error('没有可追加的素材');
    if (notifyCommandResult(result, autoRegister ? '快速追加素材并自动注册成功！' : '快速追加素材成功！')) {
      notifySuccess('你可以继续追加其他素材。');
    }
  } catch (err) {
    notifyError(err);
    throw err;
  }
}
