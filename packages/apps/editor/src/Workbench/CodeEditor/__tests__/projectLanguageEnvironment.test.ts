import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@motajs/react-monaco-editor", () => ({
  MonacoLanguageLibraryScope: class {
    replace = vi.fn();
    dispose = vi.fn();
  },
  setMonacoTheme: vi.fn(),
}));

vi.mock("@/runtime/RuntimeContext", () => ({ useRuntimePreview: vi.fn() }));
vi.mock("@/stores/EditorStore", () => ({ EditorStore: { useStore: vi.fn() } }));

import {
  buildRuntimeSnapshotDeclaration,
  buildRuntimeCompatibilityDeclaration,
  composeCoreDeclaration,
} from "../projectLanguageEnvironment";

describe("project language environment", () => {
  beforeEach(() => vi.clearAllMocks());

  it("turns isolated runtime members and getSpecials results into declarations", () => {
    const declaration = buildRuntimeSnapshotDeclaration({
      core: [
        { name: "flyTo", kind: "function" },
        { name: "customState", kind: "object" },
        { name: "statusBarItems", kind: "array" },
      ],
      modules: {
        plugin: [{ name: "myPluginMethod", kind: "function" }],
      },
      catalogs: {
        "material.items": [{ name: "yellowKey", kind: "object" }],
        "status.maps": [{ name: "sample0", kind: "object" }],
      },
      specials: [{ id: 1, name: "先攻" }, { id: 27, name: "自定义属性" }],
    });

    expect(declaration).toContain("type MotaEnemySpecialId = 1 | 27");
    expect(declaration).toContain("\"flyTo\": (...args: any[]) => any");
    expect(declaration).toContain("\"plugin\": {");
    expect(declaration).toContain("\"myPluginMethod\": (...args: any[]) => any");
    expect(declaration).toContain("\"statusBarItems\": any[]");
    expect(declaration).toContain("\"yellowKey\": Record<string, any>");
    expect(declaration).toContain("\"sample0\": Record<string, any>");
  });

  it("keeps Tern and runtime snapshot declarations when runtime.d.ts is unavailable", () => {
    expect(composeCoreDeclaration("", ["__MotaTernCore", "MotaProjectRuntimeSnapshot"]))
      .toBe("declare let core: __MotaTernCore & MotaProjectRuntimeSnapshot;\n");
  });

  it("augments runtime.d.ts instead of replacing its formal core type", () => {
    expect(composeCoreDeclaration("interface core {}\ndeclare let core: core;", ["__MotaTernCore"]))
      .toContain("declare let core: core & __MotaTernCore;");
  });

  it("augments the project main global when runtime.d.ts declares it", () => {
    expect(composeCoreDeclaration("type main = {};\ndeclare let main: main;\ndeclare let core: core;", ["MotaRuntimeCompatibility"]))
      .toContain("declare let main: main & MotaMainRuntimeCompatibility;");
  });

  it("adds editor-only corrections without modifying runtime.d.ts", () => {
    const declaration = buildRuntimeCompatibilityDeclaration();
    expect(declaration).toContain("core: typeof core");
    expect(declaration).toContain("hero: typeof hero");
    expect(declaration).toContain("flags: typeof flags");
    expect(declaration).toContain("Sprite: any");
    expect(declaration).toContain("selectColor: string | number[]");
    expect(declaration).toContain("declare function parseInt(value: number");
    expect(declaration).toContain("declare const editor: any");
    expect(declaration).toContain("plugins_bb40132b_638b_4a9f_b028_d3fe47acc8d1");
  });
});
