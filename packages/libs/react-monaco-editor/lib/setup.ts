import * as monaco from "monaco-editor";

import editorWorker from "monaco-editor/esm/vs/editor/editor.worker?worker";
import jsonWorker from "monaco-editor/esm/vs/language/json/json.worker?worker";
import cssWorker from "monaco-editor/esm/vs/language/css/css.worker?worker";
import htmlWorker from "monaco-editor/esm/vs/language/html/html.worker?worker";
import tsWorker from "monaco-editor/esm/vs/language/typescript/ts.worker?worker";

import lightPlus from "@/assets/code/light_plus.json";
import darkPlus from "@/assets/code/dark_plus.json";

import jsTM from "@/assets/code/javascript.tmGrammar.json";
import tsTM from "@/assets/code/typescript.tmGrammar.json";

import onigasmURL from "onigasm/lib/onigasm.wasm?url";

import { loadWASM } from "onigasm";
import { Registry } from "monaco-textmate";
import { wireTmGrammars } from "monaco-editor-textmate";
import { once } from "lodash-es";

self.MonacoEnvironment = {
  getWorker(_, label) {
    if (label === "json") {
      return new jsonWorker();
    }
    if (label === "css" || label === "scss" || label === "less") {
      return new cssWorker();
    }
    if (label === "html" || label === "handlebars" || label === "razor") {
      return new htmlWorker();
    }
    if (label === "typescript" || label === "javascript") {
      return new tsWorker();
    }
    return new editorWorker();
  },
};

monaco.editor.defineTheme("light-plus", lightPlus as monaco.editor.IStandaloneThemeData);
monaco.editor.defineTheme("dark-plus", darkPlus as monaco.editor.IStandaloneThemeData);

monaco.editor.setTheme("dark-plus");

const grammars = new Map([
  ["javascript", "source.js"],
  ["typescript", "source.ts"],
]);

const grammarFiles = new Map<string, any>([
  ["source.js", jsTM],
  ["source.ts", tsTM],
]);

const registry = new Registry({
  getGrammarDefinition: async (scopeName) => ({
    format: "json",
    content: grammarFiles.get(scopeName),
  }),
});

const loadOnigasm = once(() => loadWASM(onigasmURL));

export const setupMonacoTSWorker = async (editor: monaco.editor.IStandaloneCodeEditor) => {
  try {
    await loadOnigasm();
    await wireTmGrammars(monaco, registry, grammars, editor);
  } catch {
    //
  }
};
