---
phase: 02-table
plan: 08
subsystem: ui
tags: [react, antd, json-schema, editor-core, undo, capabilities, table]

# Dependency graph
requires:
  - phase: 02-table
    provides: "02-03 capability seam declarations (ITableEditorCapabilities / ITablePanelOpener / ICodeEditorOpener) in src/react"
  - phase: 02-table
    provides: "02-04 table tracer (TablePanel.onSwitchIn / TableGrid / resource ids / buildTableTree)"
  - phase: 02-table
    provides: "02-05 shell invokes onSwitchIn / onSwitchOut on active-panel change (D-31)"
  - phase: 02-table
    provides: "02-07 edit modes, leaf rows and the unified undo path (commitValue / addItem / deleteItem / TableUndoType)"
  - phase: 01-shell
    provides: "editor-core unified undo path (IUndoable / IUndoContext / IEditorPanelContext.addUndoContext)"
provides:
  - "built-in schema presentation rule set (buildSchemaPresentation) and a schema-document row builder (buildSchemaTree)"
  - "schema mode detected by resource-id convention (table#schema.<name>): schema view reads only its own document, no schema request"
  - "SchemaBanner + TableToolbar (edit-mode control + optional muted title + 编辑 Schema + 在代码编辑器中打开)"
  - "TableCapabilitiesContext / useTableCapabilities (src/react), consumed by TableGrid"
  - "TablePanel.openSchemaPanel (D-06, injected ITablePanelOpener) and TablePanel.openCurrentViewInCodeEditor (D-30, injected ICodeEditorOpener + one whole-resource replace)"
affects: [02-09, 02-10]

# Actuals — pairs with the plan's estimate (50000 tokens, 3 tasks) to calibrate future estimates.
# tokens = chars/4 over the realized diff (3 plan commits, 12 files, 49152 chars)
actuals:
  tokens: 12288
  tasks: 3
  commits: 3
  plan_head_before: 2172a1a5635cd177e199047b6a2ea9149e401817

tech-stack:
  added: []
  patterns:
    - "schema mode = resource-id convention (table#schema.<name>); a schema view never requests a schema resource (D-05)"
    - "presentation rules are built-in (Object.freeze constants), never read from the edited schema"
    - "capability seam is a React Context in src/react; src/table may import src/react, never the reverse"
    - "switch-in refresh (D-15 rev / D-31): onSwitchIn re-requests data + schema and recomputes; no cross-panel broadcast"
    - "D-30 write-back is a single whole-resource replace recorded as one reversible operation through editor-core's undo path"

key-files:
  created:
    - packages/libs/editor-impl/src/table/model/schemaPresentation.ts
    - packages/libs/editor-impl/src/table/components/SchemaBanner.tsx
    - packages/libs/editor-impl/src/table/components/TableToolbar.tsx
    - packages/libs/editor-impl/src/react/capabilitiesContext.ts
    - packages/libs/editor-impl/src/table/__tests__/schemaMode.test.tsx
    - packages/libs/editor-impl/src/table/__tests__/switchRefresh.test.tsx
  modified:
    - packages/libs/editor-impl/src/table/components/TableGrid.tsx
    - packages/libs/editor-impl/src/table/tablePanel.ts
    - packages/libs/editor-impl/src/react/index.ts
    - packages/libs/editor-impl/src/table/components/index.ts
    - packages/libs/editor-impl/src/table/model/index.ts
    - packages/libs/editor-impl/src/table/table.css

key-decisions:
  - "buildSchemaPresentation takes sibling keyword rows and returns ordered rules (paired members absorbed into a pair rule; compact scalars flagged); TableGrid merges the paired rows at render time"
  - "buildSchemaTree turns a schema document into a keyword row tree (properties/items recurse); per-keyword synthesized validation nodes drive the reused inline controls"
  - "The panel methods take the opener as an argument; TableGrid reads the opener from useTableCapabilities() and supplies it — keeps the class panel out of React context while the capability stays injected"
  - "TableCapabilitiesContext lives in src/react (declared here); 02-09's CapabilityProvider will provide it and mount the modals"
  - "openCurrentViewInCodeEditor serializes this.data and writes back to target.data, so D-30 covers both the data view (table.<name>) and the schema view (table#schema.<name>) with one path"
  - "TableUndoType gained Replace; its payload reuses the { path: '', previousValue, nextValue } shape (whole-document previous/next)"

patterns-established:
  - "Pattern 1: schema targets render through buildSchemaTree + schema-mode pairing; data targets keep buildTableTree, one grid serves both"
  - "Pattern 2: capability absence degrades to a disabled control (edit-schema / open-in-code), never a crash"

requirements-completed: [TABLE-01]

