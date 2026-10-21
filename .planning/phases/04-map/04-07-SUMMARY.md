---
phase: 04-map
plan: 07
subsystem: editor-impl / map panel data layer
tags: [map, manual-save, baseline-snapshot, undo, barrier, request-token]
plan_head_before: 361f2a2373a0e615e444720c9e7baa4e4d7c3f65

requires:
  - plan: 04-04
    provides: MapPanel tracer with open, commit and save plus MapSurface
  - plan: 04-05
    provides: cell change collection and immutable layer writes
  - plan: 04-06
    provides: isMapDataDirty / isMapPropertiesDirty and document validation

provides:
  - MapPanel.loadSummaries with loading, empty and failure states
  - MapPanel.openMap with stale-result discard, document clearing and baseline capture
  - MapPanel.onSwitchIn that skips reloading a dirty map
  - MapPanel.save that snapshots before awaiting the host and rebases on the sent snapshot
  - MapPanel.undo / MapPanel.redo for cell records with a map id guard
  - MapPanel.registerBarrier used after switching maps

affects: [04-08, 04-09, 04-10, 04-11, 04-12, 04-16]

actuals:
  tokens: 8712
  tasks: 3
  commits: 4

tech-stack:
  added: []
  patterns:
    - "Baseline snapshot: dirty state is derived by comparing current content with the last saved or opened snapshot"
    - "Request token: every load increments a counter so late results are discarded"

key-files:
  created:
    - packages/libs/editor-impl/src/map/__tests__/mapPanel.test.tsx
    - packages/libs/editor-impl/src/map/__tests__/mapSave.test.tsx
  modified:
    - packages/libs/editor-impl/src/map/mapPanel.ts

key-decisions:
  - "Save snapshots the document before awaiting the host and sets that snapshot as the new baseline, so edits made during save stay dirty"
  - "Dirty state is always recomputed from the baseline, never stored as an independent boolean"
  - "Switching maps pushes a barrier record; undo stops on a barrier instead of skipping across maps"
  - "Undo and redo validate the payload map id and ignore records from another map"
  - "The switch confirmation placeholder from the plan is deferred to 04-08 instead of adding dead code now"

patterns-established:
  - "One stroke produces exactly one undo record via collectNetCellChanges"
  - "Host errors are shown as plain text, never interpolated into markup"

requirements-completed: [MAP-01]

coverage:
  - id: D1
    description: "Panel lists host maps, opens one map and switches to another, dropping late results"
    requirement: MAP-01
    verification:
      - kind: unit
        ref: "packages/libs/editor-impl/src/map/__tests__/mapPanel.test.tsx#地图面板：清单 / 打开 / 切换"
        status: pass
    human_judgment: false
  - id: D2
    description: "Manual save submits only dirty domains and rebases on the sent snapshot"
    requirement: MAP-01
    verification:
      - kind: unit
        ref: "packages/libs/editor-impl/src/map/__tests__/mapSave.test.tsx#地图面板：按域手动保存"
        status: pass
    human_judgment: false
  - id: D3
    description: "One stroke is one undo record; cross-map payloads are ignored; barriers block undo"
    requirement: MAP-01
    verification:
      - kind: unit
        ref: "packages/libs/editor-impl/src/map/__tests__/mapPanel.test.tsx#一笔连续三格只产生一条撤销记录"
        status: pass
    human_judgment: false

duration: 15min
completed: 2026-10-21
status: complete
---

# Phase 04 Plan 07: Map list, switch, manual save and one-stroke undo Summary

**Map panel now lists host maps, switches without leaving stale cells on the canvas, saves only dirty data against a pre-await snapshot, and records one undo entry per stroke with a map-id guard and a switch barrier**

## Performance

- **Duration:** about 15 min
- **Started:** 2026-10-21T18:07Z (approx.)
- **Completed:** 2026-10-21T18:22Z
- **Tasks:** 3
- **Files modified:** 3 (1 production file, 2 test files)

## Accomplishments

- Map list handles loading, empty and failure states without discarding the already opened document.
- Opening a map clears the previous document immediately, resets the current layer to the first layer, returns the viewport to the top-left corner and captures a baseline so a fresh panel is not dirty.
- Switching maps discards late results through a request token and leaves a barrier record on the undo stack.
- Manual save takes a snapshot before awaiting the host and uses that snapshot as the new baseline, so edits made during save remain dirty.
- Save failure keeps the dirty flag, the in-memory cells and the host error text.
- Undo/redo handle only cell records whose map id matches the open map; unsaved state is recomputed after every undo/redo.
- `MapPanel.onSwitchIn` re-reads the map list but does not reload a map with unsaved changes.

