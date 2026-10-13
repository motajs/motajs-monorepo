---
phase: 02-table
plan: 12
subsystem: editor-core
tags: [editor-core, editor-impl, shell, panel, open-param, table, implementation]

# Dependency graph
requires:
  - phase: 02-table
    provides: 外壳接口的可选打开参数（IEditorPanelFactoryParam.openParam、IShellSystem.openPanelInTab / createPanelInstance 的可选参数）
provides:
  - "ShellSystem 把可选打开参数从两个入口透传到面板工厂；未提供时刻意省略 openParam 键"
  - "tablePanelType.create 读取 param.openParam.target 并在构造阶段调用 ITablePanel.setTable(target)（面板一打开即瞄准）"
  - "非导出谓词 isTablePanelTarget 安全收窄不透明 openParam.target（无 as 断言）"
affects: [02-13-dev-host-integration]

# Actuals (#2632) — pairs with the plan's `estimate` to calibrate future estimates.
# Same estimateTokens scale (chars/4 over the realized diff), never a harness token count.
actuals:
  tokens: 3258
  tasks: 2
  commits: 2
  plan_head_before: d0b4c679eea9cab5d23668510e632cc0c4db1bea

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "外壳透传打开参数：按是否提供构造两种工厂入参对象，未提供时整个省略 openParam 键——对不关心该参数的既有工厂完全透明"
    - "面板工厂在构造阶段自行收窄不透明 openParam：用非导出谓词 isTablePanelTarget 做运行时形状检查，畸形/缺省一律视为「不瞄准」而非抛错"

key-files:
  created:
    - packages/libs/editor-core/src/shell/__tests__/shellOpenParam.test.ts
    - packages/libs/editor-impl/src/table/__tests__/openParam.test.tsx
  modified:
    - packages/libs/editor-core/src/shell/shellSystem.ts
    - packages/libs/editor-impl/src/table/tablePanelType.ts

key-decisions:
  - "未提供打开参数时整个省略 openParam 键（不写 openParam: undefined）——createInstance 用三元表达式构造入参，保证不关心该参数的工厂行为一字不变"
  - "收窄 openParam.target 只用非导出谓词 isTablePanelTarget，不引入第二个辅助函数名（保持用户确认的命名面）、不使用 as 断言"
  - "谓词同时校验 data / schema 两键且各带数值 type、字符串 id，畸形值安全忽略，面板落回 NoTarget 态（T-02-12-01）"

patterns-established:
  - "打开参数消费方在构造阶段瞄准：面板工厂读自己的 IXxxPanelParam 并 setTable，取代「包装冻结类型捕获实例再外部 setTable」的旧做法"

requirements-completed: [TABLE-01]

coverage:
  - id: D1
    description: "外壳两个实例创建入口把可选打开参数透传给面板工厂；未提供时工厂入参完全不含 openParam 键"
    requirement: TABLE-01
    verification:
      - kind: unit
        ref: "packages/libs/editor-core/src/shell/__tests__/shellOpenParam.test.ts (3 tests, passed)"
        status: pass
    human_judgment: false
  - id: D2
    description: "表格面板类型读取 param.openParam.target 并在构造阶段 setTable——一打开即瞄准目标表"
    requirement: TABLE-01
    verification:
      - kind: unit
        ref: "packages/libs/editor-impl/src/table/__tests__/openParam.test.tsx (2 tests, passed)"
        status: pass
    human_judgment: false

duration: 10min
completed: 2026-10-13
status: complete
---

# Phase 2 Plan 12: 外壳打开参数（实现） Summary

**把外壳的可选打开参数真正接起来：`ShellSystem` 从两个创建入口把参数透传给面板工厂（未提供时整个省略该键），`tablePanelType.create` 读取自己的 `param.openParam.target` 并在构造阶段调用 `ITablePanel.setTable(target)`——表格面板一打开就瞄准目标表，无需外部再补一次 setTable，且不关心该参数的既有工厂行为一字不变。**

## Performance

- **Duration:** 10 min
- **Started:** 2026-10-13T07:39:08Z
- **Completed:** 2026-10-13T07:49:23Z
- **Tasks:** 2
- **Files modified:** 4（2 改 2 建）

## Accomplishments

