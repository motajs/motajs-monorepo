# Phase 4: Resource + Edit Layers Moved - Pattern Map

> **File-name note (2026-09-23).** The user-mandated convention is **lowerCamelCase file names; PascalCase only for `.tsx` React components**. This pattern map was written before that convention and still shows the pre-convention PascalCase core paths (e.g. `lib/resources/FileHandler.ts`). The authoritative names are in `INTERFACE-NAME.md` and the four `04-*-PLAN.md` files (e.g. `lib/resources/fileHandler.ts`); where this file and a PLAN.md disagree on a **file name**, the PLAN.md wins. Symbol names (classes/functions/types) are unaffected.

**Mapped:** 2026-09-23
**Files analyzed:** 41 (19 core new/moved, 13 editor new/shim, 9 gate/config)
**Analogs found:** 37 / 41 (4 new files have no in-repo analog — see §No Analog Found)

> **How to read this file.** This phase is a **move + de-singleton**, not new construction. For every
> *moved* file the "closest analog" is the file that already exists in the editor — the plan copies it
> byte-for-byte except for the enumerated import/name rewrites. For the *four genuinely new* files
> (`ResourceRegistry.ts`, `undoSystem.ts`, `editorShims.js`, `appInstances.ts`) the analog is the
> Phase-2/3 core seam (`kernel/core.ts`, `kernel/registry.ts`) or the repo verifier family.
> All analog paths below are **git-tracked source** (verified with `git ls-files` this session);
> no gitignored mirror path is emitted.

> **Naming is fixed.** Every file/type/method name below comes from
> `.planning/phases/04-resource-edit-layers-moved/INTERFACE-NAME.md` (CONFIRMED 2026-09-23) and must
> be written exactly as given (`OperationHistory.registerUndoSystem`, `ResourceRegistry.getOrThrow`,
> `src/appInstances.ts`, …).

---

## File Classification

### A. Core — `packages/libs/editor-core/lib/resources/*` (new directory; D-09 internal, exported from root `.`)

| New File | Role | Data Flow | Closest Analog | Match Quality |
|----------|------|-----------|----------------|---------------|
| `lib/resources/types.ts` | model | transform | `packages/apps/editor/src/fs/types.ts` (move source) | exact (move) |
| `lib/resources/interfaces.ts` | model | transform | `packages/apps/editor/src/fs/interfaces.ts` (move source) | exact (move) |
| `lib/resources/ContentUtils.ts` | utility | transform | `packages/apps/editor/src/fs/ContentUtils.ts` (move source) | exact (move, +`Object.freeze`) |
| `lib/resources/errors.ts` | utility | request-response | `packages/apps/editor/src/fs/errors.ts` (move source) | exact (move) |
| `lib/resources/waitUntil.ts` | utility | event-driven | `packages/apps/editor/src/utils/base/signal.ts` (move source) | exact (move) |
| `lib/resources/FileHandler.ts` | service | file-I/O | `packages/apps/editor/src/fs/FileHandler.ts` (move source) + `lib/kernel/core.ts` (injection) | exact (move, constructor injection) |
| `lib/resources/FileHandlerManager.ts` | service | CRUD (cache) | `packages/apps/editor/src/fs/FileHandlerManager.ts` (move source) | exact (move, de-singleton) |
| `lib/resources/DataHandler.ts` | service | transform | `packages/apps/editor/src/fs/DataHandler.ts` (move source) | exact (move) |
| `lib/resources/JsonDataHandler.ts` | service | transform | `packages/apps/editor/src/fs/JsonDataHandler.ts` (move source) | exact (move) |
| `lib/resources/BinaryFileHandler.ts` | service | file-I/O | `packages/apps/editor/src/fs/BinaryFileHandler.ts` (move source) | exact (move, FsPort) |
| `lib/resources/PersistExecutor.ts` | service | batch (queue) | `packages/apps/editor/src/fs/PersistExecutor.ts` (move source) | exact (move) |
| `lib/resources/PersistenceMonitor.ts` | service | event-driven | `packages/apps/editor/src/fs/PersistenceMonitor.ts` (move source) + `lib/kernel/diagnostics.ts` (class-only) | exact (move, de-singleton) |
| `lib/resources/combinators.ts` | utility | transform | `packages/apps/editor/src/project/resources.ts` (move source) | exact (move, renamed) |
| `lib/resources/ResourceRegistry.ts` | service (registry) | CRUD (id map) | `lib/kernel/core.ts` + `lib/kernel/registry.ts` + `blockly/registry/index.ts` | role-match (new) |
| `lib/resources/__tests__/<fs double>.ts` | test helper | file-I/O | `packages/apps/editor/test/utils/MemoryFileSystem.ts` | role-match (new, flat) |
| `lib/resources/__tests__/*.test.ts` | test | unit | `lib/__tests__/coreApiSurface.test.ts` | role-match (test style) |

### B. Core — `packages/libs/editor-core/lib/edit/*` (new directory; D-09)

| New File | Role | Data Flow | Closest Analog | Match Quality |
|----------|------|-----------|----------------|---------------|
| `lib/edit/operations.ts` | service (command) | CRUD + transform | `packages/apps/editor/src/project/history/operations.ts` (move source) | exact (move, minus viewport ops) |
| `lib/edit/operationHistory.ts` | service | event-driven (queue) | `packages/apps/editor/src/project/history/operationHistory.ts` (move source) | exact (move, store on instance) |
| `lib/edit/undoSystem.ts` | model (contract) | event-driven | `operations.ts:11-16` (`OperationTarget`) + `lib/kernel/registry.ts` | role-match (new) |
| `lib/edit/action.ts` | utility | transform | `packages/apps/editor/src/utils/action.ts` (move source) | exact (move) |
| `lib/edit/fieldPath.ts` | utility | transform | `packages/apps/editor/src/utils/fieldPath.ts` (move source) | exact (move) |
| `lib/edit/__tests__/operationHistory.invariants.test.ts` | test | unit | `src/project/history/__tests__/operationHistory.invariants.test.ts` (split) + `coreApiSurface.test.ts` | role-match (moved) |

### C. Core — barrels & manifest (modified)

| Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---------------|------|-----------|----------------|---------------|
| `lib/index.ts` | config (barrel) | — | its own current content (named re-exports) | exact (extend in place) |
| `lib/react/index.ts` | config (barrel) | — | its own current content | exact (extend in place) |
| `package.json` | config | — | its own current `dependencies` shape (Phase-2 D-02) | exact (extend in place) |
| `pnpm-workspace.yaml` | config | — | its own `catalog:` block | exact (extend in place) |

