import { describe, expect, it } from 'vitest';
import { collectFloorImagePaths, resolveFloorImageParts } from '../floorImages';

describe('floor images', () => {
  it('resolves mapped image paths and ignores disabled images', () => {
    expect(
      collectFloorImagePaths(
        [
          { name: '背景图', canvas: 'bg' },
          { name: 'hidden.png', canvas: 'fg', disabled: true },
        ],
        { 背景图: 'bg.jpg' },
      ),
    ).toEqual(['project/images/bg.jpg']);
  });

  it('uses pixel coordinates, crop fields, frame width and reverse', () => {
    const result = resolveFloorImageParts(
      [
        {
          name: 'animated.png',
          canvas: 'fg',
          x: 17,
          y: 23,
          sx: 4,
          sy: 6,
          w: 192,
          h: 80,
          frame: 3,
          reverse: ':x',
        },
      ],
      new Map([['project/images/animated.png', { width: 256, height: 128 }]]),
      {},
      2,
    );

    expect(result.diagnostics).toEqual([]);
    expect(result.parts).toEqual([
      expect.objectContaining({
        layer: 'fg',
        sourceX: 132,
        sourceY: 6,
        sourceWidth: 64,
        sourceHeight: 80,
        x: 17,
        y: 23,
        reverse: ':x',
      }),
    ]);
  });

  it('splits auto images at the bottom 32 pixels', () => {
    const result = resolveFloorImageParts(
      [{ name: 'tower.png', canvas: 'auto', x: 32, y: 64, sx: 8, sy: 12, w: 96, h: 80 }],
      new Map([['project/images/tower.png', { width: 96, height: 80 }]]),
    );

    expect(result.parts).toEqual([
      expect.objectContaining({ layer: 'fg', sourceY: 12, sourceHeight: 48, y: 64 }),
      expect.objectContaining({ layer: 'bg', sourceY: 60, sourceHeight: 32, y: 112 }),
    ]);
  });

  it('reports malformed canvas and undersized auto images without throwing', () => {
    const result = resolveFloorImageParts(
      [
        { name: 'bad.png', canvas: 'other' },
        { name: 'short.png', canvas: 'auto' },
      ],
      new Map([
        ['project/images/bad.png', { width: 32, height: 32 }],
        ['project/images/short.png', { width: 32, height: 16 }],
      ]),
    );

    expect(result.parts).toEqual([]);
    expect(result.diagnostics).toHaveLength(2);
  });
});