- `ShellSystem.createPanelInstance(typeId, openParam?)` 与 `ShellSystem.openPanelInTab(tabId, typeId, openParam?)` 各接收可选打开参数并转交私有 `ShellSystem.createInstance`；其余行为（返回值、默认路径、工厂抛错隔离、实例登记、hooks）一律不变。
- `ShellSystem.createInstance` 按是否提供参数构造两种工厂入参：`openParam === undefined ? { context, instanceId } : { context, instanceId, openParam }`——**未提供时整个省略该键**（不是 `openParam: undefined`），对不关心参数的工厂完全透明。
- `tablePanelType.create` 先建 `TablePanel`，再读 `param.openParam`；当带 `target` 且经非导出谓词 `isTablePanelTarget` 收窄通过时，在构造阶段调用 `ITablePanel.setTable(target)`——面板一打开即瞄准目标表并触发读取。
- `isTablePanelTarget(value: unknown): value is ITablePanelTarget` 做运行时形状检查（非 null 对象、含 `data` / `schema`，二者各带数值 `type` 与字符串 `id`），不使用 `as` 断言；畸形/缺省一律视为「不瞄准」，面板落回「尚未设置目标表」态，不抛穿（T-02-12-01）。
- 两个新测试分别钉住外壳两态透传（提供 / 缺省）与表格「一打开即瞄准 / 缺省不瞄准」。

## Task Commits

Each task was committed atomically:

1. **Task 1: 外壳把可选打开参数透传给面板工厂（并提供 / 缺省两态的测试）** - `91f288c` (feat)
2. **Task 2: 表格面板类型在构造时按 openParam 瞄准目标表（并测试一打开即瞄准）** - `77f9f93` (feat)

**Plan metadata:** (see final docs commit appended after this SUMMARY)

## Files Created/Modified

- `packages/libs/editor-core/src/shell/shellSystem.ts` — 两入口新增 `openParam?` 透传；`createInstance` 按是否提供构造工厂入参（缺省省略该键）
- `packages/libs/editor-core/src/shell/__tests__/shellOpenParam.test.ts`（新）— 打开参数送达工厂的两态测试（openPanelInTab 提供 / 缺省、createPanelInstance 提供）
- `packages/libs/editor-impl/src/table/tablePanelType.ts` — 新增非导出谓词 `isTablePanelTarget`；`create` 在构造阶段据 `param.openParam.target` 调用 `setTable`
- `packages/libs/editor-impl/src/table/__tests__/openParam.test.tsx`（新）— 「经打开参数一打开即瞄准」（列头 / 分组行 / 值域）与「缺省不瞄准」（尚未设置目标表）两态测试

## Decisions Made

- 未提供打开参数时**整个省略 `openParam` 键**：由 `createInstance` 的三元表达式保证，使既有不关心该参数的工厂（如 `FakePanel`、旧 `openPanelInTab` 调用方）行为与返回值一字不变。
- 收窄只用计划确认的 `isTablePanelTarget` 谓词；形状检查（数值 `type` + 字符串 `id`）**内联在本谓词内**，未引入第二个辅助函数名，以保持在用户确认的命名面之内，且避免 `as` 断言。
- `tablePanelType` 仍是同一个 `Object.freeze({ id, name, icon, create })` 常量 `IEditorPanelType`，可直接经 `ShellSystem.registerPanelType` 注册。

## Deviations from Plan

None - plan executed exactly as written. (测试最小面板为清除 `@typescript-eslint/no-unused-vars` 警告省略了未使用的后置参数与泛型，属既有测试风格，未改变任何断言与行为。)

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- 打开参数已从外壳贯通到表格面板工厂：02-13（dev 宿主接入）可开空白标签后带 `{ target }` 打开表格面板，面板一打开即瞄准演示表，无需实例捕获或外部 `setTable`。
- 未新增依赖、未新增「按 instanceId 取回实例」API、未采用包装冻结类型的旧做法；`editor-core` 61 / `editor-impl` 84 测试全绿，四个 core 门禁脚本均退出 0，无遗留 block。

---

*Phase: 02-table*
*Completed: 2026-10-13*

## Self-Check: PASSED

- FOUND: packages/libs/editor-core/src/shell/shellSystem.ts
- FOUND: packages/libs/editor-core/src/shell/__tests__/shellOpenParam.test.ts
- FOUND: packages/libs/editor-impl/src/table/tablePanelType.ts
- FOUND: packages/libs/editor-impl/src/table/__tests__/openParam.test.tsx
- FOUND: 91f288c (feat(02-12) shell openParam passthrough)
- FOUND: 77f9f93 (feat(02-12) tablePanelType aim at construction)
- COMMITS measured: 2 (git rev-list --count d0b4c67..HEAD)
