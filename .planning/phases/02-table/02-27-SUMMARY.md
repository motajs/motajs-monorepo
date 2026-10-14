---
phase: 02-table
plan: 27
subsystem: ui
tags: [react, table, editor-impl, uat-gap-closure, json-schema, ajv]

# Dependency graph
requires:
  - phase: 02-table
    provides: "schema 专用呈现（schemaPresentation.ts 的 buildSchemaTree / buildKeywordRows / keywordConfig）；TableRow.renderValueControl 控件推导；model/control.ts 的 inferControlKind、model/validation.ts 的 validateValue"
provides:
  - "x-order 关键字的纯重排被接受（按 string[] 校验）且仍以文本域编辑（P21）"
  - "type 关键字只提供 7 个合法 JSON Schema 取值、以下拉呈现并挡住非法值（P22）"
affects: [02-table, verify-work]

# Actuals (#2632)
actuals:
  tokens: 1554
  tasks: 2
  commits: 3
  plan_head_before: ed6c79cdbd167ed6327e1550f1240789ee2a8fa9

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "关键字合成校验节点：x-order 用 { type:'array', items:{type:'string'}, 'x-control':Text } —— ajv 按字符串数组校验、控件推导取文本域"
    - "合法取值枚举：type 用 { enum: SCHEMA_TYPE_VALUES } —— 既作下拉候选又作 ajv 校验，非法值（如 textarea）被声明式挡下"

key-files:
  created: []
  modified:
    - packages/libs/editor-impl/src/table/model/schemaPresentation.ts
    - packages/libs/editor-impl/src/table/__tests__/schemaMode.test.tsx

key-decisions:
  - "x-order 仍保留文本域编辑（不改成多选），只把校验从 { type:'string' } 改为按字符串数组；traversal.readOrder 语义（列出的在前、其余追加、非法则自然顺序）不变"
  - "type 的合法取值用模块级非导出常量 SCHEMA_TYPE_VALUES（7 个），经 keywordConfig 合成 { enum } —— 控件推导见 enum 即推 Select，校验由 validateValue 的 ajv enum 兜底"
  - "测试查下拉候选项改用 screen.getAllByRole('option')，不用 document 全局——PORT-02 门禁（coreModuleState.js）同样扫描 editor-impl/src"

patterns-established:
  - "同一关键字配置同时承载「校验形状」与「控件形状」：x-control 显式指定控件、type/items/enum 驱动 ajv 校验"

requirements-completed: [TABLE-01]

# Coverage metadata (#1602)
coverage:
  - id: D1
    description: "在 schema 编辑视图里对 x-order 做纯重排（同一批字段名、仅改数组次序）被接受并写回，数据表行序随之变化；x-order 仍以文本域编辑；非字符串数组被拒（P21）"
    requirement: TABLE-01
    verification:
      - kind: unit
        ref: "src/table/__tests__/schemaMode.test.tsx#x-order 纯重排被接受并改变行序"
        status: pass
      - kind: unit
        ref: "src/table/__tests__/schemaMode.test.tsx#x-order 非字符串数组被拒且文档不变"
        status: pass
    human_judgment: false
  - id: D2
    description: "schema 编辑视图里 type 关键字以下拉呈现且候选恰为 7 个合法 JSON Schema 取值，非法值（如 textarea）不可选、提交被拒（P22）"
    requirement: TABLE-01
    verification:
      - kind: unit
        ref: "src/table/__tests__/schemaMode.test.tsx#schema 目标下成对关键字合行、紧凑标量单控件"
        status: pass
      - kind: unit
        ref: "src/table/__tests__/schemaMode.test.tsx#type 非法取值被挡且文档不变"
        status: pass
    human_judgment: false

# Metrics
duration: ~25min
completed: 2026-10-14
status: complete
---

# Phase 02 Plan 27: x-order 纯重排被接受 + type 限合法取值 Summary

**schema 编辑视图里 x-order 换顺序不再误报「非法」（按字符串数组校验、仍是文本域），type 关键字改为只给 7 个合法 JSON Schema 取值的下拉并挡住 textarea 之类非法值**

## Performance

- **Duration:** ~25min
- **Started:** 2026-10-14T17:10Z
- **Completed:** 2026-10-14T17:35Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- `x-order` 的纯重排（同一批字段名、只改数组次序）现在被接受并写回 schema，数据表行序随之变化（P21 修复）
- `x-order` 仍以文本域呈现、可直接改 JSON 数组，未改成多选框（保住「可重排」）
- `type` 关键字改为下拉，候选项恰为 7 个合法 JSON Schema 取值（string / number / integer / boolean / object / array / null）；`textarea` 等非法值不可选、直接提交也被 ajv 拒绝（P22 修复）
- 未改 schema 数据模型 / `types.ts`；校验仍一律走 ajv 声明式；未新增依赖；未做任何表达式求值

## Task Commits

Each task was committed atomically:

1. **Task 1: `x-order` 的纯重排被接受（P21，tracer）** - `17704b1` (feat)
2. **Task 2: `type` 关键字提供合法取值、挡住非法值（P22）** - `181bce1` (feat)
3. **Task 2 修复：测试查候选项改用 role 而非 document 全局** - `fd342ad` (test)

**Plan metadata:** (docs commit recorded after this summary)

_Note: Task 2 有一条追加的 `test` 提交（见 Deviations）——同任务范围内的门禁修复。_

## Files Created/Modified
- `packages/libs/editor-impl/src/table/model/schemaPresentation.ts` - `keywordConfig` 增 `x-order`（按字符串数组校验 + `x-control: Text` 保持文本域）与 `type`（`{ enum: SCHEMA_TYPE_VALUES }`）两个分支；新增非导出模块级常量 `SCHEMA_TYPE_VALUES`
- `packages/libs/editor-impl/src/table/__tests__/schemaMode.test.tsx` - 新增 P21 两例（纯重排被接受并改行序 / 非字符串数组被拒），更新既有 `table-input-type` 断言为「下拉 + 7 个候选」，新增 P22 一例（非法 type 被挡）

## Decisions Made
- `x-order` 只改校验形状（`{ type:'array', items:{type:'string'}, 'x-control':Text }`），不改其文本域控件，也不动 `traversal.readOrder` 的排序语义
- `type` 的合法取值放模块级非导出常量 `SCHEMA_TYPE_VALUES`，经 `keywordConfig` 合成为 `{ enum }`——同一份 enum 既喂下拉候选，又作 `validateValue` 的 ajv 校验边界
- 测试查下拉候选项改用 `screen.getAllByRole('option')`，避免 `document` 全局（PORT-02 门禁扫描 `editor-impl/src`）

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] 测试用 `document` 全局被 PORT-02 门禁拦下**
- **Found during:** 终验（运行 `scripts/verify/coreModuleState.js`）
- **Issue:** Task 2 的测试用 `document.querySelectorAll('.ant-select-item-option')` 取下拉候选；`coreModuleState.js` 的 `CORE_LIBS` 同时扫描 `editor-impl/src`，`no-restricted-globals`（PORT-02）在 error 级命中该行，门禁非零退出
- **Fix:** 改用 `screen.getAllByRole('option').map((o) => o.textContent)` 取候选项，不再引用 `document` 全局；断言内容不变
- **Files modified:** `packages/libs/editor-impl/src/table/__tests__/schemaMode.test.tsx`
- **Verification:** `node scripts/verify/coreModuleState.js` 退出 0；`schemaMode.test.tsx` 12 用例全绿
- **Committed in:** fd342ad

**2. [Rule 2 - Formatting] Prettier 重排 import 行**
- **Found during:** Task 2 提交前 `prettier --check`
- **Issue:** Task 1 加了 `TableControlKind` 后 `../types` 的具名导入行超过 120 列，Prettier 要求折成多行
- **Fix:** `prettier --write` 该文件（仅 import 折行，无行为变化）
- **Files modified:** `packages/libs/editor-impl/src/table/model/schemaPresentation.ts`
- **Verification:** `prettier --check` 两文件均通过
- **Committed in:** 181bce1（Task 2 提交）

---

**Total deviations:** 2 auto-fixed (1 bug, 1 formatting)
**Impact on plan:** 两处均在本计划范围内、必要且无范围蔓延；P21 / P22 目标语义与计划一致。

## Issues Encountered
- 计划估计 `x-order` 的控件原本已是文本域（回退 `{ type:'string' }` → `inferControlKind` → Text），根因确实只在 ajv 校验：`{ type:'string' }` 对数组失败。已按计划只改校验形状，控件不动。
- 已知退化（计划已注明、不额外扩展）：`type` 若写成数组（如 `['string','null']`）时下拉无匹配项，可接受。

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- P21 / P22 修复完成：`editor-impl` 136 测试、`editor-core` 70 测试、`typecheck` 退出 0，四条门禁脚本（coreImportType / coreEngineNeutral / coreModuleState / coreFsSurface）串行全绿，Prettier 干净。
- 未改数据模型（`types.ts` 未动）、未新增依赖、未新增对外导出命名（`SCHEMA_TYPE_VALUES` 为非导出）。
- 待 `verify-work` 对 P21 / P22 做最终人工确认。

---
*Phase: 02-table*
*Completed: 2026-10-14*

## Self-Check: PASSED

- FOUND: `packages/libs/editor-impl/src/table/model/schemaPresentation.ts`
- FOUND: `packages/libs/editor-impl/src/table/__tests__/schemaMode.test.tsx`
- FOUND: `.planning/phases/02-table/02-27-SUMMARY.md`
- FOUND: commit `17704b1` (Task 1)
- FOUND: commit `181bce1` (Task 2)
- FOUND: commit `fd342ad` (Task 2 fix)
