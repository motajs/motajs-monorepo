# Roadmap: motajs-monorepo

## Overview

This milestone is a **packaging and boundary milestone**, not a feature milestone: extract an engine-agnostic `@motajs/editor-core` from `@motajs/editor` as a pure refactor with complete behavior parity. The journey is ordered by risk: first build and quantify the verification net (the repo currently has no PR CI, a conditionally-skipped e2e suite, and tests that cannot start without the `packages/external/mota-js` submodule), then create and enforce the package boundary, then build the per-instance kernel that replaces the six module singletons, then move the already-agnostic resource/edit layers verbatim, then push all engine-specific paths/formats/vocabulary into a mota-js adapter proven against a fake engine B. From there the four capabilities extract in ascending engine-coupling order — table (schema-only) → code (file-backed) → asset (binary + write-heavy) → map (five semantic hooks + Pixi) — each validating the capability-port pattern on a new axis. Preview resolves through the settled registries, the adapter completes the cutover and deletes every shim, and the milestone closes by freezing the extension surface and executing the parity acceptance gate. Every phase after Phase 2 must end green on the Phase 1 baseline; "behavior unchanged" is only meaningful because Phase 1 makes it measurable.

## Phases

**Phase Numbering:**

- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Baseline & Verification Net** - Quantify the current behavior and make the test/CI safety net actually run before any code moves
- [ ] **Phase 2: Package Boundary & Build Scaffolding** - Create `packages/libs/editor-core` and enforce the boundary, resolution, styling, and compiler rules
- [ ] **Phase 3: Kernel — Runtime, Ports, Registry, Diagnostics** - Replace the six module singletons with a per-instance `EditorCore`, public capability registry, and declared ports
- [ ] **Phase 4: Resource + Edit Layers Moved** - Relocate the engine-agnostic resource and edit layers verbatim, preserving all invariants
- [ ] **Phase 5: Engine Adapter Skeleton & Resource Descriptors** - Move paths, formats, vocabulary, and migrations into the adapter, proven with a fake engine B
- [ ] **Phase 6: Fixed Shell + Slots** - Extract the fixed workbench shell with registry-driven named slots, visually identical to baseline
- [ ] **Phase 7: Table Capability + Port** - Extract the schema-driven table editor with layered field-editor overrides and an injected asset-catalog port
- [ ] **Phase 8: Code Capability + Port** - Extract Monaco code editing and the generic Blockly host, with language config injected and keybindings reconciled
- [ ] **Phase 9: Asset Capability + Port** - Extract asset management, validating the port for binary and write-heavy operations
- [ ] **Phase 10: Map Capability + Port** - Extract Pixi map editing and the five semantic hooks behind capability ports
- [ ] **Phase 11: Preview Service + Adapter Cutover + Shim Deletion** - Extract preview with the v4 wire contract unchanged; complete the adapter cutover and delete all shims
- [ ] **Phase 12: Extension Surface Freeze, Parity Verification & Protocol Freeze** - Freeze the extension surface and pass the milestone parity acceptance gate

## Phase Details

### Phase 1: Baseline & Verification Net

**Goal**: Establish a running, quantified verification baseline — the before-picture that makes "behavior unchanged" measurable — before a single file moves.
**Depends on**: Nothing (first phase)
**Requirements**: VERIFY-01, VERIFY-02, VERIFY-03, VERIFY-04, VERIFY-06, VERIFY-07
**Success Criteria** (what must be TRUE):

  1. `packages/external/mota-js` submodule is initialized and the full unit-test suite can start and run per package.
  2. A PR CI workflow runs lint + per-package typecheck + unit tests + production build, and fails on regression.
  3. Characterization tests for `PersistExecutor`/`PersistenceMonitor` and `operationHistory` pass, locking error→retry→idle, concurrent latest-wins, no-UI-rollback-on-persist-failure, capacity 100, and multi-target checkpoint rollback.
  4. A recorded baseline exists (per-package unit counts, e2e run, build output, bundle/artifact size vs the 20 MiB ceiling, `editor-manifest.json`, protocol constants) plus Playwright screenshot baselines for the four editors + shell.
  5. No e2e test is silently skipped — each is either a required fixture or carries a CI-visible marker.

**Plans**: 7 plans
Plans:
**Wave 1**

- [ ] 01-01-PLAN.md — Repair the local environment and initialize the `mota-js` submodule (VERIFY-01)

**Wave 2** *(blocked on Wave 1 completion)*

- [ ] 01-02-PLAN.md — Record the quantified baseline: unit/e2e counts, build artifact vs 20 MiB, manifest, protocol constants, four-editor screenshots (VERIFY-01)

