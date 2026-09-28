---
gsd_state_version: "1.0"
current_phase: 5
current_phase_name: Engine Adapter Skeleton & Resource Descriptors
current_plan: Not started
status: planning
stopped_at: Phase 5 context gathered
last_updated: "2026-09-28T00:49:21.350Z"
last_activity: 2026-09-24
last_activity_desc: Phase 4 complete, transitioned to Phase 5
state_head: fc717e2dee77148304695820b32f309664032116
progress:
  total_phases: 12
  completed_phases: 0
  total_plans: 21
  completed_plans: 21
  percent: 0
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-09-24)

**Core value:** Decouple the editor kernel from engine details through an engine-agnostic `editor-core` so old and new engines share one editing layer and third parties can customise freely.
**Current focus:** Phase 5 — Engine Adapter Skeleton & Resource Descriptors

## Current Position

Phase: 5 — Engine Adapter Skeleton & Resource Descriptors
Current Plan: Not started
Total Plans in Phase: 4
Status: Ready to plan
Last activity: 2026-09-24 — Phase 4 complete, transitioned to Phase 5

Progress: [░░░░░░░░░░] 0%

## Performance Metrics

**Velocity:**

- Total plans completed: 21
- Average duration: - min
- Total execution time: 0.0 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01 | 10 | - | - |
| 2 | 3 | - | - |
| 3 | 4 | - | - |
| 4 | 4 | - | - |

**Recent Trend:**

- Last 5 plans: -
- Trend: N/A

*Updated after each plan completion*
**Per-Plan Metrics:**

| Plan | Duration | Tasks | Files |
|------|----------|-------|-------|
| Phase 4 P01 | 30 | 3 tasks | 28 files |
| Phase 04 P02 | 25min | 3 tasks | 23 files |
| Phase 4 P3 | 38min | 2 tasks | 17 files |
| Phase 04 P04 | 25 | 3 tasks | 9 files |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- [Roadmap]: 12-phase structure adopted — verification net first, then boundary, kernel, verbatim resource/edit moves, adapter skeleton, shell, capabilities least-coupled-first (table→code→asset→map), preview/cutover, then extension freeze + parity gate.
- [Roadmap]: `editor-core` package uses `lib/` (never `src/`) per `resolvePlugin.js` and `tsconfig.lib.base.json`; subpath exports (`.`, `./code`, `./table`, `./map`, `./asset`, `./shell`, `./react`) created up front.
- [Roadmap]: Per-instance `EditorCore` via `createEditorCore(config)` replaces the six module singletons; registration returns diagnostics+rollback, construction fails loudly on unresolved required registration.
- [Process, 2026-09-22, **supersedes the 2026-09-21 per-phase rule**]: **One branch for the whole milestone — `editor/core-extract`.** This is not a large project; per-phase branches added overhead without benefit. `git.branching_strategy` stays `none`, so GSD never auto-creates or auto-switches branches (and no `milestone` template is set — a literal one would also trip the W015 config-validation warning and would silently fork from `origin/main`, making "is the previous phase merged?" an implicit precondition). Phase 2 keeps its existing `editor/boundary` branch unchanged and is merged to `main` manually. From **Phase 3 onward**, all phases 3–12 land on `editor/core-extract`, created once from a `main` that already contains the merged Phase 2 work. Precondition before starting Phase 3: confirm the Phase 2 PR has landed on `main`.

