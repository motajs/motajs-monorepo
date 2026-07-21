import { parse } from "acorn";
import beautifier from "js-beautify";

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
  const diagnostics: ScriptDiagnostic[] = [];
  try {
    validateFunctionSource(source);
  } catch (reason) {
    const error = reason as { message?: string; loc?: { line: number; column: number } };
    diagnostics.push({
      message: error.message ?? String(reason),
      line: error.loc?.line,
      column: error.loc ? error.loc.column + 1 : undefined,
      severity: "error",
    });
  }
  return diagnostics;
}
