import { describe, expect, it } from "vitest";
import type { BlockRegistry, SpriteRegistry } from "@/project/model/projectModel";
import type { FloorData } from "@/types";
import { resolveDefaultGroundSprite } from "../spriteResolver";

const terrainGround = {
  key: "terrains:ground",
  id: "ground",
  images: "terrains",
  path: "project/materials/terrains.png",
  x: 0,
  y: 0,
  width: 32,
  height: 32,
};

const floor = (defaultGround?: string): FloorData => ({ defaultGround } as FloorData);

describe("resolveDefaultGroundSprite", () => {
  const blocks: BlockRegistry = new Map();
  const sprites: SpriteRegistry = new Map([["terrains:ground", terrainGround]]);
  const tilesets = ["one.png", "two.png", "three.png", "four.png"];

  it("resolves X ids through the registered tileset order", () => {
    expect(resolveDefaultGroundSprite(floor("X40001"), blocks, sprites, tilesets)).toMatchObject({
      id: "X40001",
      idnum: 40001,
      path: "project/tilesets/four.png",
      tilesetLocalIndex: 1,
    });
  });

  it("uses ground when the field is absent", () => {
    expect(resolveDefaultGroundSprite(floor(), blocks, sprites, tilesets)).toBe(terrainGround);
  });

  it("treats none as an intentional transparent background", () => {
    expect(resolveDefaultGroundSprite(floor("none"), blocks, sprites, tilesets)).toBeUndefined();
  });

  it("silently treats an unregistered default ground as transparent", () => {
    expect(resolveDefaultGroundSprite(floor("null"), blocks, sprites, tilesets)).toBeUndefined();
    expect(resolveDefaultGroundSprite(floor("projectCustomGround"), blocks, sprites, tilesets)).toBeUndefined();
  });
});
