import { describe, expect, it, vi } from "vitest";
import { ScriptDocumentRegistry } from "./scriptDocumentRegistry";

describe("ScriptDocumentRegistry", () => {
  it("keeps undo history isolated per open tab", () => {
    const registry = new ScriptDocumentRegistry();
    const first = registry.open("functions:first", "first");
    const second = registry.open("functions:second", "second");

    first.replaceRange(" edited", { line: 0, ch: 5 });
    second.replaceRange(" edited", { line: 0, ch: 6 });
    first.undo();

    expect(first.getValue()).toBe("first");
    expect(second.getValue()).toBe("second edited");
    expect(second.historySize().undo).toBeGreaterThan(0);
  });

  it("records loading another value as an undoable whole-document edit", () => {
    const registry = new ScriptDocumentRegistry();
    const document = registry.open("plugins:shop", "draft");
    document.clearHistory();

    registry.setValue("plugins:shop", "disk");
    document.undo();

    expect(document.getValue()).toBe("draft");
  });

  it("uses the data path as the Tern document name and preserves the Doc on rename", () => {
    const registry = new ScriptDocumentRegistry();
    const document = registry.open("plugins:oldName", "function () {}");
    const server = { addDoc: vi.fn(), delDoc: vi.fn() };
    registry.attachTern(server as never);

    registry.rename("plugins:oldName", "plugins:newName");

    expect(server.delDoc).toHaveBeenCalledWith("plugins:oldName");
    expect(server.addDoc).toHaveBeenLastCalledWith("plugins:newName", document);
    expect(registry.get("plugins:newName")).toBe(document);
  });

  it("binds every open Doc to one shared Tern server and unregisters the group", () => {
    const registry = new ScriptDocumentRegistry();
    const first = registry.open("functions:first", "function first() {}");
    const second = registry.open("plugins:second", "function second() {}");
    const server = { addDoc: vi.fn(), delDoc: vi.fn() };

    registry.attachTern(server as never);

    expect(server.addDoc.mock.calls).toEqual([
      ["functions:first", first],
      ["plugins:second", second],
    ]);

    const third = registry.open("functions:third", "function third() {}");
    expect(server.addDoc).toHaveBeenLastCalledWith("functions:third", third);

    registry.detachTern(server as never);
    expect(server.delDoc.mock.calls).toEqual([
      ["functions:first"],
      ["plugins:second"],
      ["functions:third"],
    ]);
  });
});