### D. Editor — new files (deleted in Phase 11)

| New File | Role | Data Flow | Closest Analog | Match Quality |
|----------|------|-----------|----------------|---------------|
| `src/appInstances.ts` | config (composition-root-lite) | event-driven | `lib/kernel/core.ts` + `src/main.tsx` | role-match (new) |
| `src/project/history/viewportOperations.ts` | service (command) | event-driven | `src/project/history/operations.ts:150-204` (relocated) | exact (move within editor) |
| `src/project/history/useOperationHistory.ts` | hook | event-driven | `src/project/history/operationHistory.ts:189-204` | exact (wrapper) |

### E. Editor — re-export shims (`// SHIM(phase4)`; D-10)

| Shim File | Role | Data Flow | Forwards To | Match Quality |
|-----------|------|-----------|-------------|---------------|
| `src/fs/{types,interfaces,errors,ContentUtils,PersistExecutor,DataHandler,JsonDataHandler,BinaryFileHandler}.ts` | shim | — | matching `lib/resources/*` | exact (new) |
| `src/fs/FileHandler.ts` | shim | — | `lib/resources/FileHandler.ts` | exact (new) |
| `src/fs/PersistenceMonitor.ts` | shim | — | core class + `appInstances.persistenceMonitor` | exact (new) |
| `src/fs/FileHandlerManager.ts` | shim | — | `appInstances.FileHandlerManager` (instance) | exact (new) |
| `src/project/resources.ts` | shim | — | `lib/resources/combinators.ts` | exact (new) |
| `src/project/history/{operations,operationHistory}.ts` | shim | — | `lib/edit/*` + instance | exact (new) |
| `src/utils/action.ts`, `src/utils/fieldPath.ts` | shim | — | `lib/edit/action.ts`, `lib/edit/fieldPath.ts` | exact (new) |
| `src/utils/base/signal.ts` | shim | — | `lib/resources/waitUntil.ts` | exact (new) |
| `src/fs/index.ts` | config (barrel) | — | core names + editor-only handlers + instances | exact (rewrite) |
| `src/project/history/index.ts` | config (barrel) | — | core edit names + instance + wrapper | exact (rewrite) |

### F. Gates / verifiers / CI (new or modified)

| File | Role | Data Flow | Closest Analog | Match Quality |
|------|------|-----------|----------------|---------------|
| `scripts/verify/editorShims.js` | test (verifier) | — | `scripts/verify/coreModuleState.js` + `scripts/verify/coreBoundaries.js` | exact (new, same family) |
| `.dependencyCruiser.cjs` | config | — | its own `core-singletons-only-imported-by-composition-root` rule (lines 53-66) | exact (retarget in place) |
| `eslint.config.js` | config | — | its own Block B `ignores` (line 159) | exact (widen in place) |
| `scripts/verify/coreModuleState.js` | test (verifier) | — | its own `firstTestFile()` (lines 244-253) | exact (extend in place) |
| `scripts/verify/coreExports.js` + `.planning/phases/02-.../subpathStatus.json` | config (two-file contract) | — | their own `SUBPATH_CONTENT['.']` (lines 77-81) / `['.'].content` | exact (update both) |
| `.github/workflows/ci.yml` | config | — | its own `lint` job steps | exact (add one `- run:`) |

---

## Pattern Assignments

### 1. Core `lib/resources/FileHandler.ts` (service, file-I/O)

**Analog (move source):** `packages/apps/editor/src/fs/FileHandler.ts`
**Secondary analog (injection shape):** `packages/libs/editor-core/lib/kernel/core.ts:113-117`

**Imports pattern** — *delete the two editor couplings, keep the rest* (source lines 1-9):
```ts
// BEFORE (source)
import { effect, signal } from 'alien-signals';
import { fs as defaultFs, type Fs } from '@/services/fs';      // ← DELETE (D-05)
import { waitUntil } from '@/utils/base/signal';               // → './waitUntil'
import type { Content } from './types';
import type { IContentHandler, ReadonlySignal } from './interfaces';
import { persistenceMonitor } from './PersistenceMonitor';     // ← DELETE value import; keep type
import { isFileNotFoundError } from './errors';

// AFTER (target)
import { effect, signal } from 'alien-signals';
import type { FsPort } from '../ports/fs';
import { waitUntil } from './waitUntil';
import type { Content } from './types';
import type { IContentHandler, ReadonlySignal } from './interfaces';
import type { PersistenceMonitor } from './PersistenceMonitor';
import { isFileNotFoundError } from './errors';
```

**Constructor-injection pattern** — the de-singleton seam (D-07). Field name stays `fs` (A8) to
minimise test churn; the pair is bundled in `FileHandlerDependencies` (INTERFACE-NAME §C) so it can
never be passed in the wrong order:
```ts
export interface FileHandlerDependencies {
  readonly fs: FsPort;
  readonly persistenceMonitor: PersistenceMonitor;
}

export class FileHandler implements IContentHandler<string> {
  private _content = signal<Content<string>>({ status: 'idle' });
  readonly content = this._content as ReadonlySignal<Content<string>>;
  private readonly fs: FsPort;                       // was `Fs`; holds a flat FsPort
  private readonly persistenceMonitor: PersistenceMonitor;
  private readonly path: string;
  private mutationVersion = 0;

  constructor(path: string, deps: FileHandlerDependencies) {   // NO parameter property (Pitfall 1)
    this.path = path;
    this.fs = deps.fs;
    this.persistenceMonitor = deps.persistenceMonitor;
  }
```

**Core commit pattern (memory-first + single write path, RES-05)** — source lines 69-78; only the
`persistenceMonitor` receiver and the flat `fs.writeFile` change:
```ts
  private commit(value: string): void {
    this.mutationVersion += 1;
    this._content({ status: 'loaded', value });                 // memory-first
    const path = this.path;
    const fs = this.fs;
    this.persistenceMonitor.schedule(path, {                    // was bare `persistenceMonitor`
      kind: 'write',
      execute: () => fs.writeFile(path, value, 'utf-8'),        // was `fs.promises.writeFile`
    });
  }
```

