---
phase: 02-table
plan: 15
subsystem: editor-impl/table
tags: [react, antd, input-number, table, uat-fix, ajv-validation]

requires:
  - phase: 02-table
    provides: "02-14 交付的 ITablePanel.setTable(target, columnIndex?) 等类型（本计划仅用其存在性）"
provides:
  - "数字字段行内控件 NumberInput（antd InputNumber 包装）"
  - "外部编辑器返回值在提交前经 validateValue 校验，非法值落行内拒绝且不写回"
  - "常驻预留的提示行，成功文案去掉「刷新后生效」"
affects: [02-16, 02-17, 02-18, 02-19, verify-work, UAT]

actuals:
  tokens: 4128
  tasks: 3
  commits: 3
  plan_head_before: 319a52cb945f5efc6c684691b185c5ca588a6a64

tech-stack:
  added: []
  patterns:
    - "行内控件按 TableControlKind 分支渲染：Number 分支复用 antd InputNumber"

key-files:
  created:
    - packages/libs/editor-impl/src/table/components/inputs/NumberInput.tsx
    - packages/libs/editor-impl/src/table/__tests__/behaviour.uat.test.tsx
  modified:
    - packages/libs/editor-impl/src/table/components/TableRow.tsx
    - packages/libs/editor-impl/src/table/components/TableGrid.tsx
    - packages/libs/editor-impl/src/table/components/inputs/index.ts
    - packages/libs/editor-impl/src/table/tablePanel.ts
    - packages/libs/editor-impl/src/table/table.css
    - packages/libs/editor-impl/src/table/__tests__/edit.test.tsx
    - packages/libs/editor-impl/src/table/__tests__/tracer.test.tsx

key-decisions:
  - "外部编辑器返回值的校验点落在 TableRow.runExternalEditor：提交前调用 validateValue，拒绝复用行内 .etable-row-error 呈现（B1）"
  - "TablePanel.commitValue 的面板级校验保留为防御性兜底，不改其语义"
  - "提示行采用「常驻预留」：renderNotice 总是渲染 .etable-notice 容器（空态为空内容）并给 min-height，用最小改动消除布局抖动（B3）"
  - "数字字段新控件命名为 NumberInput / INumberInputProps（已登记 INTERFACE-NAME.md「Plan 15–19」）"

patterns-established:
  - "数字字段：TableControlKind.Number → NumberInput（antd InputNumber 单行控件），不再落 TextareaInput 多行文本域"

requirements-completed: [TABLE-01]

coverage:
  - id: D1
    description: "外部编辑器返回不满足字段 schema 的值时当场落行内拒绝提示且不写回（B1）"
    requirement: TABLE-01
    verification:
      - kind: unit
        ref: "packages/libs/editor-impl/src/table/__tests__/behaviour.uat.test.tsx#外部编辑器返回非法值时行内拒绝且不写回"
        status: pass
    human_judgment: false
  - id: D2
    description: "数字字段（TableControlKind.Number）渲染成 antd InputNumber 单行控件而非多行文本域，提交数字值（B2）"
    requirement: TABLE-01
    verification:
      - kind: unit
        ref: "packages/libs/editor-impl/src/table/__tests__/behaviour.uat.test.tsx#数字字段渲染 InputNumber 并提交数字"
        status: pass
    human_judgment: false
  - id: D3
    description: "成功文案去掉「刷新后生效」（只剩「添加成功」/「删除成功」）且提示行常驻预留，出现 / 消失不再顶动表头表体（B3）"
    requirement: TABLE-01
    verification:
      - kind: unit
        ref: "packages/libs/editor-impl/src/table/__tests__/behaviour.uat.test.tsx#新增成功后提示为「添加成功」且不含刷新"
        status: pass
      - kind: unit
        ref: "packages/libs/editor-impl/src/table/__tests__/behaviour.uat.test.tsx#就绪但无提示时提示行容器常驻占位"
        status: pass
    human_judgment: false
  - id: D4
    description: "新增命名 NumberInput / INumberInputProps 是否照此定案（项目「重要命名先确认」门禁）"
    verification: []
    human_judgment: true
    rationale: "命名门禁要求用户确认；命名已登记 INTERFACE-NAME.md「Plan 15–19」，最终定案需人工确认。"