coverage:
  - id: D1
    description: "Schema-mode presentation: paired keywords (minimum/maximum) render as one row with two small number inputs; compact scalars as a single control; built-in rules only"
    requirement: TABLE-01
    verification:
      - kind: unit
        ref: "packages/libs/editor-impl/src/table/__tests__/schemaMode.test.tsx#schema 目标下成对关键字合行、紧凑标量单控件"
        status: pass
    human_judgment: false
  - id: D2
    description: "「编辑 Schema」 button: absent for a schema target (D-05), opens a NEW table panel pointed at table#schema.<name> via the injected opener (D-06); disabled while loading, hidden on error"
    requirement: TABLE-01
    verification:
      - kind: unit
        ref: "packages/libs/editor-impl/src/table/__tests__/schemaMode.test.tsx#schema 目标下不显示「编辑 Schema」按钮并渲染提示条"
        status: pass
      - kind: unit
        ref: "packages/libs/editor-impl/src/table/__tests__/schemaMode.test.tsx#数据目标下「编辑 Schema」经注入打开器打开 schema 面板"
        status: pass
      - kind: unit
        ref: "packages/libs/editor-impl/src/table/__tests__/schemaMode.test.tsx#schema 资源加载中「编辑 Schema」按钮禁用"
        status: pass
      - kind: unit
        ref: "packages/libs/editor-impl/src/table/__tests__/schemaMode.test.tsx#schema 资源不可用时「编辑 Schema」按钮隐藏"
        status: pass
    human_judgment: false
  - id: D3
    description: "「在代码编辑器中打开」 (D-30): opens the current view's file via the injected code opener; a non-null result is parsed and written back as one reversible whole-resource replace; invalid JSON is rejected"
    requirement: TABLE-01
    verification:
      - kind: unit
        ref: "packages/libs/editor-impl/src/table/__tests__/schemaMode.test.tsx#数据视图下打开数据文件并整份写回记一次可逆操作"
        status: pass
      - kind: unit
        ref: "packages/libs/editor-impl/src/table/__tests__/schemaMode.test.tsx#代码编辑器返回非法 JSON 时拒绝写回"
        status: pass
      - kind: unit
        ref: "packages/libs/editor-impl/src/table/__tests__/schemaMode.test.tsx#schema 视图下打开 schema 文件"
        status: pass
    human_judgment: false
  - id: D4
    description: "Switch-in refresh (D-15 rev / D-31): shell activation re-requests data + schema and recomputes the layout"
    requirement: TABLE-01
    verification:
      - kind: unit
        ref: "packages/libs/editor-impl/src/table/__tests__/switchRefresh.test.tsx#外壳切入面板时重新请求数据与 schema 并重算"
        status: pass
    human_judgment: false
  - id: D5
    description: "Overall look-and-feel of the schema banner / toolbar / paired row (400px columns, muted one-line banner truncation, small paired inputs)"
    verification: []
    human_judgment: true
    rationale: "Layout and appearance depend on real browser rendering; jsdom asserts behaviour and DOM structure only (banner truncation is a plan backstop)."

duration: 34min
completed: 2026-10-13
status: complete
---

# Phase 02 Plan 08: schema presentation, toolbar, switch-in refresh and D-30 open/write-back Summary

**Schema-driven editing behaviours on top of the 02-04/02-05/02-07 base: schema-specific presentation (paired keyword rows, built-in rules), a schema-mode banner, a toolbar with 「编辑 Schema」 (D-06, injected opener) and 「在代码编辑器中打开」 (D-30, whole-resource write-back), and switch-in refresh (D-15 rev / D-31).**

## Performance

- **Duration:** ~34 min
- **Tasks:** 3
- **Files modified:** 12 (6 created, 6 modified)
- **Commits:** 3 (`commits` measured from `plan_head_before`)

## Accomplishments

- A standard JSON Schema document now renders as a keyword row tree (`buildSchemaTree`): each level's keywords are rows, `properties` / `items` recurse, and every leaf carries a synthesized validation node so the 02-06 inline controls are reused unchanged.
- Schema-specific presentation is driven by an **internal** rule set (`buildSchemaPresentation`, `Object.freeze` constants) — never from the edited schema. Paired keywords (`minimum`/`maximum`, `exclusiveMinimum`/`exclusiveMaximum`) merge onto one row with two small `InputNumber`s; compact scalars (`type`/`pattern`/`format`/`title`/`description`) render a single control.
- A schema target is detected by the resource-id convention (`table#schema.<name>`); a schema view requests only its own document (no schema request, D-05) and shows a one-line muted `SchemaBanner` above the grid.
- The toolbar is presentational (`TableToolbar`); `TableGrid` reads the injected capabilities through `TableCapabilitiesContext` / `useTableCapabilities` and wires the two buttons. 「编辑 Schema」 is absent for a schema target, disabled while loading, hidden on error, and on a data target opens a **new** panel pointed at `table#schema.<name>` through the injected `ITablePanelOpener` (D-06). 「在代码编辑器中打开」 opens the current view's file through the injected `ICodeEditorOpener` (D-30).
- D-30 write-back is one reversible whole-resource replace (`TableUndoType.Replace`) through editor-core's unified undo path; a non-JSON return is rejected and the resource stays unchanged (T-02-23).
- `TablePanel.onSwitchIn` (from 02-04) now also recomputes the schema presentation layout; nothing was added back for cross-panel broadcast (D-31).

