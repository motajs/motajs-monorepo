import type { Editor, Position, TextMarker } from "codemirror";
import type { TernServerInstance } from "./createTernServer";
import {
  SEMANTIC_TYPES_QUERY,
  type SemanticTypesQuery,
  type SemanticTypesQueryResult,
} from "./semanticTypesQuery";

export type TernSemanticKind =
  | "array"
  | "boolean"
  | "function"
  | "number"
  | "object"
  | "string"
  | "union";

interface SemanticTarget {
  from: Position;
  to: Position;
  text: string;
}

interface SemanticResult extends SemanticTarget {
  kind: TernSemanticKind;
  type: string;
}

interface SemanticTargetBatch {
  targets: SemanticTarget[];
  range: { from: number; to: number };
}

const IDENTIFIER = /^[A-Za-z_$][A-Za-z0-9_$]*$/;
const SEMANTIC_TOKEN_TYPES = new Set(["def", "property", "variable", "variable-2", "variable-3"]);
const MAX_QUERY_TOKENS = 600;
const CHANGE_UPDATE_DELAY = 180;
const VIEWPORT_UPDATE_DELAY = 32;

export function classifyTernType(type: string | undefined): TernSemanticKind | undefined {
  if (!type || type === "?" || type === "unknown") return undefined;
  if (type.includes("|")) return "union";
  if (/^fn\(/.test(type)) return "function";
  if (type === "number") return "number";
  if (type === "string") return "string";
  if (type === "bool" || type === "boolean") return "boolean";
  if (/^\[/.test(type)) return "array";
  return "object";
}

function collectVisibleTargets(editor: Editor): SemanticTargetBatch {
  const viewport = editor.getViewport();
  const viewportLines = Math.max(1, viewport.to - viewport.from);
  const margin = Math.max(20, viewportLines);
  const from = Math.max(0, viewport.from - margin);
  const requestedTo = Math.min(editor.lineCount(), viewport.to + margin);
  const targets: SemanticTarget[] = [];
  let coveredTo = requestedTo;
  for (let line = from; line < requestedTo; line += 1) {
    for (const token of editor.getLineTokens(line, true)) {
      const tokenTypes = token.type?.split(" ") ?? [];
      if (!tokenTypes.some((type) => SEMANTIC_TOKEN_TYPES.has(type))) continue;
      if (!IDENTIFIER.test(token.string)) continue;
      if (targets.length >= MAX_QUERY_TOKENS) {
        coveredTo = line;
        return { targets, range: { from, to: coveredTo } };
      }
      targets.push({
        from: { line, ch: token.start },
        to: { line, ch: token.end },
        text: token.string,
      });
    }
  }
  return { targets, range: { from, to: coveredTo } };
}

function requestTargetTypes(
  server: TernServerInstance,
  editor: Editor,
  targets: SemanticTarget[],
): Promise<Array<SemanticResult | undefined>> {
  if (targets.length === 0) return Promise.resolve([]);
  return new Promise((resolve) => {
    try {
      const end = targets.at(-1)!.to;
      const query: SemanticTypesQuery = {
        type: SEMANTIC_TYPES_QUERY,
        positions: targets.map((target) => target.to),
        end,
        fullDocs: true,
        file: "doc",
      };
      server.request(
        editor as never,
        query,
        (error, data: SemanticTypesQueryResult | undefined) => {
          if (error || !data) {
            console.warn("Tern semantic type query failed", error);
            resolve(targets.map(() => undefined));
            return;
          }
          resolve(targets.map((target, index) => {
            const type = data.types[index] ?? undefined;
            const kind = classifyTernType(type);
            return kind && type ? { ...target, kind, type } : undefined;
          }));
        },
        end,
      );
    } catch (error) {
      console.warn("Tern semantic type query could not be sent", error);
      resolve(targets.map(() => undefined));
    }
  });
}

export function attachTernSemanticHighlighting(options: {
  editor: Editor;
  server: TernServerInstance;
  enabled(): boolean;
}): () => void {
  const { editor, server, enabled } = options;
  let generation = 0;
  let timer: number | undefined;
  let marks: TextMarker[] = [];
  let updateInFlight = false;
  let updateQueued = false;
  let disposed = false;
  let coveredRange: { from: number; to: number } | undefined;

  const clearMarks = () => {
    marks.forEach((mark) => mark.clear());
    marks = [];
  };

  const update = async (requestGeneration: number) => {
    if (!enabled()) {
      clearMarks();
      return;
    }
    const batch = collectVisibleTargets(editor);
    const { targets } = batch;
    const results = await requestTargetTypes(server, editor, targets);
    if (requestGeneration !== generation || !enabled()) return;

    editor.operation(() => {
      clearMarks();
      marks = results.flatMap((result) => {
        if (!result || editor.getRange(result.from, result.to) !== result.text) return [];
        return [editor.markText(result.from, result.to, {
          className: `CodeMirror-Tern-semantic CodeMirror-Tern-semantic-${result.kind}`,
          attributes: { "data-tern-type": result.type },
          clearWhenEmpty: true,
        })];
      });
      coveredRange = batch.range;
    });
  };

  const flush = async () => {
    timer = undefined;
    if (updateInFlight) {
      updateQueued = true;
      return;
    }
    updateInFlight = true;
    do {
      updateQueued = false;
      await update(generation);
    } while (updateQueued && !disposed);
    updateInFlight = false;
  };

  const schedule = (delay: number, restartTimer: boolean) => {
    generation += 1;
    updateQueued = true;
    if (updateInFlight) return;
    if (timer != null) {
      if (!restartTimer) return;
      window.clearTimeout(timer);
    }
    timer = window.setTimeout(() => void flush(), delay);
  };
  const handleChange = () => {
    coveredRange = undefined;
    schedule(CHANGE_UPDATE_DELAY, true);
  };
  const handleViewportChange = () => {
    const viewport = editor.getViewport();
    const prefetchMargin = Math.max(4, Math.floor((viewport.to - viewport.from) / 2));
    if (
      coveredRange
      && viewport.from >= coveredRange.from + prefetchMargin
      && viewport.to <= coveredRange.to - prefetchMargin
    ) return;
    schedule(VIEWPORT_UPDATE_DELAY, false);
  };
  const handleSwapDoc = () => {
    clearMarks();
    coveredRange = undefined;
    schedule(0, true);
  };

  editor.on("change", handleChange);
  editor.on("viewportChange", handleViewportChange);
  editor.on("swapDoc", handleSwapDoc);
  schedule(0, false);

  return () => {
    disposed = true;
    generation += 1;
    updateQueued = false;
    if (timer != null) window.clearTimeout(timer);
    editor.off("change", handleChange);
    editor.off("viewportChange", handleViewportChange);
    editor.off("swapDoc", handleSwapDoc);
    clearMarks();
  };
}
