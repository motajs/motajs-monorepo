import { describe, expect, it } from 'vitest';
import { createMaterialLayout } from '@/MapEditor/MaterialPanel/layout';

describe('material layout', () => {
  it('keeps the complete sheet size but normalizes animation frames to the first column', () => {
    const layout = createMaterialLayout({
      sourceSize: [128, 320],
      cellSize: [32, 32],
      mode: 'full',
      rowsPerColumn: 50,
    });
    expect(layout.displaySize).toEqual([128, 320]);
    expect(layout.displayToSource([3, 4])).toEqual([0, 4]);
    expect(layout.sourceToDisplay([2, 4])).toEqual([0, 4]);
  });

  it('folds 32px rows at the configured boundary', () => {
    const layout = createMaterialLayout({
      sourceSize: [128, 52 * 32],
      cellSize: [32, 32],
      mode: 'folded',
      rowsPerColumn: 50,
    });
    expect(layout.displaySize).toEqual([64, 1600]);
    expect(layout.sourceToDisplay([0, 49])).toEqual([0, 49]);
    expect(layout.sourceToDisplay([0, 50])).toEqual([1, 0]);
    expect(layout.displayToSource([1, 1])).toEqual([0, 51]);
  });

  it('uses the same row mapping for 48px materials', () => {
    const layout = createMaterialLayout({
      sourceSize: [128, 7 * 48],
      cellSize: [32, 48],
      mode: 'folded',
      rowsPerColumn: 3,
    });
    expect(layout.displaySize).toEqual([96, 144]);
    expect(layout.sourceToDisplay([0, 3])).toEqual([1, 0]);
    expect(layout.displayToSource([2, 0])).toEqual([0, 6]);
  });

  it('collapses a single autotile to one representative cell', () => {
    const layout = createMaterialLayout({
      sourceSize: [96, 128],
      cellSize: [32, 32],
      mode: 'folded',
      rowsPerColumn: 50,
      kind: 'single',
    });
    expect(layout.displaySize).toEqual([32, 32]);
    expect(layout.displayToSource([2, 3])).toEqual([0, 0]);
  });

  it('never folds spatial tilesets', () => {
    const layout = createMaterialLayout({
      sourceSize: [320, 192],
      cellSize: [32, 32],
      mode: 'folded',
      rowsPerColumn: 2,
      kind: 'spatial',
    });
    expect(layout.displaySize).toEqual([320, 192]);
    expect(layout.displayToSource([7, 4])).toEqual([7, 4]);
    expect(layout.sourceToDisplay([7, 4])).toEqual([7, 4]);
  });

  it('supports the virtual terrain prefix used by clear and airwall', () => {
    const layout = createMaterialLayout({
      sourceSize: [32, 5 * 32],
      cellSize: [32, 32],
      mode: 'folded',
      rowsPerColumn: 3,
    });
    expect(layout.sourceToDisplay([0, 0])).toEqual([0, 0]);
    expect(layout.sourceToDisplay([0, 1])).toEqual([0, 1]);
    expect(layout.sourceToDisplay([0, 2])).toEqual([0, 2]);
    expect(layout.sourceToDisplay([0, 3])).toEqual([1, 0]);
  });
});
