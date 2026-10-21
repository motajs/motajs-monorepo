---
phase: 04-map
plan: 16
subsystem: ui
tags: [react, antd, map-panel, tile-palette, blob-url, hooks]
requires:
  - phase: 04-10
    provides: map panel view assembly and the map-palette-slot placeholder
  - phase: 04-11
    provides: MapPalette component with selection / retry / clear callbacks
  - phase: 04-04
    provides: useMapObjectUrl path guard and blob URL lifecycle pattern
provides:
  - real MapPalette mounted inside MapPanelView
  - useMapTileGroupUrls batching per-group image bytes into revocable blob URLs
  - MapPanel.selectPalette / MapPanel.reloadTileImages / MapPanel.setAboveLayerOpacity
  - 04-10 toolbar wiring closed (capability flags and callbacks bound to the real panel)
affects: [04-12, 04-13, 04-14]
actuals:
  tokens: 7125
  tasks: 1
  commits: 1
  plan_head_before: 0b4d6a1996544c4e442b4c96f7ce166a82540d03
tech-stack:
  added: []
  patterns:
    - one useEffect batches all group image reads; no hook calls inside loops
    - blob URLs live only in component state and are revoked on unmount or version change
    - palette selection is written to the panel store; the view never keeps a second copy
key-files:
  created: []
  modified:
    - packages/libs/editor-impl/src/map/components/MapPanelView.tsx
    - packages/libs/editor-impl/src/map/components/useMapObjectUrl.ts
    - packages/libs/editor-impl/src/map/mapPanel.ts
    - packages/libs/editor-impl/src/map/__tests__/mapView.palette.test.tsx
key-decisions:
  - "Palette values (selection / version / recent / groups) are read from the panel store inside MapPanelView instead of being passed as snapshot props; panel render output is not re-created by store updates, so snapshot props would go stale."
  - "Group images are deduped by imagePath: two groups sharing one atlas trigger a single byte read and one blob URL."
  - "The toolbar's view-only fallbacks stay in place for select-layer / brush / passability / big-map / viewport; those panel methods belong to 04-12."
patterns-established:
  - "Mounting a pure-props palette: the view owns blob URLs and store reads, the component only receives props and callbacks."
  - "Panel-level integration tests render MapPanelView with the real panel store and bind callbacks to the captured MapPanel instance."
requirements-completed: [MAP-01]
coverage:
  - id: D1
    description: "Real MapPalette mounted in MapPanelView, map-palette-slot removed, shared image paths read once"
    requirement: MAP-01
    verification:
      - kind: unit
        ref: "src/map/__tests__/mapView.palette.test.tsx#调色板挂进面板且同一图片路径只读取一次"
        status: pass
    human_judgment: false
  - id: D2
    description: "Tile / recent / erase selection written to IMapPanelViewState.paletteSelection through MapPanel.selectPalette"
    requirement: MAP-01
    verification:
      - kind: unit
        ref: "src/map/__tests__/mapView.palette.test.tsx#点图块把 1×1 选中写进面板状态"
        status: pass
      - kind: unit
        ref: "src/map/__tests__/mapView.palette.test.tsx#点最近使用的图块得到最近使用种类"
        status: pass
      - kind: unit
        ref: "src/map/__tests__/mapView.palette.test.tsx#点擦除格得到 1×1 全 0 的空选中"
        status: pass
    human_judgment: false
  - id: D3
    description: "Empty tile catalog keeps the canvas visible and makes commitCells a no-op; failed images retry through MapPanel.reloadTileImages without touching the document"
    requirement: MAP-01
    verification:
      - kind: unit
        ref: "src/map/__tests__/mapView.palette.test.tsx#图块目录为空时调色板显示空态且落笔无效"
        status: pass
      - kind: unit
        ref: "src/map/__tests__/mapView.palette.test.tsx#图片全失败时重试只重取字节且不改文档"
        status: pass
    human_judgment: false
  - id: D4
    description: "MapRecentClearDialog mounted with the palette; 04-10 toolbar capability flags and callbacks wired from MapPanel so toolbar actions reach the panel"
    requirement: MAP-01
    verification:
      - kind: unit
        ref: "src/map/__tests__/mapView.palette.test.tsx#点清除记录弹出确认弹窗"
        status: pass
      - kind: unit
        ref: "src/map/__tests__/mapView.palette.test.tsx#点工具栏新建地图经真实面板打开弹窗"
        status: pass
    human_judgment: false
duration: 14 min
completed: 2026-10-21
status: complete
---

# Phase 4 Plan 16: Mount the Tile Palette into the Map Panel Summary

**The panel now renders the real tile palette with store-backed selection, per-group blob URLs and a retry path, and the 04-10 toolbar is wired to the live MapPanel instance.**

## Performance

- **Duration:** 14 min
- **Started:** 2026-10-21T20:56:26Z
- **Completed:** 2026-10-21T21:10:00Z
- **Tasks:** 1
- **Files modified:** 4

## Accomplishments