**Error-handling / not-found classifier** — source lines 111-127; `this.fs.readFile` (flat) and the
`isFileNotFoundError` branch are preserved **verbatim** (RES-05, "not-found ≠ error"):
```ts
    try {
      const content = await this.fs.readFile(this.path, 'utf-8');   // was `this.fs.promises.readFile`
      if (version === this.mutationVersion) this._content({ status: 'loaded', value: content });
    } catch (error) {
      if (version !== this.mutationVersion) return;
      const normalized = error instanceof Error ? error : new Error(String(error));
      this._content(isFileNotFoundError(normalized) ? { status: 'not-found' } : { status: 'error', error: normalized });
    }
```
Also change the two remaining flat calls: `this.persistenceMonitor.statusFor(this.path)` (source :89)
and `this.fs.deleteFile(path)` (source :102). **No `defaultFs`, no `fs.promises`, no `Fs` type.**

---

### 2. Core `lib/resources/FileHandlerManager.ts` (service, cache)

**Analog (move source):** `packages/apps/editor/src/fs/FileHandlerManager.ts`

**De-singleton pattern** — the module ends in `new` today; that line is **deleted** (D-06):
```ts
// source line 175 — DELETE
export const FileHandlerManager = new FileHandlerManagerImpl();
```
Rename the private class `FileHandlerManagerImpl` → exported `FileHandlerManager` (INTERFACE-NAME),
make the two maps **instance fields** (they already are — lines 15-18), and add the injected deps:
```ts
export class FileHandlerManager {
  private readonly handlers = new Map<string, FileHandler>();          // instance, not module
  private readonly loadingPromises = new Map<string, Promise<FileHandler>>();
  private readonly deps: FileHandlerDependencies;                      // NO parameter property
  constructor(deps: FileHandlerDependencies) {
    this.deps = deps;
  }

  get(path: string): FileHandler {
    let handler = this.handlers.get(path);
    if (!handler) {
      handler = new FileHandler(path, this.deps);                      // was `new FileHandler(path)`
      this.handlers.set(path, handler);
    }
    return handler;
  }
```

**Flat-port call site** — source `exists()` lines 100-112; only the read changes:
```ts
    try {
      await this.deps.fs.readFile(path, 'utf-8');      // was `await fs.promises.readFile(...)`
      return true;
    } catch {
      return false;
    }
```
Drop `import { fs } from '@/services/fs'` (source :10); add `import { FileHandler, type FileHandlerDependencies } from './FileHandler'`.
Every other method (`load`/`loadAll`/`has`/`isLoaded`/`delete`/`remove`/`reload`/`clear`/`size`)
moves byte-for-byte.

---

### 3. Core `lib/resources/PersistenceMonitor.ts` (service, event-driven)

**Analog (move source):** `packages/apps/editor/src/fs/PersistenceMonitor.ts`
**Secondary analog (class-only / no module state):** `lib/kernel/diagnostics.ts:60-105`

**De-singleton pattern** — the class body is unchanged; only the trailing export is removed (D-06):
```ts
// source line 145 — DELETE
export const persistenceMonitor = new PersistenceMonitor();
```
`PersistenceMonitor` needs **no injection** (dependency-free class). Its `controllers`/`persistingSet`/
`failedMap` maps (source lines 17-19) are already instance fields; the `signal` instances (20-26) are
already instance fields. Keep `resetForTests()` (131-137) — editor tests call it.

**Factory-vs-class precedent** — `lib/kernel/diagnostics.ts:62-66` documents why core prefers
instance state in closures/fields:
```ts
/**
 * 创建一个 **per-instance** 的诊断总线。
 * 用工厂而非类：实现得以保持为闭包，模块本身不持有任何可变状态。
 */
export function createDiagnosticBus(): DiagnosticBus { … }
```
`PersistenceMonitor` stays a **class** (INTERFACE-NAME), but the "module holds no mutable state"
rule (Block B) is the same constraint this precedent illustrates.

---

### 4. Core `lib/resources/ContentUtils.ts` (utility, transform) — ⚠ must arrive as `Object.freeze`

**Analog (move source):** `packages/apps/editor/src/fs/ContentUtils.ts`

**The single clearest "verbatim is impossible" item (Pitfall 2).** Source line 10 is a module-level
object literal under an exported `const`; the core-scoped `no-restricted-syntax` selector
(`eslint.config.js:172-176`) matches exactly that shape:
```ts
// source line 10 — WOULD red `pnpm lint` in core
export const ContentUtils = {
  map<T, R>(content: Content<T>, fn: (value: T) => T): Content<R> { … },
  …
};

// target — parent becomes a CallExpression, so the selector does NOT match
export const ContentUtils = Object.freeze({
  map<T, R>(content: Content<T>, fn: (value: T) => T): Content<R> { … },
  …
});
```
The gate's own message names this remedy, and `scripts/verify/coreModuleState.js:74-75, 99-102`
proves `Object.freeze({…})` is structurally exempt. Imports (`ts-pattern` + `./types`, source :7-8)
are unchanged.

---

### 5. Core `lib/resources/PersistExecutor.ts` (service, queue) — RES-05

**Analog (move source):** `packages/apps/editor/src/fs/PersistExecutor.ts`

Move **byte-for-byte**; the only import rewrite is `@/utils/base/signal` → `./waitUntil`. The
"one executing + one pending" state is the invariant that must not change:
```ts
export type PersistenceIntent = {
  kind: 'write' | 'delete';
  execute: () => Promise<void>;
};

export class PersistExecutor {
  private pendingIntent: PersistenceIntent | null = null;
  private failedIntent: PersistenceIntent | null = null;
  private isExecuting = false;

  schedule(intent: PersistenceIntent): void {
    this.pendingIntent = intent;                       // latest-wins
    if (this.isExecuting) {
      this._status({ status: 'executing', pending: 1 });
      return;
    }
    void this.processQueue();
  }
```
(Quoted from `04-RESEARCH.md` §Code Examples, itself `[VERIFIED: PersistExecutor.ts:13-16, 21-24, 36-43]`.)

---

### 6. Core `lib/resources/combinators.ts` (utility, transform)

**Analog (move source):** `packages/apps/editor/src/project/resources.ts` (renamed to `combinators.ts`)

Move the whole file; import rewrites only:
```ts
import { computed, effect } from 'alien-signals';
import type { ReadonlySignal } from './interfaces';        // was '@/fs/interfaces'
import type { Content } from './types';                    // was '@/fs/types'
import { ContentUtils } from './ContentUtils';             // was '@/fs/ContentUtils'
import { waitUntil } from './waitUntil';                   // was '@/utils/base/signal'
```
Public types `ResourceView` / `LoadableResource` / `ComputedResource` and functions
`computedResource` / `aggregateResource` / `optional` (source :8-136) move unchanged. `ResourceRegistry`
consumes `ResourceView` from here (INTERFACE-NAME §C).

---

