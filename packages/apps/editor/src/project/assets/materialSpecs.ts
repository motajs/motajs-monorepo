export const MATERIAL_SHEET_IMAGES = ['terrains', 'animates', 'enemys', 'enemy48', 'items', 'npcs', 'npc48'] as const;

export type MaterialSheetImages = (typeof MATERIAL_SHEET_IMAGES)[number];

export function materialRowHeight(images: string): number {
  return images.endsWith('48') ? 48 : 32;
}

export function materialPath(images: string, id?: string): string {
  if (images === 'autotile') {
    if (!id) throw new Error('Autotile id is required');
    return `project/autotiles/${id}.png`;
  }
  return `project/materials/${images}.png`;
}
