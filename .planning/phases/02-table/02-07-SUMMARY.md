---
phase: 02-table
plan: 07
subsystem: ui
tags: [react, antd, json-schema, ajv, editor-core, undo, table]

# Dependency graph
requires:
  - phase: 02-table
    provides: "02-04 table tracer (TablePanel / TableGrid / resource ids / buildTableTree)"
  - phase: 02-table
    provides: "02-06 JSON-Schema validation (validateValue / validateId) and the five inline input controls + inferControlKind"
  - phase: 01-shell
    provides: "editor-core unified undo path (IUndoable / IUndoContext / IEditorPanelContext.addUndoContext)"
provides:
  - "editable leaf rows: schema-mapped value control (TextareaInput / SelectInput / CheckboxInput / CheckboxSet / ColorInput), pre-commit validation, mode-sensitive double-click"
  - "field-path helpers as bare functions (parseFieldPath / getParentFieldPath / setByFieldPath / deleteByFieldPath / getShortField) over the legacy bracketed form `['a']['b']`"
  - "编辑 / 添加 / 删除 edit-mode Segmented; add/delete with prompt/confirm + copy"
  - "TablePanel.commitValue / addItem / deleteItem + undo / redo recording exactly one reversible IUndoContext per edit"
affects: [02-08, 02-09, 02-10]

# Actuals — pairs with the plan's estimate (52000 tokens, 3 tasks) to calibrate future estimates.
actuals:
  tokens: 14173
  tasks: 3
  commits: 4

tech-stack:
  added: []
  patterns:
    - "one reversible operation per edit: write through the resource layer, then record IUndoContext; a failed write records nothing (T-02-18)"
    - "engine-neutral table: no expression evaluation — validation is ajv (validateValue) + charset (validateId) only"
    - "field paths use the legacy bracketed string form; immutable set/delete return fresh objects"

key-files:
  created:
    - packages/libs/editor-impl/src/table/model/fieldPath.ts
    - packages/libs/editor-impl/src/table/components/TableRow.tsx
    - packages/libs/editor-impl/src/table/components/GapRow.tsx
    - packages/libs/editor-impl/src/table/components/EditModeSegmented.tsx
    - packages/libs/editor-impl/src/table/__tests__/edit.test.tsx
    - packages/libs/editor-impl/src/table/__tests__/undo.test.ts
  modified:
    - packages/libs/editor-impl/src/table/tablePanel.ts
    - packages/libs/editor-impl/src/table/components/TableGrid.tsx
    - packages/libs/editor-impl/src/table/components/index.ts
    - packages/libs/editor-impl/src/table/model/index.ts
    - packages/libs/editor-impl/src/table/model/traversal.ts
    - packages/libs/editor-impl/src/table/table.css
    - packages/libs/editor-impl/src/table/__tests__/tracer.test.tsx

key-decisions:
  - "Field paths use the legacy bracketed string form `['a']['b']` (user-confirmed); buildTableTree now joins keys that way so the helpers resolve every row"
  - "TableUndoType members Change / Add / Delete; undo payload { path, previousValue, nextValue } (user-confirmed)"
  - "Fold state is grid-local UI state and is never recorded in the undo history"
  - "The edit-mode Segmented is controlled by the grid's own state, defaulting to Change"
  - "Value commit is rejected inside TableRow for immediate feedback and re-validated in TablePanel.commitValue so the plan-02-09 external-editor path shares one validated entry point"

patterns-established:
  - "Pattern 1: every edit deep-clones via immutable field-path helpers, writes through the resource layer, then records one IUndoContext"
  - "Pattern 2: unsafe field segments (__proto__ / constructor / prototype) are refused at the field-path write layer (T-02-17)"

requirements-completed: [TABLE-01]

