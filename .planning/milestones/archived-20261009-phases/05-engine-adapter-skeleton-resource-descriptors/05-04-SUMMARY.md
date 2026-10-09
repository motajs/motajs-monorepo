---
phase: 05-engine-adapter-skeleton-resource-descriptors
plan: 04
subsystem: editor
tags: [mota-adapter, resource-descriptor, engine-adapter, define-engine, file-resource, floor-factory, port-03, port-04, port-05, port-07]

# Dependency graph
requires:
  - phase: 05-engine-adapter-skeleton-resource-descriptors
    provides: "05-01's adapter contract (`defineEngine`, `ResourceDescriptor`/`ResourceDependencies`/`PreloadStrategy`, `isValidResourceId`, `EngineDefinitionError`) and its `INTERFACE-NAME.md` §Plan 05-04 (CONFIRMED names)"
  - phase: 05-engine-adapter-skeleton-resource-descriptors
    provides: "05-03's `FileResource<T>` — core's one file-backed resource class the adapter constructs inside each `create(deps)`"
  - phase: 04-resource-edit-layers-moved
    provides: "the domain data handlers (`TowerDataHandler`, `ItemsDataHandler`, `EnemysDataHandler`, `MapsBlocksDataHandler`, `IconsDataHandler`, `FunctionsDataHandler`, `PluginsDataHandler`, `FloorDataHandler`) and the editor-owned `Json2xDataHandler`, all inheriting core's `DataHandler`"
  - phase: 05-engine-adapter-skeleton-resource-descriptors
    provides: "05-02's `scripts/verify/coreEngineNeutral.js` gate — used to prove no mota vocabulary reached core production source"
provides:
  - "`packages/apps/editor/src/adapter/motaResources.ts` — the deliberately-duplicated address/var-name literals (`MOTA_RESOURCE_ADDRESSES`, `MOTA_EVENTS_VAR_NAME`), the adapter-local `EventsData` type, and the `motaFloorAddress` helper"
  - "`packages/apps/editor/src/adapter/motaEngine.ts` — `motaEngine`, an `EngineAdapter` produced by `defineEngine({ id: 'mota-js', resources: [...] })` with nine fixed descriptors"
  - "`packages/apps/editor/src/adapter/motaFloor.ts` — `motaFloorDescriptor(floorId)`, the parameterized floor factory deriving `mota.floor.<floorId>` and `MotaFloorIdError`"
affects: [07, 11]

# Actuals — chars/4 over the realized diff (base 9542d3e..HEAD)
actuals:
  tokens: 2260
  tasks: 2
  commits: 2        # measured: git rev-list --count 9542d3e..HEAD at SUMMARY write (2 atomic task commits)
plan_head_before: 9542d3efb4b6acadc9eb28668ea8d034dd7ea5de

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Adapter-side literal duplication (D-01): because the additive posture forbids editing the editor's project-data aggregator, the adapter duplicates the ten path/var-name literals in an adapter-local constants module; the duplication is documented in the module header and removed in Phase 11"
    - "One-seam descriptor factories (D-05): every descriptor's `create(deps)` builds `new FileResource<...>(id, address, (file) => new XxxDataHandler(file), deps)` lazily against the injected `deps.fileHandlers`, never a module singleton — this is what keeps the adapter Phase-11-ready"
    - "Parameterization decoded adapter-side (D-07): the generic descriptor stays template-free; `motaFloorDescriptor(floorId)` resolves the id and IO address into a concrete descriptor and is deliberately NOT a static entry of `motaEngine.resources`"
    - "Shared-predicate id assertion (D-09): the floor factory asserts its derived id with core's `isValidResourceId` and throws a named `MotaFloorIdError` rather than widening the registry grammar"
    - "Adapter-owned handlers by ownership, not relocation (PORT-05): `Json2xDataHandler` and the domain `*DataHandler` subclasses stay physically in the editor; the adapter constructs them, core keeps only the generic `JsonDataHandler`"

key-files:
  created:
    - packages/apps/editor/src/adapter/motaResources.ts
    - packages/apps/editor/src/adapter/motaEngine.ts
    - packages/apps/editor/src/adapter/motaFloor.ts
  modified: []

