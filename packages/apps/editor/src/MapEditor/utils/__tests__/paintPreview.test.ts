import { describe, expect, it } from "vitest";
import { createPaintPreviewFloor, resolvePaintPositions } from "../paintPreview";

const layer = [
  [0, 0, 1, 1],
  [0, 0, 1, 1],
  [0, 0, 0, 0],
];

describe("map paint preview", () => {
  it("resolves line, rectangle, and fill positions independently of material type", () => {
    expect(resolvePaintPositions({
      brush: "line",
      start: [0, 0],
      end: [2, 1],
      path: [[0, 0], [1, 0], [2, 0], [2, 1]],
      tileSize: [1, 1],
      layerMap: layer,
      floorWidth: 4,
      floorHeight: 3,
    })).toEqual([[0, 0], [1, 0], [2, 0], [2, 1]]);

    expect(resolvePaintPositions({
      brush: "rectangle",
      start: [0, 0],
      end: [1, 1],
      path: [[0, 0]],
      tileSize: [1, 1],
      layerMap: layer,
      floorWidth: 4,
      floorHeight: 3,
    })).toEqual([[0, 0], [1, 0], [0, 1], [1, 1]]);

    expect(resolvePaintPositions({
      brush: "fill",
      start: [0, 0],
      end: [3, 2],
      path: [[0, 0]],
      tileSize: [2, 2],
      layerMap: layer,
      floorWidth: 4,
      floorHeight: 3,
    })).toEqual(expect.arrayContaining([[0, 0], [1, 0], [0, 1], [1, 1], [0, 2], [1, 2], [2, 2], [3, 2]]));
  });

  it("renders the exact repeated tileset values without mutating the source floor", () => {
    const floor = {
      width: 4,
      height: 3,
      map: layer.map((row) => [...row]),
      bgmap: layer.map((row) => row.map(() => 0)),
      fgmap: layer.map((row) => row.map(() => 0)),
    };
    const source = floor.map.map((row) => [...row]);
    const positions = [[0, 0], [1, 0], [0, 1], [1, 1]] as const;
    const preview = createPaintPreviewFloor(
      floor,
      "map",
      positions,
      [0, 0],
      { idnum: 10000, id: "X10000", images: "tiles.png", x: 0, y: 0, isTile: true },
      { startIdnum: 10000, sourceX: 0, sourceY: 0, width: 2, height: 2, columns: 4, rows: 4 },
    );

    expect(preview.map?.slice(0, 2).map((row) => row.slice(0, 2))).toEqual([
      [10000, 10001],
      [10004, 10005],
    ]);
    expect(floor.map).toEqual(source);
  });

  it("previews a configured layer that is not present on the floor yet", () => {
    const floor = { floorId: "sample", width: 2, height: 2, map: [[0, 0], [0, 0]] };
    const preview = createPaintPreviewFloor(
      floor,
      "bg2map",
      [[1, 0]],
      [1, 0],
      { idnum: 7, id: "grass", images: "terrains", x: 0, y: 0 },
    );

    expect(preview.bg2map).toEqual([[0, 7], [0, 0]]);
    expect(floor).not.toHaveProperty("bg2map");
  });
});
