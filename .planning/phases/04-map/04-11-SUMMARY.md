---
phase: 04-map
plan: 11
subsystem: ui
tags: [react, antd, map-palette, drag-selection, recent-tiles]
requires:
  - phase: 04-04
    provides: IMapPaletteSelection / IMapBrushPattern / MapPaletteKind and the palette selection contract
  - phase: 04-09
    provides: the emap stylesheet and palette slot container to be filled later
provides:
  - MapPalette pure-props component with erase cell, recent section and collapsible grouped grids
  - same-group drag selection that emits a row-major IMapBrushPattern with missing cells as 0
  - missing-image placeholder tiles that stay selectable
  - image loading / failure + retry presentation for the whole tile catalog
  - MapRecentClearDialog, a destructive controlled confirmation for clearing recent tiles
provides-files:
  - packages/libs/editor-impl/src/map/components/MapPalette.tsx
  - packages/libs/editor-impl/src/map/components/dialogs/MapRecentClearDialog.tsx
  - packages/libs/editor-impl/src/map/map.css
  - packages/libs/editor-impl/src/map/__tests__/mapView.palette.test.tsx
affects: [04-12, 04-16]
actuals:
  tokens: 12911
  tasks: 3
  commits: 1
  plan_head_before: 8dc1ac9c49eb19cdeb827604f44cc87847a39125
tech-stack:
  added: []
  patterns:
    - palette is a pure props component; images (blob urls + per-group MapImageStatus) are injected
    - drag selection is normalised through a clamped rect and resolved by (column, row), never by number arithmetic
    - destructive confirm dialog returns null while closed so cancel removes it from the DOM
key-files:
  created:
    - packages/libs/editor-impl/src/map/components/MapPalette.tsx
    - packages/libs/editor-impl/src/map/components/dialogs/MapRecentClearDialog.tsx
    - packages/libs/editor-impl/src/map/__tests__/mapView.palette.test.tsx
  modified:
    - packages/libs/editor-impl/src/map/components/index.ts
    - packages/libs/editor-impl/src/map/components/dialogs/index.ts
    - packages/libs/editor-impl/src/map/map.css
key-decisions:
  - "MapPalette takes groupUrls / groupStatus maps keyed by group id and holds no selection itself: selection is a controlled prop, drag/collapse/clear-open are local UI state."
  - "Drag extension reads the tile under the pointer from the grid's pointermove target dataset instead of pointer capture, so hover-based extension actually works in a browser."
  - "MapRecentClearDialog returns null while closed, following the phase decision that dialogs must leave the DOM on cancel (antd keeps hidden content otherwise)."
  - "No paint guard was added here: only an empty tile catalog disables painting, and that guard lives in MapPanel.commitCells. The palette merely offers no options when the catalog is empty."
patterns-established:
  - "Selection highlight is derived from primaryTileNumber + pattern shape, so a controlled selection can be re-rendered without extra anchor state."
  - "Missing tile images degrade to checkerboard + warm badge while keeping the real number, so painting with placeholder tiles keeps working."
requirements-completed: [MAP-01]
coverage:
  - id: D1
    description: "Three fixed sections: erase cell, recent used, grouped collapsible 32px grids with sticky headers"
    requirement: MAP-01
    verification:
      - kind: unit
        ref: "src/map/__tests__/mapView.palette.test.tsx#图块调色板骨架"
        status: pass
    human_judgment: false
  - id: D2
    description: "Empty catalog shows 暂无可用的图块 and renders no tile buttons; loading and failure states keep group headers and offer retry"
    requirement: MAP-01
    verification:
      - kind: unit
        ref: "src/map/__tests__/mapView.palette.test.tsx#图块调色板骨架"
        status: pass
    human_judgment: false
  - id: D3
    description: "Missing tile images render a placeholder badge but stay focusable, selectable and paintable"
    requirement: MAP-01
    verification:
      - kind: unit
        ref: "src/map/__tests__/mapView.palette.test.tsx#缺图图块带占位标记与提示且仍可选择"
        status: pass
    human_judgment: false
  - id: D4
    description: "Same-group drag select builds a W×H row-major pattern with missing cells as 0; releases show the W×H label"
    requirement: MAP-01
    verification:
      - kind: unit
        ref: "src/map/__tests__/mapView.palette.test.tsx#调色板多格框选"
        status: pass
    human_judgment: false
  - id: D5
    description: "Recent used section: 6-column grid, order preserved, unknown numbers skipped, destructive clear behind a confirm dialog"
    requirement: MAP-01
    verification:
      - kind: unit
        ref: "src/map/__tests__/mapView.palette.test.tsx#调色板最近使用"
        status: pass
    human_judgment: false
