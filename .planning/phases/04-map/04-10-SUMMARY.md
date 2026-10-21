---
phase: 04-map
plan: 10
subsystem: ui
tags: [react, antd, map-panel, toolbar, status-bar, empty-state]
requires:
  - phase: 04-07
    provides: map list/open/switch state and the published view state
  - phase: 04-08
    provides: controlled dialog kinds, create/add-layer entries and unsaved guard
  - phase: 04-09
    provides: map properties domain, openProperties/closeProperties and drawer
provides:
  - two-row map toolbar with identity, save, layer, brush, passability, big-map and viewport controls
  - first-open inline map list with loading, list-error, no-map and unopened states
  - canvas status bar with five segments and narrow-width priority hiding
  - panel view assembly including save notice line, three dialogs and properties drawer
  - emap-scoped stylesheet including the properties drawer body contract
affects: [04-11, 04-12, 04-16]
actuals:
  tokens: 18288
  tasks: 3
  commits: 3
  plan_head_before: 0651b2b
tech-stack:
  added: []
  patterns:
    - view components receive props and callbacks only; panel state stays in the store
    - dialogs are mounted only for the active view.dialog kind, so cancel truly removes them from the DOM
    - render model is computed once in MapPanelView per render and consumed by MapSurface
key-files:
  created:
    - packages/libs/editor-impl/src/map/map.css
    - packages/libs/editor-impl/src/map/components/MapToolbar.tsx
    - packages/libs/editor-impl/src/map/components/MapEmptyState.tsx
    - packages/libs/editor-impl/src/map/components/MapStatusBar.tsx
    - packages/libs/editor-impl/src/map/__tests__/mapView.toolbar.test.tsx
    - packages/libs/editor-impl/src/map/__tests__/mapView.emptyState.test.tsx
  modified:
    - packages/libs/editor-impl/src/map/components/MapPanelView.tsx
    - packages/libs/editor-impl/src/map/components/index.ts
key-decisions:
  - "Dialogs mount only for the matching view.dialog kind; antd Modal keeps hidden content when open flips false, and the contract requires the dialog to disappear after cancel."
  - "The above-layer opacity slider's data-test-id lives on its wrapper because antd Slider does not forward data attributes to its root."
  - "Panel capability flags and callbacks stay optional on the view props; wiring them from MapPanel is outside this plan's files_modified list."
patterns-established:
  - "View-only interactions fall back to store updates when no panel callback is supplied, so the view layer is usable before panel wiring lands."
  - "Every user-supplied map/layer name is rendered through React text nodes with a title attribute; no rich-text injection."
requirements-completed: [MAP-01]
coverage:
  - id: D1
    description: "Two-row toolbar with map identity, create/properties/save, layer segmented, layer add, brush mode, passability, big map, viewport buttons and above-layer opacity slider"
    requirement: MAP-01
    verification:
      - kind: unit
        ref: "src/map/__tests__/mapView.toolbar.test.tsx#地图工具栏"
        status: pass
    human_judgment: false
  - id: D2
    description: "First-open inline map list and its loading/list-error/no-map/unopened states"
    requirement: MAP-01
    verification:
      - kind: unit
        ref: "src/map/__tests__/mapView.emptyState.test.tsx#地图清单空态"
        status: pass
    human_judgment: false
  - id: D3
    description: "Status bar with coordinate/selection/map/layer/mode segments and narrow-width priority hiding"
    requirement: MAP-01
    verification:
      - kind: unit
        ref: "src/map/__tests__/mapView.toolbar.test.tsx#地图状态条"
        status: pass
    human_judgment: false
  - id: D4
    description: "Panel view assembly of toolbar, body, save notice, three controlled dialogs and the properties drawer"
    requirement: MAP-01
    verification:
      - kind: unit
        ref: "src/map/__tests__/mapView.toolbar.test.tsx#地图面板视图装配"
        status: pass
    human_judgment: false
duration: 32 min
completed: 2026-10-21
status: complete
---

# Phase 4 Plan 10: Map Panel View Layer Summary

**Two-row map toolbar, first-open inline map list, five-segment status bar, save notice line and the controlled dialog/drawer assembly, all on an `emap-` stylesheet.**

## Performance

- **Duration:** 32 min
- **Started:** 2026-10-21T11:58:33Z
- **Completed:** 2026-10-21T12:30:33Z
- **Tasks:** 3
- **Files modified:** 8

## Accomplishments

- The panel now has a real first layer: toolbar, map list, canvas frame, status bar and save notice line.
- All disabled states come from props: loading/error/list-error hide or disable editing controls without ever clicking into a no-op.
- Missing host capabilities (create map, add layer, properties schema) show disabled buttons with exact tooltips.
- Narrow layouts move passability, big map and viewport controls into a 「视图」 dropdown instead of wrapping.
- The three controlled dialogs render from `view.dialog`, and the properties drawer opens from `view.propertiesOpen` with the `emap-properties-body` container.

