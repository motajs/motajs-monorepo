import { describe, expect, it } from 'vitest';
import type { MapsBlocksData } from '@/services/mapBlock';
import type { FloorData } from '@/types';
import {
  REGISTERED_AIRWALL,
  airwallRegistrationIsCurrent,
  buildRegisteredAirwall,
  floorUsesIdnum,
} from '../airwallMigration';

describe('airwall project migration', () => {
  it('detects idnum 17 in every map layer and object cells', () => {
    const base = { floorId: 'sample', map: [[0]], bgmap: [[0]], fgmap: [[0]] } as FloorData;
    expect(floorUsesIdnum(base, 17)).toBe(false);
    expect(floorUsesIdnum({ ...base, map: [[17]] }, 17)).toBe(true);
    expect(floorUsesIdnum({ ...base, bgmap: [[17]] }, 17)).toBe(true);
    expect(floorUsesIdnum({ ...base, fgmap: [[{ idnum: 17 } as unknown as number]] }, 17)).toBe(true);
  });

  it('creates a registered invisible wall with an editor-only preview', () => {
    const block = buildRegisteredAirwall();
    expect(block).toEqual(REGISTERED_AIRWALL);
    expect(airwallRegistrationIsCurrent({ '17': block })).toBe(true);
  });

  it('is idempotent and preserves unrelated existing metadata', () => {
    const existing = { ...REGISTERED_AIRWALL, customFlag: 'kept' };
    const next = buildRegisteredAirwall(existing);
    expect(next.customFlag).toBe('kept');
    expect(airwallRegistrationIsCurrent({ '17': next } as MapsBlocksData)).toBe(true);
  });

  it('refuses to overwrite a real block occupying idnum 17', () => {
    expect(() => buildRegisteredAirwall({ cls: 'terrains', id: 'wall' })).toThrow('图块编号 17 已被 wall 占用');
  });
});
