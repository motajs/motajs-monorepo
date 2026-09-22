# Phase 3: Kernel — Runtime, Ports, Registry, Diagnostics - Pattern Map

**Mapped:** 2026-09-22
**Files analyzed:** 21 (16 created, 5 modified)
**Analogs found:** 18 with matches / 21 (3 weak/no-analog: `ports/engine.ts`, `ports/preview.ts`, first-class `kernel/core.ts` composition root)

> **Scope guardrails — read before using this map.**
> - Phase 3 is **add-only** for `@motajs/editor` (D-13). No `packages/apps/editor/**` file is modified; editor files appear below only as **read-only analogs**.
> - Names are **confirmed** (N-01..N-26, `INTERFACE-NAME.md`). Use them verbatim — do not invent alternatives.
> - Class methods are written `ClassName.methodName` (AGENTS.md).
> - `@/` must **not** appear inside `packages/libs/editor-core/lib/**` (Phase-2 D-06 amended → extensionless **relative** imports only). Every core analog below uses extensionless relative imports (e.g. `lib/react/index.ts:1`).
> - Framing is engine-neutral: examples use `acme.thing`, never engine vocabulary (RESEARCH Pitfall 15).
> - Every analog path in this document is **git-tracked** source (verified with `git ls-files` this session).

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `packages/libs/editor-core/lib/kernel/core.ts` | composition-root / factory | request-response (construct + lifecycle) | `packages/apps/editor/src/runtime/RuntimeResourceGateway.ts` | role-match |
| `packages/libs/editor-core/lib/kernel/registry.ts` | registry / service | CRUD | `packages/apps/editor/src/blockly/registry/index.ts` | exact |
| `packages/libs/editor-core/lib/kernel/diagnostics.ts` | event bus / provider | pub-sub | `packages/apps/editor/src/utils/notify.ts` (**ANTI-analog**) + `RuntimeResourceGateway.ts` | anti + role-match |
| `packages/libs/editor-core/lib/kernel/errors.ts` | error class | transform | `packages/libs/h5animate/lib/errors.ts` | role-match |
| `packages/libs/editor-core/lib/ports/engine.ts` | port interface | request-response | `packages/apps/editor/src/runtime/protocol.ts` | weak (versioned entry shape only) |
| `packages/libs/editor-core/lib/ports/fs.ts` | port interface | file-I/O | `packages/apps/editor/src/services/fs/fs.ts` | exact |
| `packages/libs/editor-core/lib/ports/host.ts` | port interface | request-response | `packages/apps/editor/src/environment.ts` | role-match |
| `packages/libs/editor-core/lib/ports/preview.ts` | port interface | request-response | — | none |
| `packages/libs/editor-core/lib/ports/index.ts` | barrel | transform | `packages/libs/file2x/lib/index.ts` | exact |
| `packages/libs/editor-core/lib/index.ts` (modified) | barrel | transform | `packages/libs/react-hooks/lib/index.ts` | exact |
| `packages/libs/editor-core/lib/__tests__/capabilityRegistry.test.ts` | test | request-response | `packages/libs/editor-core/lib/__tests__/coreProbe.test.tsx` | role-match |
| `packages/libs/editor-core/lib/__tests__/diagnostics.test.ts` | test | pub-sub | `coreProbe.test.tsx` | role-match |
| `packages/libs/editor-core/lib/__tests__/coreStartup.test.ts` | test | request-response | `coreProbe.test.tsx` | role-match |
| `packages/libs/editor-core/lib/__tests__/coreLifecycle.test.ts` | test | request-response | `coreProbe.test.tsx` | role-match |
| `packages/libs/editor-core/lib/__tests__/coreIsolation.test.ts` | test | request-response | `coreProbe.test.tsx` | role-match |
| `packages/libs/editor-core/lib/__tests__/coreApiSurface.test.ts` | test | transform | `coreProbe.test.tsx` | role-match |
| `scripts/verify/coreModuleState.js` | verifier | batch | `scripts/verify/coreBoundaries.js` | exact |
| `eslint.config.js` (modified) | config | n/a | itself (root block) + `packages/apps/editor/eslint.config.js` | role-match |
| `.dependencyCruiser.cjs` (modified) | config | n/a | itself | exact |
| `.github/workflows/ci.yml` (modified) | config | n/a | itself | exact |
| `.planning/phases/02-package-boundary-build-scaffolding/subpathStatus.json` (modified) | config / manifest data | n/a | itself + `scripts/verify/coreExports.js` assertion | exact |