duration: 16min
completed: 2026-10-13
status: complete
---

# Phase 2 Plan 15: 表格单元格行为修复（B1 / B2 / B3）Summary

**表格单元格即时反馈对齐：非法值当场落行内拒绝、数字字段改用 antd 单行数字控件、成功提示去掉「刷新后生效」且提示行常驻不再抖动。**

## Performance

- **Duration:** ~16 min
- **Started:** 2026-10-13T18:33:00+08:00
- **Completed:** 2026-10-13T18:49:39+08:00
- **Tasks:** 3 / 3
- **Files modified:** 9（2 新建 + 7 修改）

## Accomplishments

- **B1 — 非法值当场可见拒绝**：外部编辑器（代码 / 事件 / 素材 / 多选 / 坐标）返回值在提交前经 `validateValue` 校验，不通过即落行内 `.etable-row-error`，且不写入资源。原先只有面板顶部一行提示。
- **B2 — 数字字段单行控件**：新增 `NumberInput`（包一层 antd `InputNumber`）并从输入控件桶导出；`TableRow.renderValueControl` 的 `TableControlKind.Number` 分支改走它，不再落多行 `<textarea>`。
- **B3 — 文案与抖动**：`TablePanel.addItem` / `deleteItem` 成功文案改为「添加成功」/「删除成功」（去掉「，刷新后生效」）；`TableGrid.renderNotice` 总是渲染 `.etable-notice` 容器并给以 `min-height`，提示出现 / 消失不再把表头与表体向下顶。
- 新增 `behaviour.uat.test.tsx` 把 B1 / B2 / B3 各自钉住（5 个用例）。

## Task Commits

Each task was committed atomically:

1. **Task 1: 值校验失败 → 行内可见拒绝（B1）** - `4f5b4bd` (fix)
2. **Task 2: 成功提示去「刷新后生效」并常驻预留（B3）** - `3ef9c4f` (fix)
3. **Task 3: 数字字段改用 antd InputNumber（B2）** - `a4ec787` (feat)

**Plan metadata:** `d35458e` (docs: complete plan)

## Files Created/Modified

- `packages/libs/editor-impl/src/table/components/inputs/NumberInput.tsx`（新）— `INumberInputProps` / `NumberInput`，包装 antd `InputNumber` 的数字行内控件。
- `packages/libs/editor-impl/src/table/__tests__/behaviour.uat.test.tsx`（新）— B1 / B2 / B3 的 UAT 回归测试（5 用例）。
- `packages/libs/editor-impl/src/table/components/TableRow.tsx` — `runExternalEditor` 提交前 `validateValue`；`renderValueControl` 增加 Number 分支。
- `packages/libs/editor-impl/src/table/components/TableGrid.tsx` — `renderNotice` 改为常驻渲染 `.etable-notice` 容器。
- `packages/libs/editor-impl/src/table/components/inputs/index.ts` — 追加 `export * from './NumberInput';`。
- `packages/libs/editor-impl/src/table/tablePanel.ts` — 成功文案去掉「，刷新后生效」。
- `packages/libs/editor-impl/src/table/table.css` — `.etable-notice` 增加 `min-height: 22px`；新增 `.etable-input-number { width: 100%; }`。
- `packages/libs/editor-impl/src/table/__tests__/edit.test.tsx` — 成功文案断言更新；数字字段非法值用例改走数字输入框。
- `packages/libs/editor-impl/src/table/__tests__/tracer.test.tsx` — `inputValue` 助手兼容数字输入框。

## Decisions Made

