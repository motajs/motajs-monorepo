import "./localization/zh-cn";
// Monaco 0.56 loads the TypeScript worker manager lazily. Its shared worker
// module also registers editor contributions and their singleton services, so
// load those registrations before the first standalone editor is created.
import "monaco-editor/internal/common/workers";
import * as monaco from "monaco-editor/editor/editor.api";
import * as monacoTypeScript from "monaco-editor/languages/features/typescript/register";
import "monaco-editor/languages/definitions/javascript/register";
import "monaco-editor/languages/definitions/typescript/register";
import "monaco-editor/languages/features/json/register";

import editorWorker from "monaco-editor/editor/editor.worker?worker";
import jsonWorker from "monaco-editor/languages/features/json/json.worker?worker";
import tsWorker from "monaco-editor/languages/features/typescript/ts.worker?worker";

import lightPlus from "./assets/code/light_plus.json";
import darkPlus from "./assets/code/dark_plus.json";

import jsTM from "./assets/code/javascript.tmGrammar.json";
import tsTM from "./assets/code/typescript.tmGrammar.json";

import onigasmURL from "onigasm/lib/onigasm.wasm?url";

import { loadWASM } from "onigasm";
import { Registry } from "monaco-textmate";
import { wireTmGrammars } from "monaco-editor-textmate";
import { once } from "lodash-es";

self.MonacoEnvironment = {
  getWorker(_, label) {
    if (label === "json") return new jsonWorker();
    if (label === "javascript" || label === "typescript") return new tsWorker();
    return new editorWorker();
  },
};

monaco.editor.defineTheme("light-plus", {
  ...(lightPlus as monaco.editor.IStandaloneThemeData),
});
monaco.editor.defineTheme("dark-plus", {
  ...(darkPlus as monaco.editor.IStandaloneThemeData),
});

monaco.editor.setTheme("dark-plus");

const grammars = new Map([
  ["javascript", "source.js"],
  ["typescript", "source.ts"],
]);

const grammarFiles = new Map<string, object>([
  ["source.js", jsTM],
  ["source.ts", tsTM],
]);

const registry = new Registry({
  getGrammarDefinition: async (scopeName) => {
    const content = grammarFiles.get(scopeName);
    if (!content) throw new Error(`Unknown TextMate grammar: ${scopeName}`);
    return { format: "json", content };
  },
});

const loadOnigasm = once(() => loadWASM(onigasmURL));

const configureJavascript = once(() => {
  const defaults = monacoTypeScript.javascriptDefaults;
  defaults.setEagerModelSync(true);
  defaults.setCompilerOptions({
    allowJs: true,
    allowNonTsExtensions: true,
    checkJs: true,
    noEmit: true,
    target: monacoTypeScript.ScriptTarget.ESNext,
    module: monacoTypeScript.ModuleKind.ESNext,
    moduleResolution: monacoTypeScript.ModuleResolutionKind.NodeJs,
  });
  defaults.setDiagnosticsOptions({
    // Script entries are stored as function expressions. Monaco parses a model
    // as a whole JS file, where an anonymous function expression would be a
    // false-positive syntax error; consumers provide their expression-aware gate.
    noSyntaxValidation: true,
    // Mota scripts are intentionally open JavaScript. The language service is
    // used for completion, hover, navigation, argument hints and semantic
    // coloring, while Acorn remains the sole correctness gate.
    noSemanticValidation: true,
    // Monaco reports refactor hints (unused locals, "convert constructor to
    // class", etc.) through the same marker channel as diagnostics. They are
    // useful in a typed application, but overwhelm legacy script entries and
    // make the validation count look like a correctness failure.
    noSuggestionDiagnostics: true,
  });
});

export const initializeMonaco = (): void => {
  configureJavascript();
  if (!document.getElementById("motajs-monaco-semantic-colors")) {
    const style = document.createElement("style");
    style.id = "motajs-monaco-semantic-colors";
    style.textContent = `
.monaco-editor .monaco-type-function { color: #795e26 !important; }
.monaco-editor .monaco-type-number { color: #26734d !important; }
.monaco-editor .monaco-type-string { color: #a31515 !important; }
.monaco-editor .monaco-type-boolean { color: #005cc5 !important; }
.monaco-editor .monaco-type-object { color: #005fb8 !important; }
:root[data-monaco-theme="dark"] .monaco-editor .monaco-type-function { color: #dcdcaa !important; }
:root[data-monaco-theme="dark"] .monaco-editor .monaco-type-number { color: #b5cea8 !important; }
:root[data-monaco-theme="dark"] .monaco-editor .monaco-type-string { color: #ce9178 !important; }
:root[data-monaco-theme="dark"] .monaco-editor .monaco-type-boolean { color: #569cd6 !important; }
:root[data-monaco-theme="dark"] .monaco-editor .monaco-type-object { color: #9cdcfe !important; }
`;
    document.head.appendChild(style);
  }
};

export const setupMonacoTextmate = async (editor: monaco.editor.IStandaloneCodeEditor) => {
  initializeMonaco();
  try {
    await loadOnigasm();
    await wireTmGrammars(
      monaco as unknown as Parameters<typeof wireTmGrammars>[0],
      registry,
      grammars,
      editor,
    );
  } catch {
    //
  }
};

const preloadRuntime = once(async () => {
  initializeMonaco();
  await loadOnigasm();
  const worker = await monacoTypeScript.getJavaScriptWorker();
  await worker();
});

/** Loads and starts Monaco's heavy runtime without requiring an editor surface. */
export const preloadMonacoRuntime = async (): Promise<void> => await preloadRuntime();
