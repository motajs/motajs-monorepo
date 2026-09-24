# Phase 4: Resource + Edit Layers Moved — INTERFACE-NAME.md

> **Status: CONFIRMED (2026-09-23).**
> Per `AGENTS.md` §Project Rules, every important name (file / interface / method / function / type /
> package / exported symbol) is reported here and confirmed **before** it is written into code,
> plans, or config. Function-body locals are exempt.
>
> Sections: a **File-name convention** rule, the **Phase-level** names, and **one section per Plan**
> (04-01 … 04-04). Methods are written `ClassName.methodName`.

---

## File-name convention (user-mandated, 2026-09-23)

**File names use lowerCamelCase. Only React component files (`.tsx`) use PascalCase.**

Scope and the one deliberate exception:

- Applies to **every file this phase creates** — the moved-in modules in `packages/libs/editor-core/lib/resources/**` and `lib/edit/**`, the new core test files, the new core `FsPort` test double, and the new editor files.
- **Does NOT rename pre-existing editor files that become shims** (`packages/apps/editor/src/fs/{types,interfaces,errors,ContentUtils,FileHandler,FileHandlerManager,DataHandler,JsonDataHandler,BinaryFileHandler,PersistExecutor,PersistenceMonitor}.ts`, `src/project/resources.ts`, `src/project/history/{operations,operationHistory,index}.ts`, `src/utils/{action,fieldPath}.ts`, `src/utils/base/signal.ts`, `src/fs/index.ts`). Those exact paths are the import contract for the editor's ~78 consumers, and the shim mechanism depends on them; they are deleted in Phase 11.
- **React components keep PascalCase** (e.g. `CoreProbe.tsx`).
- **Symbol names are NOT renamed.** A class `FileHandler` still lives in `fileHandler.ts`; the root barrel still exports the symbol `FileHandler`.

---

## Resolved decisions that shaped naming

| # | Decision | Choice |
|---|----------|--------|
| Q1 | `action.ts` + `fieldPath.ts` scope | **(A)** move both into `lib/edit/`, shim both old paths, add `es-toolkit` to core `dependencies` |
| Q2 | `ResourceRegistry` (RES-02) | **(A)** Phase 4 delivers class + unit tests, **unwired** to `projectData` |
| Q3 | App-instance module file name | **(A)** `packages/apps/editor/src/appInstances.ts` |
| Q4 | `useOperationHistory` signature | **(A)** core `useOperationHistory(history)` + editor zero-arg wrapper |
| Q5 | `subpathStatus.json` `.` content value | `kernel+resources+edit-exports` (two-file contract with `coreExports.js`) |
| Q6 | File-name convention | lowerCamelCase; PascalCase only for `.tsx` components (see above) |

---

## Phase-level names (confirmed)

### A. Core `lib/resources/*` — moved resource layer (D-09: internal dir, exported from root `.`)

| Name | Kind | Purpose (what it is for) | Origin |
|------|------|--------------------------|--------|
| `lib/resources/types.ts` | file | `Content<T>` five-state union + `FileContent` | moved from `src/fs/types.ts` |
| `lib/resources/interfaces.ts` | file | `ReadonlySignal`/`IContentView`/`IContentHandler`/`IDataHandler`/`RecoverableResource` | moved from `src/fs/interfaces.ts` |
| `lib/resources/contentUtils.ts` | file | `ContentUtils` combinator object (arrives as `Object.freeze({…})`) | moved from `src/fs/ContentUtils.ts` |
| `lib/resources/errors.ts` | file | `isFileNotFoundError` (not-found ≠ error) | moved from `src/fs/errors.ts` |
| `lib/resources/waitUntil.ts` | file | home for the `waitUntil` signal-timing helper | moved from `src/utils/base/signal.ts` |
| `lib/resources/fileHandler.ts` | file | text-file state machine; constructor takes injected `FileHandlerDependencies` | moved from `src/fs/FileHandler.ts` |
| `lib/resources/fileHandlerManager.ts` | file | per-path `FileHandler` cache; **per-instance class**, no trailing `new` | moved from `src/fs/FileHandlerManager.ts` |
| `lib/resources/dataHandler.ts` | file | abstract parse/stringify handler over a `FileHandler` | moved from `src/fs/DataHandler.ts` |
| `lib/resources/jsonDataHandler.ts` | file | generic JSON handler (core keeps only this one) | moved from `src/fs/JsonDataHandler.ts` |
| `lib/resources/binaryFileHandler.ts` | file | read-only binary → `HTMLImageElement`; `FsPort`, no default | moved from `src/fs/BinaryFileHandler.ts` |
| `lib/resources/persistExecutor.ts` | file | one-executing + one-pending, latest-wins, retry | moved from `src/fs/PersistExecutor.ts` |
| `lib/resources/persistenceMonitor.ts` | file | path-owned `PersistExecutor` map; **class only**, no trailing `new` | moved from `src/fs/PersistenceMonitor.ts` |
| `lib/resources/combinators.ts` | file | `computedResource` / `aggregateResource` / `optional` + `ResourceView` / `LoadableResource` / `ComputedResource` | moved from `src/project/resources.ts` (renamed) |
| `lib/resources/resourceRegistry.ts` | file | RES-02: generic logical-id → resource registration | new |

