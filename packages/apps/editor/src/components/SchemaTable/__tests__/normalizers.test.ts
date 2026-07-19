import { describe, expect, it } from "vitest";
import {
  autoEventPagesNormalizer,
  nullableScalarOrListNormalizer,
  numericScalarOrListNormalizer,
  optionalColorNormalizer,
  optionalEventNormalizer,
  optionalPointNormalizer,
  optionalEventListNormalizer,
  optionalStringListNormalizer,
  optionalWeatherNormalizer,
  passabilityNormalizer,
} from "../normalizers";

describe("SchemaTable normalizers", () => {
  it("normalizes historical numeric scalar/list values into one editing list", () => {
    expect(numericScalarOrListNormalizer.toEdit({ present: true, value: 0 })).toEqual([]);
    expect(numericScalarOrListNormalizer.toEdit({ present: true, value: 6 })).toEqual([6]);
    expect(numericScalarOrListNormalizer.toEdit({ present: true, value: [6, 25] })).toEqual([6, 25]);
    expect(numericScalarOrListNormalizer.toRaw([6], { present: true, value: 6 })).toEqual({
      present: true,
      value: [6],
    });
    expect(numericScalarOrListNormalizer.toRaw([], { present: true, value: 0 })).toEqual({
      present: true,
      value: [],
    });
  });

  it("round-trips nullable scalar/list BGM values", () => {
    expect(nullableScalarOrListNormalizer.toEdit({ present: true, value: null })).toEqual([]);
    expect(nullableScalarOrListNormalizer.toEdit({ present: true, value: "a.mp3" })).toEqual(["a.mp3"]);
    expect(nullableScalarOrListNormalizer.toEdit({ present: true, value: ["a.mp3", "b.ogg"] })).toEqual(["a.mp3", "b.ogg"]);
    expect(nullableScalarOrListNormalizer.toRaw([], { present: false })).toEqual({ present: true, value: null });
    expect(nullableScalarOrListNormalizer.toRaw(["a.mp3"], { present: true, value: null })).toEqual({ present: true, value: "a.mp3" });
    expect(nullableScalarOrListNormalizer.toRaw(["a.mp3", "b.ogg"], { present: false })).toEqual({ present: true, value: ["a.mp3", "b.ogg"] });
  });

  it("uses missing rather than null when optional point/color editors clear", () => {
    expect(optionalPointNormalizer.toRaw(null, { present: true, value: [1, 2] })).toEqual({ present: false });
    expect(optionalColorNormalizer.toRaw(null, { present: true, value: [1, 2, 3] })).toEqual({ present: false });
  });

  it("rejects raw shapes it cannot normalize", () => {
    expect(() => nullableScalarOrListNormalizer.toEdit({ present: true, value: 7 })).toThrow();
    expect(() => optionalPointNormalizer.toEdit({ present: true, value: [1] })).toThrow();
    expect(() => optionalWeatherNormalizer.toEdit({ present: true, value: ["rain", 11] })).toThrow();
  });

  it("maps an optional weather tuple to a named editing record", () => {
    expect(optionalWeatherNormalizer.toEdit({ present: false })).toEqual({ type: "", level: 5 });
    expect(optionalWeatherNormalizer.toEdit({ present: true, value: null })).toEqual({ type: "", level: 5 });
    expect(optionalWeatherNormalizer.toEdit({ present: true, value: ["rain", 6] })).toEqual({ type: "rain", level: 6 });
    expect(optionalWeatherNormalizer.toRaw({ type: "blood", level: 3 }, { present: false })).toEqual({
      present: true,
      value: ["blood", 3],
    });
    expect(optionalWeatherNormalizer.toRaw({ type: "", level: 5 }, { present: true, value: ["rain", 6] })).toEqual({
      present: false,
    });
  });

  it("normalizes an optional string list without persisting an empty selection", () => {
    expect(optionalStringListNormalizer.toEdit({ present: false })).toEqual([]);
    expect(optionalStringListNormalizer.toRaw([], { present: true, value: ["up"] })).toEqual({ present: false });
    expect(optionalStringListNormalizer.toRaw(["left", "right"], { present: false })).toEqual({
      present: true,
      value: ["left", "right"],
    });
  });

  it("normalizes combined passability and omits empty member paths", () => {
    expect(passabilityNormalizer.toEdit({ present: false })).toEqual({ cannotOut: [], cannotIn: [] });
    expect(passabilityNormalizer.toEdit({
      present: true,
      value: { cannotOut: ["up"], cannotIn: ["custom"] },
    })).toEqual({ cannotOut: ["up"], cannotIn: ["custom"] });
    expect(passabilityNormalizer.toRaw({ cannotOut: [], cannotIn: ["left"] }, { present: false })).toEqual({
      present: true,
      value: { cannotIn: ["left"] },
    });
    expect(() => passabilityNormalizer.toEdit({ present: true, value: { cannotOut: 1 } })).toThrow("cannotOut");
  });

  it("normalizes optional event lists to missing when empty", () => {
    expect(optionalEventListNormalizer.toEdit({ present: false })).toEqual([]);
    expect(optionalEventListNormalizer.toEdit({ present: true, value: null })).toEqual([]);
    expect(optionalEventListNormalizer.toRaw(null, { present: true, value: [{ type: "comment" }] }))
      .toEqual({ present: false });
    expect(optionalEventListNormalizer.toRaw([], { present: true, value: [{ type: "comment" }] }))
      .toEqual({ present: false });
    expect(optionalEventListNormalizer.toRaw([{ type: "comment" }], { present: false }))
      .toEqual({ present: true, value: [{ type: "comment" }] });
    expect(() => optionalEventListNormalizer.toEdit({ present: true, value: {} })).toThrow();
  });

  it("preserves configured event objects while keeping the compact array form", () => {
    const configured = {
      trigger: "action",
      enable: true,
      noPass: false,
      data: [{ type: "comment", text: "configured" }],
    };
    expect(optionalEventNormalizer.toEdit({ present: true, value: configured })).toEqual(configured);
    expect(optionalEventNormalizer.toRaw(configured, { present: false })).toEqual({
      present: true,
      value: configured,
    });
    expect(optionalEventNormalizer.toRaw([], { present: true, value: configured })).toEqual({ present: false });
    expect(optionalEventNormalizer.toRaw([{ type: "comment" }], { present: false })).toEqual({
      present: true,
      value: [{ type: "comment" }],
    });
    expect(() => optionalEventNormalizer.toEdit({
      present: true,
      value: { trigger: "action", data: "invalid" },
    })).toThrow("configured event data");
  });

  it("normalizes auto-event page records into a sorted editable list", () => {
    expect(autoEventPagesNormalizer.toEdit({
      present: true,
      value: {
        3: null,
        1: { condition: "true", data: [] },
      },
    })).toEqual([
      { id: 1, value: { condition: "true", data: [] } },
      { id: 3, value: null },
    ]);
    expect(autoEventPagesNormalizer.toRaw([
      { id: 0, value: null },
      { id: 1, value: { condition: "flag:door", data: [] } },
    ], { present: false })).toEqual({
      present: true,
      value: {
        0: null,
        1: { condition: "flag:door", data: [] },
      },
    });
    expect(autoEventPagesNormalizer.toRaw([], { present: true, value: { 0: null } })).toEqual({ present: false });
    expect(() => autoEventPagesNormalizer.toEdit({ present: true, value: { page: null } })).toThrow("page id");
  });
});