- [Phase 3 complete, 2026-09-23]: The engine-agnostic kernel landed add-only (no `@motajs/editor` change, D-13). `packages/libs/editor-core/lib/kernel/` (core.ts / registry.ts / diagnostics.ts / errors.ts) + `lib/ports/` (EngineAdapter / FsPort / HostPort / PreviewAdapter) + 6 kernel tests (core suite 7 files / 34 tests). Two new machine gates enforce D-15/PORT-02 (no `fetch`/`window`/`document`/`navigator`/`localStorage`/`XMLHttpRequest`/`process.env`/`import.meta.env`) and D-10+D-22 (no module-level mutable binding in core production source), both two-polarity and wired into the existing four CI jobs. Decisions D-17..D-22 are recorded in `.planning/phases/03-kernel-runtime-ports-registry-diagnostics/03-CONTEXT.md`; confirmed names in that phase's `INTERFACE-NAME.md`. Two deliberate partial satisfactions: "replace the six singletons" → Phase 11, and PORT-01 capability ports → Phases 7–10.
- [Phase 4]: 04-01: es-toolkit catalog entry pinned to the exact installed 1.44.0 (removes the ^1.43.0 version-float hazard); user-approved before the manifest edit.
- [Phase 4]: 04-01: ContentUtils moved into core as Object.freeze({...}) — the module-state gate's own sanctioned remedy; a verbatim move would red pnpm lint.
- [Phase 4]: 04-01: dependency-cruiser .dependencyCruiser.cjs gained enhancedResolveOptions {exportsFields:['exports'], conditionNames:[...]} so exports-only packages (alien-signals) resolve; the values are dependency-cruiser's own init-config template defaults. No rule weakened.
- [Phase 4]: FileHandler takes a single FileHandlerDependencies object (fs: FsPort + persistenceMonitor) assigned in the constructor body — no parameter property (erasableSyntaxOnly would raise TS1294) and the field name fs is retained so fixture pokes keep working
- [Phase 4]: FileHandlerManager is a per-instance class with no module-level instance; src/appInstances.ts is the only construction site, importing the core class as the module-local alias FileHandlerManagerClass so the exported instance keeps the legacy name FileHandlerManager
- [Phase 4]: Core owns DataHandler, JsonDataHandler, BinaryFileHandler and the resource combinators, exported from the root '.' barrel; Json2xDataHandler/ScriptDataHandler deliberately stay in the editor and inherit DataHandler through the shim
- [Phase 4]: MemoryFsPort is a flat, seven-operation FsPort test double with fewer declared parameters than FsPort (arity compatibility) to avoid new no-unused-vars warnings; it deliberately does not reproduce MemoryFileSystem's nested promises/callback shape (D-14)
- [Phase 4]: RES-06 liveness is proven by capturing the derived content callable before a mutation and re-invoking the SAME callable afterwards, for both the file layer and the DataHandler/JsonDataHandler data layer
- [Phase 4]: The UndoSystem seam captures EVERY registered system synchronously at OperationHistory.execute invocation time (capture-all), so a plain data patch still restores the viewport on undo; registration order defines reverse restore order (D-03)
- [Phase 4]: OperationHistory is de-singletonised: the Store is an instance field exposed as OperationHistory.store and the UndoSystem registry is per-instance; src/appInstances.ts is the only new OperationHistory( site (D-06/D-07/D-11)
- [Phase 4]: patchResourceOperation is typed against the narrow PatchableResource<T> (path/raw/mutate); the editor DataResource<T> satisfies it structurally with zero edits (D-04)
- [Phase 4]: ResourceRegistry (RES-02) is Map-backed, form-validating and DiagnosticBus-decoupled; it ships unwired to projectData so Phase 5 shapes it against real engine descriptors.
- [Phase 4]: editorShims.js verifies comment-stripped construction sites (exactly 3, all in src/appInstances.ts) and shim-inventory set equality; a JSDoc mention of a constructor is documentation, not a site.
- [Phase 4]: The retargeted dependency-cruiser rule matches raw editor import specifiers because dependency-cruiser does not resolve the @/ alias; its editor half is dormant-by-target until Phase 11 and editorShims.js carries the real guard.

### Pending Todos

None yet.

### Blockers/Concerns

- Phase 8 (Code) needs the Blockly split confirmed before planning; Phase 10 (Map) and Phase 11 (Preview/cutover) are flagged for phase-specific research.
- Phase 7 (Table) has an open design question: built-in primitive field types vs engine-supplied, and whether the field-editor registry is core-mechanism or fully adapter-provided.
- Phase 5 (Adapter) must resolve RES-02's unwired `ResourceRegistry` shape against real engine descriptors — the registry shipped in Phase 4 with no production consumer by design.

## Deferred Items

Items acknowledged and deferred at milestone close, most recent first:

| Category | Item | Status | Deferred At | Milestone |
|----------|------|--------|-------------|-----------|
| *(none)* | | | | |

## Session Continuity

Last session: 2026-09-28T00:49:21.153Z
Stopped at: Phase 5 context gathered
Resume file: .planning/phases/05-engine-adapter-skeleton-resource-descriptors/05-CONTEXT.md