key-decisions:
  - "The ten mota paths are expressed as nine fixed descriptors on `motaEngine` (eight `project/*.js` + `_server/config.json`) plus the parameterized `motaFloorDescriptor(floorId)` factory — honouring the locked count of 10 (D-04/D-07)"
  - "The address/var-name literals are DELIBERATELY duplicated in `motaResources.ts` because D-01 forbids editing the project-data aggregator; the duplication is banner-documented and removed in Phase 11 (Research A6)"
  - "`mota.events` uses the editor's adapter-owned `Json2xDataHandler<EventsData>` with the exact var name `events_c12a15a8_c380_4b28_8144_256cba95f760`; the adapter exports it as `MOTA_EVENTS_VAR_NAME` and `MOTA_RESOURCE_ADDRESSES.eventsVarName`"
  - "`mota.editorConfig` is the sole `preload: 'lazy'` descriptor and uses core's generic `JsonDataHandler<EditorConfig>`; all eight `project/*.js` descriptors are `preload: 'eager'`"
  - "The five table-meta paths and the derived `commonEvents` resource are documented adapter follow-ups owned by Phase 7 / Phase 11 and are deliberately NOT added this phase (locked count of 10)"
  - "The engine migration `packages/apps/editor/src/project/migrations/airwallMigration.ts` stays adapter-side and is referenced only in an adapter comment; no core file gained engine vocabulary or a migration reference (PORT-07/D-10)"

patterns-established:
  - "Dead-code adapter discipline: no entry point imports `src/adapter/`, so the editor bundle is unchanged this phase; the adapter compiles and is machine-verified while remaining unwired until Phase 11 (D-01)"
  - "Id-grammar boundary: the parameterized floor factory asserts the derived id against the shared predicate and surfaces a named error instead of silently widening the grammar (Open Question 1 recorded, not decided)"

requirements-completed: [PORT-03, PORT-04, PORT-05, PORT-07]

# Coverage metadata — one entry per shipped deliverable.
coverage:
  - id: D1
    description: "`motaResources.ts` — the adapter-local constants module holding the deliberately-duplicated path/var-name literals (`MOTA_RESOURCE_ADDRESSES`, `MOTA_EVENTS_VAR_NAME`), the `motaFloorAddress(floorId)` helper, and the adapter-local `EventsData` type"
    requirement: PORT-04
    verification:
      - kind: other
        ref: "pnpm --filter @motajs/editor typecheck (exit 0)"
        status: pass
      - kind: other
        ref: "node -e \"…adapter has no projectData import\" (exit 0 — no adapter file contains the project-data aggregator import path)"
        status: pass
    human_judgment: false
  - id: D2
    description: "`motaEngine.ts` — `motaEngine` produced by `defineEngine({ id: 'mota-js', resources: [...] })` with nine fixed descriptors (`mota.tower`/`items`/`enemys`/`maps`/`icons`/`functions`/`plugins`/`events`/`editorConfig`), each `create(deps)` constructing `FileResource` with the matching existing domain handler and `deps.fileHandlers`"
    requirement: PORT-03
    verification:
      - kind: other
        ref: "pnpm --filter @motajs/editor typecheck (exit 0) && pnpm lint (exit 0 — 0 errors)"
        status: pass
      - kind: other
        ref: "node -e \"…adapter mapping complete\" (exit 0 — all nine fixed ids present in motaEngine.ts, no projectData import)"
        status: pass
      - kind: other
        ref: "node scripts/verify/coreEngineNeutral.js (exit 0 — core production tree 37 files / 0 engine-term violations)"
        status: pass
    human_judgment: false
  - id: D3
    description: "`motaFloor.ts` — `motaFloorDescriptor(floorId)` returns a concrete `ResourceDescriptor<FloorData>` deriving `mota.floor.<floorId>` adapter-side, asserting it with core's `isValidResourceId` and throwing the named `MotaFloorIdError` on a grammar violation (no grammar widening); `preload: 'on-demand'` with `preloadDependsOn: ['mota.tower']`"
    requirement: PORT-04
    verification:
      - kind: other
        ref: "pnpm --filter @motajs/editor typecheck (exit 0) && pnpm lint (exit 0)"
        status: pass
      - kind: other
        ref: "node -e \"…adapter mapping complete (9 fixed + floor family)\" (exit 0 — `mota.floor.` prefix present, no projectData import)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Adapter ownership + no core leak + additive posture: `Json2xDataHandler`/domain handlers are adapter-owned comments-only (PORT-05); the engine migration stays at `src/project/migrations/airwallMigration.ts` with no core reference (PORT-07/D-10); no entry point imports the adapter and `projectData.ts` is byte-identical"
    requirement: PORT-05
    verification:
      - kind: other
        ref: "node scripts/verify/coreEngineNeutral.js (exit 0 — airwall/mota terms absent from core production source) && node scripts/verify/coreModuleState.js (exit 0) && node scripts/verify/editorShims.js (exit 0 — 18 marked files exact)"
        status: pass
      - kind: other
        ref: "git diff 9542d3e -- packages/apps/editor/src/project/data/projectData.ts (empty — byte-identical) && grep for `adapter/mota` imports outside src/adapter (NONE)"
        status: pass
    human_judgment: false

