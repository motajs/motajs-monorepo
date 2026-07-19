import type { TowerData } from "@/services/tower";
import { describe, expect, it } from "vitest";
import { buildTowerDiagnostics } from "../towerDiagnostics";

function tower(overrides: Partial<TowerData> = {}): TowerData {
  return {
    main: { floorIds: ["sample0"] },
    firstData: {
      name: "sample_project",
      floorId: "sample0",
      hero: { lv: 1, hp: 1000, atk: 10, def: 10 },
    },
    values: { statusCanvasRowsOnMobile: 3 },
    ...overrides,
  };
}

describe("tower diagnostics", () => {
  it("accepts a valid project identity, initial floor and finite values", () => {
    expect(buildTowerDiagnostics(tower())).toEqual([]);
  });

  it("locates identifier, floor, numeric and range diagnostics on their sources", () => {
    const diagnostics = buildTowerDiagnostics(tower({
      firstData: {
        name: "bad project name",
        floorId: "missing",
        hero: { lv: 0, hp: Number.POSITIVE_INFINITY },
      },
      values: { statusCanvasRowsOnMobile: 6, lavaDamage: Number.NaN },
    }));
    expect(diagnostics).toEqual(expect.arrayContaining([
      expect.objectContaining({ source: "tower:firstData.name", code: "tower.name.invalid" }),
      expect.objectContaining({ source: "tower:firstData.floorId", code: "tower.initial-floor.invalid" }),
      expect.objectContaining({ source: "tower:firstData.hero.lv", code: "tower.hero.level" }),
      expect.objectContaining({ source: "tower:firstData.hero.hp", code: "tower.number.finite" }),
      expect.objectContaining({ source: "tower:values.lavaDamage", code: "tower.number.finite" }),
      expect.objectContaining({ source: "tower:values.statusCanvasRowsOnMobile", code: "tower.status.rows" }),
    ]));
  });
});