---

## Pattern Assignments

### `packages/libs/editor-core/lib/kernel/registry.ts` (registry, CRUD)

**Analog:** `packages/apps/editor/src/blockly/registry/index.ts` + `packages/apps/editor/src/blockly/registry/types.ts`

This is the **closest first-party precedent** for the D-02 contract. Copy the **result/diagnostic contract shape**, not the repair mechanics (RESEARCH Pattern 1).

**Result type shape** — `packages/apps/editor/src/blockly/registry/types.ts:182-199`:
```typescript
export interface RegistryDiagnostic {
  level: 'error' | 'warning';
  code: string;
  message: string;
  packId?: string;
  blockType?: string;
  input?: string;
}

export interface RegisterPackOptions {
  source: BlockPackSource;
}

export interface RegisterPackResult {
  ok: boolean;
  diagnostics: RegistryDiagnostic[];
  registeredBlockTypes: string[];
}
```

**Core pattern — validate → reject-with-diagnostics (no throw), literal object returns** — `packages/apps/editor/src/blockly/registry/index.ts:554-557, 578`:
```typescript
    const diagnostics = this.validatePack(normalizedPack, options, allowOverride);
    if (diagnostics.some((item) => item.level === 'error')) {
      return { ok: false, diagnostics, registeredBlockTypes: [] };
    }
// ...
    return { ok: true, diagnostics, registeredBlockTypes };
```

**Restore-previous-on-failure** (the "rollback" D-02 names) — `packages/apps/editor/src/blockly/registry/index.ts:597-600`:
```typescript
    if (previous) this.removePack(pack.id);
    const result = this.registerPack(pack, options);
    if (!result.ok && previous) this.registerPack(previous.pack, previous.options);
    return result;
```
> **Do NOT copy these mechanics.** `BlockRegistry` needs remove-then-restore because a pack touches five maps at once; the kernel registry touches exactly one. Use **compute-then-commit**: validate kind format, validate duplicate/`replaceable` rules, then one `map.set(...)`. A failure then has no side effect *by construction* — strictly stronger than the observable requirement. `registry.ts` stores `Map<string, RegistryEntry>` keyed `` `${kind}:${id}` `` (never a plain object — RESEARCH V5: no `__proto__` pollution path).

**Naming to apply (confirmed, N-04/N-05/N-06):** `CapabilityRef`, `RegisterCapabilityOptions`, `RegisterCapabilityResult`, plus the kind-format validator. `RegisterCapabilityResult` = `{ disposer: () => void; diagnostics: readonly Diagnostic[] }` (D-02).

---

### `packages/libs/editor-core/lib/kernel/diagnostics.ts` (event bus, pub-sub)

**ANTI-analog (do not reuse):** `packages/apps/editor/src/utils/notify.ts:10-21`
```typescript
const listeners = new Set<(notification: EditorNotification) => void>();

export function subscribeNotifications(listener: (notification: EditorNotification) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function emit(notification: EditorNotification): void {
  if (listeners.size > 0) listeners.forEach((listener) => listener(notification));
  else if (notification.level === 'error') console.error(notification.message);
  else console.info(notification.message);
}
```
**Explicitly forbidden:** the module-level `const listeners = new Set(...)` is exactly the binding the D-10 structural gate forbids. Adopting it makes the new gate red on day one (RESEARCH Pitfall 2). Take only the **shape reference**: `subscribe(listener) => unsubscribe`. `diagnostics.ts` must hold **no module-level mutable state**; `createDiagnosticBus` (N-12) builds a **closure per instance** (factory, not a class — INTERFACE-NAME N-12 rationale).

**Per-instance storage + subscribe-returns-unsubscribe + sync teardown drain** — `packages/apps/editor/src/runtime/RuntimeResourceGateway.ts:43-56`:
```typescript
export class RuntimeResourceGateway {
  private revision = 0;
  private readonly watched = new Map<string, () => void>();
  private onChange: ((change: ProjectResourceChange) => void) | null = null;

  setChangeListener(listener: ((change: ProjectResourceChange) => void) | null): void {
    this.onChange = listener;
  }

  dispose(): void {
    for (const unsubscribe of this.watched.values()) unsubscribe();
    this.watched.clear();
    this.onChange = null;
  }
```

