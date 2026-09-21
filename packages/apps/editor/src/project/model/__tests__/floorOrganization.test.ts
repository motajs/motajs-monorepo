import { describe, expect, it } from 'vitest';
import {
  buildFloorOrganizationTokens,
  floorMatchesQuery,
  moveFloorOrganizationToken,
  organizationFromTokens,
  partitionContainingFloor,
  validateFloorOrganization,
} from '../floorOrganization';

describe('floorOrganization', () => {
  it('round-trips ordered partitions through boundary tokens', () => {
    const floorIds = ['A', 'B', 'C', 'D'];
    const partitions: [string, string][] = [['B', 'C']];
    expect(organizationFromTokens(buildFloorOrganizationTokens(floorIds, partitions))).toEqual({
      floorIds,
      floorPartitions: partitions,
      diagnostics: [],
    });
  });

  it('changes membership when a floor crosses a boundary', () => {
    const tokens = buildFloorOrganizationTokens(['A', 'B', 'C'], [['A', 'B']]);
    const floorC = tokens.findIndex((token) => token.kind === 'floor' && token.floorId === 'C');
    const end = tokens.findIndex((token) => token.kind === 'boundary' && token.edge === 'end');
    const moved = moveFloorOrganizationToken(tokens, floorC, end);
    expect(organizationFromTokens(moved)).toEqual({
      floorIds: ['A', 'B', 'C'],
      floorPartitions: [['A', 'C']],
      diagnostics: [],
    });
  });

  it('drops an empty partition after its only floor moves out', () => {
    const tokens = buildFloorOrganizationTokens(['A', 'B'], [['A', 'A']]);
    const floorA = tokens.findIndex((token) => token.kind === 'floor' && token.floorId === 'A');
    const end = tokens.findIndex((token) => token.kind === 'boundary' && token.edge === 'end');
    const moved = moveFloorOrganizationToken(tokens, floorA, end + 1);
    expect(organizationFromTokens(moved).floorPartitions).toEqual([]);
  });

  it('diagnoses missing, reversed and overlapping partitions', () => {
    expect(validateFloorOrganization(['A', 'B'], [['A', 'missing']]).valid).toBe(false);
    expect(validateFloorOrganization(['A', 'B'], [['B', 'A']]).valid).toBe(false);
    expect(
      validateFloorOrganization(
        ['A', 'B', 'C'],
        [
          ['A', 'B'],
          ['B', 'C'],
        ],
      ).valid,
    ).toBe(false);
  });

  it('matches a floor by id, title or status name', () => {
    const floor = { id: 'MT10', title: '主塔十层', name: '10F' };
    expect(floorMatchesQuery(floor, 'mt1')).toBe(true);
    expect(floorMatchesQuery(floor, '十层')).toBe(true);
    expect(floorMatchesQuery(floor, '10f')).toBe(true);
    expect(floorMatchesQuery(floor, '地牢')).toBe(false);
  });

  it('returns no partition for an unpartitioned floor', () => {
    expect(partitionContainingFloor(['A', 'B'], [], 'A')).toBeUndefined();
    expect(partitionContainingFloor(['A', 'B'], [['A', 'A']], 'B')).toBeUndefined();
    expect(partitionContainingFloor(['A', 'B'], [['A', 'A']], 'A')).toBe(0);
  });
});