### 7. Core `lib/resources/ResourceRegistry.ts` (service, registry) — NEW (RES-02)

**Primary analog (register → disposer + diagnostics, storage in closure):**
`packages/libs/editor-core/lib/kernel/core.ts:125-171`
**Secondary analog (contract types only, no second factory):** `lib/kernel/registry.ts:14-31`
**Tertiary analog (register-returns-result + rollback, editor precedent — pattern only, core must NOT import it):**
`packages/apps/editor/src/blockly/registry/index.ts:544-579` + `types.ts:195-199`

**Register pattern** — mirror `createEditorCore`'s `registerCapability`: duplicate detection, a
disposer that only removes *its own* entry, and a frozen snapshot. Storage is a `Map` (prototype-
pollution safe, Security §V5) inside the instance:
```ts
// kernel/core.ts:144-171 (the shape to copy)
const existing = entries.get(target);
if (existing && existing.replaceable !== true) { /* reject duplicate */ }
const entry: RegistryEntry = { … };
const disposer = (): void => {
  if (entries.get(target) === entry) entries.delete(target);
};
entries.set(target, entry);
teardowns.push(disposer);
return { disposer, diagnostics: [] };
```
```ts
// kernel/core.ts:184-193 (snapshot shape)
function snapshotCapabilities(): readonly CapabilityRef[] {
  return Object.freeze([...entries.values()].map((entry) => ({ … })));
}
```
**Contract-type style** — `lib/kernel/registry.ts` shows "contract types here, storage/validation in
the closure" (`:4-9`) and the `RegisterCapabilityResult` result shape (`:27-31`). The new
`ResourceRegistryEntry` (INTERFACE-NAME §C) is the analogue of `CapabilityRef`.

**Target shape (INTERFACE-NAME §D)** — class with `register`/`get`/`getOrThrow`/`has`/`ids`/`snapshot`;
`register` returns a disposer and rejects duplicate ids; `getOrThrow` throws a plain `Error`
(`kernel/core.ts:180` precedent: `throw new Error(\`Capability not registered: …\`)`). **Keep it
decoupled from `DiagnosticBus`** (Pitfall 10: `coreApiSurface.test.ts:43-51` asserts exactly five codes).
Editor blockly precedent for "register returns a result object" (`blockly/registry/index.ts:544-578`)
is a *reference only* — core must not import it.

---

### 8. Core `lib/resources/{types,interfaces,errors,waitUntil,DataHandler,JsonDataHandler,BinaryFileHandler}.ts`

**Analogs (move sources):** the same-named files under `packages/apps/editor/src/fs/` plus
`packages/apps/editor/src/utils/base/signal.ts` (→ `waitUntil.ts`).

| Target | Source | Import rewrites (Q10 table) |
|--------|--------|-----------------------------|
| `types.ts` | `fs/types.ts` | none (type-only) |
| `interfaces.ts` | `fs/interfaces.ts` | `./types` unchanged |
| `errors.ts` | `fs/errors.ts` | none |
| `waitUntil.ts` | `utils/base/signal.ts` | `alien-signals` only |
| `DataHandler.ts` | `fs/DataHandler.ts` | `@/utils/base/signal` → `./waitUntil` |
| `JsonDataHandler.ts` | `fs/JsonDataHandler.ts` | `./DataHandler`, `./FileHandler` unchanged |
| `BinaryFileHandler.ts` | `fs/BinaryFileHandler.ts` | drop `@/services/fs`; `FsPort` (no default); `@/utils/base/signal` → `./waitUntil` |

**Not-found ≠ error classifier (RES-05, moves verbatim)** — `errors.ts:10-20`:
```ts
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
**`waitUntil` (moves byte-for-byte)** — `utils/base/signal.ts:19-34` (returns `Promise<void>`,
resolves immediately if predicate is already true, otherwise subscribes with `effect` and unsubscribes).
**`BinaryFileHandler`** — source `constructor(path, fs?: Fs)` + `this.fs = fs || defaultFs` becomes
`constructor(path, fs: FsPort)` with **no default** (D-12); `this.fs.readFileBinary(path)` (was
`this.fs.promises.readFileBinary`).

**Not moved (D-01):** `src/fs/Json2xDataHandler.ts` and `src/fs/ScriptDataHandler.ts` stay in the
editor; they keep importing `./DataHandler`/`./FileHandler`, which now resolve to shims.

---

### 9. Core `lib/edit/operations.ts` (service, command)

**Analog (move source):** `packages/apps/editor/src/project/history/operations.ts`

**The `UndoSystem` precedent — `OperationTarget` capture/restore** (source lines 11-16):
```ts
export interface OperationTarget {
  readonly key: string;
  readonly path: string;
  capture(): unknown | Promise<unknown>;
  restore(checkpoint: unknown): Promise<void>;
}
```
`UndoSystem` (next section) is modelled on this exact contract shape, minus `key`/`path`.

**`PatchableResource` rebuild (D-04)** — `dataResourceTarget` (source :30-44) and
`ResourcePatchOperation` (:99-132) narrow `DataResource<T>` to the local contract:
```ts
// target — replaces the `@/project/data/DataResource` import
export interface PatchableResource<T> {
  readonly path: string;
  raw(): IContentHandler<string>;
  mutate(recipe: (draft: T) => void): Promise<void>;
}
```
The two functions' bodies move **verbatim**; only the parameter type changes
(`DataResource<T>` → `PatchableResource<T>`) and `@/fs/types` → `../resources/types`.
`DataResource<T>` structurally satisfies it (`src/project/data/DataResource.ts:17-29`), so no edit to
that file.

**What stays (D-02):** `RestoreViewportOperation`, `NavigateFloorOperation`, `navigateFloorOperation`
(source :150-204) are **removed** from the core copy and relocated to
`src/project/history/viewportOperations.ts` (see §16). Also drop the `./viewport` import (source :4).

---

### 10. Core `lib/edit/operationHistory.ts` (service, queue) — RES-04

**Analog (move source):** `packages/apps/editor/src/project/history/operationHistory.ts`

**Store-on-instance (D-11)** — the module-level store is the D-10 violation; move it onto the class:
```ts
// source lines 34-38 — DELETE
const historyStore = new Store<OperationHistoryState>({ entries: [], current: 0, busy: false });

