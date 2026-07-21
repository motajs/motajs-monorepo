import "../localization/zh-cn";
import messages from "typescript/lib/zh-cn/diagnosticMessages.generated.json";

// Monaco exposes the TypeScript instance used by its worker, but does not ship
// a declaration for this internal worker-only export.
// @ts-expect-error Worker compiler API has no public declaration file.
import { ts } from "monaco-editor/language/typescript/ts.worker.js";

ts.typescript.setLocalizedDiagnosticMessages(messages);
