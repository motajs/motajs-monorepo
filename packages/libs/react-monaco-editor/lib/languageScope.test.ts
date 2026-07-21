// @vitest-environment jsdom

import { describe, expect, it } from "vitest";
import { monaco, MonacoLanguageLibraryScope, setMonacoTheme } from "./languageScope";

describe("MonacoLanguageLibraryScope", () => {
  it("loads Monaco's Simplified Chinese language pack", () => {
    expect((globalThis as typeof globalThis & { _VSCODE_NLS_LANGUAGE?: string })._VSCODE_NLS_LANGUAGE)
      .toBe("zh-cn");
  });

  it("filters legacy-script noise without disabling semantic diagnostics", () => {
    new MonacoLanguageLibraryScope("diagnostics").dispose();
    const options = monaco.typescript.javascriptDefaults.getDiagnosticsOptions();
    expect(options.noSemanticValidation).toBe(false);
    expect(options.noSuggestionDiagnostics).toBe(true);
    expect(options.diagnosticCodesToIgnore).toEqual(expect.arrayContaining([2322, 2403, 7044]));
  });

  it("replaces and releases scoped TypeScript extra libraries", () => {
    const scope = new MonacoLanguageLibraryScope("test");
    const path = "inmemory://motajs/test-language-scope.d.ts";

    scope.replace([{ path, content: "declare const first: string;" }]);
    expect(monaco.typescript.javascriptDefaults.getExtraLibs()[path]?.content).toContain("first");

    scope.replace([{ path, content: "declare const second: number;" }]);
    expect(monaco.typescript.javascriptDefaults.getExtraLibs()[path]?.content).toContain("second");

    scope.dispose();
    expect(monaco.typescript.javascriptDefaults.getExtraLibs()[path]).toBeUndefined();
  });

  it("synchronizes Monaco and document theme state", () => {
    setMonacoTheme("dark");
    expect(document.documentElement.dataset.monacoTheme).toBe("dark");
    setMonacoTheme("light");
    expect(document.documentElement.dataset.monacoTheme).toBe("light");
  });
});