# Metrics
duration: 10min
completed: 2026-09-28
status: complete
---

# Phase 5 Plan 04: mota adapter descriptors Summary

**All ten hardcoded mota paths expressed as core `ResourceDescriptor`s in a new dead-code adapter directory — nine fixed descriptors on `motaEngine = defineEngine({ id: 'mota-js', … })` plus the parameterized `motaFloorDescriptor(floorId)` factory — with every IO address, var name and engine word kept adapter-side and `projectData.ts` untouched.**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-09-28T05:38:58Z
- **Completed:** 2026-09-28T05:49:00Z
- **Tasks:** 2 (2 committed atomically)
- **Files modified:** 3 (3 created, 0 modified)

## Accomplishments

- `src/adapter/motaResources.ts` (created) declares `MOTA_RESOURCE_ADDRESSES` (`Object.freeze`) holding the eight `project/*.js` addresses, `_server/config.json`, and `eventsVarName = events_c12a15a8_c380_4b28_8144_256cba95f760`; `MOTA_EVENTS_VAR_NAME`; the adapter-local `EventsData` type; and `motaFloorAddress(floorId)` returning `project/floors/${floorId}.js`. A Chinese header records that the literals are a deliberate duplication of the project-data aggregator (D-01), removed in Phase 11.
- `src/adapter/motaEngine.ts` (created, extended in Task 2) exports `const motaEngine: EngineAdapter = defineEngine({ id: 'mota-js', resources: [...] })` with **nine** fixed descriptors — `mota.tower`→`project/data.js`/`TowerDataHandler`; `mota.items`/`mota.enemys`/`mota.maps`/`mota.icons`/`mota.functions`/`mota.plugins`→their domain handlers; `mota.events`→`Json2xDataHandler<EventsData>(file, MOTA_RESOURCE_ADDRESSES.eventsVarName, 'Events Data')`; `mota.editorConfig`→`_server/config.json`/`JsonDataHandler<EditorConfig>` (`preload: 'lazy'`). Every `create(deps)` lazily constructs `new FileResource<…>(id, address, (file) => new XxxDataHandler(file), deps)`. Header comments record the PORT-05 handler ownership, the PORT-07 adapter-side migration, and the deferred table-meta/`commonEvents` follow-ups.
- `src/adapter/motaFloor.ts` (created) exports `motaFloorDescriptor(floorId): ResourceDescriptor<FloorData>` deriving `mota.floor.<floorId>`, asserting it with core's `isValidResourceId` and throwing the adapter-local `MotaFloorIdError` (message names the derived id and the grammar) on failure — never widening the registry grammar; `preload: 'on-demand'`, `preloadDependsOn: ['mota.tower']`, and `create` returns `new FileResource<FloorData>(id, motaFloorAddress(floorId), (file) => new FloorDataHandler(file, floorId), deps)`. The Chinese header records D-07 (floor family is not a static entry), adapter-side parameter decoding, and the deferred id-grammar encoding decision.
- No adapter file imports the project-data aggregator; no entry point imports the adapter; `projectData.ts` is byte-identical; all core gates and the full build/artifact check are green.

## Task Commits

Each task was committed atomically:

1. **Task 1 (tracer): End-to-end one mota descriptor — `mota.tower` through `FileResource` + `TowerDataHandler`** - `bd6c5b1` (feat)
2. **Task 2: Complete the 10-path mapping, the floor factory, and adapter ownership** - `310b834` (feat)

**Plan metadata:** (final docs commit; see STATE/ROADMAP update)

_Note: Task 1 was a `type="tracer"` task with an automated-only `<verify>`; under `human_verify_mode=end-of-phase` its end-to-end pass was logged (`⚡ Tracer verified end-to-end — expanding`) and no checkpoint was raised._

## Verification Evidence

