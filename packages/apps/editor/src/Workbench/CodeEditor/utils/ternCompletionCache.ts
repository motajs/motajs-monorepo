import type CodeMirror from "codemirror";

type AsyncHintProvider = ((
  editor: CodeMirror.Editor,
  callback: (hints: CodeMirror.Hints | null | undefined) => void,
) => void) & { async: true };

interface CompletionContext {
  doc: CodeMirror.Doc;
  key: string;
  prefix: string;
  from: CodeMirror.Position;
  to: CodeMirror.Position;
}

function completionContext(editor: CodeMirror.Editor): CompletionContext {
  const cursor = editor.getCursor();
  const line = editor.getLine(cursor.line);
  let from = cursor.ch;
  let to = cursor.ch;
  while (from > 0 && /[A-Za-z0-9_$]/.test(line[from - 1])) from -= 1;
  while (to < line.length && /[A-Za-z0-9_$]/.test(line[to])) to += 1;
  return {
    doc: editor.getDoc(),
    key: `${cursor.line}:${from}:${line.slice(0, from)}\0${line.slice(to)}`,
    prefix: line.slice(from, cursor.ch),
    from: { line: cursor.line, ch: from },
    to: { line: cursor.line, ch: to },
  };
}

function hintText(hint: CodeMirror.Hint | string): string {
  if (typeof hint === "string") return hint;
  return hint.displayText ?? hint.text;
}

function filterHints(hints: CodeMirror.Hints, context: CompletionContext): CodeMirror.Hints {
  const list = context.prefix
    ? hints.list.filter((hint) => hintText(hint).startsWith(context.prefix))
    : hints.list;
  return {
    ...hints,
    from: context.from,
    to: context.to,
    list,
  };
}

function deliverHints(
  editor: CodeMirror.Editor,
  callback: (hints: CodeMirror.Hints | null | undefined) => void,
  hints: CodeMirror.Hints | null | undefined,
): void {
  callback(hints);
  if (hints?.list.length) return;

  // show-hint keeps completionActive set when an async provider returns no
  // candidates. End that empty completion so later keystrokes may open a new
  // Tern request instead of being suppressed forever.
  queueMicrotask(() => editor.closeHint());
}

/**
 * Fetches an unfiltered Tern completion set once per popup context. Subsequent
 * edits to the current identifier are filtered synchronously in the browser.
 */
export function createLocallyFilteredHint(fetchHints: AsyncHintProvider): {
  clear(): void;
  hint: AsyncHintProvider;
} {
  let cached: { doc: CodeMirror.Doc; key: string; hints: CodeMirror.Hints } | undefined;
  let request = 0;

  const clear = () => {
    cached = undefined;
    request += 1;
  };

  const hint = ((editor, callback) => {
    const context = completionContext(editor);
    if (cached?.doc === context.doc && cached.key === context.key) {
      deliverHints(editor, callback, filterHints(cached.hints, context));
      return;
    }

    const requestId = ++request;
    fetchHints(editor, (hints) => {
      if (requestId !== request) {
        callback(undefined);
        return;
      }
      if (!hints) {
        deliverHints(editor, callback, hints);
        return;
      }
      cached = { doc: context.doc, key: context.key, hints };
      deliverHints(editor, callback, filterHints(hints, completionContext(editor)));
    });
  }) as AsyncHintProvider;
  hint.async = true;

  return { clear, hint };
}
