import { describe, expect, it } from "vitest";

import {
  canCopyPastePrefab,
  getPrefabComment,
  getPrefabItemData,
  getPrefabType,
  resolvePrefabTarget,
} from "@/project/model/prefabModel";
import type { CommentObject } from "@/components/Table";

describe("prefabModel", () => {
  it("resolves enemy and item targets", () => {
    const enemy = resolvePrefabTarget({ images: "enemys", id: "greenSlime", idnum: 201 });
    expect(enemy).toMatchObject({
      type: "enemy",
      displayId: "greenSlime",
      dataKey: "greenSlime",
      registered: true,
    });
    expect(enemy && canCopyPastePrefab(enemy)).toBe(true);

    const item = resolvePrefabTarget({ images: "items", id: "yellowKey", idnum: 21 });
    expect(item).toMatchObject({
      type: "item",
      displayId: "yellowKey",
      dataKey: "yellowKey",
      registered: true,
    });
    expect(item && canCopyPastePrefab(item)).toBe(true);
  });

  it("resolves mapBlock and unregistered material targets", () => {
    const block = resolvePrefabTarget({ images: "terrains", id: "blueShop-left", idnum: 165 });
    expect(block).toMatchObject({
      type: "mapBlock",
      displayId: "blueShop-left",
      dataKey: "165",
      registered: true,
    });
    expect(block && canCopyPastePrefab(block)).toBe(false);

    const unregistered = resolvePrefabTarget({ images: "terrains", y: 99 });
    expect(unregistered).toMatchObject({
      type: "mapBlock",
      displayId: "",
      dataKey: null,
      registered: false,
    });
  });

  it("gets prefab data and comment schema by target", () => {
    const meta = {
      _data: {
        enemys: { enemyMeta: true },
        items: { itemMeta: true },
        maps: { mapMeta: true },
      },
    } as unknown as CommentObject;
    const enemy = resolvePrefabTarget({ images: "enemy48", id: "bigBat", idnum: 302 });
    const item = resolvePrefabTarget({ images: "items", id: "yellowKey", idnum: 21 });
    const block = resolvePrefabTarget({ images: "terrains", id: "ground", idnum: 0 });

    expect(getPrefabType({ images: "enemy48" })).toBe("enemy");
    expect(enemy && getPrefabItemData({ bigBat: { name: "Big Bat" } }, enemy)).toEqual({ name: "Big Bat" });
    expect(item && getPrefabComment(meta, item)).toEqual({ itemMeta: true });
    expect(block && getPrefabComment(meta, block)).toEqual({ mapMeta: true });
  });
});