**Required bus semantics to implement (RESEARCH Pattern 2):** `snapshot(): readonly Diagnostic[]` (append-only history, so construction-time diagnostics survive `createEditorCore` returning); `subscribe(listener): () => void` (subsequent only — no replay); iterate a **copy** of the listener set; on a listener throw, **append-without-dispatch** the internal diagnostic (`severity: 'warning'`, code `diagnostic.subscriber-error`, `cause` = thrown value) directly to the history array — never re-enter `push` (RESEARCH Pitfall 3).

**Names to apply (confirmed):** `Diagnostic`, `DiagnosticSeverity`, `DiagnosticBus`, `createDiagnosticBus`, `DIAGNOSTIC_CODES` (`as const` table), `DiagnosticCode` (N-10..N-14).

---

### `packages/libs/editor-core/lib/kernel/errors.ts` (error class, transform)

**Analog:** `packages/libs/h5animate/lib/errors.ts` (Error subclass carrying a code + structured payload).

**Class shape + extra payload fields** — `packages/libs/h5animate/lib/errors.ts:67-100`:
```typescript
export class H5AnimateError extends Error {
  public readonly code: H5AnimateErrorCode;
  public readonly position?: number;
  // ...
  constructor(code: H5AnimateErrorCode, message: string, options?: { /* ... */ }) {
    super(message);
    this.name = 'H5AnimateError';
    this.code = code;
    // ...
  }
```

**Stack discipline** — `packages/libs/packer/src/errors.ts:30-45`:
```typescript
export class MotaBuilderError extends Error {
  public readonly code: ErrorCode;
  public readonly details?: Record<string, unknown>;

  constructor(message: string, code: ErrorCode, details?: Record<string, unknown>) {
    super(message);
    this.name = 'MotaBuilderError';
    this.code = code;
    this.details = details;

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, MotaBuilderError);
    }
  }
}
```

**Name to apply (confirmed, N-16):** `EditorCoreStartupError` — `readonly diagnostics: readonly Diagnostic[]` carrying **all** diagnostics (D-08) and `this.name = 'EditorCoreStartupError'`. Do **not** copy the packer's `Error.captureStackTrace` line shown above: it is V8/`@types/node`-only and does not compile under core's tsconfig (`lib: ESNext, DOM, DOM.Iterable`, no `types`); `super(message)` already captures the stack. (The packer is a Node CLI; core is a browser-targeted library.)

---

### `packages/libs/editor-core/lib/kernel/core.ts` (composition root, request-response)

**Analogs:** `RuntimeResourceGateway.ts` (per-instance lifecycle + `dispose`) and `blockly/registry` contract (registry delegation). There is **no exact in-repo composition-root factory** — use the RESEARCH §Code Examples skeleton for the atomic-construction logic.

**Per-instance dispose skeleton** — reuse `RuntimeResourceGateway.ts:43-56` (above): private state, a `dispose()` that drains callbacks and is safe to call repeatedly.

**Atomic construction + reverse-order teardown + startup throw (RESEARCH §Code Examples "Atomic construction + startup error"):**
```typescript
function createEditorCore(config: EditorCoreConfig): EditorCore {
  const diagnostics = createDiagnosticBus();
  const teardowns: Array<() => void> = [];
  let disposed = false;
  // …build registry, apply config.install(registrar)…
  const missing = resolveRequired(config.required ?? [], builtinRequired, registry);
  if (missing.length > 0) {
    for (const ref of missing) diagnostics.push({ severity: 'error', code: 'capability.required-missing', target: ref, … });
    disposeInReverse(teardowns, diagnostics);        // D-08: reverse-order dispose of what was created
    throw new EditorCoreStartupError(diagnostics.snapshot());
  }
  return { /* registry quartet + .diagnostics + .dispose */ };
}
```

**Dispose mechanics (D-09, RESEARCH Pattern 3):** set `disposed = true` **first** (re-entrant call is a no-op), then `for (let i = teardowns.length - 1; i >= 0; i -= 1)` inside a per-item `try/catch`, collecting failures. Collected failures go to the `DiagnosticBus` as `severity: 'error'` **and** a `console` line — mirror `packages/apps/editor/src/fs/PersistExecutor.ts:72`:
```typescript
        const normalized = error instanceof Error ? error : new Error(String(error));
        console.error('PersistExecutor: task failed', normalized);
```

