---
phase: 02-table
plan: 10
subsystem: testing
tags: [vitest, testing-library, integration, xss, nyquist, editor-impl]

# Dependency graph
requires:
  - phase: 02-table
    provides: 表格面板 / 资源层 / 统一撤销 / schema 呈现 / 注入式打开器（02-04…02-09）
provides:
  - 阶段级集成测试：单个用例端到端跑通完整表格流程（含 schema 面板切入刷新）
  - XSS / 边界守卫：脚本样字段名、注释、值以字面文本渲染
  - 02-VALIDATION.md 逐任务映射填齐、Wave 0 勾选、门禁退出码记录与签核
affects: [gsd-verify-work, editor-host-integration]

actuals:
  tokens: 5290
  tasks: 2
  commits: 2
  plan_head_before: 4d7e25144dacafd0178139f05335f784b5fc9277

tech-stack:
  added: []
  patterns:
    - "阶段级集成测试：单用例贯穿 面板 ↔ 外壳 ↔ 资源层 ↔ 网格 ↔ schema 模式 ↔ 外部编辑器接缝"
    - "注入式打开器在测试里以真实外壳开新标签承载 schema 面板（开标签 → openPanelInTab → setTable → onSwitchIn）"
    - "以「改 schema 注释 → 切回数据面板看到新注释」证明切入刷新，而非跨面板广播"

key-files:
  created:
    - packages/libs/editor-impl/src/table/__tests__/integration.test.tsx
  modified:
    - .planning/phases/02-table/02-VALIDATION.md

key-decisions:
  - "生效门禁（coreImportType / coreEngineNeutral / coreModuleState / coreFsSurface）全部真实运行、退出 0"
  - "失效门禁如实记录：coreBoundaries 意外为 0（绿）、coreExports 1、implExports 1；不作阶段门禁、不削弱生效门禁"
  - "nyquist_compliant 仅在全部生效检查全绿时置 true"

requirements-completed: [TABLE-01]

coverage:
  - id: D1
    description: "阶段级集成测试：打开数据表 → 查看 schema 驱动行 → 编辑值 → 加行 → 删行（各一步撤销/重做）→ 注入打开器新开 schema 面板 → 改 schema → 切回数据面板因切入刷新而重算"
    requirement: TABLE-01
    verification:
      - kind: integration
        ref: "packages/libs/editor-impl/src/table/__tests__/integration.test.tsx#数据表完整流程与 schema 切入刷新端到端跑通"
        status: pass
    human_judgment: false
  - id: D2
    description: "XSS / 边界守卫：脚本样字段名、注释、值以字面文本渲染，不生成 img / script 元素"
    requirement: TABLE-01
    verification:
      - kind: integration
        ref: "packages/libs/editor-impl/src/table/__tests__/integration.test.tsx#脚本样字段名、注释与值以字面文本渲染"
        status: pass
    human_judgment: false
  - id: D3
    description: "验证策略签核：逐任务映射填齐、Wave 0 勾选、生效门禁退出码 0、失效门禁状态记录"
    requirement: TABLE-01
    verification:
      - kind: other
        ref: "pnpm --filter @motajs/editor-impl test && pnpm --filter @motajs/editor-impl typecheck && pnpm --filter @motajs/editor-core test && pnpm --filter @motajs/editor-core typecheck (均退出 0)"
        status: pass
      - kind: other
        ref: "node scripts/verify/coreImportType.js && coreEngineNeutral.js && coreModuleState.js && coreFsSurface.js (均退出 0)"
        status: pass
    human_judgment: false
  - id: D4
    description: "表格画面 / 交互与旧表格视觉对齐（约 400px 列、分割线、横向滚动、hover 高亮）"
    requirement: TABLE-01
    verification: []
    human_judgment: true
    rationale: "目视 / 交互验收需真实宿主；editor-impl 无独立运行壳，归入后续 @motajs/editor 接入阶段的手动验收"

duration: 8min
completed: 2026-10-13
status: complete
---

# Phase 2 Plan 10: 阶段集成测试、门禁运行与验证签核 Summary

