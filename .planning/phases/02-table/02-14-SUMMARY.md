---
phase: 02-table
plan: 14
subsystem: editor-impl
tags: [editor-core, editor-impl, table, types-only, interface, gap-closure, get-title, multi-column, x-order]

# Dependency graph
requires:
  - phase: 02-table
    provides: TablePanel / ITablePanel / ITablePanelTarget / ITablePanelParam / ITableSchemaNode (TABLE-01), and 02-13 dev-host table wiring
provides:
  - "IEditorPanel.getTitle?() optional per-instance display-title seam (editor-core, types-only)"
  - "ITablePanel.setTable(target, columnIndex?) multi-column target"
  - "ITablePanelParam.columnWidth? (per-column pixel width, default ~400px)"
  - "ITableSchemaNode['x-order']? (explicit sibling field presentation order)"
affects: [02-table implementation block (table multi-column impl), dev-host opener injection block]

# Actuals (#2632) — same scale as plan estimate (chars/4 over realized diff)
actuals:
  tokens: 535
  tasks: 2
  commits: 2

tech-stack:
  added: []
  patterns: ["types-only interface block: optional members keep every existing implementor valid without touching implementation files"]

key-files:
  created: []
  modified:
    - packages/libs/editor-core/src/panel/types.ts
    - packages/libs/editor-impl/src/table/types.ts

key-decisions:
  - "getTitle modelled as an OPTIONAL method (getTitle?()) so TablePanel / dev demo panel / test fakes need no change — satisfies the types-only constraint"
  - "setTable gains an optional columnIndex (0-based, omitted = column 0); non-breaking because the existing single-arg TablePanel.setTable still satisfies the interface"
  - "x-order typed as readonly string[] — declares a presentation-order hint only; no behaviour depends on it in this plan"
  - "columnWidth documented as ~400px default per D-17; ITablePanelParam keeps extends Record<string, unknown>, no target member added"

patterns-established:
  - "Interface-only (types-only) plan: declare the seam, keep every new member optional or appended-optional so typecheck and tests stay green with zero implementation edits"

requirements-completed: [TABLE-01]

coverage:
  - id: D1
    description: "editor-core gains an optional per-instance display-title seam IEditorPanel.getTitle?() (absent -> shell falls back to the panel type name)"
    requirement: "TABLE-01"
    verification:
      - kind: unit
        ref: "pnpm --filter @motajs/editor-core typecheck (tsc -b, exit 0)"
        status: pass
    human_judgment: false
  - id: D2
    description: "editor-impl/table type surface updated: setTable(target, columnIndex?), ITablePanelParam.columnWidth?, ITableSchemaNode['x-order']"
    requirement: "TABLE-01"
    verification:
      - kind: unit
        ref: "pnpm --filter @motajs/editor-impl typecheck (tsc -b, exit 0)"
        status: pass
    human_judgment: false
  - id: D3
    description: "No regression in existing suites and editor-core neutrality gates (types-only, non-breaking)"
    verification:
      - kind: unit
        ref: "pnpm --filter @motajs/editor-core test (61 tests, exit 0); pnpm --filter @motajs/editor-impl test (84 tests, exit 0)"
        status: pass
      - kind: other
        ref: "node scripts/verify/coreImportType.js; coreEngineNeutral.js; coreModuleState.js; coreFsSurface.js (each exit 0)"
        status: pass
    human_judgment: false

duration: ~4min
completed: 2026-10-13
status: complete
---

# Phase 2 Plan 14: Table-fix round — interfaces (types only) Summary

**Defined the types-only interface surface for the table-fix round: an optional per-instance `IEditorPanel.getTitle?()` seam in editor-core, plus `ITablePanel.setTable(target, columnIndex?)` (multi-column target), `ITablePanelParam.columnWidth?` (~400px), and the `ITableSchemaNode['x-order']` key — no behaviour, no implementation edits.**

## Performance

- **Duration:** ~4min
- **Started:** 2026-10-13T18:06:55Z
- **Completed:** 2026-10-13T18:10:43Z
- **Tasks:** 2/2 complete
- **Files modified:** 2

## Accomplishments
- `editor-core`: `IEditorPanel` now declares the optional method `getTitle(): string | undefined` — the per-instance display-title seam (the shell reads it, absent -> falls back to `IEditorPanelType.name`). Optional, so `TablePanel`, the dev-host demo panel and all test fakes are untouched.
- `editor-impl/table`: `ITablePanel.setTable` is now `setTable(target: ITablePanelTarget, columnIndex?: number): void` (0-based target column; omitted = column 0).
- `ITablePanelParam` gains `readonly columnWidth?: number` (per-column pixel width, default ~400px per D-17), keeping `extends Record<string, unknown>` and adding no `target` member.
- `ITableSchemaNode` gains the extension key `readonly 'x-order'?: readonly string[]` (explicit sibling field presentation order).
- All four new names (`getTitle`, `columnIndex`, `columnWidth`, `x-order`) are the confirmed names; all pre-existing names (`ITablePanel` / `ITablePanelTarget` / `ITablePanelParam` / `ITableSchemaNode` / `x-editor` / `x-control`) are unchanged.

## Task Commits

Each task was committed atomically:

1. **Task 1: editor-core `IEditorPanel.getTitle?()` seam** - `83b8187` (feat)
2. **Task 2: editor-impl table types (`setTable` column, `columnWidth`, `x-order`)** - `914788f` (feat)

**Plan metadata:** (this SUMMARY commit)

## Files Created/Modified
- `packages/libs/editor-core/src/panel/types.ts` - added optional `getTitle?(): string | undefined` to `IEditorPanel`
- `packages/libs/editor-impl/src/table/types.ts` - `setTable(target, columnIndex?)`, `ITablePanelParam.columnWidth?`, `ITableSchemaNode['x-order']`

## Decisions Made
- `getTitle` is an **optional** method: keeps the plan types-only (no implementor changed), and the shell fallback to the type name is documented in the method JSDoc.
- `columnIndex` is appended as optional, so the current single-arg `TablePanel.setTable(target)` still satisfies the interface (TypeScript parameter optionality) — this is why typecheck stays green.
- `x-order` is a presentation-order hint only, typed `readonly string[]`; nothing consumes it in this plan (it is for the following implementation block).

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Known Stubs
None — this plan adds type declarations only; no stub values, placeholders, or unwired data sources.

## Threat Flags
None — the only security-relevant surface touched is the `getTitle` return value (rendered into the tab label). The plan's T-02-14-02 `mitigate` disposition is honoured by typing the title as a plain `string`; the shell's existing render path emits it as a React text node (no `dangerouslySetInnerHTML`). No HTML pre-rendering was introduced.

## Next Phase Readiness
- The type surface is defined and agreed; the following implementation block (table multi-column / per-instance title / new-row ordering) and the dev-host opener-injection block can now build against it.
- No behaviour shipped yet: `getTitle` is not read by the shell, `columnIndex` / `columnWidth` / `x-order` are not consumed.

## Self-Check: PASSED

- FOUND: packages/libs/editor-core/src/panel/types.ts
- FOUND: packages/libs/editor-impl/src/table/types.ts
- FOUND: 83b8187
- FOUND: 914788f

---
*Phase: 02-table*
*Completed: 2026-10-13*