**Config `install(registrar)` (D-18, RESEARCH Open Question 5):** give the registrar a **narrow** interface (`CapabilityRegistrar.register` + `CapabilityRegistrar.addTeardown`), never the `EditorCore` instance (D-12 / RESEARCH Anti-Pattern). `addTeardown` is what makes KERN-02's ordering observable in tests.

**Names to apply (confirmed, N-01/N-02/N-07/N-08/N-20):** `createEditorCore`, `EditorCore`, `EditorCoreConfig`, `EDITOR_CORE_API_VERSION = "0.1.0"` (D-11/D-20 — lives here), `CapabilityRegistrar` with `CapabilityRegistrar.register` / `CapabilityRegistrar.addTeardown`.

**Instance method surface (D-01/D-12, use `ClassName.methodName` in prose):** `EditorCore.registerCapability`, `EditorCore.getCapability`, `EditorCore.getCapabilityOrThrow`, `EditorCore.snapshotCapabilities`, `EditorCore.dispose`, plus `.diagnostics`. `EditorCore.snapshotCapabilities()` returns a flattened, frozen `readonly CapabilityRef[]` (`{ kind, id, value, owner }`) per D-19.

**Module-state exception:** `core.ts` is the **one** file exempt from the D-10 module-state selectors (it owns `teardowns`/`disposed`). The ESLint scoping must keep PORT-02 rules applying to it (RESEARCH Pattern 5 caution).

---

### `packages/libs/editor-core/lib/ports/fs.ts` (port interface, file-I/O)

**Analog:** `packages/apps/editor/src/services/fs/fs.ts` — the real call surface, verbatim `:23-32`:
```typescript
export interface FsPromiseApi {
  readFile(filename: string, encoding: FileEncoding): Promise<string>;
  readFileBinary(filename: string): Promise<ArrayBuffer>;
  writeFile(filename: string, data: string, encoding: FileEncoding): Promise<void>;
  writeMultiFiles(filenames: string[], dataList: string[]): Promise<void>;
  readdir(path: string): Promise<string[]>;
  mkdir(path: string): Promise<void>;
  moveFile(src: string, dest: string): Promise<void>;
  deleteFile(path: string): Promise<void>;
}
```
`FsPort` is the **minimal honest** subset grounded in real Phase-4 call sites (RESEARCH §Port grounding): `readFile`, `readFileBinary`, `writeFile`, `deleteFile`, `readdir`, `mkdir`, `moveFile` — `writeMultiFiles` is declared but has **no production caller**, so D-14 ("don't guess, don't write empty interfaces") says leave it out.

**Not-found contract `FsPort` must preserve** — `packages/apps/editor/src/fs/errors.ts:10-20`:
```typescript
export function isFileNotFoundError(error: Error): boolean {
  const { code } = error as ErrorWithCode;
  if (code) return code === 'file-not-found' || code === 'ENOENT';

  return (
    error.name === 'NotFoundError' ||
    /\bfile-not-found\b/i.test(error.message) ||
    /\bfile not found\b/i.test(error.message) ||
    /\bENOENT\b/i.test(error.message) ||
    /\bno such file\b/i.test(error.message)
  );
}
```

**Import style to copy:** extensionless relative, `export interface FsPort { … }`, explicit return types — matches `fs.ts` and `lib/react/index.ts:1`.

---

### `packages/libs/editor-core/lib/ports/host.ts` (port interface, request-response)

**Analog:** `packages/apps/editor/src/environment.ts:9-20` — endpoint-resolution surface:
```typescript
export interface EditorEnvironment {
  protocolVersion: typeof EDITOR_ENVIRONMENT_PROTOCOL_VERSION;
  release?: EditorReleaseIdentity;
  endpoints: {
    fs: string;
    runtime: string;
    preview: string;
    docs?: string;
    project: string;
    update?: string;
  };
}
```
`HostPort`'s Phase-4 need is the endpoint resolution shape (RESEARCH §Port grounding). Keep it engine-neutral — `host.ts` must **not** mention `mota`/`tower`/game paths; mirror the logical endpoint names, not the host app's vocabulary.

---

### `packages/libs/editor-core/lib/ports/engine.ts` (port interface, request-response — weak analog)

