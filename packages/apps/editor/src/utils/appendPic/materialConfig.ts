import type { GridPOD } from '@/utils/coordinate';

/**
 * 根据素材类型计算格子尺寸（与 tileset-editor 模式一致）
 */
export const getGridSizeForMaterial = (materialType: string): GridPOD => {
  // 48x48 素材类型
  if (materialType.endsWith('48')) {
    return [32, 48] as const;
  }
  // 32x32 素材类型（默认）
  return [32, 32] as const;
};

/**
 * 根据素材类型计算默认帧数
 */
export const getFrameCountForMaterial = (materialType: string): number => {
  // autotile 类型固定 4 帧
  if (materialType === 'autotile') {
    return 4;
  }
  if (materialType === 'items' || materialType === 'terrains') {
    return 1;
  }
  // 横向两帧素材
  if (materialType === 'enemys' || materialType === 'npcs') {
    return 2;
  }
  // 横向四帧素材
  if (materialType === 'enemy48' || materialType === 'npc48') {
    return 4;
  }
  // 其他类型默认 4 帧
  return 4;
};
