# Phase 5: Engine Adapter Skeleton & Resource Descriptors - Pattern Map

**Mapped:** 2026-09-28
**Files analyzed:** 12 source/tooling files + 1 mandatory planning artifact
**Analogs found:** 11 exact/role-match, 1 partial (engine-B fixture), 0 missing

> **Project Rule gate (read before planning):** every important name below marked **(TBD)** must first be written into
> `.planning/phases/05-engine-adapter-skeleton-resource-descriptors/INTERFACE-NAME.md` (one section per Plan, stating
> each name's **purpose**) and confirmed by the user **before** it lands in code. Describe class methods as
> `ClassName.methodName`. The file does not exist yet — creating/confirming it is Plan 1's first task.
>
> **Additive constraint:** `packages/apps/editor/src/project/data/projectData.ts` is a **read-only reference** this
> phase (D-01, "一行不改"). It is cited below as the *source of truth for the 10 paths*, never as a file to edit.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `packages/libs/editor-core/lib/ports/engine.ts` (MODIFIED) | contract / port + pure validator | transform (validate/normalize) | `resourceRegistry.ts` (validation+throw) + `kernel/errors.ts` (aggregated error) | role-match |
| `packages/libs/editor-core/lib/resources/fileResource.ts` **(TBD name)** (NEW) | resource class | file-I/O (reactive) | `combinators.ts` `ComputedResource` + `fileHandler.ts` | role-match (exact shape) |
| `packages/libs/editor-core/lib/__tests__/engineB.ts` **(TBD name)** (NEW) | test fixture | file-I/O + derived | `resources.test.ts` `TestResource` + `memoryFsPort.ts` | partial |
| `packages/libs/editor-core/lib/__tests__/engineContract.test.ts` **(TBD name)** (NEW) | test | request-response (contract) | `resourceRegistry.test.ts` + `resources.test.ts` | role-match |
| `packages/libs/editor-core/lib/__tests__/coreApiSurface.test.ts` (MODIFIED) | test | request-response | itself (extend existing assertions) | exact |
| `packages/libs/editor-core/lib/index.ts` (MODIFIED) | barrel | n/a | itself (existing named re-export block) | exact |
| `packages/apps/editor/src/adapter/motaEngine.ts` **(TBD name)** (NEW) | adapter / descriptor config | file-I/O (declarative) | `project/data/projectData.ts` (reference only; 10 paths + lazy handlers) | role-match |
| `packages/apps/editor/src/adapter/motaFloor.ts` **(TBD name)** (NEW) | adapter factory | file-I/O | `projectData.ts` `ProjectDataImpl.floor` + `floorPath` | role-match |
| `scripts/verify/coreEngineNeutral.js` **(TBD name)** (NEW) | verifier / gate | batch (static scan) | `coreModuleState.js` + `editorShims.js` + `coreBoundaries.js` | exact (copy skeleton) |
| `.github/workflows/ci.yml` (MODIFIED) | config | n/a | itself (lint job step list) | exact |
| `.planning/phases/02-package-boundary-build-scaffolding/subpathStatus.json` + `scripts/verify/coreExports.js` (CONDITIONAL) | config + verifier | n/a | themselves (hand-maintained pair) | exact |
| `.planning/phases/05-.../INTERFACE-NAME.md` **(MANDATORY artifact)** | planning doc | n/a | Phase 3/4 precedent (Project Rule) | n/a |

## Pattern Assignments

### `packages/libs/editor-core/lib/ports/engine.ts` (contract/port + validator, MODIFIED)

**Analog A:** `packages/libs/editor-core/lib/resources/resourceRegistry.ts` — id grammar + throw-on-invalid precedent.
**Analog B:** `packages/libs/editor-core/lib/kernel/errors.ts` — aggregated error class carrying a frozen list.
**Analog C:** `packages/libs/editor-core/lib/kernel/core.ts` — collect-all-problems-then-throw-once.

**Current shape to extend** (`engine.ts:1-15`, the entire file today):
```ts
export interface EngineAdapter {
  /** 适配器的逻辑身份，供 Phase 5 以它作为引擎描述的键（`EngineAdapter.id`）。 */
  readonly id: string;

  /** 适配器实现的契约版本（`EngineAdapter.apiVersion`）。 */
  readonly apiVersion: string;
}
```

**Id grammar to REUSE, never reinvent** (`resourceRegistry.ts:25-37`):
```ts
/** 逻辑 id 形式：一段或多段以点分隔，每段以字母/`_`/`$` 开头，不含空白与斜杠。 */
const LOGICAL_ID_PATTERN = /^[A-Za-z_$][A-Za-z0-9_$]*(\.[A-Za-z_$][A-Za-z0-9_$]*)*$/;

/** 保留名：即使形式上合法也拒绝，避免任何对象键语义的误用（V5）。 */
const RESERVED_IDS = Object.freeze(['__proto__', 'constructor', 'prototype']);

/** 校验逻辑 id；不合法即抛出普通 `Error`（不产生机器诊断，见文件头 Pitfall 10）。 */
function assertValidLogicalId(id: string): void {
  if (id.length === 0) throw new Error('Resource id 不能为空');
  if (/\s/.test(id)) throw new Error(`Resource id 不能包含空白字符：${JSON.stringify(id)}`);
  if (RESERVED_IDS.includes(id)) throw new Error(`Resource id 不允许使用保留名：${id}`);
  if (!LOGICAL_ID_PATTERN.test(id)) throw new Error(`Resource id 形式不合法：${id}`);
}
```
> Do NOT let the two grammars drift. Either export a shared predicate from `resourceRegistry.ts` and import it, or
> duplicate with a comment linking them (RESEARCH §"The id grammar defineEngine must reuse"). A descriptor id that
> `ResourceRegistry.register` later rejects would otherwise surface only at registration (Phase 11).

**Throw-on-invalid precedent + per-problem message naming the offender** (`resourceRegistry.ts:49-59`):
```ts
register<T>(id: string, resource: ResourceView<T>): () => void {
  assertValidLogicalId(id);
  if (this.entries.has(id)) throw new Error(`Resource already registered: ${id}`);
  ...
}
```

**Aggregated error class to mirror** (`kernel/errors.ts:18-30`) — extends `Error`, sets `name`, freezes the carried list,
does NOT call `Error.captureStackTrace` (core tsconfig has no `@types/node`):
```ts
export class EditorCoreStartupError extends Error {
  public readonly diagnostics: readonly Diagnostic[];

  constructor(diagnostics: readonly Diagnostic[]) {
    const missing = diagnostics
      .filter((diagnostic) => diagnostic.code === DIAGNOSTIC_CODES.capabilityRequiredMissing)
      .map((diagnostic) => diagnostic.target ?? '(unknown)');
    const summary = missing.length > 0 ? missing.join('、') : 'unknown required capability';
    super(`Editor core startup failed: missing required capabilities: ${summary}`);
    this.name = 'EditorCoreStartupError';
    this.diagnostics = Object.freeze([...diagnostics]);
  }
}
```

**Collect-all-then-throw-once precedent** (`kernel/core.ts:211-230`):
```ts
const requiredRefs = new Set<string>([...(config.requiredCapabilities ?? []), ...BUILTIN_REQUIRED_CAPABILITIES]);
let missingCount = 0;
for (const ref of requiredRefs) {
  if (entries.has(ref)) continue;
  missingCount += 1;
  diagnostics.push({ severity: 'error', code: DIAGNOSTIC_CODES.capabilityRequiredMissing, message: `缺少必需的能力注册：${ref}`, target: ref });
}
if (missingCount > 0) {
  drainTeardowns(teardowns, diagnostics);
  throw new EditorCoreStartupError(diagnostics.snapshot());
}
```

**Version constant convention** (`kernel/core.ts:25`): `export const EDITOR_CORE_API_VERSION = '0.1.0';`
If a dedicated `ENGINE_ADAPTER_API_VERSION` is added, it follows this exact shape (a module-level `export const`, not an
instance member) — **flag it in INTERFACE-NAME; the user may veto and reuse `EDITOR_CORE_API_VERSION`** (Research A3).

**Proposed new members (names all TBD — confirm first):**
`ResourceDescriptor<T>` = `{ id, create(deps), preload?, preloadDependsOn? }`; `ResourceDependencies` = `{ fileHandlers }`;
`EngineDescription` = `{ id, apiVersion?, resources }`; `defineEngine(description): EngineAdapter`;
`EngineDefinitionError` (name TBD). **No `path`/`format`/handler-instance field may appear** (D-04).
`create` has a **fixed signature `create(deps)` with no id parameter** (Pitfall A).

---

### `packages/libs/editor-core/lib/resources/fileResource.ts` (resource class, NEW — TBD name)

**Analog A:** `packages/libs/editor-core/lib/resources/combinators.ts` — a class implementing `LoadableResource<T>`
(`id`/`content`/`ensureLoaded`/`reload`/`waitForSettled`/`value`/`subscribe`). This is the structural template.
**Analog B:** `packages/libs/editor-core/lib/resources/fileHandler.ts` — injected-dependency object + reactive signal class.
**Delegates:** `fileHandlerManager.ts` (`get`/`load`/`reload`) and `dataHandler.ts` (handler base).

**Interface the class must implement** (`combinators.ts:8-20`):
```ts
export interface ResourceView<T> {
  readonly id: string;
  readonly content: ReadonlySignal<Content<T>>;
  snapshot(): Content<T>;
  value(): T;
  subscribe(listener: (content: Content<T>) => void): () => void;
}
export interface LoadableResource<T> extends ResourceView<T> {
  ensureLoaded(): Promise<void>;
  reload(): Promise<void>;
  waitForSettled(): Promise<void>;
}
```

**Class implementation template** (`combinators.ts:29-87`) — the shape to copy (field init + delegates):
```ts
export class ComputedResource<T> implements LoadableResource<T> {
  readonly content: ReadonlySignal<Content<T>>;
  readonly id: string;
  ...
  constructor(id: string, dependencySource: DependencySource, computeContent: () => Content<T>, reloadDependencySource: DependencySource = dependencySource) {
    this.id = id;
    ...
    this.content = computed(computeContent);
  }
  snapshot(): Content<T> { return this.content(); }
  value(): T { return ContentUtils.unwrap(this.content(), this.id); }
  async ensureLoaded(): Promise<void> { ... }
  async reload(): Promise<void> { ... }
  async waitForSettled(): Promise<void> {
    await waitUntil(() => !['idle', 'loading'].includes(this.content().status));
  }
  subscribe(listener: (content: Content<T>) => void): () => void { return effect(() => listener(this.content())); }
}
```

**Injected-dependency object pattern** (`fileHandler.ts:11-34`) — the deps object is shared, not positional args:
```ts
export interface FileHandlerDependencies {
  readonly fs: FsPort;
  readonly persistenceMonitor: PersistenceMonitor;
}

export class FileHandler implements IContentHandler<string> {
  private _content = signal<Content<string>>({ status: 'idle' });
  readonly content = this._content as ReadonlySignal<Content<string>>;
  ...
  constructor(path: string, deps: FileHandlerDependencies) {
    this.path = path;
    this.fs = deps.fs;
    this.persistenceMonitor = deps.persistenceMonitor;
  }
```

**Manager delegation** (`fileHandlerManager.ts:37-46, 57-87, 162-165`) — the file-backed class delegates to these; it
does **not** construct a `FileHandler` itself:
```ts
get(path: string): FileHandler {
  let handler = this.handlers.get(path);
  if (!handler) {
    handler = new FileHandler(path, this.deps);
    this.handlers.set(path, handler);
  }
  return handler;
}
```
```ts
async load(path: string): Promise<FileHandler> {
  const existingPromise = this.loadingPromises.get(path);
  if (existingPromise) return existingPromise;
  const handler = this.get(path);
  if (handler.isLoaded()) return handler;
  const loadPromise = (async () => { try { await handler.ensureLoaded(); return handler; } finally { this.loadingPromises.delete(path); } })();
  this.loadingPromises.set(path, promise);
  return loadPromise;
}
```

**Handler base constructor + value unwrap** (`dataHandler.ts:30`, `:73-87`, `:135-140`):
```ts
constructor(fileHandler: FileHandler, resourceName: string) { ... }
```
```ts
getContent(): Content<T> { return this.content(); }
unwrap(): T { return ContentUtils.unwrap(this.getContent(), this.resourceName); }
waitForSettled(): Promise<void> {
  return waitUntil(() => { const status = this.content().status; return status !== 'loading' && status !== 'idle'; });
}
```

**Hard constraints for this class (D-06):** `address` and the `FileHandler` are **private**; the class inspects no file
extension and concatenates/decodes no path (`ports/fs.ts:16-18` — core owns no path-normalisation surface). Constructor
signature (TBD, confirm in INTERFACE-NAME): `(id, address, handlerFactory: (file: FileHandler) => IDataHandler<T>, deps)`.

---

### `packages/libs/editor-core/lib/__tests__/engineB.ts` (test fixture, NEW — TBD name)

**Analog A:** `resources.test.ts:10-68` — the in-file `TestResource<T> implements LoadableResource<T>` double (copy
this for the non-file resource shape).
**Analog B:** `resources/__tests__/memoryFsPort.ts:15-144` — the `FsPort` in-memory double to drive the file-backed
fixture (reuse directly, do not re-implement).

**Class-double template** (`resources.test.ts:10-68`, abridged — the pattern for a **non-file** engine-B resource):
```ts
class TestResource<T> implements LoadableResource<T> {
  readonly content: ReadonlySignal<Content<T>>;
  readonly id: string;
  private readonly mutableContent: ReturnType<typeof signal<Content<T>>>;
  constructor(id: string, initial: Content<T>, loadedValue: T) {
    this.id = id;
    this.mutableContent = signal(initial);
    this.content = this.mutableContent as ReadonlySignal<Content<T>>;
    ...
  }
  snapshot(): Content<T> { return this.mutableContent(); }
  ...
}
```
> Engine B must include **at least one non-file resource** built with `computedResource(...)` so it proves the
> descriptor is source-agnostic (D-11 / Pattern 3). The RESEARCH sketch ids (`engineB.catalog`, `engineB.index`,
> `engineB.notes`, `engineB.chapter`) and the exact export symbol are **TBD — confirm in INTERFACE-NAME**.

**Reusable FsPort double** (`memoryFsPort.ts:15-62, 119-144`): `setFile`/`getFile`/`hasFile`/`clear` helpers; a missing
path rejects with `file-not-found: <path>` (`:59`), which `isFileNotFoundError` recognises → `not-found`.

**Self-check:** assert the fixture source contains none of the banned game words (RESEARCH Pattern 3 assertion 7).

---

### `packages/libs/editor-core/lib/__tests__/engineContract.test.ts` (test, NEW — TBD name)

**Analog A:** `resources/__tests__/resourceRegistry.test.ts` — vitest file header/docblock style + `describe`/`it`.
**Analog B:** `resources/__tests__/resources.test.ts` — driving combinators and asserting `Content` status transitions.

**Test-file header convention** (`resourceRegistry.test.ts:1-13`):
```ts
// @vitest-environment node
/**
 * `ResourceRegistry`（RES-02）单元测试。
 * ...
 * fixture 纪律（D-22 的约定半边）：本文件不声明模块级 fixture 表；期望值直接写在用例内。
 */
import { describe, expect, it } from 'vitest';
```
Use `// @vitest-environment node` (core's vitest defaults to jsdom).

**Assertion style for status transitions** (`resources.test.ts:71-83`) — assert on `snapshot()`:
```ts
const optionalSource = optional(source, {});
expect(optionalSource.snapshot()).toEqual({ status: 'loaded', value: {} });
await optionalSource.ensureLoaded();
expect(source.reloadCalls).toBe(0);
```

**Registry round-trip style to mirror** (`resourceRegistry.test.ts:31-40`):
```ts
const registry = new ResourceRegistry();
const resource = makeResource('mota.tower', 42);
const disposer = registry.register('mota.tower', resource);
expect(registry.get<number>('mota.tower')).toBe(resource);
expect(registry.ids()).toEqual(['mota.tower']);
```

**End-to-end assertions required** (RESEARCH Pattern 3 list): ids frozen in declared order; register→get same view;
file-backed read through `MemoryFsPort` yields `loaded` / missing yields `not-found`; **non-file view performs no FsPort
read**; preload order lists dependencies before dependents; cycle/dangling dep each throw with **all** problems in one
error; duplicate ids rejected; non-function `create` rejected.

---

### `packages/libs/editor-core/lib/__tests__/coreApiSurface.test.ts` (test, MODIFIED)

**Analog:** itself. Extend the existing runtime + compile-time assertions.

**Runtime value assertions** (`coreApiSurface.test.ts:148-174`):
```ts
const functions = [ ..., computedResource, aggregateResource, ... ];
for (const candidate of functions) expect(typeof candidate).toBe('function');
```

**Compile-time type assertions** (`coreApiSurface.test.ts:176-199`):
```ts
expectTypeOf<ResourceView<string>>().not.toBeNever();
expectTypeOf<LoadableResource<string>>().not.toBeNever();
```
Add: `defineEngine` (value), `ResourceDescriptor<unknown>` / `EngineDescription` (types), `EngineAdapter` still resolves
(`:126` `expectTypeOf<EngineAdapter>().toBeObject();`). Keep `DIAGNOSTIC_CODES` at exactly five (`:100-108`) — do **not**
add a diagnostic code for `defineEngine` (Pitfall 10 / RESEARCH Pattern 1).

---

### `packages/libs/editor-core/lib/index.ts` (barrel, MODIFIED)

**Analog:** itself. Add **named** re-exports only, in the existing resources block.

**Existing block to extend** (`index.ts:38-47`):
```ts
export { FileHandler } from './resources/fileHandler';
export type { FileHandlerDependencies } from './resources/fileHandler';
...
export { ResourceRegistry } from './resources/resourceRegistry';
export type { ResourceRegistryEntry } from './resources/resourceRegistry';
```
Add `defineEngine` / (error class) as values, `ResourceDescriptor` / `EngineDescription` / `ResourceDependencies` /
`PreloadStrategy` (TBD) as `export type`, and the new file-backed class as a value. Header rule (`index.ts:9-11`):
named re-exports only, never `export *`; this file is a leaf — nothing under `lib/` may import `../index` (`no-circular`).

---

### `packages/apps/editor/src/adapter/motaEngine.ts` (adapter/descriptor, NEW — TBD name)

**Analog:** `packages/apps/editor/src/project/data/projectData.ts` — **reference source only, do not edit**. It is the
authoritative list of the 10 paths and the handler each uses.

**The 10 paths to express** (`projectData.ts:20-28`, `:76-78`; config `editorConfigService.ts:18`):
```ts
const TOWER_DATA_PATH = 'project/data.js';
const ITEMS_DATA_PATH = 'project/items.js';
const ENEMYS_DATA_PATH = 'project/enemys.js';
const MAPS_BLOCKS_DATA_PATH = 'project/maps.js';
const ICONS_DATA_PATH = 'project/icons.js';
const FUNCTIONS_DATA_PATH = 'project/functions.js';
const PLUGINS_DATA_PATH = 'project/plugins.js';
const EVENTS_DATA_PATH = 'project/events.js';
const EVENTS_VAR_NAME = 'events_c12a15a8_c380_4b28_8144_256cba95f760';
```
```ts
function floorPath(floorId: string): string { return `project/floors/${floorId}.js`; }
```
```ts
const CONFIG_PATH = '_server/config.json';   // editorConfigService.ts:18
```

**Lazy handler construction to mirror** (`projectData.ts:98-107`, `:189-198`) — descriptor `create(deps)` is the same
lazy `new` shape:
```ts
tower(): DataResource<TowerData> {
  if (!this.towerResource) {
    this.towerResource = new HandlerDataResource(
      'tower',
      TOWER_DATA_PATH,
      new TowerDataHandler(FileHandlerManager.get(TOWER_DATA_PATH)),
    );
  }
  return this.towerResource;
}
```
```ts
events(): DataResource<EventsData> {
  if (!this.eventsResource) {
    this.eventsResource = new HandlerDataResource(
      'events', EVENTS_DATA_PATH,
      new Json2xDataHandler<EventsData>(FileHandlerManager.get(EVENTS_DATA_PATH), EVENTS_VAR_NAME, 'Events Data'),
    );
  }
  return this.eventsResource;
}
```

**Handler classes the adapter constructs** (`TowerDataHandler.ts:17-21`; `Json2xDataHandler.ts:21-33`):
```ts
export class TowerDataHandler extends Json2xDataHandler<TowerData> {
  constructor(fileHandler: FileHandler) { super(fileHandler, DATA_VAR_NAME, 'Tower Data'); }
}
```
```ts
export class Json2xDataHandler<T> extends DataHandler<T> {
  constructor(fileHandler: FileHandler, varName: string, resourceName: string) { super(fileHandler, resourceName); this.varName = varName; }
}
```

**Mapping table (from RESEARCH §Adapter mapping):** `mota.tower`→`project/data.js`/`TowerDataHandler`; `mota.items`,
`mota.enemys`, `mota.maps`, `mota.icons`, `mota.functions`, `mota.plugins` → their `*DataHandler`; `mota.events` →
`Json2xDataHandler<EventsData>(f, EVENTS_VAR_NAME, 'Events Data')`; `mota.editorConfig` → `_server/config.json` /
`JsonDataHandler<EditorConfig>`; floor family → parameterized (below). Ids/`preload` literals are **TBD**.

**Hard constraints:**
- Adapter imports only the **contract** from `@motajs/editor-core` and the handler classes from `@/services/*` +
  `@/fs/Json2xDataHandler`. It must **NOT** import `@/project/data/projectData` (Pitfall G).
- Use `deps.fileHandlers` for the manager, not the `@/fs/FileHandlerManager` singleton — this is what keeps it Phase-11-ready.
- The path/var-name literals are **duplicated** here (or in an adapter-local constants module) because D-01 forbids
  exporting them from `projectData.ts`. Record this duplication in the plan so it is not mistaken for a leak (Research A6).
- The adapter is **dead code** this phase (no consumer until Phase 11); it must not be pulled into any entry bundle.

---

### `packages/apps/editor/src/adapter/motaFloor.ts` (adapter factory, NEW — TBD name)

**Analog:** `projectData.ts` `ProjectDataImpl.floor` + `floorPath` (`:76-78`, `:109-121`).
```ts
floor(floorId: string): DataResource<FloorData> {
  let resource = this.floorResources.get(floorId);
  if (!resource) {
    const path = floorPath(floorId);
    resource = new HandlerDataResource(`floor:${floorId}`, path, new FloorDataHandler(FileHandlerManager.get(path), floorId));
    this.floorResources.set(floorId, resource);
  }
  return resource;
}
```
Export a factory `(floorId) => ResourceDescriptor<FloorData>` returning a **concrete** descriptor (path resolved
adapter-side, core never sees it). **Open Question 1 / name TBD.** Flag the id-grammar risk: a real `floorId` may not
satisfy `LOGICAL_ID_PATTERN`; decide whether the factory sanitises/encodes the id — **do not silently widen the registry
grammar** (RESEARCH OQ1).

---

### `scripts/verify/coreEngineNeutral.js` (verifier/gate, NEW — TBD name)

**Analog A:** `scripts/verify/coreModuleState.js` — the structural skeleton to copy.
**Analog B:** `scripts/verify/editorShims.js` — `collectSources()` walker + two-polarity `try/finally` fixture pattern.
**Analog C:** `scripts/verify/coreBoundaries.js` — `SYNTHETIC_FIXTURE` / `SYNTHETIC_SOURCE` constants.

**Header + imports + assertion helpers** (`coreModuleState.js:1-34`, `:134-144`):
```js
#!/usr/bin/env node
/**
 * editor-core 静态门禁的两极性证明（...）。
 * 用法：node scripts/verify/coreEngineNeutral.js
 * ...
 */
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const REPO_ROOT = path.resolve(import.meta.dirname, '..', '..');
...
const failures = [];
function check(condition, message) { if (!condition) failures.push(message); }
function relative(absolutePath) { return path.relative(REPO_ROOT, absolutePath).replace(/\\/g, '/'); }
```

**Recursive source walker to copy** (`editorShims.js:114-130`) — add the `__tests__` exclusion for D-12 scope:
```js
function collectSources(dir) {
  const results = [];
  const walk = (current) => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (/\.tsx?$/.test(entry.name)) results.push({ relPath: relative(full), source: fs.readFileSync(full, 'utf8') });
    }
  };
  walk(dir);
  results.sort((left, right) => left.relPath.localeCompare(right.relPath));
  return results;
}
```

**Two-polarity fixture create/inspect/finally-delete** (`editorShims.js:275-293`):
```js
function checkTwoPolarity() {
  try {
    fs.writeFileSync(FORWARD_FIXTURE, FORWARD_FIXTURE_SOURCE, 'utf8');
    const forwardLocal = forwardOnlyFailures(collectMarkedFiles(collectSources(EDITOR_SRC)));
    check(forwardLocal.length > 0, '两极性 (i) 失败：...');
    ...
  } finally {
    fs.rmSync(FORWARD_FIXTURE, { force: true });
  }
  check(!fs.existsSync(FORWARD_FIXTURE), `... fixture 未被删除：${relative(FORWARD_FIXTURE)}`);
}
```

**Synthetic fixture constants style** (`coreBoundaries.js:52-58`):
```js
const SYNTHETIC_FIXTURE = path.join(REPO_ROOT, CORE_LIB, 'code', '__boundariesProbe__.ts');
const SYNTHETIC_SOURCE = "import '../table/index';\n";
```

**`main()` + `process.exit(1)`** (`coreModuleState.js:454-477`):
```js
function main() {
  ...
  if (failures.length > 0) {
    for (const failure of failures) console.error(`coreModuleState: ${failure}`);
    process.exit(1);
  }
  console.log('coreModuleState: 全部断言通过（...）');
}
main();
```

**Algorithm (D-12/D-13):**
1. Scope `packages/libs/editor-core/lib`, keep `*.ts`/`*.tsx`, **exclude any path containing a `__tests__` segment**.
2. Scan the **raw source including comments** (Pitfall D — do NOT reuse `stripComments()` here).
3. Banned words: `tower / floor / loc / autopass / autotile / idnum / airwall / commonEvent / prefab / mota` with `\b`.
4. `floor` special-case: a hit is a violation **unless the immediately preceding character is `.`** (covers `Math.floor`,
   `.floor()`); implement per-match, not as a different regex.
5. Assert `sources.length > 0` (`editorShims.js:304` `check(sources.length > 0, ...)`).
6. **Two-polarity:** transient fixture under core source with every banned word once **plus a `Math.floor(...)` line and
   a false-friend line** (`location` / a `locState`-like identifier — **not** `localStorage`, already banned by PORT-02);
   delete in `finally`; assert every banned word flagged and no clean case flagged.
7. Starting state is **green** (core production source verified clean this session); if red, fix the real leak — do not
   weaken the gate (D-09/PORT-06).

---

### `.github/workflows/ci.yml` (config, MODIFIED)

**Analog:** itself. Add **one** `- run:` line to the existing `lint` job only.

**Existing steps** (`ci.yml:31-37`):
```yaml
      - run: pnpm lint

      - run: node scripts/verify/coreBoundaries.js

      - run: node scripts/verify/coreModuleState.js

      - run: node scripts/verify/editorShims.js
```
`scripts/verify/ci-workflow.js:31` asserts `JOB_IDS = ['lint', 'typecheck', 'unit', 'build']` and `JOB_SCRIPTS`
(`ci-workflow.js:34`) — adding a step inside `lint` needs **no** change to `ci-workflow.js`. Do not add/rename jobs.

---

### `scripts/verify/coreExports.js` + `.planning/.../subpathStatus.json` (CONDITIONAL, MODIFIED)

**Analog:** themselves. Only touch **if** the `.` `content` label changes.

**The hand-maintained pair + its verifier** (`coreExports.js:78-82`, `:204-208`):
```js
const SUBPATH_CONTENT = {
  '.': 'kernel+resources+edit-exports',
  './react': 'probe',
};
const DEFAULT_SUBPATH_CONTENT = 'empty-barrel';
```
```js
const expectedContent = SUBPATH_CONTENT[subpath] ?? DEFAULT_SUBPATH_CONTENT;
check(entry.content === expectedContent, `subpathStatus.json 的 "${subpath}" content 应为 "${expectedContent}"，...`);
```
If the new exports warrant a new label (e.g. `kernel+resources+edit+adapter-exports`), change `coreExports.js` **and**
`subpathStatus.json:".content"` **in the same commit** (Pitfall F). If the new names fit the existing label, no change.

---

## Shared Patterns

### Core relative imports (no `@/`)
**Source:** convention established `tsconfig.lib.base.json` + Phase 2 D-06; every `lib/**` file uses `./`/`../`.
**Apply to:** all new/modified core files.
```ts
import type { ResourceView } from '../resources/combinators';
import { FileHandlerManager } from './fileHandlerManager';
```
Never `@/` inside core; core is also the only place that must not import `packages/apps/*` or `packages/external/*`
(`.dependencyCruiser.cjs:16-21` `core-must-not-import-consumers`).

### Chinese file-header block comment
**Source:** `resourceRegistry.ts:1-16`, `fileHandlerManager.ts:1-12`, `interfaces.ts:1-3`.
**Apply to:** every new core source file and the verifier (JS header per `coreModuleState.js:1-29`).
State the module's purpose, its constraints, and any deliberate non-goal (e.g. "本阶段刻意不接线").

### Named exports only; `export type` for types
**Source:** `index.ts:9-11` (barrel rule) + editor `verbatimModuleSyntax: true`.
**Apply to:** `index.ts`, all new core files, the adapter.
```ts
export { defineEngine } from './ports/engine';
export type { ResourceDescriptor, EngineDescription, ResourceDependencies } from './ports/engine';
```
Editor adapter files MUST use `import type { X }` for type-only imports (`tsconfig.app.json:7`
`verbatimModuleSyntax`; `:16` `erasableSyntaxOnly` → no `enum`, use `as const`/unions).

### Aggregated-validation error
**Source:** `kernel/errors.ts:18-30` + `kernel/core.ts:227-230`; per-problem throw `resourceRegistry.ts:33-37,51`.
**Apply to:** `defineEngine`. Collect **all** problems, throw once with the frozen full list; no `DiagnosticBus` coupling
(keeps `DIAGNOSTIC_CODES` at exactly five).

### Two-polarity gate skeleton
**Source:** `coreModuleState.js`, `coreBoundaries.js`, `editorShims.js`.
**Apply to:** `coreEngineNeutral.js`. `failures[]` + `check()` + `relative()` + `main()` + `process.exit(1)` + a
transient fixture created and deleted in `finally` with a post-delete existence assertion.

### Reactive resource composition
**Source:** `combinators.ts:114-135` (`computedResource`, `aggregateResource`, `optional`) + `Content` 5-state union
(`types.ts:8-13`).
**Apply to:** the file-backed class's `content`, and engine-B's non-file resource. Never hand-roll subscription
bookkeeping; `subscribe` wraps `effect`, `content` wraps `computed`/`signal`.

### Naming must be confirmed first (Project Rule)
**Source:** `.planning/PROJECT`-level Project Rules in `AGENTS.md`.
**Apply to:** every `(TBD)` name above. Write `INTERFACE-NAME.md` (one section per Plan, each entry stating the thing's
**purpose**) and get user confirmation before landing. Describe class methods as `ClassName.methodName`.

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `packages/libs/editor-core/lib/__tests__/engineB.ts` | test fixture | file-I/O + derived | No existing non-mota engine fixture. **Partial** match only: `resources.test.ts` `TestResource` (class double) + `memoryFsPort.ts` (FsPort double) supply the building blocks; the engine-description assembly is new. Planner should use RESEARCH Pattern 3 for the concrete shape. |

## Metadata

**Analog search scope:** `packages/libs/editor-core/lib/**` (ports, resources, kernel, __tests__), `scripts/verify/*.js`,
`.github/workflows/ci.yml`, `.dependencyCruiser.cjs`, `packages/apps/editor/src/{project/data,services,fs}`.
**Files scanned:** ~30; 14 git-tracked analogs read in full (all tracked-source verified via `git ls-files`).
**Pattern extraction date:** 2026-09-28.
**Mirror-path check:** all cited analogs are tracked source under `packages/` and `scripts/`; no `.gsd/capabilities`
mirror paths exist or are referenced.
