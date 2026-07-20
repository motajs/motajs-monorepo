import type { Editor, EditorChange, KeyMap, Position } from "codemirror";
import type { TypeQuery, TypeQueryResult } from "tern";
import type { TernServerInstance } from "./createTernServer";
import { attachTernSemanticHighlighting } from "./ternSemanticHighlighting";
import { createLocallyFilteredHint } from "./ternCompletionCache";

const COMPLETION_OPEN_DELAY = 120;

interface HoverTarget {
  line: number;
  start: number;
  end: number;
  clientX: number;
  clientY: number;
}

function sameTarget(left: HoverTarget | null, right: HoverTarget): boolean {
  return left?.line === right.line && left.start === right.start && left.end === right.end;
}

function requestType(
  server: TernServerInstance,
  editor: Editor,
  position: Position,
  callback: (error?: Error, data?: TypeQueryResult) => void,
): void {
  const query: TypeQuery = {
    type: "type",
    file: "doc",
    end: position,
    preferFunction: false,
  };
  server.request(
    editor as never,
    query,
    (error, data: TypeQueryResult | undefined) => callback(
      error ? new Error(String(error)) : undefined,
      data,
    ),
    position,
  );
}

function createTypeTooltip(data: TypeQueryResult, target: HoverTarget): HTMLDivElement {
  const tooltip = document.createElement("div");
  tooltip.className = "CodeMirror-Tern-tooltip editorTernHoverTooltip";
  tooltip.dataset.testId = "tern-hover-tooltip";

  const type = document.createElement("strong");
  type.textContent = data.type || "unknown";
  tooltip.append(type);
  if (data.doc) {
    const documentation = document.createElement("span");
    documentation.textContent = ` — ${data.doc}`;
    tooltip.append(documentation);
  }
  document.body.append(tooltip);

  const margin = 8;
  const box = tooltip.getBoundingClientRect();
  tooltip.style.left = `${Math.max(margin, Math.min(target.clientX + 12, window.innerWidth - box.width - margin))}px`;
  tooltip.style.top = `${Math.max(margin, Math.min(target.clientY + 16, window.innerHeight - box.height - margin))}px`;
  return tooltip;
}