| Command | Result |
|---------|--------|
| `pnpm --filter @motajs/editor typecheck` | exit 0 |
| `pnpm lint` | exit 0 — 0 errors, 107 pre-existing warnings (none from this plan's files) |
| inline: no `project/data/projectData` import in any adapter file | exit 0 — "adapter has no projectData import" |
| inline: all nine fixed ids + the `mota.floor.` prefix present | exit 0 — "adapter mapping complete (9 fixed + floor family)" |
| `node scripts/verify/coreEngineNeutral.js` | exit 0 — real tree 37 production files / 0 engine-term violations; two-polarity fixture hits all 10 terms, 5 clean cases 0 false positives, deleted in `finally` |
| `node scripts/verify/coreModuleState.js` | exit 0 — 61 files, 0 error-level restricted-rule messages |
| `node scripts/verify/editorShims.js` | exit 0 — 18 marked files exact, 17 forwarding shims, exactly 3 construction sites in `appInstances.ts` |
| `pnpm --filter @motajs/editor exec panda codegen` | exit 0 |
| `pnpm build` | exit 0 — editor artifact: 57 files, raw 16.81 MiB, gzip 4.29 MiB (dead adapter not pulled into any entry) |
| `node scripts/verify/editorArtifactAssets.js` | exit 0 — all assertions pass |
| `git diff 9542d3e -- …/project/data/projectData.ts` | empty — `projectData.ts` byte-identical to pre-phase state |

## Files Created/Modified

- `packages/apps/editor/src/adapter/motaResources.ts` (created) — adapter-local duplicated literals, `MOTA_EVENTS_VAR_NAME`, `EventsData`, `motaFloorAddress`.
- `packages/apps/editor/src/adapter/motaEngine.ts` (created) — `motaEngine` with the nine fixed descriptors + ownership/follow-up comments.
- `packages/apps/editor/src/adapter/motaFloor.ts` (created) — `motaFloorDescriptor` factory and `MotaFloorIdError`.

## Decisions Made

- **Nine fixed descriptors + one parameterized factory = the locked count of 10.** The floor family is deliberately not a static array entry, because the generic descriptor must stay template-free (D-04/D-07).
- **The literals are duplicated, not imported.** D-01 forbids editing the project-data aggregator, so `motaResources.ts` duplicates them and banner-documents the duplication (Research A6; removed in Phase 11).
- **`mota.events` keeps the editor-owned `Json2xDataHandler`** with the exact `events_c12a15a8_c380_4b28_8144_256cba95f760` var name; `mota.editorConfig` is the only lazy descriptor and uses core's generic `JsonDataHandler` (PORT-05 boundary).
- **The floor id is asserted, not widened.** `motaFloorDescriptor` uses the shared `isValidResourceId` predicate and throws `MotaFloorIdError`; the reversible encoding decision is deferred to Phase 11 / the user (Open Question 1).
- **Migrations stay adapter-side.** `airwallMigration.ts` is untouched and referenced only in an adapter comment; no core file gained engine vocabulary or a migration reference (PORT-07/D-10).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] A `*/*` sequence in a JSDoc comment closed the block comment early**
- **Found during:** Task 2 (first typecheck of the completed `motaEngine.ts`)
- **Issue:** The header comment contained the literal `@/services/*/*DataHandler`, whose substring `*/` terminated the JSDoc block prematurely; `tsc -b` then reported a cascade of syntax errors (`TS1109`, `TS1005`, `TS1443`) across the file.
- **Fix:** Reworded the comment to `@/services/` 下各 `xxxDataHandler` 子类` so no `*/` appears inside the comment body. No code change.
- **Files modified:** `packages/apps/editor/src/adapter/motaEngine.ts`
- **Verification:** `pnpm --filter @motajs/editor typecheck` exit 0; `pnpm lint` exit 0.
- **Committed in:** `310b834` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** The single fix was a comment-authoring artifact local to the new file; it changed no behavior, no contract and no other file. No scope creep.

## Issues Encountered

None beyond the comment-termination artifact above. The adapter compiled against the core contract and the editor handlers on the first correct attempt; all gates were green on the first run.

## User Setup Required

None - no external service configuration required. No package was installed (`[T-05-SC]` — the adapter consumes only existing in-repo modules).

## Next Phase Readiness

- The full 10-path mota mapping is now expressible through the core contract with all IO addresses adapter-side; Phase 11's composition root can wire `motaEngine` + `motaFloorDescriptor` into the editor data path without core learning a single engine word.
- `projectData.ts` and every editor runtime file are untouched, so the editor artifact is behavior-unchanged (build + `editorArtifactAssets.js` green).
- Open Question 1 (floor id-grammar encoding) and the table-meta/`commonEvents` follow-ups are recorded in the adapter headers and remain owned by Phase 7 / Phase 11.
- All core + editor gates green: `coreEngineNeutral` / `coreModuleState` / `editorShims`, `pnpm --filter @motajs/editor typecheck`, `pnpm lint`, `pnpm build`.

---
*Phase: 05-engine-adapter-skeleton-resource-descriptors*
*Completed: 2026-09-28*

## Self-Check: PASSED

- Promised artifacts exist: `packages/apps/editor/src/adapter/motaResources.ts`, `motaEngine.ts`, `motaFloor.ts`.
- Task commits exist: `bd6c5b1`, `310b834` (measured 2 via `git rev-list --count 9542d3e..HEAD`).
- `packages/apps/editor/src/project/data/projectData.ts` is absent from the plan diff (D-01 honored, byte-identical).
- No entry point imports the adapter (`grep 'adapter/mota'` outside `src/adapter` → NONE).
