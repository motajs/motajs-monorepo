# Phase 4: Resource + Edit Layers Moved — INTERFACE-NAME.md

> **Status: CONFIRMED (2026-09-23).**
> Per `AGENTS.md` §Project Rules, every important name (file / interface / method / function / type /
> package / exported symbol) is reported here and confirmed **before** it is written into code,
> plans, or config. Function-body locals are exempt.
>
> This file has a **Phase-level** section (names known from CONTEXT.md + RESEARCH.md, all confirmed).
> **Per-Plan sections will be appended after the planner returns**, covering any plan-specific name.
> Methods are written `ClassName.methodName`.

---

## Resolved decisions that shaped naming

| # | Decision | Choice |
|---|----------|--------|
| Q1 | `action.ts` + `fieldPath.ts` scope | **(A)** move both into `lib/edit/`, shim both old paths, add `es-toolkit` to core `dependencies` |
| Q2 | `ResourceRegistry` (RES-02) | **(A)** Phase 4 delivers class + unit tests, **unwired** to `projectData` |
| Q3 | App-instance module file name | **(A)** `packages/apps/editor/src/appInstances.ts` |
| Q4 | `useOperationHistory` signature | **(A)** core `useOperationHistory(history)` + editor zero-arg wrapper |
| Q5 | `subpathStatus.json` `.` content value | `kernel+resources+edit-exports` (two-file contract with `coreExports.js`) |

---

## Phase-level names (confirmed)

### A. Core `lib/resources/*` — moved resource layer (D-09: internal dir, exported from root `.`)

| Name | Kind | Purpose (what it is for) | Origin |
|------|------|--------------------------|--------|
| `lib/resources/types.ts` | file | `Content<T>` five-state union + `FileContent` | moved from `src/fs/types.ts` |
| `lib/resources/interfaces.ts` | file | `ReadonlySignal`/`IContentView`/`IContentHandler`/`IDataHandler`/`RecoverableResource` | moved from `src/fs/interfaces.ts` |
| `lib/resources/ContentUtils.ts` | file | `ContentUtils` combinator object (arrives as `Object.freeze({…})`) | moved from `src/fs/ContentUtils.ts` |
| `lib/resources/errors.ts` | file | `isFileNotFoundError` (not-found ≠ error) | moved from `src/fs/errors.ts` |
| `lib/resources/waitUntil.ts` | file | home for the `waitUntil` signal-timing helper | moved from `src/utils/base/signal.ts` |
| `lib/resources/FileHandler.ts` | file | text-file state machine; constructor takes injected `FileHandlerDependencies` | moved from `src/fs/FileHandler.ts` |
| `lib/resources/FileHandlerManager.ts` | file | per-path `FileHandler` cache; **per-instance class**, no trailing `new` | moved from `src/fs/FileHandlerManager.ts` |
| `lib/resources/DataHandler.ts` | file | abstract parse/stringify handler over a `FileHandler` | moved from `src/fs/DataHandler.ts` |
| `lib/resources/JsonDataHandler.ts` | file | generic JSON handler (core keeps only this one) | moved from `src/fs/JsonDataHandler.ts` |
| `lib/resources/BinaryFileHandler.ts` | file | read-only binary → `HTMLImageElement`; `FsPort`, no default | moved from `src/fs/BinaryFileHandler.ts` |
| `lib/resources/PersistExecutor.ts` | file | one-executing + one-pending, latest-wins, retry | moved from `src/fs/PersistExecutor.ts` |
| `lib/resources/PersistenceMonitor.ts` | file | path-owned `PersistExecutor` map; **class only**, no trailing `new` | moved from `src/fs/PersistenceMonitor.ts` |
| `lib/resources/combinators.ts` | file | `computedResource` / `aggregateResource` / `optional` + `ResourceView` / `LoadableResource` / `ComputedResource` | moved from `src/project/resources.ts` (renamed) |
| `lib/resources/ResourceRegistry.ts` | file | RES-02: generic logical-id → resource registration | new |

### B. Core `lib/edit/*` — moved edit layer (D-09)

| Name | Kind | Purpose | Origin |
|------|------|---------|--------|
| `lib/edit/operations.ts` | file | `EditorOperation`/`OperationTarget`/`AppliedOperation`/`OperationMeta`/`CompositeOperation`/`compositeOperation`/`operationPathTarget`/`patchResourceOperation` (minus viewport ops) | moved from `src/project/history/operations.ts` |
| `lib/edit/operationHistory.ts` | file | `OperationHistory` (capacity 100, multi-target checkpoint, undo/redo); store moves onto the instance | moved from `src/project/history/operationHistory.ts` |
| `lib/edit/undoSystem.ts` | file | `UndoSystem` contract (the D-03 delegation seam) | new |
| `lib/edit/action.ts` | file | `Action` + `applyActionsWithInverse` (D-04 field-action primitive) | moved from `src/utils/action.ts` |
| `lib/edit/fieldPath.ts` | file | field-path helpers `parseFieldPath`/`buildFieldPath`/`getByFieldPath`/`setByFieldPath`/`deleteByFieldPath` | moved from `src/utils/fieldPath.ts` |

### C. New exported types / interfaces

| Name | Kind | Purpose |
|------|------|---------|
| `FileHandlerDependencies` | interface | the injected deps object `{ fs: FsPort; persistenceMonitor: PersistenceMonitor }`, shared by `FileHandler` and `FileHandlerManager` so the pair can never be passed in the wrong order |
| `UndoSystem<Snapshot>` | interface | the undo delegation contract: `id`, `capture()`, `restore(snapshot)`; core stores one snapshot per registered system per history entry |
| `PatchableResource<T>` | interface | narrow resource contract core's patch op needs: `path`, `raw()`, `mutate()` (satisfied structurally by editor's `DataResource<T>`) |
| `ResourceRegistry` | class | RES-02 registry: logical id → resource |
| `ResourceRegistryEntry` | interface | snapshot row of `ResourceRegistry` (`id` + `resource`) |

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

*(Appended after the planner returns. One section per plan, per `AGENTS.md`.)*