**Wave 3** *(blocked on Wave 2 completion)*

- [ ] 01-03-PLAN.md — Characterization tests freezing the persistence invariants (VERIFY-03)
- [ ] 01-04-PLAN.md — Characterization tests freezing the history invariants (VERIFY-04)
- [ ] 01-05-PLAN.md — Required e2e fixture replacing the silent skip, plus the manifest protocol assertion (VERIFY-06, VERIFY-07)

**Wave 4** *(blocked on Wave 3 completion)*

- [ ] 01-06-PLAN.md — Editor `vitest.config.ts` split, per-package `typecheck`, root fan-out scripts (VERIFY-02)

**Wave 5** *(blocked on Wave 4 completion)*

- [ ] 01-07-PLAN.md — Four-job PR CI workflow and required status checks (VERIFY-02)

### Phase 2: Package Boundary & Build Scaffolding

**Goal**: Create `packages/libs/editor-core` and make the boundary, module resolution, styling, and compiler coverage machine-enforced rather than assumed.
**Depends on**: Phase 1
**Requirements**: PKG-01, PKG-02, PKG-03, PKG-04, PKG-05, VERIFY-05
**Success Criteria** (what must be TRUE):

  1. `packages/libs/editor-core` exists using `lib/` (not `src/`), with `private: true`, `type: module`, `sideEffects: false`, and the full subpath export map (`.`, `./code`, `./table`, `./map`, `./asset`, `./shell`, `./react`).
  2. React/ReactDOM and all singleton libraries (antd, Semi, alien-signals, immer, monaco-editor, pixi.js, blockly) are declared as `peerDependencies` + `catalog:default`, and exactly one copy resolves.
  3. `tsc -b` and a Vite build resolve core's `@/` imports identically (verified, not assumed).
  4. PandaCSS generates a known core class and React Compiler transforms core TSX (both probed; workarounds applied if not).
  5. `dependency-cruiser` rules (forbidden edges, singleton `requireZero`, no-cycles) run in CI and fail on violation.

**Plans**: TBD
**UI hint**: yes

### Phase 3: Kernel — Runtime, Ports, Registry, Diagnostics

**Goal**: Replace the six module singletons with a per-instance `EditorCore` graph that owns a public capability registry, declared ports, and aggregated startup diagnostics.
**Depends on**: Phase 2
**Requirements**: KERN-01, KERN-02, KERN-03, KERN-04, KERN-05, KERN-06, PORT-01, PORT-02
**Success Criteria** (what must be TRUE):

  1. `createEditorCore(config)` returns a per-instance `EditorCore`, and two instances coexist without interference (isolation test passes).
  2. `dispose()` releases resources in reverse creation order.
  3. `registerCapability(kind, id, value, {owner, replaceable})` returns diagnostics + rollback, and `createEditorCore()` aggregates all diagnostics and fails startup loudly when a required registration is unresolved.
  4. `EDITOR_CORE_API_VERSION`, `DiagnosticBus`, and all port interfaces (`EngineAdapter`, `FsPort`, `HostPort`, `PreviewAdapter`, capability ports) exist and are exported.
  5. Core source contains no default `Fs`, no DOM/environment parsing, and no direct `fetch` — every dependency is injected by the composition root.

**Plans**: TBD

### Phase 4: Resource + Edit Layers Moved

**Goal**: Move the already-engine-agnostic resource and edit layers into core verbatim, with existing tests green and every behavioral invariant intact.
**Depends on**: Phase 3
**Requirements**: RES-01, RES-02, RES-03, RES-04, RES-05, RES-06
**Success Criteria** (what must be TRUE):

  1. `src/fs/*` and `src/project/resources.ts` are moved into `lib/resources/*`, and `src/project/history/*` into `lib/edit/*`, with the existing test suites passing unchanged.
  2. `ResourceRegistry` supports generic logical-id registration and `FileHandlerManager` is a per-instance service (no module singleton).
  3. The invariants hold under characterization tests: memory-first ≠ saved, single write path, `not-found` ≠ `error`, and per-path serialization (one executing + one pending).
  4. Hook results are `ReadonlySignal<Content<T>>` (five-state reactive), never snapshots or effect-faked reactivity.
  5. `@motajs/editor` imports keep working throughout the transition via tracked re-export shims.

**Plans**: TBD

### Phase 5: Engine Adapter Skeleton & Resource Descriptors