- **校验点**：`TableRow.runExternalEditor` 在 `props.onChange` 前统一 `validateValue`，把「外部编辑器返回非法值」与「行内控件非法值」收敛到同一呈现（行内 `.etable-row-error`）。面板级 `TablePanel.commitValue` 校验保留为防御性兜底。
- **抖动消除方式**：采用「常驻预留」而非行级提示重构——`renderNotice` 恒渲染容器、CSS 给最小高度，改动面最小。
- **命名**：`NumberInput` / `INumberInputProps` 照 `INTERFACE-NAME.md`「Plan 15–19」登记实现。

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] 更新因成功文案变更而失效的既有断言**
- **Found during:** Task 2（成功提示去「刷新后生效」）
- **Issue:** `edit.test.tsx` 断言 `'添加成功，刷新后生效。'`，与本计划要求的文案不符，会让「既有测试全绿」不成立。
- **Fix:** 断言改为 `'添加成功'`。
- **Files modified:** `packages/libs/editor-impl/src/table/__tests__/edit.test.tsx`
- **Verification:** `pnpm --filter @motajs/editor-impl test` 退出 0。
- **Committed in:** `3ef9c4f`（Task 2 提交）

**2. [Rule 3 - Blocking] 更新把数字字段当文本域驱动的既有测试**
- **Found during:** Task 3（数字字段改用 InputNumber）
- **Issue:** `edit.test.tsx` 的「非法值被拒绝」用例用 `type: 'number'` 字段并在 `textarea` 里输入；`tracer.test.tsx` 用 `inputValue`（只找 `textarea`）读 `count` 值。数字字段改走 `InputNumber` 后二者取不到控件而失败。
- **Fix:** `edit.test.tsx` 新增 `commitNumber` 助手驱动数字输入框；`tracer.test.tsx` 的 `inputValue` 助手改为找 `textarea, input`。
- **Files modified:** `packages/libs/editor-impl/src/table/__tests__/edit.test.tsx`、`packages/libs/editor-impl/src/table/__tests__/tracer.test.tsx`
- **Verification:** `pnpm --filter @motajs/editor-impl test` 退出 0（12 文件 / 89 用例）。
- **Committed in:** `a4ec787`（Task 3 提交）

---

**Total deviations:** 2 auto-fixed（1 bug、1 blocking）
**Impact on plan:** 均为本计划行为变更直接导致的既有测试适配，未引入新依赖、未扩大范围。

## Issues Encountered

- 本计划 `files_modified` 未列出 `edit.test.tsx` / `tracer.test.tsx`，但 B2 / B3 的行为变更会使它们失败；按偏差规则改动并记录如上。

## User Setup Required

None - no external service configuration required.

### 需人工确认（非功能）

- 新增命名 `NumberInput` / `INumberInputProps` 是否照此定案（项目「重要命名先确认」门禁）。已登记于 `INTERFACE-NAME.md`「Plan 15–19」。

## Verification

| 命令 | 结果 |
| --- | --- |
| `pnpm --filter @motajs/editor-impl typecheck` | 退出 0 |
| `pnpm --filter @motajs/editor-impl test` | 退出 0（12 文件 / 89 用例全绿） |
| `pnpm --filter @motajs/editor-core test` | 退出 0（7 文件 / 61 用例全绿） |
| `node scripts/verify/coreImportType.js` | 退出 0 |
| `node scripts/verify/coreEngineNeutral.js` | 退出 0 |
| `node scripts/verify/coreModuleState.js` | 退出 0 |
| `node scripts/verify/coreFsSurface.js` | 退出 0 |
| `prettier --check`（9 个改动文件，逐个） | 全部通过 |
| `eslint`（8 个改动文件） | 退出 0（仅 1 条既有 react-refresh warning） |

## Next Phase Readiness

- B1 / B2 / B3 三条 UAT 行为缺口已修复并以测试钉住；`editor-core` 与四条生效门禁不受影响。
- 后续 02-16…02-19 修复计划可在本基础上继续。

---
*Phase: 02-table*
*Completed: 2026-10-13*

## Self-Check: PASSED