## Task Commits

Each task was committed atomically:

1. **Task 1: schema presentation model + banner + layout markers** — `e3ae672` (feat)
2. **Task 2: capability context, toolbar, schema button (D-06), D-30 write-back** — `661bd21` (feat)
3. **Task 3: lock schema mode, toolbar buttons and switch-in refresh** — `a2eead2` (test)

**Plan metadata:** (this SUMMARY commit) (docs: complete plan)

## Files Created/Modified

- `src/table/model/schemaPresentation.ts` — `isSchemaResourceId`; `buildSchemaPresentation` (built-in paired/compact rules over sibling rows); `buildSchemaTree` (schema doc → keyword row tree with synthesized per-keyword validation nodes).
- `src/table/components/SchemaBanner.tsx` — single-line muted banner with `title` (ellipsis truncation).
- `src/table/components/TableToolbar.tsx` — edit-mode control + optional muted title + 「编辑 Schema」 + 「在代码编辑器中打开」.
- `src/table/components/TableGrid.tsx` — schema-mode rows/banner, capability-driven toolbar wiring, paired-row rendering; no behaviour change for the data path.
- `src/table/tablePanel.ts` — schema-view refresh branch; `openSchemaPanel` / `openCurrentViewInCodeEditor`; `applyData` / `applySchemaLoaded` / `isSchemaView` / `currentTableName`; `TableUndoType.Replace`; view state carries `schemaMode` / `title`.
- `src/react/capabilitiesContext.ts` — `TableCapabilitiesContext` + `useTableCapabilities` (declared here; 02-09 provides the Provider).
- `src/react/index.ts`, `src/table/components/index.ts`, `src/table/model/index.ts` — barrels.
- `src/table/table.css` — banner, toolbar title and paired-value styles.
- `src/table/__tests__/schemaMode.test.tsx` — 9 cases (button presence/absence/loading/error, D-06 opener param, paired/compact rendering, D-30 write-back + undo, invalid-JSON rejection, schema-view file).
- `src/table/__tests__/switchRefresh.test.tsx` — 1 case (shell switch-in re-requests data + schema and recomputes).

## Decisions Made