coverage:
  - id: D1
    description: "Field-path helpers over the legacy bracketed form, with a prototype-polluting-key guard on writes"
    requirement: TABLE-01
    verification:
      - kind: unit
        ref: "packages/libs/editor-impl/src/table/__tests__/undo.test.ts#新增原型污染键时拒绝写入"
        status: pass
      - kind: unit
        ref: "packages/libs/editor-impl/src/table/__tests__/undo.test.ts#一次编辑是一步撤销，撤销还原旧值、重做恢复新值"
        status: pass
    human_judgment: false
  - id: D2
    description: "Unified undo path: every value change / add / delete is exactly one reversible operation, undoable and redoable through editor-core's UndoSystem"
    requirement: TABLE-01
    verification:
      - kind: unit
        ref: "packages/libs/editor-impl/src/table/__tests__/undo.test.ts#一次编辑是一步撤销，撤销还原旧值、重做恢复新值"
        status: pass
      - kind: unit
        ref: "packages/libs/editor-impl/src/table/__tests__/undo.test.ts#撤销后新编辑清空重做路径"
        status: pass
      - kind: unit
        ref: "packages/libs/editor-impl/src/table/__tests__/undo.test.ts#新增是一项可撤销操作"
        status: pass
      - kind: unit
        ref: "packages/libs/editor-impl/src/table/__tests__/undo.test.ts#删除是一项可撤销操作"
        status: pass
      - kind: unit
        ref: "packages/libs/editor-impl/src/table/__tests__/undo.test.ts#maxUndoStep 为 0 时不记录撤销但仍写入"
        status: pass
    human_judgment: false
  - id: D3
    description: "Editable leaf rows: schema-mapped value control, rejected invalid commits with the exact copy, and a mode-sensitive double-click"
    requirement: TABLE-01
    verification:
      - kind: unit
        ref: "packages/libs/editor-impl/src/table/__tests__/edit.test.tsx#合法值提交后写回资源并更新显示"
        status: pass
      - kind: unit
        ref: "packages/libs/editor-impl/src/table/__tests__/edit.test.tsx#非法值被拒绝并显示精确文案"
        status: pass
    human_judgment: false
  - id: D4
    description: "Add / delete: 添加 mode appends a validated child; 删除 mode confirms and is refused when the schema forbids null; both show the legacy copy"
    requirement: TABLE-01
    verification:
      - kind: unit
        ref: "packages/libs/editor-impl/src/table/__tests__/edit.test.tsx#添加模式下用校验通过的名字追加子项"
        status: pass
      - kind: unit
        ref: "packages/libs/editor-impl/src/table/__tests__/edit.test.tsx#删除模式确认后删除"
        status: pass
      - kind: unit
        ref: "packages/libs/editor-impl/src/table/__tests__/edit.test.tsx#schema 禁止 null 时拒绝删除"
        status: pass
    human_judgment: false
  - id: D5
    description: "Overall visual/interaction parity with the legacy table (D-27): toolbar placement, fold affordance, column layout"
    verification: []
    human_judgment: true
    rationale: "Layout and look-and-feel parity is a visual judgment; automated tests assert behaviour and DOM text, not appearance."

duration: 24min
completed: 2026-10-13
status: complete
---

# Phase 02 Plan 07: Edit modes, add/delete, and the unified undo path Summary

**Editable schema-driven table rows: schema-mapped value controls, 编辑/添加/删除 edit modes, add/delete with legacy copy, and editor-core's unified undo path (one edit = one reversible operation).**

## Performance

- **Duration:** ~24 min
- **Started:** 2026-10-13T12:11:00Z
- **Completed:** 2026-10-13T12:23:00Z
- **Tasks:** 3
- **Files modified:** 13 (6 created, 7 modified)

## Accomplishments

- Leaf rows now render the schema-mapped control (`inferControlKind` → TextareaInput / SelectInput / CheckboxInput / CheckboxSet / ColorInput); a commit failing `validateValue` is rejected with 「{字段} : 输入的值不合要求，请鼠标放置在注释上查看说明」 and never fires the change callback.
- 编辑 / 添加 / 删除 is a controlled `Segmented`; the double-click is two clicks within 500 ms (touch parity). Add prompts 「请输入新项的名称」 and validates via `validateId`; delete asks 「确定要删除吗？」 and is refused when `validateValue(schema, null)` is false with 「{字段} : 该值不允许为null，无法删除」.
- Every value change / add / delete writes through the resource layer and records exactly one `IUndoContext`; the panel's `undo`/`redo` apply the recorded inverse/forward change, write again, and re-render. Success copy is 「添加成功，刷新后生效。」 / 「删除成功，刷新后生效。」.
- Field-path helpers operate on the confirmed legacy bracketed form `['a']['b']` and are immutable; fold state stays grid-local and out of history.