**Analog:** `packages/apps/editor/src/runtime/protocol.ts:4` — the versioned-entry convention for an injected contract:
```typescript
export const RUNTIME_PROTOCOL_VERSION = 4;
```
D-14: `EngineAdapter` defines **only the entry shape**; Phase 5 expands it. Do **not** invent a full adapter contract now (adding members later is a breaking change for implementers). Keep the interface tiny and engine-neutral.

---

### `packages/libs/editor-core/lib/ports/preview.ts` (port interface, request-response — NO ANALOG)

`PreviewAdapter` is a **minimal placeholder** (D-14, Phase 11 expands it). No in-repo analog. Keep it to the smallest honest signature; do not write an empty interface (`@typescript-eslint/no-empty-object-type` is `warn` in the root config, `eslint.config.js:70`, and an empty interface violates D-14's "不写空接口").

---

### `packages/libs/editor-core/lib/ports/index.ts` (barrel) and `packages/libs/editor-core/lib/index.ts` (barrel, modified)

**Analog (libs barrel style):** `packages/libs/file2x/lib/index.ts:1-4`
```typescript
export * from './data';
export * from './script';
export * from './syntax';
export type * from './types';
```
**Analog (single re-export, extensionless relative — the core-internal precedent):** `packages/libs/editor-core/lib/react/index.ts:1`
```typescript
export { CoreProbe } from './CoreProbe';
```
`lib/ports/index.ts` re-exports the four port interfaces. `lib/index.ts` (currently `export {}` with a Phase-2 header comment, `lib/index.ts:1-8`) becomes the public aggregate: re-export `./kernel/core`, `./kernel/registry`, `./kernel/diagnostics`, `./kernel/errors`, and `./ports/index`. **Prefer named re-exports** over blanket `export *` at the root (D-16/ARCHITECTURE §2.4: the root is the only importable surface). `lib/index.ts` is a **leaf** — no kernel file may import `../index` (would trip `no-circular`, RESEARCH Pitfall 9).

> Do **not** add a `./kernel` or `./ports` subpath to `package.json` — `coreExports.js:42,136-140` asserts the exports map is exactly seven keys (RESEARCH Pitfall 7).

---

### `packages/libs/editor-core/lib/__tests__/*.test.ts` (6 test files, Wave 0)

**Analog (co-located test style in this exact package):** `packages/libs/editor-core/lib/__tests__/coreProbe.test.tsx:1-16`
```typescript
/**
 * Phase 2 smoke 测试（D-12/D-21）。
 * ...
 */
import { describe, expect, test } from 'vitest';
import { CoreProbe } from '../react/index';

describe('editor-core 探针', () => {
  test('CoreProbe 来自 core 自身的文件', () => {
    expect(typeof CoreProbe).toBe('function');
```

**Environment docblock pattern:** the core `vitest.config.ts:20-23` sets `environment: 'jsdom'` globally, so every kernel test needs a per-file override. The repo already uses this docblock form (all existing uses are `jsdom`; the kernel tests are the first `node` users) — `packages/libs/react-hooks/lib/core/common.test.tsx:1`:
```typescript
// @vitest-environment jsdom
```
Kernel tests use `// @vitest-environment node` as line 1 (RESEARCH Pitfall 11 / VALIDATION "Kernel-test env"). Do **not** edit `vitest.config.ts` (the existing probe needs jsdom). Do **not** rely on the jsdom/node environment to catch PORT-02 — that is a static gate.

**Import style:** `import { describe, expect, test } from 'vitest';` + **relative** imports to `../kernel/...` and `../ports/index` (no `@/`). Test names/messages are Chinese (matches `coreProbe.test.tsx`); fixtures must be engine-neutral (`acme.thing`, not `mota.*`).

**Names to apply (confirmed, N-20..N-25):** the six file paths under `lib/__tests__/` exactly as listed in the File Classification table.

---

### `scripts/verify/coreModuleState.js` (verifier, batch)

**Analog (copy the whole skeleton AND the two-polarity technique):** `scripts/verify/coreBoundaries.js`

**ESM + Chinese header + `failures[]` + `check()` + `process.exit(1)` + success line** — `scripts/verify/coreBoundaries.js:27-76`:
```javascript
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const REPO_ROOT = path.resolve(import.meta.dirname, '..', '..');
// ...
const failures = [];

function check(condition, message) {
  if (!condition) failures.push(message);
}
```

**Two-polarity synthetic-fixture technique** — `scripts/verify/coreBoundaries.js:51-58, 211-238`:
```javascript
const SYNTHETIC_FIXTURE = path.join(REPO_ROOT, CORE_LIB, 'code', '__boundariesProbe__.ts');
const SYNTHETIC_SOURCE = "import '../table/index';\n";
const SYNTHETIC_RULE = 'capabilities-must-not-import-each-other';
// ...
function checkSyntheticViolation() {
  fs.writeFileSync(SYNTHETIC_FIXTURE, SYNTHETIC_SOURCE, 'utf8');
  try {
    // ... run the real tool, assert it reports > 0 errors and names the rule ...
  } finally {
    fs.rmSync(SYNTHETIC_FIXTURE, { force: true });
  }
  check(!fs.existsSync(SYNTHETIC_FIXTURE), `合成违规 fixture 未被删除：${relative(SYNTHETIC_FIXTURE)}`);
}
```

**Success-line convention** — `scripts/verify/coreBoundaries.js:322-324`:
```javascript
  console.log(
    'coreBoundaries: 全部断言通过（真实树 0 违规、合成违规被拦、PKG-03 负极性 TS2307、editor→core 边方向正确）',
  );
```
`coreModuleState.js` must: (a) lint the **real** `packages/libs/editor-core/lib/**` tree and require zero module-state errors; (b) lint a **synthetic** fixture containing a module-scope `let` and require **non-zero** (the gate is provably able to fail); (c) fold in the **PORT-02 two-polarity proof** — a synthetic fixture containing each banned identifier (`fetch`/`window`/`document`/`navigator`/`localStorage`/`XMLHttpRequest`/`process.env`/`import.meta.env`) must produce an error for each (D-15, VALIDATION Wave 0). Always clean up fixtures in `finally` and assert they are gone.

**ESLint invocation reference:** `scripts/verify/lint-severities.js:24, 78-82` shows how to call the repo's own ESLint binary and parse `--print-config` JSON — use the same `node_modules/eslint/bin/eslint.js` + `spawnSync` approach.

---

### `eslint.config.js` (modified, config)

**Analog:** itself (the existing shared block) — `eslint.config.js:31-32`
```javascript
    files: ['**/*.{js,ts,tsx}'],
    ignores: ['packages/apps/editor/**'],
```
Append a **core-scoped block after** the shared block (later blocks win in flat config). Candidate shape is in RESEARCH Pattern 5 (`no-restricted-globals` for the six identifiers, `no-restricted-properties` for `process.env`, `no-restricted-syntax` for module-scope `let`/`var` + module-scope mutable containers + `import.meta.env`). The combine-and-exempt selector that was proven by execution is validated (RESEARCH §Code Examples "Module-state gate selectors"): `'…[kind="const"] > VariableDeclarator > :matches(NewExpression[callee.name=/^(Map|Set|WeakMap|WeakSet)$/], ArrayExpression, ObjectExpression)'` — `Object.freeze({…})` / `{…} as const` are structurally exempt via the `>` child combinator.

**Flat-config export shape** — `eslint.config.js:81`:
```javascript
export default [...rootConfig, ...editorConfig.map((block) => ({ ...block, basePath: 'packages/apps/editor' }))];
```
Use a **separate block** for the module-state selectors with `ignores: ['packages/libs/editor-core/lib/kernel/core.ts']`, and a **different** block for PORT-02 rules that still applies to `core.ts` (RESEARCH Pattern 5 caution: one block with one `ignores` would exempt `core.ts` from PORT-02 too).

**Per-package precedent (if the planner chooses a package config instead — RESEARCH Alternative):** `packages/apps/editor/eslint.config.js:10-50` shows a `defineConfig([...])` block with `files` + `rules`. Research **recommends the root override** (smaller change, keeps `lint-severities.js`'s root sample meaningful).

**Constraint that must not break — `scripts/verify/lint-severities.js:26-44`** samples exactly two files, **neither of them a core file**: `packages/apps/editor/src/hooks/useImageAssetUrl.ts` and `packages/apps/service-worker/src/server/fsApi.ts`, asserting an 8-rule severity table. Adding core-scoped rules cannot change those results (RESEARCH Pitfall 5). But `lint-severities.js:46-55, 142-163` scans **every git-tracked** `.js/.jsx/.mjs/.cjs/.ts/.tsx` file for `eslint-disable*` comments and requires a non-empty reason after ` -- ` — so **do not add an unexplained `eslint-disable` in any new core file; prefer not disabling at all.**

---

### `.dependencyCruiser.cjs` (modified, config)

**Analog:** itself — `forbidden`-only, `severity: 'error'` — `.dependencyCruiser.cjs:13-67`.

The kernel-must-not-import-capabilities rule **already covers all new `lib/kernel/*` files for free** — `.dependencyCruiser.cjs:22-28`:
```javascript
    {
      name: 'kernel-must-not-import-capabilities',
      comment: 'D-06：`.`（内核）不依赖任何能力 subpath。',
      severity: 'error',
      from: { path: '^packages/libs/editor-core/lib/(index\\.ts|kernel/.*)$' },
      to: { path: '^packages/libs/editor-core/lib/(code|table|map|asset)/.+' },
    },
```
The `requireZero` rule's `from`/`to` — `.dependencyCruiser.cjs:54-66` — is already correct for Phase 3: its `to.path` names six singletons that do not exist yet, so it stays an empty, green rule (Phase 2's D-17 prediction; RESEARCH Pitfall 10). **Likely no `.dependencyCruiser.cjs` change is needed at all** — but the plan must still re-run `node scripts/verify/coreBoundaries.js` after any edit. If the module-state check is implemented as a dependency-cruiser rule instead, note RESEARCH explicitly: **dependency-cruiser reasons over module *edges* and cannot express module-level state** — use the ESLint selector path.

---

### `.github/workflows/ci.yml` (modified, config)

**Analog:** itself — the four jobs, `.github/workflows/ci.yml:12-108`.

Add extra `- run:` steps **inside existing jobs only** — e.g. the module-state verifier in `lint` (beside `- run: node scripts/verify/coreBoundaries.js`, `ci.yml:33`). The `typecheck` job already carries the exports verifier (`ci.yml:55`). `scripts/verify/ci-workflow.js:31` fixes `JOB_IDS = ['lint','typecheck','unit','build']` and `:53` fixes `SUBMODULE_JOBS = ['unit','build']`; the verifier asserts **presence only**, so extra `run:` steps are safe (RESEARCH Pitfall 6). Never add a fifth job; never rename a job; do not add `submodules: recursive` to `lint`/`typecheck`. Re-run `node scripts/verify/ci-workflow.js` after editing.

---

### `.planning/phases/02-package-boundary-build-scaffolding/subpathStatus.json` (modified, manifest data)

**Analog:** itself — `.planning/phases/02-package-boundary-build-scaffolding/subpathStatus.json:5-10`:
```json
  "subpaths": {
    ".": {
      "target": "./lib/index.ts",
      "content": "empty-barrel",
      "carriesProbe": false
    },
```
After Phase 3, `lib/index.ts` re-exports the kernel surface, so `.`'s `content` must change (proposed value per N-26: `"kernel-exports"`). This is a **small contract**, because `scripts/verify/coreExports.js:181-191` cross-checks it:
```javascript
    const carriesProbe = subpath === PROBE_SUBPATH;
    check(
      entry.carriesProbe === carriesProbe,
      `subpathStatus.json 的 "${subpath}" carriesProbe 应为 ${carriesProbe}，实际是 ${JSON.stringify(entry.carriesProbe)}`,
    );
    const expectedContent = carriesProbe ? 'probe' : 'empty-barrel';
    check(
      entry.content === expectedContent,
      `subpathStatus.json 的 "${subpath}" content 应为 "${expectedContent}"，实际是 ${JSON.stringify(entry.content)}`,
    );
```
**Critical coupling (RESEARCH Pitfall 8):** `coreExports.js:186` hard-codes `expectedContent = carriesProbe ? 'probe' : 'empty-barrel'`. Changing `subpathStatus.json`'s `.` value to `"kernel-exports"` **will red the `typecheck` job unless `scripts/verify/coreExports.js` is updated in the same plan**. Decide deliberately:
- **(a)** leave both untouched — verifier stays green, but the Phase-2 record becomes false; or
- **(b)** update `subpathStatus.json` **and** the `coreExports.js` expectation together (research recommends (b): honest, two-line change).

If (b) is chosen, `scripts/verify/coreExports.js` becomes a **sixth modified file** (it is not in the confirmed file list, so this must be called out as a planned divergence before it lands).

---

## Shared Patterns

### Per-instance state, never module-level (D-10 / KERN-06)
**Source:** `packages/apps/editor/src/runtime/RuntimeResourceGateway.ts:43-56` (positive) · `packages/apps/editor/src/utils/notify.ts:10` and `packages/apps/editor/src/environment.ts:22` (negative: `let environment: EditorEnvironment | undefined;` — a module-level mutable binding in a non-core file).
**Apply to:** `kernel/core.ts` (the only allowed exception), `kernel/registry.ts`, `kernel/diagnostics.ts`.
```typescript
export class RuntimeResourceGateway {
  private revision = 0;
  private readonly watched = new Map<string, () => void>();
  private onChange: ((change: ProjectResourceChange) => void) | null = null;
  dispose(): void {
    for (const unsubscribe of this.watched.values()) unsubscribe();
    this.watched.clear();
    this.onChange = null;
  }
}
```
Every mutable container lives inside the `createEditorCore`/`createDiagnosticBus` closure or an instance field.

### Diagnostics-over-throw for registration/validation (D-02/D-08)
**Source:** `packages/apps/editor/src/blockly/registry/types.ts:182-199` + `index.ts:554-557, 578`.
**Apply to:** `kernel/registry.ts`, `kernel/core.ts` (construction aggregates; throws only the one startup error).
Result object + stable `code`; a rejected registration has **no side effect** (compute-then-commit); throw is reserved for "construction cannot complete".

### Error classes with stable codes and factories
**Source:** `packages/libs/h5animate/lib/errors.ts:67-146` · `packages/libs/packer/src/errors.ts:30-45,75-110`.
**Apply to:** `kernel/errors.ts` (`EditorCoreStartupError`) and the `DIAGNOSTIC_CODES` table.
```typescript
class EditorCoreStartupError extends Error {
  readonly diagnostics: readonly Diagnostic[];   // D-08: carries ALL diagnostics
}
```

### Extensionless relative imports + explicit return types (Phase-2 D-06 amended)
**Source:** `packages/libs/editor-core/lib/react/index.ts:1` (`export { CoreProbe } from './CoreProbe';`).
**Apply to:** **every** file under `lib/**`. Never `@/`; never `../index` from a kernel file (cycle). Explicit return types on exports (repo convention).

### Two-polarity verifiers (Phase-2 core lesson)
**Source:** `scripts/verify/coreBoundaries.js:211-238` (+ `scripts/verify/coreExports.js`).
**Apply to:** `scripts/verify/coreModuleState.js` (module-state proof **and** PORT-02 proof). Real tree green **and** a synthetic violating fixture that must go red; always delete the fixture in `finally`.

### Four-job CI contract is a hard constraint
**Source:** `.github/workflows/ci.yml:12-108` + `scripts/verify/ci-workflow.js:31,53`.
**Apply to:** `ci.yml`, `coreModuleState.js` wiring. Extra `run:` steps only; never a new job.

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `packages/libs/editor-core/lib/kernel/core.ts` | composition-root | request-response | No in-repo factory returns a per-instance object graph; closest is a per-instance *class* (`RuntimeResourceGateway`). Use RESEARCH §Code Examples for the atomic-construction logic. |
| `packages/libs/editor-core/lib/ports/engine.ts` | port interface | request-response | D-14 keeps it an entry-shape stub; `protocol.ts` supplies only the versioned-entry convention. Phase 5 expands it. |
| `packages/libs/editor-core/lib/ports/preview.ts` | port interface | request-response | D-14 minimal placeholder; no existing preview contract in core. Phase 11 expands it. |

---

## Metadata

**Analog search scope:** `packages/libs/editor-core/**`, `packages/apps/editor/src/{blockly,runtime,fs,services/fs,utils,project}`, `packages/libs/{utils,packer,h5animate,file2x,react-hooks,config}/**`, `scripts/verify/**`, root configs (`.dependencyCruiser.cjs`, `eslint.config.js`, `packages/apps/editor/eslint.config.js`), `.github/workflows/ci.yml`, `.planning/phases/02-…/subpathStatus.json`.
**Files scanned:** 24 git-tracked source files (all analog paths verified tracked via `git ls-files`).
**Pattern extraction date:** 2026-09-22
**Gates referenced (all git-tracked):** `coreBoundaries.js`, `coreExports.js`, `lint-severities.js`, `ci-workflow.js`.
**Transient tooling unavailable this session:** `rg` (ripgrep) not on PATH; content searches used the Grep tool instead.