**Goal**: Push every engine-specific path, format, vocabulary word, and migration out of core into a mota-js adapter whose hook contract is proven against a fake engine B.
**Depends on**: Phase 4
**Requirements**: PORT-03, PORT-04, PORT-05, PORT-06, PORT-07, PORT-08
**Success Criteria** (what must be TRUE):

  1. `defineEngine({...})` produces the engine description; core recognizes only logical ids and never constructs `project/...` paths or inspects file extensions.
  2. All 10 hardcoded paths become `ResourceDescriptor`s (logical id, opaque path key, format id, handler, preload dependencies).
  3. `Json2xDataHandler` and the domain `*DataHandler` subclasses live in the adapter while core keeps only generic `JsonDataHandler`; `LabelOverrides` and `MigrationHook` carry game vocabulary and engine-format migrations out of core.
  4. A fake non-mota "engine B" adapter drives the hook contract end to end with non-mota resources.
  5. No game identifier (tower/floor/loc/autopass/autotile/idnum/airwall/commonEvent) remains in core source, enforced by a mechanical grep/lint gate.

**Plans**: TBD

### Phase 6: Fixed Shell + Slots

**Goal**: Extract the fixed workbench shell with named registry-driven slots, preserving the exact baseline layout and dogfooding the extension registration API.
**Depends on**: Phase 5
**Requirements**: SHELL-01, SHELL-02, SHELL-03, SHELL-04, SHELL-05, SHELL-06
**Success Criteria** (what must be TRUE):

  1. `EditorShell`/`TopBar`/`PersistenceNotification`/error boundaries live in `lib/shell/`.
  2. `PanelSlot`/`WorkspaceSlot`/`ToolbarSlot`/`ModalHost`/`SettingsSlot` have compile-time-fixed positions and registry-driven content.
  3. The hardcoded panel-ID union is generalized to registry-driven ids, and draft guard becomes a core per-document dirty registry.
  4. Layout is visually consistent with the Phase 1 screenshot baseline.
  5. The four built-in block panels register through the same API future extensions will use (dogfooding).

**Plans**: TBD
**UI hint**: yes

### Phase 7: Table Capability + Port

**Goal**: Extract the schema-driven table editor as a capability, with layered field-editor overrides and a minimal injected asset-catalog port.
**Depends on**: Phase 6
**Requirements**: TABLE-01, TABLE-02, TABLE-03, TABLE-04
**Success Criteria** (what must be TRUE):

  1. `lib/capabilities/table-editor/` provides schema-driven rendering, action-path editing, validation UI, meta editing, and cell/edit-cell separation.
  2. `table.fieldEditor` + `table.schema` capability kinds exist with layered override precedence (core default → theme → form-level → `ui:field`/`ui:widget`).
  3. The image picker works through the minimal injected asset-catalog port and no longer accesses the engine directly.
  4. Engine schemas, meta-file mapping, and domain field types (`PassabilityField`, `FloorImagesField`, …) are supplied by the adapter and absent from core.
  5. Table editing behavior matches the Phase 1 baseline (tests + manual check).

**Plans**: TBD
**UI hint**: yes

### Phase 8: Code Capability + Port

**Goal**: Extract Monaco-based code editing and a generic Blockly host, injecting language configuration and reconciling keybindings with the core command registry.
**Depends on**: Phase 7
**Requirements**: CODE-01, CODE-02, CODE-03, CODE-04
**Success Criteria** (what must be TRUE):

  1. `lib/capabilities/code-editor/` provides the Monaco host, an engine-id-keyed document/model registry, file tabs, save/undo binding, dirty lifecycle, diagnostics surface, completion registry, and editor-action/keybinding seams.
  2. `code.language` capability kind exists; language config, completion/typing sources, and document endpoints are adapter-injected.
  3. The Blockly split is implemented: generic Blockly host + schema→block compiler stay in `code-editor`, while `blockly/project/*`, domain schemas, event field bindings, and diagnostics move to the adapter.
  4. Core command registry and Monaco's own keybinding/context-key system are explicitly reconciled with no shortcut conflicts.
  5. Code editing behavior matches the Phase 1 baseline (tests + manual check).

**Plans**: TBD

### Phase 9: Asset Capability + Port

**Goal**: Extract asset management, validating the capability port for binary and write-heavy operations with an adapter-injected codec.
**Depends on**: Phase 8
**Requirements**: ASSET-01, ASSET-02, ASSET-03
**Success Criteria** (what must be TRUE):

  1. `lib/capabilities/asset-manager/` provides directory/collection resources, append/insert/replace/remove, grid/list + type filter + search + thumbnail fallback + drag-to-assign + reference lookup, preview UI, and a `RasterCodec` port.
  2. `asset.kind` capability kind exists; asset roots/kinds, material specs, animation format handling, and codec are adapter-injected.
  3. Reference/diagnostics is a core service that later plugins can contribute findings to.
  4. Asset management behavior matches the Phase 1 baseline (tests + manual check).