- **Rule-driven pairing at render time.** `buildSchemaPresentation(rows)` returns ordered `ISchemaPresentationRule`s with paired members absorbed; `TableGrid.renderSchemaRows` merges the paired rows, so the row tree stays a plain `ITableRowNode[]`.
- **Capability stays injected; the panel method takes the opener.** `TablePanel` is a plain class that cannot read React context, so `TableGrid` reads the opener from `useTableCapabilities()` and passes it to `TablePanel.openSchemaPanel(opener)` / `openCurrentViewInCodeEditor(opener)`. This keeps the panel free of context while the capability remains injected by the composition root.
- **One D-30 path for both views.** `openCurrentViewInCodeEditor` serializes `this.data` and writes back to `target.data`; for a data view that file is `table.<name>`, for a schema view it is `table#schema.<name>`.
- **Whole-resource replace reuses the existing undo payload shape** (`{ path: '', previousValue, nextValue }`) under a new `TableUndoType.Replace`, so `TablePanel.undo` / `redo` need no new mechanism.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added `buildSchemaTree` + `isSchemaResourceId` beside `buildSchemaPresentation`**
- **Found during:** Task 1
- **Issue:** The plan named only `buildSchemaPresentation`, but the grid needs a schema-document row tree and the panel needs the resource-id mode detector; without them the schema view cannot produce rows or branch.
- **Fix:** Both live in `schemaPresentation.ts` (the plan's new file): `buildSchemaTree` builds the keyword row tree, `isSchemaResourceId` implements the `table#schema.<名>` convention.
- **Files modified:** `src/table/model/schemaPresentation.ts`
- **Verification:** schemaMode paired/compact/banner tests pass.
- **Committed in:** `e3ae672`

**2. [Rule 3 - Blocking] Added `table.css` styles and the two new barrels**
- **Found during:** Task 1
- **Issue:** `table.css`, `components/index.ts` and `model/index.ts` are not enumerated in Task 1's `files`, but the banner/toolbar/pair styles and the `export *` barrels are required for the new modules to be reachable (AGENTS.md forbids deep cross-directory re-exports).
- **Fix:** Added banner/toolbar-title/paired-value styles and the two barrel exports.
- **Files modified:** `src/table/table.css`, `src/table/components/index.ts`, `src/table/model/index.ts`
- **Verification:** typecheck + tests green.
- **Committed in:** `e3ae672`

**3. [Rule 3 - Blocking] Prettier formatting pass folded into Task 3**
- **Found during:** Task 3
- **Issue:** `TableGrid.tsx` / `tablePanel.ts` needed Prettier normalisation after the Task 1/2 edits.
- **Fix:** Ran `prettier --write` on the three new/edited files; the two whitespace-only changes landed in the Task 3 commit.
- **Files modified:** `src/table/components/TableGrid.tsx`, `src/table/tablePanel.ts`, `src/table/__tests__/schemaMode.test.tsx`
- **Verification:** `prettier --check` clean for the new files.
- **Committed in:** `a2eead2`

### Flagged Notes (not deviations)

- **New names introduced (registered per AGENTS.md 「重要命名先确认」).** Beyond the plan-confirmed names (`buildSchemaPresentation`, `SchemaBanner`, `TableToolbar`, `TableCapabilitiesContext` / `useTableCapabilities`, `TablePanel.openSchemaPanel` / `TablePanel.openCurrentViewInCodeEditor`), this plan also introduced: `buildSchemaTree`, `isSchemaResourceId`, `TableGridOpenSchemaHandler`, `TableGridOpenCodeHandler`, `ISchemaBannerProps`, `ITableToolbarProps` and supporting module constants. All are internal to `src/table` / `src/react` and registered here rather than blocked (the plan was approved for execution).
- **`onSwitchIn` already existed (02-04).** 02-08 only made the recompute schema-aware and pinned it with a regression test; no new switch hook was added, and no cross-panel broadcast seam exists (D-31).
- **Pre-existing Prettier drift** in `edit.test.tsx` / `TableRow.tsx` (last touched by 02-07) is out of scope; recorded in `deferred-items.md`.

---

**Total deviations:** 3 auto-fixed (all blocking), plus 3 flagged notes.
**Impact on plan:** All three fixes were required for the schema view to produce rows, for the new modules to be reachable, and for formatting parity. No scope creep.

## Known Stubs

None. The `onOpenExternalEditor` seam on `TableRow` remains a declared forward seam dispatched by plan 02-09 (documented in 02-07), not a stub.

## Threat Flags

None. Mitigations delivered: T-02-22 (schema/cell text rendered only as React text nodes), T-02-20 (switch-in refresh recomputes without writing back, no loop), T-02-23 (code-editor return is parsed as JSON before write-back; parse failure rejects the write; write-back goes through the unified reversible path).

## Verification Evidence

| Command | Result |
|---------|--------|
| `pnpm --filter @motajs/editor-impl typecheck` | exit 0 |
| `pnpm --filter @motajs/editor-impl test` | exit 0 (7 files, 62 tests) |
| `pnpm --filter @motajs/editor-core test` | exit 0 (6 files, 58 tests, stays green) |
| `node scripts/verify/coreImportType.js` | exit 0 (scanned 72 files, 0 `import type`) |
| `node scripts/verify/coreEngineNeutral.js` | exit 0 (scanned 56 production files, 0 engine terms) |
| `node scripts/verify/coreModuleState.js` | exit 0 (0 error-level restricted rules; two-polarity holds) |
| `node scripts/verify/coreFsSurface.js` | exit 0 (72 files; `IEditorFileSystem` only in its declaration file) |
| `pnpm exec prettier --check packages/libs/editor-impl/src` | exit 1 — only pre-existing `edit.test.tsx` / `TableRow.tsx` (see deferred-items.md); all 02-08 files clean |

## Next Phase Readiness

- Plan 02-09 can implement `CapabilityProvider` (providing `TableCapabilitiesContext`), mount the modals, and wire `TableRow.onOpenExternalEditor`; the two toolbar actions are already reachable through the capability seam.
- The schema view's write-back (`TablePanel.openCurrentViewInCodeEditor`) and `commitValue` share the same resource-write + undo path, so 02-09 can route returned field values through `TablePanel.commitValue`.
- Manual/visual acceptance (banner truncation under a narrow panel, 400px column layout, small paired inputs) remains for 02-10 / host integration.

## Self-Check: PASSED

- Created/modified files verified to exist.
- Task commits verified: `e3ae672`, `661bd21`, `a2eead2`.
- `commits: 3` measured from `plan_head_before` (`git rev-list --count`).

---

*Phase: 02-table*
*Completed: 2026-10-13*