// target — instance field
class OperationHistory {
  private readonly store = new Store<OperationHistoryState>({ entries: [], current: 0, busy: false });
  …
}
```
Replace every `historyStore.…` (source :76, 87, 124, 144, 152, 170, 179) with `this.store.…`, and
`useStore(historyStore, …)` moves to `lib/react` (see §12).

**UndoSystem seam replaces the viewport coupling (D-03)** — the entry no longer stores
`beforeViewport`/`afterViewport`; it stores per-system snapshots, captured **for every registered
system on every `execute`** (Finding 5 / A2 — required by
`src/project/history/__tests__/operationHistory.test.ts:55-71`):
```ts
// source :17-18  beforeViewport / afterViewport  →  target
interface HistoryEntryInternal {
  …
  systemsBefore: readonly { id: string; snapshot: unknown }[];
  systemsAfter: readonly { id: string; snapshot: unknown }[];
}
```
Replace `captureEditorViewport()` at source :117 (synchronous, at invocation time) with
`captureSystems()`; replace `restoreEditorViewport(...)` at :105/:150/:168 with
`restoreSystems(reverse-order)`. Registration order defines reverse restore order; restores run
**after** `restoreTargets` (matching today's sequence). `OperationHistory.registerUndoSystem(system)`
returns a disposer — same result shape as `EditorCore.registerCapability`
(`lib/kernel/core.ts:164-170`).

**Moves verbatim:** `uniqueTargets`/`captureTargets`/`restoreTargets` (source :40-65), the
`enqueue` queue with `pending`/`busy` (73-90), capacity 100 (71, 135), `applyWithCheckpoint`
(92-114), and the `undo`/`redo`/`clear` bodies apart from the store receiver and the systems calls.
The 9 pure invariant tests assert exactly this ordering (capture de-dup, reverse restore, capacity,
redo-tail truncation) and must stay green.

---

### 11. Core `lib/edit/undoSystem.ts` (model, contract) — NEW

**Analog (shape precedent):** `packages/apps/editor/src/project/history/operations.ts:11-16`
(`OperationTarget`) and `lib/kernel/registry.ts` (contract-only module style).

```ts
// target (INTERFACE-NAME §C) — modelled on OperationTarget's capture/restore pair
export interface UndoSystem<Snapshot = unknown> {
  readonly id: string;
  /** Must be synchronous: the "before" snapshot is taken at execute() invocation time. */
  capture(): Snapshot;
  restore(snapshot: Snapshot): void | Promise<void>;
}
```
No imports. `capture()` must be **synchronous** (A2) because `execute()` captures at invocation time
(source :117 is outside the queue). Core knows only `{ id, capture, restore }` — never viewport/material.

---

### 12. Core `lib/react/index.ts` (barrel) — `useOperationHistory`

**Analog (move source):** `packages/apps/editor/src/project/history/operationHistory.ts:189-204`

Core hook takes the instance (store is per-instance); the editor keeps a zero-arg wrapper (§17):
```ts
// target lib/react/index.ts (add alongside the existing probe export)
import { useStore } from '@tanstack/react-store';
import type { OperationHistory } from '../edit/operationHistory';