**Plans**: TBD
**UI hint**: yes

### Phase 10: Map Capability + Port

**Goal**: Extract the most engine-coupled capability — Pixi map editing plus five semantic hooks — on a fully settled registry/port/command/shell foundation.
**Depends on**: Phase 9
**Requirements**: MAP-01, MAP-02, MAP-03, MAP-04
**Success Criteria** (what must be TRUE):

  1. `lib/capabilities/map-editor/` provides Pixi canvas/layers, coordinate/grid utils, tool state machine, overlay host, recently-used panel, context menu, row/col marks, and floor navigation.
  2. `map.tool` + `map.overlay` capability kinds support activate/deactivate/overlay-draw/input-interception with an explicit command commit point.
  3. The five semantic hooks (block registry, sprite/tileset catalog, passability provider, floor list/organization, loc resolver) are adapter-injected, and tileset/passability/floor-transform semantics are absent from core.
  4. Pixi exists only in the `./map` subpath and never in the runtime entry.
  5. Map editing behavior matches the Phase 1 baseline (tests + manual check).

**Plans**: TBD
**UI hint**: yes

### Phase 11: Preview Service + Adapter Cutover + Shim Deletion

**Goal**: Extract the preview service with the Runtime Protocol v4 wire contract unchanged, complete the adapter cutover, and delete every singleton and shim.
**Depends on**: Phase 10
**Requirements**: PREV-01, PREV-02, PREV-03
**Success Criteria** (what must be TRUE):

  1. `lib/services/preview/` preserves the v4 wire contract exactly (envelope, provider/context, gateway, `project/` allowlist, monotonic revisions, 300 ms debounce, surface leases, retry policy).
  2. The engine boot hook moves into the adapter's `PreviewAdapter`, while the `runtime.html` entry stays in `@motajs/editor` and the artifact shape is unchanged.
  3. All six singletons and every re-export shim are deleted; `@motajs/editor` depends only on core plus its adapter.
  4. The full regression suite passes and the Phase 1 manual UAT script confirms parity.

**Plans**: TBD

### Phase 12: Extension Surface Freeze, Parity Verification & Protocol Freeze

**Goal**: Freeze the extension surface once the adapter stops moving, and pass the milestone's end-to-end parity acceptance gate.
**Depends on**: Phase 11
**Requirements**: EXT-01, EXT-02, EXT-03, EXT-04, EXT-05, VERIFY-08
**Success Criteria** (what must be TRUE):

  1. `EditorExtension` descriptor + narrow `EditorExtensionContext` are frozen (`apiVersion` required, `requires`/`optional`, `activate()` returning `Disposable`, two-phase activate-then-resolve), and the `EditorCore` object is never passed to an extension.
  2. A committed `api-extractor` `.api.md` report is enforced in CI, the version/deprecation policy is documented, and every extension point has an `extensionPointId@v1` plus an ADR.
  3. No plugin loader ships (descriptor shape only) and the subpath exports are final.
  4. The "Looks Done But Isn't" checklist passes end to end: two-core isolation, fake engine-B drive, dedupe assertion, bundle budget vs baseline, no re-export-only files, no cycles, e2e actually ran, visual parity, generated CSS contains core classes, single React instance + signal propagation smoke.
  5. Protocol constants are consolidated to one exported value — or the pre-existing `runtimeProtocolVersion: 3` vs `RUNTIME_PROTOCOL_VERSION = 4` mismatch is explicitly documented as intentionally preserved, with a generated assertion recording it.

**Plans**: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9 → 10 → 11 → 12

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Baseline & Verification Net | 0/7 | Planned | - |
| 2. Package Boundary & Build Scaffolding | 0/TBD | Not started | - |
| 3. Kernel — Runtime, Ports, Registry, Diagnostics | 0/TBD | Not started | - |
| 4. Resource + Edit Layers Moved | 0/TBD | Not started | - |
| 5. Engine Adapter Skeleton & Resource Descriptors | 0/TBD | Not started | - |
| 6. Fixed Shell + Slots | 0/TBD | Not started | - |
| 7. Table Capability + Port | 0/TBD | Not started | - |
| 8. Code Capability + Port | 0/TBD | Not started | - |
| 9. Asset Capability + Port | 0/TBD | Not started | - |
| 10. Map Capability + Port | 0/TBD | Not started | - |
| 11. Preview Service + Adapter Cutover + Shim Deletion | 0/TBD | Not started | - |
| 12. Extension Surface Freeze, Parity Verification & Protocol Freeze | 0/TBD | Not started | - |
