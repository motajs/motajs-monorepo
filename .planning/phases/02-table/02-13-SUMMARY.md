---
phase: 02-table
plan: 13
subsystem: dev-host
tags: [editor-dev, editor-impl, table, panel-type, open-param, capability-provider, gap-closure]

# Dependency graph
requires:
  - phase: 02-table
    provides: tablePanelType / TablePanel / resourceType (TABLE-01 capability), and 02-12 open-param plumbing
  - phase: 01.1-dev-host
    provides: editor-dev composition root, MemoryBackend seed(id, value), demo panel
provides:
  - dev host registers tablePanelType + '打开表格' menu item and seeds table.demo / table#schema.demo
  - openTableDemoPanel(core) opens a table aimed at the demo table via the open param { target }
  - shell render root wrapped in CapabilityProvider (degraded/empty capabilities)
affects: [02-table verification G-02-HOST, later dev-host capability wiring]

# Actuals (#2632) — same scale as plan estimate (chars/4 over realized diff; lockfile churn excluded)
actuals:
  tokens: 1720
  tasks: 2
  commits: 2

tech-stack:
  added: ["@motajs/editor-impl (workspace:*, dev-only)", "antd (catalog:default, dev-only for CapabilityProvider modals)"]
  patterns: ["open param { target } carries the table target at construction (no instance-capture wrapper)"]

key-files:
  created:
    - packages/apps/editor-dev/src/demo/tableDemo.ts
    - packages/apps/editor-dev/src/__tests__/devHostTable.test.tsx
  modified:
    - packages/apps/editor-dev/package.json
    - packages/apps/editor-dev/src/main.tsx
    - pnpm-lock.yaml

key-decisions:
  - "Target table passed via the open param { target: TABLE_DEMO_TARGET } (02-12), not a frozen-wrapper type that captures the instance"
  - "Table panel type registered directly (tablePanelType); no wrapper / instance capture"
  - "CapabilityProvider wraps the shell with no injected capabilities — table degrades gracefully; multi-select / point modals provided by the Provider itself"
  - "editor-dev stays dev-only (private: true); no product package references it"

patterns-established:
  - "Dev host capability wiring: seed resources -> registerPanelType -> registerMenuItem -> wrap shell in CapabilityProvider"

requirements-completed: [TABLE-01]

coverage:
  - id: D1
    description: "Dev host opens a schema-driven table via the '打开表格' menu, aimed at the seeded demo table through the open param"
    requirement: "TABLE-01"
    verification:
      - kind: unit
        ref: "packages/apps/editor-dev/src/__tests__/devHostTable.test.tsx#经打开参数打开 demo 表格并渲染 schema 驱动行"
        status: pass
      - kind: unit
        ref: "packages/apps/editor-dev/src/__tests__/devHostTable.test.tsx#已注册「打开表格」菜单项与表格面板类型"
        status: pass
    human_judgment: true
    rationale: "Browser visual / interaction acceptance (menu click, nested group + numeric rows render, no console errors) cannot be asserted in jsdom."
  - id: D2
    description: "editor-dev remains dev-only (private: true, no product package references it)"
    verification:
      - kind: manual_procedural
        ref: "PowerShell: Select-String packages/apps/editor-dev/package.json -Pattern '\"private\": true' (hit); product packages grep 'editor-dev' (no hit)"
        status: pass
    human_judgment: false

duration: ~1h
completed: 2026-10-13
status: halted
---

# Phase 2 Plan 13: Dev Host Table Wiring Summary

**Dev host now registers the real table panel type and a 「打开表格」 menu item, seeds `table.demo` / `table#schema.demo`, and opens a schema-driven table already aimed at the demo table via the open param `{ target }`.**

## Performance

- **Duration:** ~1h (Tasks 1–2 done; waiting on Task 3 human checkpoint)
- **Tasks:** 2/3 complete (Task 3 is a `human-verify` checkpoint — pending)
- **Files modified:** 5 (2 created, 3 modified incl. lockfile)