export function useOperationHistory(history: OperationHistory) {
  return useStore(history.store, (state) => ({
    entries: state.entries.map(({ id, label, timestamp, paths }) => ({ id, label, timestamp, paths })),
    current: state.current,
    busy: state.busy,
  }));
}
```
**Preserve the fresh-object selector verbatim** (source :194-203) — do NOT "optimise" it into
`useShallow`/memo (Q9 note 2: would change re-render counts). `@tanstack/react-store` appears
**only** in `./react`; `@tanstack/store` only in `lib/edit/operationHistory.ts`.
Keep the existing `export { CoreProbe } from './CoreProbe';` (coreBoundaries asserts the
`@motajs/editor-core/react` edge via `App.tsx:12`).

---

### 13. Core `lib/edit/{action,fieldPath}.ts` (utilities) — D-04 closure

**Analogs (move sources):** `packages/apps/editor/src/utils/action.ts`, `…/fieldPath.ts`

`action.ts` import rewrite: `@/utils/fieldPath` → `./fieldPath` (source :8). `fieldPath.ts` has **no**
rewrite (`es-toolkit/compat` only, source :8). Both pull in `es-toolkit` (`isEqual` in `action.ts:7`;
`get`/`set`/`unset` in `fieldPath.ts:8`) — hence core's new `es-toolkit` dependency (Pitfall 7: pin
`1.44.0`). `applyActionsWithInverse` (source :117-135) and the path helpers (:21-177) move byte-for-byte.

---

### 14. Core `lib/index.ts` (barrel) — named re-exports

**Analog:** its own current content (`lib/index.ts:1-19`).

Extend in the **same style** — named re-exports, never `export *` (the file's own doc comment
`:9-11` states the rationale):
```ts
// append to lib/index.ts
export { FileHandlerManager } from './resources/FileHandlerManager';
export { FileHandler, type FileHandlerDependencies } from './resources/FileHandler';
export { DataHandler } from './resources/DataHandler';
export { JsonDataHandler } from './resources/JsonDataHandler';
export { BinaryFileHandler } from './resources/BinaryFileHandler';
export { PersistenceMonitor } from './resources/PersistenceMonitor';
export { PersistExecutor } from './resources/PersistExecutor';
export { ContentUtils } from './resources/ContentUtils';
export { computedResource, aggregateResource, optional } from './resources/combinators';
export type { ResourceView, LoadableResource } from './resources/combinators';
export { ResourceRegistry } from './resources/ResourceRegistry';
export type { ResourceRegistryEntry } from './resources/ResourceRegistry';
export { OperationHistory } from './edit/operationHistory';
export { compositeOperation, patchResourceOperation, operationPathTarget } from './edit/operations';
export type { EditorOperation, OperationTarget, OperationMeta, AppliedOperation } from './edit/operations';
export type { UndoSystem } from './edit/undoSystem';
export type { PatchableResource } from './edit/operations';
export { applyActions, applyAction, applyActionsWithInverse, type Action, type ActionType } from './edit/action';
export { parseFieldPath, buildFieldPath, getByFieldPath, setByFieldPath, deleteByFieldPath } from './edit/fieldPath';
```
`lib/index.ts` is a leaf: it must not be imported by `resources/`/`edit/` (would break `no-circular`,
its own comment :10-11).

---

### 15. Core tests `lib/resources/__tests__/*`, `lib/edit/__tests__/*`

**Analogs:** `packages/apps/editor/src/fs/__tests__/*` (move sources),
`packages/libs/editor-core/lib/__tests__/coreApiSurface.test.ts` (core test style),
`packages/apps/editor/test/utils/MemoryFileSystem.ts` (double source).

**Core test style** (`coreApiSurface.test.ts:1-16`): a file-level `// @vitest-environment node`
docblock for pure tests, a Chinese header comment, `import { describe, expect, it } from 'vitest'`,
and — crucially — **no module-level fixture tables** (the D-22 convention half). Core's
`vitest.config.ts:20-23` includes `lib/**/*.test.{ts,tsx}` under jsdom globally, so pure tests opt
into node explicitly.

**Flat `FsPort` double (D-14)** — model on `MemoryFileSystem.ts:9-178` but strip the nested/callback
halves; keep the four fault-injection knobs and add flat ops:
```ts
export class MemoryFsPort implements FsPort {
  private files = new Map<string, string>();
  private writeDelay = 0;
  private writeCount = 0;
  private writeError: Error | null = null;
  private writeErrors = new Map<string, Error>();
  async readFile(path: string, encoding: 'utf-8' | 'base64'): Promise<string> { … }
  async writeFile(path: string, data: string, encoding: 'utf-8' | 'base64'): Promise<void> {
    this.writeCount += 1;
    const perPath = this.writeErrors.get(path);
    if (perPath) throw perPath;
    if (this.writeError) throw this.writeError;
    await this.delay(this.writeDelay);
    this.files.set(path, data);
  }
  // …readFileBinary/deleteFile/readdir/mkdir/moveFile
  setWriteDelay(ms: number): void { this.writeDelay = ms; }
  setWriteError(error: Error): void { this.writeError = error; }
  setWriteErrorForPath(path: string, error: Error): void { this.writeErrors.set(path, error); }
  getWriteCount(): number { return this.writeCount; }
  setFile(path: string, content: string): void { this.files.set(path, content); }
}
```
**Test setup delta** — per-test instance instead of the deleted singleton, and deps-object
construction; assertions unchanged:
```ts
beforeEach(() => {
  persistenceMonitor = new PersistenceMonitor();      // was the module singleton
  memoryFs = new MemoryFsPort();
});
// every `new FileHandler('test.txt', memoryFs.createFsInterface())`
//   becomes `new FileHandler('test.txt', { fs: memoryFs, persistenceMonitor })`
```
**Mandatory rewrites:** every `@test/*` import → core-local helpers (2-line `wait`, or inline
`setTimeout`) — otherwise `coreBoundaries.js:190-196` reds the `lint` job (Pitfall 9). The 23
`new FileHandler(...)` sites inside the moving `FileHandler.test.ts`, plus the
`(handler as any).fs = …` pokes, become constructor deps (the `fs` field name is retained, A8).
`(FileHandlerManager as any).handlers` still resolves (TS `private` is erased at runtime).

**Submodule-coupled tests stay in editor via shims (D-13):** `persistNoRollback.invariants.test.ts`,
`operationHistory.test.ts` (zero changes), and the `resource reactivity` describe split out of
`operationHistory.invariants.test.ts` into a new editor file.

---

### 16. Editor `src/appInstances.ts` (composition-root-lite) — NEW (D-07)

**Primary analog (composition root + instance factory):** `packages/libs/editor-core/lib/kernel/core.ts:113-240`
**Secondary analog (top-level wiring / error handling):** `packages/apps/editor/src/main.tsx:11-31`

This is the **only** `new FileHandlerManager(` / `new PersistenceMonitor(` / `new OperationHistory(`
site in `packages/apps/editor/src` (the verifier in §19 asserts it). It mirrors `createEditorCore`'s
"assemble the object graph, hand out the instance" shape:
```ts
// packages/apps/editor/src/appInstances.ts   (deleted in Phase 11)
// SHIM(phase4)
import {
  FileHandlerManager as FileHandlerManagerClass,
  OperationHistory,
  PersistenceMonitor,
  type FsPort,
} from '@motajs/editor-core';
import { fs } from '@/services/fs';
import { captureEditorViewport, restoreEditorViewport, type EditorViewport } from '@/project/history/viewport';

/** FsPromiseApi is structurally a superset of FsPort — no cast (D-05). */
export const fsPort: FsPort = fs.promises;

export const persistenceMonitor = new PersistenceMonitor();
// The core class is imported aliased: a same-scope `import { FileHandlerManager }` plus
// `export const FileHandlerManager` would be a redeclaration (TS2440). The instance keeps the
// legacy editor name.
export const FileHandlerManager = new FileHandlerManagerClass({ fs: fsPort, persistenceMonitor });
export const operationHistory = new OperationHistory();

operationHistory.registerUndoSystem<EditorViewport | null>({
  id: 'viewport',
  capture: () => captureEditorViewport(),                 // sync, at execute() invocation
  restore: (snapshot) => restoreEditorViewport(snapshot),
});
```
**Why one module, not one per shim (Q1):** the *same* `persistenceMonitor` object must be seen by the
injected `FileHandler`s, `DataResource.persistStatus()` (`src/project/data/DataResource.ts:124-131`),
the UI/draft guard (`PersistenceNotification.tsx:3`, `AppTopBar.tsx:19`, `LocPanel/index.tsx:29`),
and ~10 test files calling `whenQuiescent`/`failedFiles`/`resetForTests`.

---

### 17. Editor `src/project/history/viewportOperations.ts` + `useOperationHistory.ts` — NEW

**Analog (relocation source):** `packages/apps/editor/src/project/history/operations.ts:150-204`
(`RestoreViewportOperation`, `NavigateFloorOperation`, `navigateFloorOperation`) → move as-is into
`viewportOperations.ts` (D-02; the file keeps its `./viewport` import).

**Zero-arg hook wrapper** — analog `operationHistory.ts:189-204`, now delegating to core's hook so
the two existing call sites (`AppTopBar.tsx:22`, `PanelSlot.tsx:21`) stay untouched:
```ts
// src/project/history/useOperationHistory.ts
import { useOperationHistory as useCoreUseOperationHistory } from '@motajs/editor-core';
import { operationHistory } from '@/appInstances';

export function useOperationHistory() {
  return useCoreUseOperationHistory(operationHistory);
}
```

---

### 18. Editor re-export shims (`// SHIM(phase4)`) — D-10

**Analog (named re-export style):** `packages/libs/editor-core/lib/index.ts:9-18` (the repo's
"named, never `export *`" convention) and the existing `src/fs/index.ts` barrel.

