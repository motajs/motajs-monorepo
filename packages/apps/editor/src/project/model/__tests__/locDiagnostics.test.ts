import { describe, expect, it } from "vitest";
import type { LocData } from "../locModel";
import { buildLocDiagnostics } from "../locDiagnostics";

function loc(overrides: Partial<LocData> = {}): LocData {
  return {
    events: null,
    autoEvent: null,
    changeFloor: null,
    beforeBattle: null,
    afterBattle: null,
    afterGetItem: null,
    afterOpenDoor: null,
    cannotMove: null,
    cannotMoveIn: null,
    ...overrides,
  };
}

describe("loc diagnostics", () => {
  it("reports event/change-floor conflicts on both sources", () => {
    const diagnostics = buildLocDiagnostics(loc({
      events: [{ type: "comment" }],
      changeFloor: { floorId: "sample1" },
    }));
    expect(diagnostics.map((item) => item.source)).toEqual(["loc:events", "loc:changeFloor"]);
    expect(diagnostics.every((item) => item.severity === "warning")).toBe(true);
  });

  it("rejects unknown passability directions", () => {
    expect(buildLocDiagnostics(loc({ cannotMoveIn: ["north"] }))).toContainEqual(expect.objectContaining({
      source: "loc:cannotMoveIn",
      code: "loc.passability.shape",
    }));
  });
});
