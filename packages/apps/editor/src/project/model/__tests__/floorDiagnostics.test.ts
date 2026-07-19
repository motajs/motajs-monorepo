import type { FloorData } from "@/types/game";
import { describe, expect, it } from "vitest";
import { buildFloorDiagnostics } from "../floorDiagnostics";

function floor(weather: unknown): FloorData {
  return {
    floorId: "sample0",
    width: 13,
    height: 13,
    ratio: 1,
    weather,
  } as FloorData;
}

describe("floor weather diagnostics", () => {
  it("accepts custom weather names with an integer level", () => {
    expect(buildFloorDiagnostics(floor(["blood", 3]), "sample0")).toEqual([]);
  });

  it("reports tuple shape and level errors separately", () => {
    expect(buildFloorDiagnostics(floor(["rain"]), "sample0")).toContainEqual(expect.objectContaining({
      source: "floor:weather",
      code: "floor.weather.shape",
    }));
    expect(buildFloorDiagnostics(floor(["rain", 11]), "sample0")).toContainEqual(expect.objectContaining({
      source: "floor:weather",
      code: "floor.weather.level",
    }));
  });
});
