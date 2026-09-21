import { describe, expect, it } from 'vitest';
import { fillModeBfs } from '../fillBfs';
import { rectanglePositions, walkOrthogonalPath } from '../brushGeometry';

describe('map brush geometry', () => {
  it('walks an adjacent orthogonal line to the pointer', () => {
    expect(walkOrthogonalPath([1, 1], [4, 3])).toEqual([
      [2, 1],
      [3, 1],
      [3, 2],
      [4, 2],
      [4, 3],
    ]);
  });

  it('normalizes reverse rectangle drags in row-major order', () => {
    expect(rectanglePositions([3, 2], [1, 1])).toEqual([
      [1, 1],
      [2, 1],
      [3, 1],
      [1, 2],
      [2, 2],
      [3, 2],
    ]);
  });

  it('fills only the connected region with the same idnum', () => {
    const map = [
      [1, 1, 0, 1],
      [1, 0, 0, 1],
      [1, 1, 1, 1],
    ];
    const result = fillModeBfs(map, 0, 0, 4, 3);
    expect(result).toHaveLength(9);
    expect(result).toEqual(
      expect.arrayContaining([
        [0, 0],
        [0, 1],
        [1, 0],
        [0, 2],
        [1, 2],
        [2, 2],
        [3, 2],
        [3, 1],
        [3, 0],
      ]),
    );
  });
});