### B. Core `lib/edit/*` — moved edit layer (D-09)

| Name | Kind | Purpose | Origin |
|------|------|---------|--------|
| `lib/edit/operations.ts` | file | `EditorOperation`/`OperationTarget`/`AppliedOperation`/`OperationMeta`/`CompositeOperation`/`compositeOperation`/`operationPathTarget`/`patchResourceOperation` (minus viewport ops) | moved from `src/project/history/operations.ts` |
| `lib/edit/operationHistory.ts` | file | `OperationHistory` (capacity 100, multi-target checkpoint, undo/redo); store moves onto the instance | moved from `src/project/history/operationHistory.ts` |
| `lib/edit/undoSystem.ts` | file | `UndoSystem` contract (the D-03 delegation seam) | new |
| `lib/edit/action.ts` | file | `Action` + `applyActionsWithInverse` (D-04 field-action primitive) | moved from `src/utils/action.ts` |
| `lib/edit/fieldPath.ts` | file | field-path helpers (all nine exports) | moved from `src/utils/fieldPath.ts` |

### C. New exported types / interfaces

| Name | Kind | Purpose |
|------|------|---------|
| `FileHandlerDependencies` | interface | the injected deps object `{ fs: FsPort; persistenceMonitor: PersistenceMonitor }`, shared by `FileHandler` and `FileHandlerManager` so the pair can never be passed in the wrong order |
| `UndoSystem<Snapshot>` | interface | the undo delegation contract: `id`, `capture()`, `restore(snapshot)`; core stores one snapshot per registered system per history entry |
| `PatchableResource<T>` | interface | narrow resource contract core's patch op needs: `path`, `raw()`, `mutate()` (satisfied structurally by editor's `DataResource<T>`) |
| `ResourceRegistry` | class | RES-02 registry: logical id → resource |
| `ResourceRegistryEntry` | interface | snapshot row of `ResourceRegistry` (`id` + `resource`) |
| `FileHandlerManagerClass` | module-local import alias (NOT exported) | in `src/appInstances.ts`, the core `FileHandlerManager` class is imported under this alias so the exported instance can keep the legacy editor name `FileHandlerManager` (same-scope import + export-const of one name is TS2440) |

### D. New methods (`ClassName.methodName`)

| Name | Purpose |
|------|---------|
| `OperationHistory.registerUndoSystem` | registers an `UndoSystem`; returns a disposer; registration order defines reverse restore order |
| `ResourceRegistry.register` | registers a resource under a logical id; returns a disposer; duplicate id rejected |
| `ResourceRegistry.get` | looks up a resource by logical id (may be undefined) |
| `ResourceRegistry.getOrThrow` | looks up a resource by logical id, throwing if absent |
| `ResourceRegistry.has` | tests whether a logical id is registered |
| `ResourceRegistry.ids` | lists registered logical ids |
| `ResourceRegistry.snapshot` | returns the frozen flat entry array |

### E. Editor-side new files (deleted in Phase 11)

| Name | Kind | Purpose |
|------|------|---------|
| `packages/apps/editor/src/appInstances.ts` | file | the **single `new` site**: constructs and exports `persistenceMonitor`, `FileHandlerManager`, `operationHistory`; registers the viewport `UndoSystem` |
| `packages/apps/editor/src/project/history/viewportOperations.ts` | file | relocated `RestoreViewportOperation` / `NavigateFloorOperation` / `navigateFloorOperation` (D-02) |
| `packages/apps/editor/src/project/history/useOperationHistory.ts` | file | editor zero-arg wrapper over core's hook |

### F. Verifier / marker / record values

| Name | Kind | Purpose |
|------|------|---------|
| `scripts/verify/editorShims.js` | file | two-polarity verifier: lists every `// SHIM(phase4)` file, asserts shims are forward-only, and asserts `src/appInstances.ts` is the **only** `new FileHandlerManager(` / `new PersistenceMonitor(` / `new OperationHistory(` site |
| `// SHIM(phase4)` | marker comment | marks every re-export shim; the Phase-11 deletion inventory |
| `kernel+resources+edit-exports` | string value | new `subpathStatus.json['.'].content` / `coreExports.js` `SUBPATH_CONTENT['.']` (two-file contract) |

