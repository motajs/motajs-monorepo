---
status: complete
phase: 04-resource-edit-layers-moved
source: [04-01-SUMMARY.md, 04-02-SUMMARY.md, 04-03-SUMMARY.md, 04-04-SUMMARY.md]
started: 2026-09-24T00:00:00.000Z
updated: 2026-09-24T01:00:00.000Z
---

## Current Test
<!-- OVERWRITE each test - shows where we are -->

[testing complete]

## Tests

### 1. Dependency decision approval (04-01 D5)
expected: The four core dependencies (ts-pattern, @tanstack/store, @tanstack/react-store, es-toolkit pinned to 1.44.0), the two new catalog entries, and the proxy-routed install were approved before the manifest edit.
result: pass
note: "Approved in-session — the user replied 「可以执行」 to a briefing that enumerated all four items; recorded as the explicit (non---auto) approval the blocking gate required. No further human action needed."

### 2. UI / behaviour parity (04-04 D4)
expected: Against `.planning/baseline/screenshots/`, the four editors (table / code / asset / map) and the workbench shell look unchanged; a floor edit persists across reload; undo/redo restores the viewport; no spurious persistence failure.
result: pass

### 3. Resource leaf modules moved and re-exported (04-01 D1)
expected: Content/FileContent, ReadonlySignal/IContentView/IContentHandler/IDataHandler/RecoverableResource, isFileNotFoundError, waitUntil, ContentUtils live in lib/resources/* and are exported from the core root `.` and every legacy editor path.
result: pass
source: automated
coverage_id: 04-01/D1

### 4. PersistExecutor and PersistenceMonitor de-singletonised (04-01 D2)
expected: Both live in core as classes with no module-level instance; the four pure persistence tests pass inside core with assertions untouched.
result: pass
source: automated
coverage_id: 04-01/D2

### 5. Exactly one PersistenceMonitor instance per editor (04-01 D3)
expected: src/appInstances.ts is the only `new PersistenceMonitor(` site, and the shim forwards the same object to FileHandler, DataResource.persistStatus, the UI/draft guard and tests.
result: pass
source: automated
coverage_id: 04-01/D3

### 6. Core module-state gate covers every core test tree (04-01 D4)
expected: The widened exemption is proven by sampling a non-lib/__tests__ test file; coreModuleState.js and coreBoundaries.js exit 0; pnpm lint exits 0.
result: pass
source: automated
coverage_id: 04-01/D4

### 7. FileHandler has exactly one constructor form (04-02 D1)
expected: `FileHandler(path, deps)` only — no default Fs, no second positional parameter, no `fs.promises.*` under lib/resources/; the `fs` field name is retained.
result: pass
source: automated
coverage_id: 04-02/D1

### 8. FileHandlerManager is a per-instance class (04-02 D2)
expected: Per-instance handler maps; no trailing module instance; no FileHandlerManagerImpl; the editor holds exactly one manager built in src/appInstances.ts.
result: pass
source: automated
coverage_id: 04-02/D2

### 9. FileHandlerManager drives handlers with its injected deps (04-02 D3)
expected: Handlers use the same shared deps the manager was constructed with, and the four adapted editor fixtures keep passing through the shim.
result: pass
source: automated
coverage_id: 04-02/D3

### 10. Data/binary handlers and combinators reachable through shims (04-02 D4)
expected: DataHandler/JsonDataHandler/BinaryFileHandler and the three combinators are exported from the core root `.`; the editor reaches every one unchanged; Json2xDataHandler/ScriptDataHandler still inherit core's DataHandler.
result: pass
source: automated
coverage_id: 04-02/D4

### 11. ReadonlySignal<Content<T>> is a live signal (04-02 D5)
expected: Every resource exposes `ReadonlySignal<Content<T>>` derived by signal/computed — proven by re-invoking a callable captured before the mutation.
result: pass
source: automated
coverage_id: 04-02/D5

### 12. Generic edit primitives live in lib/edit and reach the root (04-03 D1)
expected: OperationMeta/OperationTarget/EditorOperation/AppliedOperation/compositeOperation/operationPathTarget/patchResourceOperation/UndoSystem plus the nine field-path and five action names are in lib/edit/*, reachable from the core root `.`, and reached unchanged through `// SHIM(phase4)` forwarders.
result: pass
source: automated
coverage_id: 04-03/D1

### 13. OperationHistory de-singletonised (04-03 D2)
expected: The Store is an instance field exposed as OperationHistory.store, the UndoSystem registry is per-instance, and src/appInstances.ts is the only `new OperationHistory(` site.
result: pass
source: automated
coverage_id: 04-03/D2

### 14. Data patch still captures/restores the viewport (04-03 D3)
expected: A plain data patch captures and restores the viewport on undo/redo via the registered `viewport` UndoSystem — the capture-all, restore-in-reverse behaviour pinned by operationHistory.test.ts:55-71.
result: pass
source: automated
coverage_id: 04-03/D3

### 15. useOperationHistory on ./react with an editor zero-arg wrapper (04-03 D4)
expected: Core's ./react exports useOperationHistory(history); the editor's zero-arg wrapper keeps AppTopBar.tsx and PanelSlot.tsx byte-identical; @tanstack/react-store appears in core only under lib/react/.
result: pass
source: automated
coverage_id: 04-03/D4

### 16. PatchableResource<T> is satisfied structurally by DataResource<T> (04-03 D5)
expected: PatchableResource<T> is the only write contract core's patch operation knows; the editor's DataResource<T> satisfies it with zero edits, so commandOperations.ts/floorCommands.ts compile untouched.
result: pass
source: automated
coverage_id: 04-03/D5

### 17. ResourceRegistry supports generic logical-id registration (04-04 D1)
expected: Map-backed registry with duplicate/malformed-id rejection, a working disposer with a stale guard, a frozen snapshot, two-instance isolation, delivered unwired from projectData.
result: pass
source: automated
coverage_id: 04-04/D1

### 18. The machine gates enforce the one-new-site and DAG invariants (04-04 D2)
expected: editorShims.js proves both polarities; the retargeted and new dependency-cruiser rules keep lib/resources and lib/edit inside the DAG; all inside the existing lint job.
result: pass
source: automated
coverage_id: 04-04/D2

### 19. Truthful subpath record and complete root surface (04-04 D3)
expected: Both coreExports.js and subpathStatus.json record `kernel+resources+edit-exports` (no new subpath); the complete Phase-4 root export surface is machine-asserted while DIAGNOSTIC_CODES stays exactly five.
result: pass
source: automated
coverage_id: 04-04/D3

## Summary

total: 19
passed: 19
issues: 0
pending: 0
skipped: 0

## Gaps

[none yet]
