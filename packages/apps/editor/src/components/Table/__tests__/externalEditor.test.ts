/** @vitest-environment jsdom */

import { describe, expect, it, vi } from "vitest";
import { openExternalEditor } from "../externalEditor";
import type { FieldConfig } from "../types";

describe("openExternalEditor", () => {
  it("opens structured events through EventEditor", () => {
    const open = vi.fn();
    const setValue = vi.fn();
    const initialValue = [{ type: "comment", text: "test" }];

    openExternalEditor("['startCanvas']", "event", { _event: "event" } as FieldConfig,
      () => initialValue, setValue, { eventEditor: { open } });

    expect(open).toHaveBeenCalledWith(expect.objectContaining({
      contextId: "table:['startCanvas']",
      entryType: "event",
      initialValue,
    }));
    open.mock.calls[0][0].onConfirm([{ type: "comment", text: "saved" }]);
    expect(setValue).toHaveBeenCalledWith("['startCanvas']", [{ type: "comment", text: "saved" }]);
  });

  it("round-trips function text through CodeEditor without JSON quoting", () => {
    const open = vi.fn();
    const setValue = vi.fn();

    openExternalEditor("['init']", "textarea", {} as FieldConfig,
      () => "function init () { return true; }", setValue, { codeEditor: { open } });

    expect(open).toHaveBeenCalledWith(expect.objectContaining({
      contextId: "table:['init']",
      initialValue: "function init () { return true; }",
    }));
    open.mock.calls[0][0].onConfirm("function init () { return false; }");
    expect(setValue).toHaveBeenCalledWith("['init']", "function init () { return false; }");
  });

  it("parses object text returned by CodeEditor", () => {
    const open = vi.fn();
    const setValue = vi.fn();

    openExternalEditor("['config']", "textarea", { _string: false } as FieldConfig,
      () => ({ enabled: false }), setValue, { codeEditor: { open } });
    open.mock.calls[0][0].onConfirm("{ enabled: true }");

    expect(setValue).toHaveBeenCalledWith("['config']", { enabled: true });
  });

  it("uses modern point, material and checkbox capabilities", async () => {
    const setValue = vi.fn();
    const selectPoint = vi.fn().mockResolvedValue({ floorId: "sample0", x: 7, y: 8 });
    openExternalEditor("['upFloor']", "point", {} as FieldConfig,
      () => [2, 3], setValue, { selectPoint });
    await vi.waitFor(() => expect(setValue).toHaveBeenCalledWith("['upFloor']", [7, 8]));

    const selectMaterial = vi.fn().mockResolvedValue(["bgm.mp3"]);
    openExternalEditor("['startBgm']", "material", {
      _directory: "./project/bgms/",
      _onconfirm: "function (_previous, current) { return current[0]; }",
    }, () => null, setValue, { selectMaterial });
    await vi.waitFor(() => expect(setValue).toHaveBeenCalledWith("['startBgm']", "bgm.mp3"));

    const checkboxSet = vi.fn().mockResolvedValue([]);
    openExternalEditor("['special']", "popCheckboxSet", {
      _checkboxSet: { key: [1], prefix: ["先攻"] },
    } as FieldConfig, () => [1], setValue, { checkboxSet });
    await vi.waitFor(() => expect(setValue).toHaveBeenCalledWith("['special']", 0));
  });

  it("does not fall back to legacy globals when a capability is absent", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    expect(() => openExternalEditor("field", "textarea", {} as FieldConfig, () => "value", vi.fn())).not.toThrow();
    expect(warn).toHaveBeenCalledWith("CodeEditor capability not available");
    warn.mockRestore();
  });
});