Shims are **forward-only** (no `new`, no `class`/`function` bodies — the verifier asserts this).
`verbatimModuleSyntax: true` is on for the editor, so type-only forwards must be `export type`:
```ts
// src/fs/ContentUtils.ts   (SHIM(phase4))
// SHIM(phase4)
export { ContentUtils } from '@motajs/editor-core';

// src/fs/types.ts          (SHIM(phase4))
// SHIM(phase4)
export type { Content, FileContent } from '@motajs/editor-core';

// src/fs/PersistenceMonitor.ts  (SHIM(phase4))
// SHIM(phase4)
export { PersistenceMonitor } from '@motajs/editor-core';
export { persistenceMonitor } from '@/appInstances';

// src/fs/FileHandlerManager.ts  (SHIM(phase4)) — the INSTANCE wins the name (D-07)
// SHIM(phase4)
export { FileHandlerManager } from '@/appInstances';
```
**Never** `export * from '@motajs/editor-core'` on the singleton shims — it would re-export the core
*class* under the same name as the editor *instance* (Pitfall 8). The other shims
(`src/project/resources.ts`, `src/project/history/{operations,operationHistory}.ts`,
`src/utils/{action,fieldPath}.ts`, `src/utils/base/signal.ts`) use explicit named re-exports.

**Barrels that must be rewritten:** `src/fs/index.ts` (currently `export * from './…'`, source :5-15)
→ core names + editor-only `Json2xDataHandler`/`ScriptDataHandler` + instance names;
`src/project/history/index.ts` (source :1-21) → core edit names + `navigateFloorOperation` (from the
new `viewportOperations.ts`) + `operationHistory` instance + `useOperationHistory` wrapper.
**Unchanged:** `src/fs/Json2xDataHandler.ts`, `src/fs/ScriptDataHandler.ts` (D-01) — they import
`./DataHandler`/`./FileHandler`, which now resolve to shims.

---

### 19. Editor `scripts/verify/editorShims.js` (verifier) — NEW

**Primary analog (marker + two-polarity + `failures[]` + `process.exit(1)`):**
`scripts/verify/coreModuleState.js:29-158, 275-315, 415-440`
**Secondary analog (raw-specifier / manifest scanning, fixture cleanup):**
`scripts/verify/coreBoundaries.js:211-238`

Copy the verifier family's shape exactly: ESM (`import … from 'node:…'`), a Chinese header comment,
`const failures = []` + `check(condition, message)` (`coreModuleState.js:135-139`), a
`finally { fs.rmSync(…) }` fixture cleanup followed by an `fs.existsSync` absence assertion
(`:284-315`), and a final `全部断言通过` success line (`:433-437`).

**Assertions to implement (Q6b):**
1. **Collect markers** — scan `packages/apps/editor/src/**/*.{ts,tsx}` for `// SHIM(phase4)`.
2. **Non-vacuity** — `markedFiles.length >= EXPECTED_SHIMS.length`; every expected path exists; the
   marked set **equals** the expected set (a new shim must be registered deliberately; a deleted shim
   is noticed — the Phase-11 inventory).
3. **Forward-only** — each marked file matches a re-export regex; contains no `new [A-Z]`, no
   `class`/`function`.
4. **The one-new-point invariant** — for each of `new FileHandlerManager(`, `new PersistenceMonitor(`,
   `new OperationHistory(`, offenders outside `src/appInstances.ts` must be **0**. This is the
   actually-enforcing half of the retargeted depcruise rule (see §20).
5. **Two-polarity** — (i) real tree passes; (ii) a synthetic marked fixture with no re-export must
   produce ≥1 failure; (iii) a synthetic `new PersistenceMonitor(` outside the app-instance module
   must fail; both fixtures deleted in `finally`.

Wire it as **one extra `- run:` step in the existing `lint` job** (no new job — `ci-workflow.js`
asserts exactly four).

---

### 20. `.dependencyCruiser.cjs` — retarget `requireZero` + new rule

**Analog:** its own current `core-singletons-only-imported-by-composition-root` rule
(`.dependencyCruiser.cjs:53-66`).

