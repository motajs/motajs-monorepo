import { projectData } from '@/project/data/projectData';
import type { BlockInfo, MapsBlocksData } from '@/services/mapBlock';
import type { FloorData } from '@/types';

export const LEGACY_AIRWALL_IDNUM = 17;

export const REGISTERED_AIRWALL: Readonly<BlockInfo> = {
  cls: 'terrains',
  id: 'airwall',
  name: '空气墙',
  noPass: true,
  cannotIn: ['up', 'down', 'left', 'right'],
  editorDisplay: {
    type: 'image',
    path: 'project/materials/airwall.png',
  },
};

export type AirwallMigrationResult = { status: 'not-used' } | { status: 'already-current' } | { status: 'migrated' };

function cellIdnum(cell: unknown): number {
  if (typeof cell === 'number') return cell;
  if (cell && typeof cell === 'object') {
    const idnum = (cell as { idnum?: unknown }).idnum;
    return typeof idnum === 'number' ? idnum : Number.NaN;
  }
  return Number(cell);
}

export function floorUsesIdnum(floor: FloorData, target: number): boolean {
  for (const layer of [floor.map, floor.bgmap, floor.fgmap]) {
    if (!Array.isArray(layer)) continue;
    for (const row of layer) {
      if (Array.isArray(row) && row.some((cell) => cellIdnum(cell) === target)) return true;
    }
  }
  return false;
}

function sameEditorDisplay(left: BlockInfo['editorDisplay'], right: BlockInfo['editorDisplay']): boolean {
  return (
    left?.type === right?.type &&
    left?.path === right?.path &&
    (left?.x ?? 0) === (right?.x ?? 0) &&
    (left?.y ?? 0) === (right?.y ?? 0) &&
    (left?.width ?? 32) === (right?.width ?? 32) &&
    (left?.height ?? 32) === (right?.height ?? 32)
  );
}

export function airwallRegistrationIsCurrent(blocks: MapsBlocksData): boolean {
  const current = blocks[String(LEGACY_AIRWALL_IDNUM)];
  return (
    current?.cls === REGISTERED_AIRWALL.cls &&
    current.id === REGISTERED_AIRWALL.id &&
    current.noPass === true &&
    Array.isArray(current.cannotIn) &&
    ['up', 'down', 'left', 'right'].every((direction) => current.cannotIn!.includes(direction)) &&
    sameEditorDisplay(current.editorDisplay, REGISTERED_AIRWALL.editorDisplay)
  );
}

export function buildRegisteredAirwall(current?: BlockInfo): BlockInfo {
  if (current && (current.id !== 'airwall' || current.cls !== 'terrains')) {
    throw new Error(`图块编号 17 已被 ${current.id ?? '未命名图块'} 占用，无法自动迁移空气墙`);
  }
  return {
    ...current,
    ...REGISTERED_AIRWALL,
    editorDisplay: { ...REGISTERED_AIRWALL.editorDisplay! },
    cannotIn: [...REGISTERED_AIRWALL.cannotIn!],
  };
}

/**
 * Upgrade the old engine-reserved airwall into an ordinary project block.
 * This is intentionally a load-time project migration rather than a renderer
 * fallback: once persisted, every editor model can resolve idnum 17 normally.
 */
export async function migrateLegacyAirwall(): Promise<AirwallMigrationResult> {
  const towerContent = projectData.tower().snapshot();
  const blocksContent = projectData.mapBlocks().snapshot();
  if (towerContent.status !== 'loaded' || blocksContent.status !== 'loaded') return { status: 'not-used' };

  const used = towerContent.value.main.floorIds.some((floorId) => {
    const floor = projectData.floor(floorId).snapshot();
    return floor.status === 'loaded' && floorUsesIdnum(floor.value, LEGACY_AIRWALL_IDNUM);
  });
  if (!used) return { status: 'not-used' };
  if (airwallRegistrationIsCurrent(blocksContent.value)) return { status: 'already-current' };

  const idnum = String(LEGACY_AIRWALL_IDNUM);
  const next = buildRegisteredAirwall(blocksContent.value[idnum]);
  const resource = projectData.mapBlocks();
  await resource.patch([[blocksContent.value[idnum] ? 'change' : 'add', `['${idnum}']`, next]]);
  return { status: 'migrated' };
}