duration: ~27 min
completed: 2026-10-21
status: complete
---

# Phase 4 Plan 11: Tile Palette Component Summary

**A pure-props tile palette: fixed erase cell, recent-used strip, collapsible 32px grouped grids, same-group multi-cell drag selection and a destructive clear-recent confirmation — not yet mounted into the panel.**

## Performance

- **Duration:** ~27 min
- **Started:** 2026-10-21T12:20:00Z (first plan read)
- **Completed:** 2026-10-21T12:47:10Z (commit time)
- **Tasks:** 3
- **Files modified:** 6 (3 created, 3 modified)

## Accomplishments

- The palette now has its three fixed sections in UI-SPEC order: erase cell, recent used, grouped grids separated by 1px rules.
- Group headers are full-width buttons with inline SVG arrows, `aria-expanded`, sticky positioning and a muted count; collapse state is local to the component.
- Tiles are real `<button>`s whose accessible name and `title` are verbatim 「图块 {名称}（编号 {编号}）」; crop offsets come from `crop.x` / `crop.y` on an injected blob URL.
- Missing images degrade to a checkerboard plus a warm `!` badge with the extra title sentence, but stay selectable so painting with placeholders keeps working.
- Dragging inside one group produces a row-major `IMapBrushPattern`, resolved by `(column, row)` so non-contiguous tile numbers stay correct; cells without a tile become 0.
- The drag overlay is a dashed accent rect with a 10% fill and a 「{W}×{H}」 label; release commits, leaving the group clamps the selection.
- The whole-catalog `MapImageStatus` drives one loading block (`正在加载图块…` + `Spin`) and one failure block (`图块加载失败` + 重试) while group headers stay visible. Retry only calls `onRetryImages`.
- Recent used renders most-recent-first in a 6-column grid capped at two rows, skips numbers absent from the catalog, and clears only through `MapRecentClearDialog`.

## Task Commits

The three tasks touch the same two files (`MapPalette.tsx` and its test), so they were delivered as one atomic commit:

1. **Tasks 1-3: palette skeleton, drag selection, recent section + clear dialog** - `c580654` (feat)

**Plan metadata:** committed after this SUMMARY.

## Files Created/Modified

- `packages/libs/editor-impl/src/map/components/MapPalette.tsx` - palette component and its pattern/selection helpers
- `packages/libs/editor-impl/src/map/components/dialogs/MapRecentClearDialog.tsx` - destructive clear confirmation
- `packages/libs/editor-impl/src/map/components/dialogs/index.ts` - barrel export for the dialog
- `packages/libs/editor-impl/src/map/components/index.ts` - barrel export for the palette
- `packages/libs/editor-impl/src/map/map.css` - `emap-palette-*` section (sections, sticky headers, grid, selected/hover/missing, overlay, states)
- `packages/libs/editor-impl/src/map/__tests__/mapView.palette.test.tsx` - 23 palette tests

## Decisions Made

