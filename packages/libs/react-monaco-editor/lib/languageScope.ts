import "./localization/zh-cn";
import * as monacoApi from "monaco-editor/editor/editor.api";
import * as monacoTypeScript from "monaco-editor/languages/features/typescript/register";
import { initializeMonaco } from "./setup";

export interface MonacoExtraLibrary {
  path: string;
  content: string;
}

export class MonacoLanguageLibraryScope {
  private disposables: monacoApi.IDisposable[] = [];
  readonly id: string;

  constructor(id: string) {
    this.id = id;
    initializeMonaco();
  }

  replace(libraries: readonly MonacoExtraLibrary[]): void {
    this.clear();
    this.disposables = libraries.map((library) => (
      monacoTypeScript.javascriptDefaults.addExtraLib(library.content, library.path)
    ));
  }

  clear(): void {
    for (const disposable of this.disposables) disposable.dispose();
    this.disposables = [];
  }

  dispose(): void {
    this.clear();
  }
}

export function setMonacoTheme(theme: "light" | "dark"): void {
  monacoApi.editor.setTheme(theme === "dark" ? "dark-plus" : "light-plus");
  document.documentElement.dataset.monacoTheme = theme;
}

type SemanticKind = "function" | "number" | "string" | "boolean" | "object";

interface QuickInfoLike {
  kind?: string;
  displayParts?: Array<{ text?: string }>;
}

function quickInfoKind(info: QuickInfoLike | undefined): SemanticKind | undefined {
  const display = Array.isArray(info?.displayParts)
    ? info.displayParts.map((part: { text?: string }) => part.text ?? "").join("")
    : "";
  if (info?.kind && ["function", "method", "constructor"].includes(info.kind)) return "function";
  const type = display.split(":").slice(1).join(":").trim();
  if (/^(?:\([^)]*\)|[^=]+)\s*=>|^typeof\s|\bFunction\b/.test(type)) return "function";
  if (/^number\b/.test(type)) return "number";
  if (/^string\b/.test(type)) return "string";
  if (/^boolean\b/.test(type)) return "boolean";
  if (/^(?:Record<|\{|\[|[A-Z][\w$]*(?:<|\b))/.test(type)) return "object";
  return undefined;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function isUsedAsCallable(model: monacoApi.editor.ITextModel, name: string): boolean {
  if (["function", "if", "for", "while", "switch", "catch", "return", "new", "typeof"].includes(name)) return false;
  return new RegExp(`\\b${escapeRegExp(name)}\\s*\\(`).test(model.getValue());
}

function ignoredTokenAt(line: string, offset: number): boolean {
  const tokens = monacoApi.editor.tokenize(line, "javascript")[0] ?? [];
  let type = "";
  for (const token of tokens) {
    if (token.offset > offset) break;
    type = token.type;
  }
  return /(?:comment|string|keyword|number)/.test(type);
}

export function attachMonacoTypeSemanticHighlighting(
  editor: monacoApi.editor.IStandaloneCodeEditor,
): () => void {
  const decorations = editor.createDecorationsCollection();
  let generation = 0;
  let timer: number | undefined;
  let disposed = false;

  const update = async () => {
    const currentGeneration = ++generation;
    const model = editor.getModel();
    if (!model || model.getLanguageId() !== "javascript") return;
    const visible = editor.getVisibleRanges();
    const identifiers: Array<{ range: monacoApi.Range; offset: number; name: string }> = [];
    for (const range of visible) {
      for (let line = range.startLineNumber; line <= range.endLineNumber; line += 1) {
        const text = model.getLineContent(line);
        const matcher = /[A-Za-z_$][\w$]*/g;
        let match: RegExpExecArray | null;
        while ((match = matcher.exec(text)) && identifiers.length < 1000) {
          if (ignoredTokenAt(text, match.index)) continue;
          const startColumn = match.index + 1;
          const tokenRange = new monacoApi.Range(line, startColumn, line, startColumn + match[0].length);
          identifiers.push({ range: tokenRange, offset: model.getOffsetAt(tokenRange.getStartPosition()), name: match[0] });
        }
      }
    }
    try {
      const workerFactory = await monacoTypeScript.getJavaScriptWorker();
      const worker = await workerFactory(model.uri);
      const results = await Promise.all(identifiers.map(async (identifier) => ({
        range: identifier.range,
        name: identifier.name,
        info: await worker.getQuickInfoAtPosition(model.uri.toString(), identifier.offset),
      })));
      if (disposed || currentGeneration !== generation || editor.getModel() !== model) return;
      decorations.set(results.flatMap(({ range, name, info }) => {
        const kind = quickInfoKind(info) ?? (isUsedAsCallable(model, name) ? "function" : undefined);
        return kind ? [{ range, options: { inlineClassName: `monaco-type-semantic monaco-type-${kind}` } }] : [];
      }));
    } catch {
      // TypeScript worker diagnostics remain available even if optional coloring fails.
    }
  };
  const schedule = (delay: number) => {
    window.clearTimeout(timer);
    timer = window.setTimeout(() => void update(), delay);
  };
  const scroll = editor.onDidScrollChange(() => schedule(40));
  const content = editor.onDidChangeModelContent(() => schedule(180));
  const model = editor.onDidChangeModel(() => schedule(0));
  schedule(0);
  return () => {
    disposed = true;
    generation += 1;
    window.clearTimeout(timer);
    scroll.dispose();
    content.dispose();
    model.dispose();
    decorations.clear();
  };
}

export function getMonacoDiagnostics(model: monacoApi.editor.ITextModel): monacoApi.editor.IMarker[] {
  return monacoApi.editor.getModelMarkers({ resource: model.uri });
}

export async function formatMonacoDocument(editor: monacoApi.editor.IStandaloneCodeEditor): Promise<boolean> {
  const action = editor.getAction("editor.action.formatDocument");
  if (!action?.isSupported()) return false;
  await action.run();
  return true;
}

export function revealMonacoPosition(
  editor: monacoApi.editor.IStandaloneCodeEditor,
  line: number,
  column = 1,
  contextLines = 5,
): void {
  const model = editor.getModel();
  if (!model) return;
  const lineNumber = Math.max(1, Math.min(model.getLineCount(), line));
  const position = {
    lineNumber,
    column: Math.max(1, Math.min(model.getLineMaxColumn(lineNumber), column)),
  };
  editor.setPosition(position);
  editor.revealLineNearTop(Math.max(1, lineNumber - contextLines));
  editor.focus();
}

export const monaco = { ...monacoApi, typescript: monacoTypeScript };
export type MonacoEditorInstance = monacoApi.editor.IStandaloneCodeEditor;
export type MonacoTextModel = monacoApi.editor.ITextModel;
export type MonacoMarker = monacoApi.editor.IMarker;
