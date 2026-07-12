import type { Content } from "@/fs/types";
import type { ImageAssetSnapshot } from "@/project/assets";
import {
  buildFloorPassability,
  buildTilesetCatalog,
  canMove,
  type RegistryBlockInfo,
  tilesetCellIdnum,
} from "@/project/model/projectModel";
import { describe, expect, it } from "vitest";

function png(width: number, height: number): Uint8Array {
  const bytes = new Uint8Array(24);
  bytes.set([137, 80, 78, 71, 13, 10, 26, 10]);
  bytes.set([0, 0, 0, 13, 73, 72, 68, 82], 8);
  new DataView(bytes.buffer).setUint32(16, width);
  new DataView(bytes.buffer).setUint32(20, height);
  return bytes;
}

describe("map editor project models", () => {
  it("builds tileset ranges from PNG dimensions", () => {
    const images = new Map<string, Content<ImageAssetSnapshot>>([
      ["project/tilesets/one.png", { status: "loaded", value: { bytes: png(96, 64), revision: 1 } }],
      ["project/tilesets/two.png", { status: "loaded", value: { bytes: png(32, 32), revision: 1 } }],
    ]);
    const content = buildTilesetCatalog(["one.png", "two.png"], images);
    expect(content.status).toBe("loaded");
    if (content.status !== "loaded") return;
    expect(content.value.entries[0]).toMatchObject({ startIdnum: 10000, columns: 3, rows: 2 });
    expect(content.value.entries[1]).toMatchObject({ startIdnum: 20000, columns: 1, rows: 1 });
    expect(tilesetCellIdnum(content.value.entries[0], 2, 1)).toBe(10005);
  });

  it("reports invalid tileset dimensions without exposing an entry", () => {
    const images = new Map<string, Content<ImageAssetSnapshot>>([
      ["project/tilesets/bad.png", { status: "loaded", value: { bytes: png(33, 32), revision: 1 } }],
    ]);
    const content = buildTilesetCatalog(["bad.png"], images);
    expect(content).toMatchObject({ status: "loaded" });
    if (content.status !== "loaded") return;
    expect(content.value.entries).toEqual([]);
    expect(content.value.diagnostics[0]?.message).toContain("multiples of 32");
  });

  it("computes floor, loc and block directional restrictions", () => {
    const registry = new Map<number, RegistryBlockInfo>([
      [1, { idnum: 1, id: "arrow", kind: "terrain", cannotOut: ["right"] }],
      [2, { idnum: 2, id: "gate", kind: "terrain", cannotIn: ["left"] }],
    ]);
    const floor = {
      width: 3,
      height: 2,
      map: [[1, 0, 0], [0, 2, 0]],
      bgmap: [[0, 0, 0], [0, 0, 0]],
      fgmap: [[0, 0, 0], [0, 0, 0]],
      cannotMove: { "1,0": ["down"] },
      cannotMoveIn: { "2,0": ["left"] },
    };
    const model = buildFloorPassability(floor, registry);
    expect(canMove(model, 0, 0, "left")).toBe(false);
    expect(canMove(model, 0, 0, "right")).toBe(false);
    expect(canMove(model, 1, 0, "down")).toBe(false);
    expect(canMove(model, 1, 0, "right")).toBe(false);
    expect(canMove(model, 0, 1, "right")).toBe(false);
    expect(canMove(model, 2, 1, "left")).toBe(true);
  });

  it("preserves mota-js one-way arrow entry and exit semantics", () => {
    const registry = new Map<number, RegistryBlockInfo>([
      [161, {
        idnum: 161,
        id: "arrowUp",
        kind: "terrain",
        cannotOut: ["left", "right", "down"],
        cannotIn: ["up"],
      }],
    ]);
    const floor = {
      width: 3,
      height: 3,
      map: [[0, 0, 0], [0, 161, 0], [0, 0, 0]],
      bgmap: [[0, 0, 0], [0, 0, 0], [0, 0, 0]],
      fgmap: [[0, 0, 0], [0, 0, 0], [0, 0, 0]],
    };
    const model = buildFloorPassability(floor, registry);

    expect(model.cells[1][1].allowed).toEqual(["up"]);
    expect(canMove(model, 0, 1, "right")).toBe(true);
    expect(canMove(model, 2, 1, "left")).toBe(true);
    expect(canMove(model, 1, 2, "up")).toBe(true);
    expect(canMove(model, 1, 0, "down")).toBe(false);
  });
});