export function attachTernEditorInteractions(options: {
  editor: Editor;
  server: TernServerInstance;
  getAutocomplete(): boolean;
}): () => void {
  const { editor, server, getAutocomplete } = options;
  const wrapper = editor.getWrapperElement();
  let hoverTimer: number | undefined;
  let hoverRequest = 0;
  let hoverTarget: HoverTarget | null = null;
  let hoverHighlight: HTMLDivElement | null = null;
  let hoverTooltip: HTMLDivElement | null = null;
  let completionTimer: number | undefined;

  const serverWithHint = server as TernServerInstance & {
    getHint: ((editor: Editor, callback: (hints: import("codemirror").Hints | null | undefined) => void) => void) & {
      async: true;
    };
  };
  const originalHint = serverWithHint.getHint.bind(serverWithHint) as typeof serverWithHint.getHint;
  originalHint.async = true;
  const localCompletion = createLocallyFilteredHint(originalHint);
  serverWithHint.getHint = localCompletion.hint;

  const completionIsActive = () => Boolean((editor.state as typeof editor.state & {
    completionActive?: unknown;
  }).completionActive);

  const clearCompletionTimer = () => {
    if (completionTimer != null) window.clearTimeout(completionTimer);
    completionTimer = undefined;
  };

  const clearHover = () => {
    hoverRequest += 1;
    if (hoverTimer != null) window.clearTimeout(hoverTimer);
    hoverTimer = undefined;
    hoverTarget = null;
    hoverHighlight?.remove();
    hoverHighlight = null;
    hoverTooltip?.remove();
    hoverTooltip = null;
    delete wrapper.dataset.ternHoverType;
  };

  const handleCursorActivity = () => {
    if (getAutocomplete()) server.updateArgHints(editor);
  };

  const handleInputRead = (_editor: Editor, change: EditorChange) => {
    if (!getAutocomplete()) return;
    if (completionIsActive()) return;
    const inserted = change.text.join("\n");
    const lastCharacter = inserted.at(-1);
    if (!lastCharacter || !/[A-Za-z_.]/.test(lastCharacter)) {
      clearCompletionTimer();
      return;
    }
    clearCompletionTimer();
    if (lastCharacter === ".") {
      server.complete(editor);
      return;
    }
    completionTimer = window.setTimeout(() => {
      completionTimer = undefined;
      if (!completionIsActive() && getAutocomplete()) server.complete(editor);
    }, COMPLETION_OPEN_DELAY);
  };

  const handleMouseMove = (event: globalThis.MouseEvent) => {
    if (!getAutocomplete()) {
      clearHover();
      return;
    }
    const position = editor.coordsChar({ left: event.clientX, top: event.clientY }, "window");
    const token = editor.getTokenAt(position, true);
    if (!token.string.trim() || position.ch < token.start || position.ch > token.end) {
      clearHover();
      return;
    }
    const target: HoverTarget = {
      line: position.line,
      start: token.start,
      end: token.end,
      clientX: event.clientX,
      clientY: event.clientY,
    };
    if (sameTarget(hoverTarget, target)) return;
    clearHover();
    hoverTarget = target;
    const startCoords = editor.charCoords({ line: target.line, ch: target.start }, "window");
    const endCoords = editor.charCoords({ line: target.line, ch: target.end }, "window");
    const wrapperBox = wrapper.getBoundingClientRect();
    hoverHighlight = document.createElement("div");
    hoverHighlight.className = "CodeMirror-tern-hover-token";
    hoverHighlight.style.left = `${startCoords.left - wrapperBox.left}px`;
    hoverHighlight.style.top = `${startCoords.top - wrapperBox.top}px`;
    hoverHighlight.style.width = `${Math.max(1, endCoords.left - startCoords.left)}px`;
    hoverHighlight.style.height = `${Math.max(1, startCoords.bottom - startCoords.top)}px`;
    wrapper.append(hoverHighlight);
    const requestId = hoverRequest;
    hoverTimer = window.setTimeout(() => {
      requestType(server, editor, { line: target.line, ch: position.ch }, (error, data) => {
        if (requestId !== hoverRequest) return;
        if (error || !data || (!data.type && !data.doc)) return;
        wrapper.dataset.ternHoverType = data.type ?? "unknown";
        hoverTooltip?.remove();
        hoverTooltip = createTypeTooltip(data, target);
      });
    }, 280);
  };

  const completionKeys: KeyMap = {
    "Ctrl-Space": () => server.complete(editor),
    "Cmd-Space": () => server.complete(editor),
  };

  editor.addKeyMap(completionKeys);
  const detachSemanticHighlighting = attachTernSemanticHighlighting({
    editor,
    server,
    enabled: getAutocomplete,
  });
  editor.on("cursorActivity", handleCursorActivity);
  editor.on("inputRead", handleInputRead);
  const handleBlur = () => clearHover();
  const handleScroll = () => clearHover();
  const handleMouseLeave = () => clearHover();
  editor.on("blur", handleBlur);
  editor.on("scroll", handleScroll);
  const handleEndCompletion = () => localCompletion.clear();
  editor.on("endCompletion", handleEndCompletion);
  wrapper.addEventListener("mousemove", handleMouseMove);
  wrapper.addEventListener("mouseleave", handleMouseLeave);

  return () => {
    clearHover();
    clearCompletionTimer();
    localCompletion.clear();
    serverWithHint.getHint = originalHint;
    detachSemanticHighlighting();
    editor.removeKeyMap(completionKeys);
    editor.off("cursorActivity", handleCursorActivity);
    editor.off("inputRead", handleInputRead);
    editor.off("blur", handleBlur);
    editor.off("scroll", handleScroll);
    editor.off("endCompletion", handleEndCompletion);
    wrapper.removeEventListener("mousemove", handleMouseMove);
    wrapper.removeEventListener("mouseleave", handleMouseLeave);
  };
}
