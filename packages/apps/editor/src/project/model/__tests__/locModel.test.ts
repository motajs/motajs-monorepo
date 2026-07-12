import { describe, expect, it } from "vitest";

import {
  getAutoEventPageIds,
  getLocDataFromFloor,
  locKey,
  resolveLocTarget,
  summarizeLocData,
} from "@/project/model/locModel";
import type { FloorData } from "@/types";

describe("locModel", () => {
  it("resolves a loc target from selection and fallback floor", () => {
    expect(resolveLocTarget({ pos: { x: 2, y: 10 } }, "sample0")).toEqual({
      floorId: "sample0",
      pos: { x: 2, y: 10 },
      key: "2,10",
    });

    expect(resolveLocTarget({ floorId: "sample1", pos: { x: 4, y: 5 } }, "sample0")).toEqual({
      floorId: "sample1",
      pos: { x: 4, y: 5 },
      key: "4,5",
    });

    expect(resolveLocTarget(null, "sample0")).toBeNull();
    expect(resolveLocTarget({ pos: { x: 0, y: 0 } })).toBeNull();
  });

  it("extracts all loc fields for a coordinate", () => {
    const floor = {
      floorId: "sample0",
      events: { "2,10": [{ type: "comment", text: "event" }] },
      autoEvent: { "2,10": { 2: { condition: "true", data: [] } } },
      changeFloor: { "1,1": { floorId: "sample1" } },
      cannotMove: { "2,10": ["up"] },
    } satisfies FloorData;

    expect(locKey({ x: 2, y: 10 })).toBe("2,10");
    expect(getLocDataFromFloor(floor, { x: 2, y: 10 })).toEqual({
      events: [{ type: "comment", text: "event" }],
      autoEvent: { 2: { condition: "true", data: [] } },
      changeFloor: null,
      beforeBattle: null,
      afterBattle: null,
      afterGetItem: null,
      afterOpenDoor: null,
      cannotMove: ["up"],
    });
  });

  it("summarizes active fields and autoEvent pages", () => {
    const locData = {
      events: [],
      autoEvent: { 3: null, 2: { condition: "true", data: [] } },
      changeFloor: { floorId: "sample1" },
      beforeBattle: null,
      afterBattle: undefined,
      afterGetItem: {},
      afterOpenDoor: "open",
      cannotMove: ["up"],
    };

    expect(getAutoEventPageIds(locData)).toEqual(["2", "3"]);
    expect(summarizeLocData(locData)).toEqual({
      activeFields: ["autoEvent", "changeFloor", "afterOpenDoor", "cannotMove"],
      autoEventPageIds: ["2", "3"],
    });
  });
});