- `MapPanelView` replaces the `map-palette-slot` placeholder with the real `MapPalette`, derives the aggregate image status and keeps the 240px container.
- `useMapTileGroupUrls` reads each distinct image path once, creates one blob URL per path, reports per-group `MapImageStatus`, and revokes URLs on version change or unmount.
- `MapPanel.selectPalette` writes tile / recent / erase selections into `IMapPanelViewState.paletteSelection`; `MapPanel.reloadTileImages` only bumps `paletteVersion`; `MapPanel.setAboveLayerOpacity` records the slider value.
- The 04-10 integration gap is closed: `MapPanel.render()` now passes capability flags, dialog/properties/save/retry/create/add-layer/unsaved callbacks and the toolbar callbacks, so toolbar actions reach the panel instead of falling back to inert defaults.
- 8 new panel-level cases pass (`mapView.palette.test.tsx` is now 31 tests), including a real-shell toolbar test and an empty-catalog no-op paint test.

## Task Commits

Each task was committed atomically:

1. **Task 1: palette URL hook + panel selection / retry + view mount** - `78c2a5b` (feat)

**Plan metadata:** committed after this SUMMARY.

## Files Created/Modified

- `packages/libs/editor-impl/src/map/components/useMapObjectUrl.ts` - added `useMapTileGroupUrls`, MIME inference and the per-path blob reader
- `packages/libs/editor-impl/src/map/components/MapPanelView.tsx` - mounts `MapPalette`, calls the hook, passes palette/retry/clear callbacks
- `packages/libs/editor-impl/src/map/mapPanel.ts` - `selectPalette` / `reloadTileImages` / `setAboveLayerOpacity`, panel-injected `loadTileBytes` and the 04-10 toolbar wiring
- `packages/libs/editor-impl/src/map/__tests__/mapView.palette.test.tsx` - 8 new panel-level cases (31 total)

## Decisions Made

- Palette values stay in the panel store and are read through `useStore` inside `MapPanelView`. Passing them as snapshot props from `MapPanel.render()` would freeze the first value because panel store updates do not re-run the panel's outer component.
- Group images are deduped by `imagePath`, so several groups backed by one atlas share a single byte read and a single blob URL.
- `MapPanel.selectPalette` normalizes the erase selection to a 1×1 all-zero pattern; it never touches the document, dirty flag or undo stack.
- View-only toolbar controls (`selectLayer`, brush mode, passability, big map, viewport) keep the 04-10 store fallbacks; their panel methods arrive with 04-12.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Palette state cannot be passed as snapshot props**
- **Found during:** Task 1 (view mount)
- **Issue:** `MapPanel.render()` runs only when the shell re-renders; panel store updates re-render `MapPanelView` alone. Passing `paletteSelection` / `paletteVersion` / `recentTiles` / `recentStatus` / `tileGroups` as props would hand the view stale first-render values, so a tile click would never light up the palette.
- **Fix:** The view reads those five values from `view` (the same store) and only receives the loader and callbacks as props.
- **Files modified:** `MapPanelView.tsx`, `mapPanel.ts`
- **Verification:** tile/recent/erase selections update both the store and the rendered `aria-pressed` state; 31 tests pass.
- **Committed in:** `78c2a5b`

**2. [Rule 2 - Missing Critical] Closed the 04-10 toolbar wiring gap**
- **Found during:** Task 1 (panel render props)
- **Issue:** `MapPanel.render()` passed only the original five props, so capability flags were always false and toolbar callbacks were undefined; the toolbar was effectively inert in the real panel.
- **Fix:** Bound `canCreateMap` / `canAddLayer` / `canOpenProperties`, dialog open/close, map select, save, retry, create map, add layer, unsaved decision, properties callbacks and `onAboveLayerOpacityChange` to the real panel methods.
- **Files modified:** `mapPanel.ts`
- **Verification:** a real-shell test clicks `map-new` and observes `MapDialogKind.New` in the panel store plus the mounted dialog.
- **Committed in:** `78c2a5b`

**3. [Rule 1 - Bug] Retry could not reach the map list**
- **Found during:** Task 1 (toolbar retry)
- **Issue:** the old `onRetry` only re-opened `targetMapId`; with no target (list error) the toolbar retry did nothing.
- **Fix:** retry re-opens the target map when there is one, otherwise reloads the summaries.
- **Files modified:** `mapPanel.ts`
- **Verification:** covered by the existing toolbar/empty-state suites; full `src/map` suite is green.
- **Committed in:** `78c2a5b`

---

**Total deviations:** 3 auto-fixed (2 bugs, 1 missing critical)
**Impact on plan:** All three are required for the palette and toolbar to work in the real panel. No scope creep into 04-12 canvas gestures.

## Issues Encountered

- The plan asked test ② to assert the `MapSurface` preview size is 1×1. `IMapRenderModel.preview` is only produced by canvas hover/gesture state, which arrives with 04-12. The test instead asserts the store selection and the palette's shared `aria-pressed` state; the preview assertion belongs to 04-12.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Ready for 04-12 to replace the canvas host with `MapCanvas` and consume the same `paletteSelection` / `paletteVersion`.
- The 04-10 integration gap recorded in `04-10-SUMMARY.md` is closed; no toolbar work remains for a follow-up plan.

---

*Phase: 04-map*
*Completed: 2026-10-21*

## Self-Check: PASSED

- All 4 plan files exist on disk.
- Commit `78c2a5b` is present in git history.
- `mapView.palette.test.tsx`: 31 passed; full `src/map/__tests__`: 268 passed across 18 files.
- `typecheck`, `coreEngineNeutral.js` and `coreModuleState.js` all exit 0.