Replace the core-path `to.path` with **raw import specifiers** (measured: dependency-cruiser does not
resolve `@/`, Pitfall 5) and retarget `from` to the future composition root / `src/appInstances.ts`.
Keep it inside the existing file, run by the existing `coreBoundaries.js` in the existing `lint` job.
The exact recommended rule text is in `04-RESEARCH.md` §Q6a (lines 801-821) — copy it, including the
honest comment that the editor half is dormant-by-target until Phase 11, and that
`scripts/verify/editorShims.js` carries the Phase-4-real guard. Also add the new
`resources/edit must not import capabilities` rule (the existing `kernel-must-not-import-capabilities`
rule's `from` is `^…/lib/(index\.ts|kernel/.*)$`, `:22-28`, so it does not cover the new dirs).

---

### 21. `eslint.config.js` — widen Block B ignores

**Analog:** its own `coreModuleStateConfig` block (`eslint.config.js:157-183`).

`ignores` (line 159) currently exempts only `lib/kernel/core.ts` and `lib/__tests__/**`. Widen to
cover every core test tree:
```js
ignores: [
  'packages/libs/editor-core/lib/kernel/core.ts',
  'packages/libs/editor-core/lib/**/__tests__/**',
  'packages/libs/editor-core/lib/**/*.test.{ts,tsx}',
],
```
**Do not merge Block A and Block B** — flat config array rules overwrite across blocks (documented at
`:147-152`), and Block A (PORT-02) must keep covering test files.

---

### 22. `scripts/verify/coreModuleState.js` — sample a new test tree

**Analog:** its own `firstTestFile()` (`coreModuleState.js:244-253`) and
`checkResolvedConfigScoping()` (`:368-413`).

`firstTestFile()` scans only `lib/__tests__`. Extend it (or add a second sample) to also pick a file
from `lib/resources/__tests__/**` / `lib/edit/__tests__/**`, so the widened Block-B exemption is
**proven**, not assumed (Pitfall 4).

---

### 23. `scripts/verify/coreExports.js` + `subpathStatus.json` — two-file contract

**Analogs:** `coreExports.js:77-81` (`SUBPATH_CONTENT`) and
`.planning/phases/02-package-boundary-build-scaffolding/subpathStatus.json:6-10`.

Update **both in one commit** to the truthful value `kernel+resources+edit-exports`
(INTERFACE-NAME §F):
```js
// coreExports.js
const SUBPATH_CONTENT = { '.': 'kernel+resources+edit-exports', './react': 'probe' };
```
```json
// subpathStatus.json
".": { "target": "./lib/index.ts", "content": "kernel+resources+edit-exports", "carriesProbe": false }
```
Do **not** add a `./resources` / `./edit` subpath — `EXPECTED_SUBPATHS` is exactly seven
(`coreExports.js:46`); adding one reds the `typecheck` job (D-09).

---

### 24. `package.json` + `pnpm-workspace.yaml` — new core dependencies

**Analog:** the manifest's own `dependencies` section shape (Phase-2 D-02: "其余一律普通
`dependencies`") and the `catalog:` block.

Add to `packages/libs/editor-core/package.json` `dependencies` (not peers — `coreExports.js:49-59,
213-232` asserts exactly nine peers): `ts-pattern`, `@tanstack/store`, `@tanstack/react-store`,
`es-toolkit`. Add two new catalog entries (`@tanstack/store: 0.8.0`, `@tanstack/react-store: 0.8.0`)
and pin `es-toolkit` to the exact installed `1.44.0` (Pitfall 7 / A4). Install through the mandated
proxy: `set HTTP_PROXY=http://127.0.0.1:7890 && set HTTPS_PROXY=http://127.0.0.1:7890 && pnpm install`.
Add a `checkpoint:human-verify` before the `es-toolkit` edit (seam `SUS(too-new)`).

---

## Shared Patterns

### Constructor injection (no module-level `new`)
**Source:** `lib/kernel/core.ts:113-117` (all mutable containers in the function/instance)
**Apply to:** `FileHandler`, `FileHandlerManager`, `PersistenceMonitor`, `OperationHistory`
```ts
// de-singleton shape: class only, collaborators injected, no trailing `new`
export class FileHandlerManager {
  private readonly handlers = new Map<string, FileHandler>();
  private readonly deps: FileHandlerDependencies;
  constructor(deps: FileHandlerDependencies) { this.deps = deps; }   // NO parameter property
}
```
**Constraint (Pitfall 1):** `erasableSyntaxOnly` is on for core's files via the editor's `tsc -b` —
never use constructor parameter properties, `enum`, or `namespace` in core.

### Flat `FsPort` (never nested `fs.promises`, never a default)
**Source:** `lib/ports/fs.ts:20-51`
**Apply to:** every moved file that reads/writes files
```ts
// D-05: core consumes the injected flat port only
const fsPort: FsPort = fs.promises;    // structural superset — no cast
await this.deps.fs.readFile(path, 'utf-8');    // NOT this.fs.promises.readFile(...)
```

### Named re-exports (never `export *` in the public surface / shims)
**Source:** `lib/index.ts:9-11` (rationale) + `lib/index.ts:13-19` (style)
**Apply to:** `lib/index.ts`, `lib/react/index.ts`, every editor shim, both editor barrels
```ts
export { ContentUtils } from '@motajs/editor-core';
export type { Content } from '@motajs/editor-core';   // verbatimModuleSyntax
```

### Module-state discipline (Block B / D-10)
**Source:** `eslint.config.js:157-183`; exemption proof at `coreModuleState.js:74-75, 99-102`
**Apply to:** all core production files
No module-level `let`/`var`, no bare object/array/`Map`/`Set` literals under an exported `const`.
Use `Object.freeze({…})` / `as const` where a table is unavoidable (`ContentUtils` is the only case).
The gate does **not** catch `new Store(...)`/`new ResourceRegistry(...)` (Pitfall 3) — keep the
construct-then-export pattern out of `lib/**` by construction; `src/appInstances.ts` is the only `new` site.

### Registration returns a disposer
**Source:** `lib/kernel/core.ts:164-170` (`EditorCore.registerCapability`); result shape
`lib/kernel/registry.ts:27-31`
**Apply to:** `OperationHistory.registerUndoSystem`, `ResourceRegistry.register`
```ts
const disposer = (): void => { if (entries.get(target) === entry) entries.delete(target); };
entries.set(target, entry);
return { disposer, diagnostics: [] };
```

### Test style
**Source:** `lib/__tests__/coreApiSurface.test.ts:1-16`
**Apply to:** all moved/new core tests
File-level Chinese header, `// @vitest-environment node` for pure tests, no module-level fixture
tables, assertions unchanged on moves (only setup/import changes).

### Verifier family
**Source:** `scripts/verify/coreModuleState.js` (marker + two-polarity) and
`scripts/verify/coreBoundaries.js` (fixture cleanup + raw-specifier scanning)
**Apply to:** `scripts/verify/editorShims.js`
ESM, Chinese header, `failures[]` + `check()`, fixture written and deleted in `finally` with an
absence assertion, `process.exit(1)` on failure, `全部断言通过` on success.

### Path/import rewrites for every moved file
**Source:** `04-RESEARCH.md` §Q10 table (lines 963-983)
Drop `@/` → extensionless relative; `import type` for type-only; `@test/*` never survives into core.

---

## No Analog Found

| File | Role | Data Flow | Reason / fallback |
|------|------|-----------|-------------------|
| `lib/resources/ResourceRegistry.ts` | service | CRUD (id map) | No in-repo "logical id → resource" registry exists (RES-02 confirmed new). Build from `lib/kernel/core.ts:125-193` + `lib/kernel/registry.ts` (role-match analog above), **unwired** to `projectData` in Phase 4 (A3). |
| `lib/edit/undoSystem.ts` | model | event-driven | No `UndoSystem` exists; the seam is new. Shape from `OperationTarget` (`operations.ts:11-16`) — `capture` sync, `restore` async (A2). |
| `scripts/verify/editorShims.js` | test | — | No shim verifier exists; build from the `coreModuleState.js`/`coreBoundaries.js` family (analogs above). |
| `src/appInstances.ts` | config | event-driven | No editor-side composition module exists yet; build from `lib/kernel/core.ts:113-240` + `main.tsx:11-31`. |

*(All four have strong role-match analogs — none is truly unmapped; they are listed here because no
exact same-name/same-shape precedent exists.)*

---

## Metadata

**Analog search scope:** `packages/libs/editor-core/lib/**`, `packages/apps/editor/src/{fs,project/history,project/data,utils,blockly,services}/**`, `packages/apps/editor/test/utils/**`, `scripts/verify/**`, repo root configs (`eslint.config.js`, `.dependencyCruiser.cjs`), `.planning/phases/02-.../subpathStatus.json`
**Files scanned:** ~30 (read this session; every analog verified `git ls-files`-tracked)
**Pattern extraction date:** 2026-09-23
**Naming source of truth:** `.planning/phases/04-resource-edit-layers-moved/INTERFACE-NAME.md` (CONFIRMED)
**Move-mechanics source of truth:** `04-RESEARCH.md` §Q10 (per-file import-rewrite table) + §Q1–Q9