## Task Commits

Each task was committed atomically:

1. **Task 1: Editable leaf rows with the value-cell control mapping** - `8546bfd` (feat)
2. **Task 2: Edit modes, add/delete, and the unified undo path** - `234de6d` (feat)
3. **Task 3: Test edit, add/delete and undo/redo** - `a6a6827` (test)
4. **Fix (T-02-17 prototype-pollution guard)** - `724f9b9` (fix)

**Plan metadata:** (this SUMMARY commit) (docs: complete plan)

## Files Created/Modified

- `packages/libs/editor-impl/src/table/model/fieldPath.ts` - parse / parent / immutable set / immutable delete / short-field helpers over `['a']['b']`; refuses `__proto__` / `constructor` / `prototype` segments.
- `packages/libs/editor-impl/src/table/components/TableRow.tsx` - leaf row: control mapping, pre-commit validation, mode-sensitive double-click, local error treatment.
- `packages/libs/editor-impl/src/table/components/GapRow.tsx` - foldable group row (`---- | ---- | ['field'] | [折叠/展开]`); fold state is local.
- `packages/libs/editor-impl/src/table/components/EditModeSegmented.tsx` - controlled 编辑/添加/删除 segmented (`data-test-id="table-edit-mode"`).
- `packages/libs/editor-impl/src/table/components/TableGrid.tsx` - owns the edit mode, renders the toolbar + notice, wires rows and callbacks.
- `packages/libs/editor-impl/src/table/tablePanel.ts` - `commitValue` / `addItem` / `deleteItem` / `undo` / `redo` + `TableUndoType`; the single write + undo path.
- `packages/libs/editor-impl/src/table/model/traversal.ts` - `joinPath` now emits the bracketed field-path form.
- `packages/libs/editor-impl/src/table/table.css` - row-error / toolbar / notice styles.
- `packages/libs/editor-impl/src/table/__tests__/edit.test.tsx` - inline edit, invalid rejection, add, delete tests.
- `packages/libs/editor-impl/src/table/__tests__/undo.test.ts` - one-edit-one-undo, undo/redo, redo-clear, add/delete reversibility, maxUndoStep 0, prototype-key refusal.
- `packages/libs/editor-impl/src/table/__tests__/tracer.test.tsx` - value-cell assertions updated from read-only text to editable control values.
- `packages/libs/editor-impl/src/table/components/index.ts`, `model/index.ts` - export the new modules.

## Decisions Made

- **Bracketed field-path form.** The user confirmed the field-path form is the legacy `['a']['b']`; `buildTableTree` was re-keyed accordingly so the helpers resolve every row (see Deviations).
- **Undo payload shape.** `TableUndoType` = `Change` / `Add` / `Delete`; payload `{ path, previousValue, nextValue }` (user-confirmed). Undo applies previous/removes the added path; redo applies next/re-adds the added path.
- **Delete permission lives in the row.** The row owns the field schema, so it performs the `validateValue(schema, null)` check and shows the refusal copy; the panel performs the write.
- **Dual validation.** The row validates for immediate feedback; `TablePanel.commitValue` re-validates so the plan-02-09 external-editor path shares one validated entry point (D-09).
- **Persistence failure isolation.** A failed write is caught, surfaced as a panel notice, and records no undo entry (T-02-18); `undo`/`redo` let a write failure throw so `UndoSystem` keeps the entry retryable.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Re-keyed the row tree to the bracketed field-path form**
- **Found during:** Task 1
- **Issue:** The confirmed field-path form is `['a']['b']`, but plan 02-04's `buildTableTree` joined keys with dots (`nested.inner`), so the confirmed `parseFieldPath` would have resolved zero rows and every helper/undo write would have no-op'd.
- **Fix:** `joinPath` in `traversal.ts` now emits `['a']['b']`; `TableRow`/`GapRow` derive display names via `getShortField`.
- **Files modified:** `src/table/model/traversal.ts`, `src/table/components/TableGrid.tsx`, `src/table/components/TableRow.tsx`, `src/table/components/GapRow.tsx`
- **Verification:** tracer + edit + undo tests pass; `['nested']` group display preserved.
- **Committed in:** `8546bfd`