- `groupUrls` / `groupStatus` are keyed by group id and injected; the palette never reads files or bytes. A group with no URL (or `MapImageStatus.Error`) renders missing tiles; a group still loading is not treated as missing.
- Selection is fully controlled: the component computes the highlight from `primaryTileNumber` plus the pattern shape, so future panel wiring can re-render from `IMapPanelViewState.paletteSelection` without extra state.
- Drag extension is resolved from the grid's `pointermove` target dataset, clamped to the start group. Cross-group moves are ignored, which is the required clamp.
- `MapRecentClearDialog` returns null when closed, matching the phase decision that cancel must remove dialog content from the DOM.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Pointer capture would have broken multi-cell dragging**
- **Found during:** Task 2 (drag selection)
- **Issue:** The plan suggested calling `setPointerCapture?.()` on `pointerdown`. With capture active, `pointerenter` / `pointermove` on sibling tiles never fire, so extending the selection over hovered cells cannot work in a real browser.
- **Fix:** Do not capture. `pointerdown` on a tile records the start cell; the grid's `pointermove` reads the hovered tile from `event.target.dataset` and updates the end cell; `pointerup` / `pointerleave` on the grid commits the clamped rect. A `useRef` flag suppresses the follow-up click so a drag is not overwritten by a 1×1 selection.
- **Files modified:** `packages/libs/editor-impl/src/map/components/MapPalette.tsx`
- **Verification:** drag cases cover 2×3 pattern, cross-group clamp, size label during drag and missing-cell 0.
- **Committed in:** `c580654`

**2. [Rule 1 - Bug] Closed dialog stayed in the DOM**
- **Found during:** Task 3 (recent clear)
- **Issue:** antd `Modal` keeps its content mounted after `open` flips to false (no transition end in jsdom and hidden content in browsers), so asserting "cancel removes the dialog" failed.
- **Fix:** `MapRecentClearDialog` returns null while closed; the palette mounts it only for its local `clearOpen` state. This mirrors the phase-level dialog contract from 04-10.
- **Files modified:** `packages/libs/editor-impl/src/map/components/dialogs/MapRecentClearDialog.tsx`
- **Verification:** the recent-clear case opens, cancels, reopens and confirms; only confirm invokes `onClearRecent`.
- **Committed in:** `c580654`

### Process Deviations

**1. One commit instead of three per-task commits**
- **Reason:** all three tasks rewrite the same `MapPalette.tsx` and the same test file; splitting them would require partial staging and would leave an intermediate commit whose barrel export references a missing component. A single atomic commit keeps every commit type-checkable and test-green.
- **Scope impact:** none — the delivered file set matches `files_modified` exactly.

---

**Total deviations:** 2 auto-fixed (2 bugs) + 1 process deviation
**Impact on plan:** Both fixes are local to the component and were required for the stated truths (real drag selection, cancel removes the dialog). No scope creep: the palette is still not mounted into the panel.

## Issues Encountered

- **Not mounted yet (by design).** `MapPanelView` still renders the `map-palette-slot` placeholder; the palette is only rendered directly by tests. Wiring `tileGroups`, `loadTileBytes`, `paletteSelection`, `recentTiles`, `recentStatus` and the three callbacks is 04-16's job.
- **No paint guard added (by design).** The component only withholds options when the catalog is empty. The actual "cannot paint" guard stays in `MapPanel.commitCells` via `isTileCatalogEmpty`; image failures never block painting.

## Known Stubs

None. Every rendered state comes from props; no placeholder data or TODO markers were introduced.

## Threat Flags

None. The boundary is the same one the plan's threat model covers: host-provided names are rendered as React text nodes and `title`s, drag targets are clamped to the start group, and no new network, storage or file access was added.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Ready for `04-12`: canvas painting consumes `IMapBrushPattern` exactly as produced here (row-major, `(column, row)` lookup, missing cells 0), and the empty-selection pattern is 1×1 `[0]`.
- Ready for `04-16`: mount `MapPalette` in `map-palette-slot`, feed `useMapTileGroupUrls` and recent tiles, and connect `onSelectPattern` / `onRetryImages` / `onClearRecent` to `MapPanel.selectPalette` / `MapPanel.reloadTileImages` / `MapPanel.clearRecentTiles`.

---

*Phase: 04-map*
*Completed: 2026-10-21*

## Self-Check: PASSED

- All 6 plan files exist on disk.
- Commit `c580654` is present in git history and is the only commit after `8dc1ac9`.
- `mapView.palette.test.tsx`: 23 passed.
- Full `src/map` suite: 260 passed across 18 files.
- `typecheck` exit 0; `coreEngineNeutral.js` and `coreModuleState.js` exit 0; ESLint on the changed files exit 0.