## Task Commits

Each task was committed atomically:

1. **Task 1: panel stylesheet + two-row toolbar** - `98021c4` (feat)
2. **Task 2: first-open map list and empty states** - `069b49c` (feat)
3. **Task 3: status bar + panel view assembly** - `05000b2` (feat)

**Plan metadata:** committed after this SUMMARY.

_Note: the shared toolbar test file is delivered in Task 3's commit because it imports the Task 3 view; Task 1's toolbar was verified by that same suite._

## Files Created/Modified

- `packages/libs/editor-impl/src/map/map.css` - `emap-` scoped panel, toolbar, body, status, notice, empty state and `.emap-properties-body`
- `packages/libs/editor-impl/src/map/components/MapToolbar.tsx` - two-row toolbar and narrow 「视图」 dropdown
- `packages/libs/editor-impl/src/map/components/MapEmptyState.tsx` - four-state map list/empty area
- `packages/libs/editor-impl/src/map/components/MapStatusBar.tsx` - five-segment canvas status bar
- `packages/libs/editor-impl/src/map/components/MapPanelView.tsx` - assembly layer with dialogs, drawer and notice line
- `packages/libs/editor-impl/src/map/components/index.ts` - barrel exports for the new components
- `packages/libs/editor-impl/src/map/__tests__/mapView.toolbar.test.tsx` - 24 toolbar/status/assembly tests
- `packages/libs/editor-impl/src/map/__tests__/mapView.emptyState.test.tsx` - 8 empty-state tests

## Decisions Made

- Dialogs mount only when `view.dialog` matches their kind. antd Modal keeps hidden content in the DOM when `open` flips to false, which would contradict the contract that cancel makes the dialog disappear.
- The opacity slider's test id sits on its wrapper because antd Slider does not forward arbitrary data attributes to its root element.
- Capability flags and panel callbacks remain optional on the view props so the view can be assembled and tested before panel wiring is added.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Dialogs kept their hidden DOM after cancel**
- **Found during:** Task 3 (panel view assembly)
- **Issue:** `MapNewDialog` / `MapUnsavedDialog` keep their content mounted when `open` becomes false, so the required "cancel makes it disappear" behavior was not observable.
- **Fix:** Mount each dialog only when `view.dialog` matches its kind, leaving the dialog's own `open` prop true while it is mounted.
- **Files modified:** `packages/libs/editor-impl/src/map/components/MapPanelView.tsx`
- **Verification:** toolbar suite covers new-dialog open/cancel and unsaved-dialog cancel; all 24 tests pass.
- **Committed in:** `05000b2`

**2. [Rule 1 - Bug] Slider test id was not emitted**
- **Found during:** Task 3 (status bar + assembly tests)
- **Issue:** antd `Slider` does not forward `data-test-id` to its root, so the toolbar test could not locate the opacity control.
- **Fix:** Put `data-test-id="map-layer-opacity"` on the `.emap-opacity` wrapper; tests assert the inner `.ant-slider` disabled state.
- **Files modified:** `packages/libs/editor-impl/src/map/components/MapToolbar.tsx`, `packages/libs/editor-impl/src/map/__tests__/mapView.toolbar.test.tsx`
- **Verification:** slider enabled/disabled and keyboard-change cases pass.
- **Committed in:** `98021c4` (component) and `05000b2` (test)

---

**Total deviations:** 2 auto-fixed (1 blocking, 1 bug)
**Impact on plan:** Both fixes are local to the view layer and needed to satisfy the stated dialog and slider contracts. No scope creep.

## Issues Encountered

- **Panel wiring is deferred.** `MapPanel` is not in this plan's `files_modified` list, so the new view cannot receive capability flags or panel callbacks from it yet. The view is complete and proves the full path in tests by rendering `MapPanelView` with the real panel store and `MapPanel.openProperties`. The actual `MapPanel.render()` call still passes only the original five props; a later plan should pass `canCreateMap` / `canAddLayer` / `canOpenProperties` and the callbacks (select map, open dialog, open properties, create/add layer, unsaved decision, properties rows). Until then the real panel shows capability-dependent controls as disabled and view-only controls fall back to store updates.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Ready for `04-11` to fill the palette slot (`data-test-id="map-palette-slot"`).
- Ready for `04-12` to replace the canvas host with `MapCanvas` and move the status bar ownership into it.
- The panel wiring gap above should be closed when the palette is mounted (`04-16`) or in a follow-up to this plan.

---

*Phase: 04-map*
*Completed: 2026-10-21*

## Self-Check: PASSED

- All 8 plan files exist on disk.
- Commits `98021c4`, `069b49c` and `05000b2` are present in git history.
- `mapView.toolbar.test.tsx`: 24 passed; `mapView.emptyState.test.tsx`: 8 passed.
- Full `src/map` suite: 237 passed across 17 files.
- `typecheck`, `coreEngineNeutral.js` and `coreModuleState.js` all exit 0.
