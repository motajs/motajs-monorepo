import { parse } from "acorn";
import beautifier from "js-beautify";
import { JSHINT } from "jshint";
import { JSHINT_OPTIONS } from "../CodeEditor/config/commands";

export interface ScriptDiagnostic {
  message: string;
  line?: number;
  column?: number;
  severity: "error" | "warning";
}

export function formatFunctionSource(source: string): string {
  return beautifier.js(source, {
    brace_style: "collapse",
    indent_with_tabs: true,
    jslint_happy: true,
  });
}

export function validateFunctionSource(source: string): void {
  const program = parse(`(${source}\n)`, { ecmaVersion: "latest", locations: true }) as unknown as {
    body: Array<{ type: string; expression?: { type?: string } }>;
  };
  const expression = program.body[0]?.expression;
  if (program.body.length !== 1 || !expression || !["FunctionExpression", "ArrowFunctionExpression"].includes(expression.type ?? "")) {
    throw new Error("源码必须是完整的 function、async/generator function 或箭头函数表达式");
  }
}

export function collectFunctionDiagnostics(source: string): ScriptDiagnostic[] {
  // JSHint otherwise interprets an anonymous function as a declaration and
  // reports a spurious "missing name" warning. Lint in expression context,
  // which is also the context used by the script serializer.
  const wrapperPrefix = "void (";
  const sourceLineCount = source.split("\n").length;
  JSHINT(`${wrapperPrefix}${source}\n);`, JSHINT_OPTIONS.options);
  const diagnostics: ScriptDiagnostic[] = [];
  for (const error of JSHINT.errors ?? []) {
    if (!error || error.line > sourceLineCount) continue;
    let severity: ScriptDiagnostic["severity"] = "warning";
    if (error.code?.startsWith("E")) severity = "error";
    let column = error.character;
    if (error.line === 1) column = Math.max(1, column - wrapperPrefix.length);
    diagnostics.push({
      message: error.reason,
      line: error.line,
      column,
      severity,
    });
  }

  try {
    validateFunctionSource(source);
  } catch (reason) {
    if (!diagnostics.some((diagnostic) => diagnostic.severity === "error")) {
      const error = reason as { message?: string; loc?: { line: number; column: number } };
      diagnostics.push({
        message: error.message ?? String(reason),
        line: error.loc?.line,
        column: error.loc ? error.loc.column + 1 : undefined,
        severity: "error",
      });
    }
  }
  return diagnostics;
}