**一个用例端到端跑通整条表格流程（打开 → 编辑 → 增删 → 撤销/重做 → 注入打开器新开 schema 面板 → 改 schema → 切回刷新）并锁住脚本样文本的字面渲染；四个生效门禁全绿、失效门禁如实记录、02-VALIDATION 签核。**

## Performance

- **Duration:** 8 min
- **Started:** 2026-10-13T14:19:04Z
- **Completed:** 2026-10-13T14:27:25Z
- **Tasks:** 2
- **Files modified:** 2（1 新建 + 1 修改）

## Accomplishments

- 新增 `integration.test.tsx`：单个 `it` 贯穿面板 ↔ 外壳 ↔ 资源层 ↔ 网格 ↔ schema 模式 ↔ 外部编辑器接缝，逐段断言数据写回与 DOM；每次编辑/添加/删除各验证「一步撤销 + 撤销还原 + 重做恢复」。
- 证明「切入时刷新」（D-15 修订版）：在 schema 面板改 `name` 的注释后，数据面板此刻不可见（无跨面板广播）；切回时外壳调用 `onSwitchIn` 重新请求 schema 并重算，注释由旧值变为新值。
- 新增 XSS 回归守卫：字段名、注释、值均含脚本样文本时以字面文本渲染，`querySelector('img')` / `('script')` 均为空。
- 运行全部生效检查：editor-impl test（82 用例）与 typecheck、editor-core test（58 用例）与 typecheck，四个生效门禁，全部退出 0。
- 运行三个失效门禁并如实记录退出码：`coreBoundaries` 0、`coreExports` 1、`implExports` 1（引用已归档阶段产物，与阶段门禁无关）。
- `02-VALIDATION.md`：逐任务映射填实（含补入 02-04 / 02-06 / 02-07 的行）、Wave 0 与签核清单勾选、`nyquist_compliant: true`、`status: approved`。

## Task Commits

Each task was committed atomically:

1. **Task 1: 阶段集成与边界测试** - `86e0535` (test)
2. **Task 2: 运行全部门禁、记录失效门禁、签核验证** - `83d5e73` (docs)

**Plan metadata:** (see final docs commit appended after this SUMMARY)

## Files Created/Modified

- `packages/libs/editor-impl/src/table/__tests__/integration.test.tsx` — 阶段级集成 + XSS 边界测试（新建）
- `.planning/phases/02-table/02-VALIDATION.md` — 逐任务映射填实、Gate Run Record、Wave 0 与签核（修改）

## Decisions Made

- 集成测试的注入式打开器以**真实外壳**开新标签承载 schema 面板：`openBlankTab → openPanelInTab → setTable → onSwitchIn`，从而在同一进程内真实走通 D-06 机制，而非仅捕获参数。
- 切入刷新用「改 schema 注释、切回数据面板看到新注释」作为可观察证据，明确取代旧的跨面板广播语义。
- `nyquist_compliant: true` 的判据是四个**生效**门禁全绿；失效门禁只记录，不参与判定。

## Deviations from Plan

None - plan executed exactly as written.

> 一处与计划假设不同但非偏差：计划注释预期失效门禁 `coreBoundaries.js` 为红，实测为**绿**（退出 0）。已如实记录于 `02-VALIDATION.md` Gate Run Record，未影响阶段判定（它本就不作为阶段门禁）。

## Issues Encountered

None. 运行 editor-impl 全量测试时输出若干 jsdom `window.getComputedStyle` 的 stderr 提示（来自 antd 内部），属既有噪声，不影响退出码（82/82 全绿）。

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Phase 2（表格编辑）全部 9 个计划均已产出 SUMMARY；本计划为收尾计划。
- 仅人工项（视觉对齐：约 400px 列、分割线、横向滚动、hover 高亮）留给 `@motajs/editor` 接入阶段的手动验收。
- 失效门禁（`coreExports` / `implExports`）属本阶段外原因，建议在后续包边界相关阶段刷新或重定基线。

---
*Phase: 02-table*
*Completed: 2026-10-13*

## Self-Check: PASSED

- FOUND: packages/libs/editor-impl/src/table/__tests__/integration.test.tsx
- FOUND: 86e0535 (test(02-10))
- FOUND: 83d5e73 (docs(02-10))
- FOUND: .planning/phases/02-table/02-VALIDATION.md (signed off)