## Task Commits

1. **Task 1: list, open and switch maps** - `65b0d25` (feat)
2. **Task 2: manual save baseline semantics** - `cd8618d` (test)
3. **Task 3: one-stroke undo, cross-map guard and barrier** - `13bb8f5` (test)
4. **Formatting fix after Prettier check** - `8264cbb` (style)

## Files Created/Modified

- `packages/libs/editor-impl/src/map/mapPanel.ts` - Added list/open/switch, baseline capture, derived dirty state, per-domain save and cell undo/redo with map-id guard.
- `packages/libs/editor-impl/src/map/__tests__/mapPanel.test.tsx` - 15 cases covering list, open, switch, stale results, barrier, switch-in refresh and undo/redo.
- `packages/libs/editor-impl/src/map/__tests__/mapSave.test.tsx` - 7 cases covering dirty detection, snapshot baseline, failure retention, duplicate saves and undo back to baseline.

## Verification

| Check | Command | Result |
| --- | --- | --- |
| Panel tests | `pnpm --filter @motajs/editor-impl exec vitest run src/map/__tests__/mapPanel.test.tsx` | 15 passed |
| Save tests | `pnpm --filter @motajs/editor-impl exec vitest run src/map/__tests__/mapSave.test.tsx` | 7 passed |
| Full map suite | `pnpm --filter @motajs/editor-impl exec vitest run src/map` | 13 files / 151 tests passed |
| Typecheck | `pnpm --filter @motajs/editor-impl typecheck` | exit 0 |
| Engine-neutral gate | `node scripts/verify/coreEngineNeutral.js` | exit 0 |
| Module-state gate | `node scripts/verify/coreModuleState.js` | exit 0 |
| Formatting | `pnpm exec prettier --check` on the three files | exit 0 |
| Lint | `pnpm exec eslint` on the three files | 0 errors, 5 pre-existing-style `_data` warnings |

## Decisions Made

- Save uses a detached snapshot as the baseline rather than the live document, which is what keeps edits made during an in-flight save dirty.
- Dirty state is computed on demand from the baseline; the published `unsaved` flag is only a projection of that comparison.
- The barrier record carries a numeric `MapBarrierAction.Switch` value instead of the literal string `'switch'` from the plan, following the project rule that status/action identifiers must be enums.
- `IMapBarrierData` and `MapBarrierAction` live inside `mapPanel.ts` because the plan's `files_modified` list does not allow touching `types.ts`.

## Deviations from Plan

1. **Commit granularity** - The save and undo implementations were written together with the Task 1 implementation and therefore landed in commit `65b0d25`; Task 2 and Task 3 commits carry their tests. No behaviour was left uncommitted.
2. **Barrier action shape** - Used a numeric enum member instead of the string `'switch'` to satisfy the project's "no string identifiers" rule.
3. **Switch confirmation placeholder** - The plan asked for a private call site that currently returns "no changes". It was not added, because a method that always returns `true` would be dead code and the name would need separate confirmation. `04-08` will hook the three-way dialog into `MapPanel.openMap`; until then switching with unsaved changes proceeds without asking, as this plan's scope states.
4. **Properties domain** - The property table stays empty in this plan (as specified); `refreshUnsaved` already compares it so `04-09` can populate it without changing the dirty logic.

**Total deviations:** 4 documented (0 auto-fixes, 1 commit-granularity note, 2 style/scope adjustments, 1 deferred placeholder).
**Impact on plan:** No scope creep, no behaviour lost; all plan verification commands pass.

## Issues Encountered

- jsdom logs `HTMLCanvasElement.prototype.getContext` errors when the map index imports PixiJS. This is pre-existing test-environment noise from the tracer and does not affect results.

## Known Stubs

None.

## Threat Flags

None - no new network endpoints, auth paths or trust boundaries beyond the host save callback already covered by the plan's threat model.

## Next Phase Readiness

- Ready for `04-08` to add the unsaved-changes dialog and wire it to `MapPanel.openMap`.
- `04-09` can fill the properties domain and reuse `MapPanel.refreshUnsaved` / `captureBaseline`.
- `04-10`, `04-11`, `04-16` can build toolbars and palettes on the published view state.
- `04-12` can add canvas gestures without touching save or undo semantics.

---
*Phase: 04-map*
*Completed: 2026-10-21*

## Self-Check: PASSED