## Accomplishments
- `editor-dev` now depends on `@motajs/editor-impl` (workspace:*) and `antd` (catalog:default), both dev-only.
- `main.tsx` seeds `table.demo` (data) and `table#schema.demo` (standard JSON Schema with nested `position` object + numeric fields), registers `tablePanelType` and the 「打开表格」 menu item, and wraps the shell render root in `CapabilityProvider`.
- `openTableDemoPanel(core)` opens a blank tab then opens the table panel with the open param `{ target: TABLE_DEMO_TARGET }` — the panel is aimed at construction (02-12), no instance-capture wrapper.
- End-to-end test proves the open-param path renders schema-driven rows (`['position']` group, `标题`/`等级`/`横坐标`/`纵坐标` comments, values `示例条目`/`3`/`12`/`34`) and that the menu item + panel type are registered.

## Task Commits

1. **Task 1: wire table capability into dev host via open param** - `ba0cdd5` (feat)
2. **Task 2: dev host table wiring end-to-end test** - `53ea99d` (test)

**Plan metadata:** pending (Task 3 checkpoint not yet passed)

## Files Created/Modified
- `packages/apps/editor-dev/package.json` - added `@motajs/editor-impl` + `antd` devDependencies
- `packages/apps/editor-dev/src/demo/tableDemo.ts` - seed data/schema, `TABLE_DEMO_TARGET`, menu constants, `openTableDemoPanel(core)`
- `packages/apps/editor-dev/src/main.tsx` - seed + register panel type + menu item + `CapabilityProvider` wrap
- `packages/apps/editor-dev/src/__tests__/devHostTable.test.tsx` - end-to-end acceptance test
- `pnpm-lock.yaml` - dependency resolution for the two new devDependencies

## Decisions Made
- Target passed via open param `{ target }` (02-12), not the dropped frozen-wrapper / instance-capture approach.
- `tablePanelType` registered directly; no wrapper type.
- `CapabilityProvider` wraps the shell with no injected capabilities; table degrades gracefully.
- `editor-dev` stays `private: true`, dev-only.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Adjusted the automated assertion for the nested group's description**
- **Found during:** Task 2 (dev host table wiring end-to-end test)
- **Issue:** The plan's suggested assertion `screen.getByText('坐标')` (the `position` group's schema `description`) fails: group rows render `----` in the comment column and `['position']` in the value column — the group's own description is not rendered as text (confirmed against delivered `TableGrid`/`TableRow` behavior, and consistent with the existing `tracer.test.tsx` which asserts child descriptions, not group descriptions).
- **Fix:** Asserted the actually rendered nested-group content instead — `['position']` group row plus its child descriptions `横坐标` / `纵坐标` and child values `12` / `34` — which still proves "schema-driven nested group + numeric fields".
- **Files modified:** `packages/apps/editor-dev/src/__tests__/devHostTable.test.tsx`
- **Verification:** `pnpm --filter @motajs/editor-dev test` → 5/5 pass, exit 0
- **Committed in:** `53ea99d` (part of Task 2 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1)
**Impact on plan:** The adjusted assertion is faithful to the plan's intent (nested group + numeric fields, schema-driven). No product code changed.

## Issues Encountered
None beyond the deviation above.

## User Setup Required
None - no external service configuration required.

## Checkpoint Pending (Task 3 — human-verify)

Task 3 is a `checkpoint:human-verify` browser acceptance. Execution is paused here until the human responds. Steps and expected observations are reported to the orchestrator (run `pnpm --filter @motajs/editor-dev dev`, open http://127.0.0.1:1056, click 「打开表格」, expect the demo table: `title` / `level` leaf rows, collapsible `['position']` group with `x` / `y` child rows, values `3` / `12` / `34`, Chinese descriptions in the comment column, 「表格面板」 in blank-tab type list, no console errors).

## Next Phase Readiness
- Pending Task 3 browser acceptance. On human approval, this plan re-summarizes as `complete` (status flips from `halted`), and STATE/ROADMAP are updated.
- No product code changed; no product runtime dependency added.

## Self-Check: PASSED

- FOUND: packages/apps/editor-dev/src/demo/tableDemo.ts
- FOUND: packages/apps/editor-dev/src/__tests__/devHostTable.test.tsx
- FOUND: ba0cdd5
- FOUND: 53ea99d

---
*Phase: 02-table*
*Status: halted at Task 3 human-verify checkpoint*