### G. Changed files (no new public name)

`.dependencyCruiser.cjs` (retarget `requireZero` to editor specifiers + add a `resources/edit must not import capabilities` rule), `eslint.config.js` (widen the module-state Block B ignores to all core test trees), `scripts/verify/coreModuleState.js` (sample a new test tree in the exemption probe), `packages/libs/editor-core/package.json` (add `dependencies`: `ts-pattern`, `@tanstack/store`, `@tanstack/react-store`, `es-toolkit`), `pnpm-workspace.yaml` (add `@tanstack/store`/`@tanstack/react-store` catalog entries), `packages/libs/editor-core/lib/index.ts`, `packages/libs/editor-core/lib/react/index.ts`, and the editor shim/barrel files under `src/fs/*`, `src/project/resources.ts`, `src/project/history/{operations,operationHistory,index}.ts`, `src/utils/{action,fieldPath,base/signal}.ts`.

---

## Per-Plan sections

### Plan 04-01 — Tracer: resource leaf end-to-end, persistence chain de-singleton, `src/appInstances.ts`

| Name | Kind | What it is for |
|------|------|----------------|
| `wait` (in `lib/resources/__tests__/testHelpers.ts`) | exported function | the 2-line timer helper the moved persistence tests used to import from `@test/utils/testHelpers`; core may not alias `@test/*` |
| `fsPort` (exported const in `src/appInstances.ts`) | exported binding | names the single `FsPort` binding (`fs.promises`) that `FileHandlerManager` is constructed with in 04-02; exported rather than module-local so 04-01's own editor typecheck stays green under `noUnusedLocals` (an unexported, unread binding is TS6133) |
| `lib/resources/contentUtils.ts`, `persistExecutor.ts`, `persistenceMonitor.ts` | file names | lowerCamelCase per the convention (symbols `ContentUtils`, `PersistExecutor`, `PersistenceMonitor` unchanged) |

### Plan 04-02 — Injected `FileHandler`/`FileHandlerManager` chain, data/binary handlers, combinators

| Name | Kind | What it is for |
|------|------|----------------|
| `MemoryFsPort` | exported class | the flat, seven-operation `FsPort` test double for core tests (D-14); the name must be distinct from the editor's nested/callback `MemoryFileSystem` double |
| `lib/resources/__tests__/memoryFsPort.ts` | file name | home for that double |
| `lib/resources/__tests__/contentSignalLiveness.test.ts` | file name | home for the RES-06 liveness assertion required by `04-VALIDATION.md`'s Wave 0 list; a new file rather than an added case in the moved `fileHandler.test.ts`, because D-13 requires moved tests' assertions to stay untouched |
| `FileHandlerManagerClass` | module-local import alias (NOT exported) | `src/appInstances.ts` imports the core `FileHandlerManager` class under this alias so the exported instance keeps the legacy editor name `FileHandlerManager` (see §C) |
| `lib/resources/fileHandler.ts`, `fileHandlerManager.ts`, `dataHandler.ts`, `jsonDataHandler.ts`, `binaryFileHandler.ts` | file names | lowerCamelCase per the convention (symbols unchanged) |

### Plan 04-03 — `lib/edit/*`, the `UndoSystem` seam, `useOperationHistory` on `./react`

| Name | Kind | What it is for |
|------|------|----------------|
| `OperationHistory.store` | public readonly field | exposes the per-instance `Store<OperationHistoryState>` so `useOperationHistory` in `./react` can subscribe with `useStore`; required because the store can no longer be a module-level value |
| `captureSystems` / `restoreSystems` | module-private functions | the two halves of the `UndoSystem` delegation seam inside `operationHistory.ts`; not exported, but they are the named seam the D-03 decision is implemented with |

### Plan 04-04 — `ResourceRegistry` (RES-02), machine gates, phase record

| Name | Kind | What it is for |
|------|------|----------------|
| `singletons-only-imported-by-composition-root` | dependency-cruiser rule name | the retargeted `requireZero` rule: the three editor singletons that remain may only be imported by the future composition root |
| `resources-edit-must-not-import-capabilities` | dependency-cruiser rule name | keeps `lib/resources` and `lib/edit` out of the four capability directories (D-06 DAG) |
| `EXPECTED_SHIMS` | module-local const | the hard-coded eighteen-file shim inventory the verifier asserts set-equality against |
| `APP_INSTANCE_MODULE` | module-local const | the one file (`packages/apps/editor/src/appInstances.ts`) allowed to construct the three instances and exempt from the forward-only rule |
| `lib/resources/resourceRegistry.ts` | file name | lowerCamelCase per the convention (symbol `ResourceRegistry` unchanged) |

---

*Confirmed: 2026-09-23. Any further new important name must be added here and confirmed before it lands in code.*
