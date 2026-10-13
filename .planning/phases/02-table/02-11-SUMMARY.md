---
phase: 02-table
plan: 11
subsystem: editor-core
tags: [editor-core, types, shell, panel, open-param, interface-only]

# Dependency graph
requires:
  - phase: 02-table
    provides: 外壳 / 面板既有接口（IEditorPanelFactoryParam、IShellSystem.openPanelInTab / createPanelInstance）
provides:
  - "IEditorPanelFactoryParam.openParam?：工厂收到的可选打开参数（裸记录）"
  - "IShellSystem.openPanelInTab / createPanelInstance 各自的可选打开参数（裸 Record<string, unknown>）"
affects: [02-12-open-param-impl, 02-13-dev-host-integration]

# Actuals (#2632) — pairs with the plan's `estimate` to calibrate future estimates.
# Same estimateTokens scale (chars/4 over the realized diff), never a harness token count.
actuals:
  tokens: 423
  tasks: 2
  commits: 2
  plan_head_before: 5ce621165406fe4e126436755878ba9aade24720

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "外壳打开参数以不透明裸 Record<string, unknown> 承载：内核只透传、不假定外部参数形状；各面板自定义 IXxxPanelParam extends Record<string, unknown> 自行收窄"

key-files:
  created: []
  modified:
    - packages/libs/editor-core/src/panel/types.ts
    - packages/libs/editor-core/src/shell/types.ts

key-decisions:
  - "打开参数刻意保持为裸 Record<string, unknown>，不新增任何具名导出类型——内核对外部参数形状一无所知"
  - "纯类型放宽：ShellSystem 现有实现少写该参数仍满足接口，故本计划不改动任何实现（透传实现见 02-12）"
  - "成员名 openParam 依用户 2026-10-13 确认的打开参数模型（D-06）"

patterns-established:
  - "接口先行：接口计划只加类型声明、实现计划才接线（本项目强制「先接口、后实现」）"

requirements-completed: [TABLE-01]

coverage:
  - id: D1
    description: "面板工厂入参新增可选 openParam，工厂在构造时即可得知实例目标"
    requirement: TABLE-01
    verification:
      - kind: other
        ref: "pnpm --filter @motajs/editor-core typecheck && pnpm --filter @motajs/editor-impl typecheck (均退出 0)；pnpm --filter @motajs/editor-core test (58/58)"
        status: pass
    human_judgment: false
  - id: D2
    description: "外壳两个实例创建入口（openPanelInTab / createPanelInstance）各新增可选打开参数"
    requirement: TABLE-01
    verification:
      - kind: other
        ref: "pnpm --filter @motajs/editor-core typecheck && pnpm --filter @motajs/editor-impl typecheck (均退出 0)；pnpm --filter @motajs/editor-core test (58/58)"
        status: pass
    human_judgment: false

duration: 6min
completed: 2026-10-13
status: complete
---

# Phase 2 Plan 11: 外壳打开参数接口（仅类型） Summary

**给外壳接口加上「可选打开参数」：面板工厂入参 `IEditorPanelFactoryParam` 新增可选成员 `openParam`，外壳两个实例创建入口 `openPanelInTab` / `createPanelInstance` 各新增一个可选末位参数——一律不透明裸 `Record<string, unknown>`，内核只透传、不理解其内容；纯类型放宽，零行为改动。**

## Performance

- **Duration:** 6 min
- **Started:** 2026-10-13T07:24:42Z
- **Completed:** 2026-10-13T07:31:00Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- `IEditorPanelFactoryParam` 新增可选成员 `readonly openParam?: Record<string, unknown>`（带中文 jsDoc：内核只透传、不假定其形状）——工厂在构造面板实例时即可得知「要打开什么」。
- `IShellSystem.openPanelInTab(tabId, typeId, openParam?)` 与 `IShellSystem.createPanelInstance(typeId, openParam?)` 各新增一个可选末位参数，并为两处补上逐参 `@param openParam` 说明。
- 未新增任何具名导出类型、未触碰任何实现文件（`shellSystem.ts` 一行未改）；不透明参数形状由各面板自定义 `IXxxPanelParam extends Record<string, unknown>` 自行收窄。
- 宽化后的接口对既有实现完全兼容：`editor-core` 与 `editor-impl` 双双 typecheck 退出 0，`editor-core` 既有 58 个测试全绿。

## Task Commits

Each task was committed atomically:

1. **Task 1: 给面板工厂入参增加可选打开参数 openParam** - `1d815ee` (feat)
2. **Task 2: 给外壳两个实例创建入口增加可选打开参数** - `66d7209` (feat)

**Plan metadata:** (see final docs commit appended after this SUMMARY)

## Files Created/Modified

- `packages/libs/editor-core/src/panel/types.ts` — `IEditorPanelFactoryParam` 新增 `readonly openParam?: Record<string, unknown>`
- `packages/libs/editor-core/src/shell/types.ts` — `IShellSystem.openPanelInTab` / `createPanelInstance` 各新增可选 `openParam?: Record<string, unknown>` 及 `@param` 说明

## Decisions Made

- 打开参数保持**裸 `Record<string, unknown>`**，不引入具名导出类型：内核对外部参数形状一无所知，各面板自收窄（表格为既有 `ITablePanelParam`，其成员 `target?: ITablePanelTarget`）。
- 不新增「按 instanceId 取回面板实例」的 API——打开参数取代「包装类型捕获实例再 `setTable`」的旧做法，需要实例者应早已持有其引用。
- 纯类型放宽即可，无需改动 `shellSystem.ts`：TypeScript 允许实现方法省略可选尾参。

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- 接口已就位：02-12（实现计划）可据此让 `ShellSystem` 把可选打开参数透传给面板工厂，02-13 再用打开参数把表格能力接进开发宿主。
- 本计划为纯接口计划，无运行时行为引入，无遗留 block。

---

*Phase: 02-table*
*Completed: 2026-10-13*

## Self-Check: PASSED

- FOUND: packages/libs/editor-core/src/panel/types.ts
- FOUND: packages/libs/editor-core/src/shell/types.ts
- FOUND: 1d815ee (feat(02-11) panel openParam)
- FOUND: 66d7209 (feat(02-11) shell openParam)
- COMMITS measured: 2 (git rev-list --count 5ce6211..HEAD)