**2. [Rule 1 - Bug] Updated the tracer test's value-cell assertions**
- **Found during:** Task 1
- **Issue:** The tracer asserted value cells as read-only text ('hello' / 'deep' / '42'); once cells became controls the values live on textarea `.value`, so `getByText` no longer found them.
- **Fix:** Assert the control value (JSON text) and use row test-ids for the fold assertion; the XSS test now asserts the literal value is not markup.
- **Files modified:** `src/table/__tests__/tracer.test.tsx`
- **Verification:** `pnpm --filter @motajs/editor-impl test` green.
- **Committed in:** `8546bfd`

**3. [Rule 2 - Missing Critical] Prototype-pollution guard on field-path writes (T-02-17)**
- **Found during:** Task 3 (threat-register review)
- **Issue:** The plan's threat register requires "set-by-path refuses non-whitelisted keys"; `validateId`'s charset whitelist accepts `__proto__`, and the initial `setByFieldPath` did not refuse it.
- **Fix:** `setAt`/`deleteAt` skip `__proto__` / `constructor` / `prototype` segments; a regression test proves an add of `__proto__` leaves the data untouched.
- **Files modified:** `src/table/model/fieldPath.ts`, `src/table/__tests__/undo.test.ts`
- **Verification:** new test passes; all suites green.
- **Committed in:** `724f9b9`

**4. [Rule 3 - Blocking] Added the Segmented component and supporting barrel/CSS**
- **Found during:** Task 2
- **Issue:** TableGrid cannot compile without `EditModeSegmented`, and the parity `data-test-id`s / styles need barrel exports and CSS; these files are not enumerated in the plan's `files_modified`.
- **Fix:** Added `EditModeSegmented.tsx`, exported the new components from `components/index.ts`, and added toolbar/notice/row-error styles to `table.css`.
- **Files modified:** `src/table/components/EditModeSegmented.tsx`, `src/table/components/index.ts`, `src/table/table.css`
- **Verification:** typecheck + tests green.
- **Committed in:** `234de6d`

---

**Total deviations:** 4 auto-fixed (1 bug, 1 missing critical, 2 blocking)
**Impact on plan:** All four were required for the confirmed field-path form to work, for security (T-02-17), and for the task to compile. No scope creep.

## Issues Encountered

- `createElement(GapRow, { ... })` with a required `children` prop failed the `createElement` overload; resolved by passing `children` inside the props object.
- `@testing-library/react`'s default test id attribute is `data-testid`, but the components use the parity `data-test-id`; `edit.test.tsx` configures `testIdAttribute` locally.

## Intentional deferral (not a stub)

- In Change mode the double-click invokes the row's `onOpenExternalEditor` seam; the panel does not yet supply a handler — the external-editor dispatch is delivered by plan 02-09. No data is written on this path.

## Known Stubs

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `edit` / `undo` tests lock the unified write + undo path, so 02-08 (switch-in refresh + schema presentation) and 02-09 (external editors + modals) can layer on top of `TablePanel.commitValue` as the single validated commit entry point.
- Plan 02-09 must wire the `onOpenExternalEditor` handler and route returned values back through `TablePanel.commitValue`.

## Verification Evidence

- `pnpm --filter @motajs/editor-impl typecheck` → exit 0
- `pnpm --filter @motajs/editor-impl test` → exit 0 (5 files, 52 tests)
- `pnpm --filter @motajs/editor-core test` → exit 0 (6 files, 58 tests, stays green)
- `node scripts/verify/coreImportType.js` → exit 0
- `node scripts/verify/coreEngineNeutral.js` → exit 0
- `node scripts/verify/coreModuleState.js` → exit 0
- `node scripts/verify/coreFsSurface.js` → exit 0

## Self-Check: PASSED

---
*Phase: 02-table*
*Completed: 2026-10-13*
