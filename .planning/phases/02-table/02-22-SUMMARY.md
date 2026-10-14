---
phase: 02-table
plan: 22
subsystem: ui
tags: [editor-impl, table, gutter, add-flow, popover, antd, textarea, x-order, uat-fix, gap-closure]

# Dependency graph
requires:
  - phase: 02-table
    provides: 表格引擎（schema 驱动行树、统一撤销、schema 专用呈现、多栏布局、层级视觉）与 `ITableSchemaNode['x-order']`、`insertAfterFieldPath`、`TablePanel.addItem(anchorKey, name)`
provides:
  - 可靠的「添加」流程：名称输入浮层在回车 / 失焦 / 「确定」三处都可提交，新字段插到锚点行之后并同步写父对象 `x-order`，整次插入可撤销（P12）
  - 名称输入与「条目」单元格在 DOM 上分离，不再伪装成把该行条目单元格变成输入框（P12）
  - 表格内文本域一律 antd `Input.TextArea` 的回归钉死（P13）
affects: [02-table, 02-23, editor-dev]

# Actuals (#2632) — pairs with the plan's `estimate` (50000 tokens) to calibrate future estimates.
actuals:
  tokens: 8254
  tasks: 2
  commits: 2
plan_head_before: a87a5f4c159ae85eac1d19876dec4d78bccb2aca

# Tech tracking
tech-stack:
  added: []
  patterns: [锚点名称输入浮层（DOM 与条目单元格分离）, 三入口提交（回车 / 失焦 / 确认按钮）]

key-files:
  created:
    - packages/libs/editor-impl/src/table/__tests__/addFlow.uat.test.tsx
  modified:
    - packages/libs/editor-impl/src/table/components/TableGrid.tsx
    - packages/libs/editor-impl/src/table/table.css

key-decisions:
  - "P12 根因在交互侧（失焦丢弃 + 输入框压条目列），写入路径（addItem/insertAfterFieldPath/withOrder）本就正确 —— 故不改 tablePanel.ts（计划授权：根因只在交互侧则不改写入逻辑）"
  - "名称输入改为独立浮层 .etable-add-popover（antd Input + 确定/取消 按钮），提交入口扩为回车 / 失焦 / 确定三处；失焦时名称非空即提交、为空则收起"
  - "确认 / 取消按钮用 onMouseDown preventDefault 保住输入焦点，避免「按钮 mousedown 触发失焦 → 提交 → 重复提交」"
  - "P13 审计结论：src/table/** 内无裸 <textarea>、无 createElement('textarea')、无 window.prompt/confirm；TextareaInput.tsx 已是 antd Input.TextArea，未改实现，仅补回归断言"

patterns-established:
  - "浮层式名称输入：与数据单元格在 DOM 上分离，避免「把单元格变成输入框」的误导"
  - "多入口提交共用同一校验函数（commitName），失败给出可见提示而非静默"

requirements-completed: [TABLE-01]

coverage:
  - id: D1
    description: "添加流程真实可用：回车 / 失焦 / 确定均可提交；新字段插到锚点行之后；父对象 x-order 同步；整次插入可撤销"
    requirement: TABLE-01
    verification:
      - kind: unit
        ref: "packages/libs/editor-impl/src/table/__tests__/addFlow.uat.test.tsx#失焦提交把新字段插到锚点行之后"
        status: pass
      - kind: unit
        ref: "packages/libs/editor-impl/src/table/__tests__/addFlow.uat.test.tsx#点确定按钮提交新字段"
        status: pass
      - kind: unit
        ref: "packages/libs/editor-impl/src/table/__tests__/addFlow.uat.test.tsx#新增把新名写进 schema 的 x-order 且紧接锚点"
        status: pass
      - kind: unit
        ref: "packages/libs/editor-impl/src/table/__tests__/addFlow.uat.test.tsx#新增后撤销还原数据与 schema"
        status: pass
    human_judgment: false
  - id: D2
    description: "名称输入呈现为独立浮层（DOM 上与条目单元格分离，不再像把条目单元格变成输入框）"
    requirement: TABLE-01
    verification:
      - kind: unit
        ref: "packages/libs/editor-impl/src/table/__tests__/addFlow.uat.test.tsx#名称输入位于独立浮层而非条目单元格内"
        status: pass
    human_judgment: true
    rationale: "用例只能断言 DOM 分离（输入不在 .etable-cell-name 内、位于 .etable-add-popover 中）；「是否视觉上仍压在条目列」需要人眼核对，自动化无法判定"
  - id: D3
    description: "表格内文本域一律 antd Input.TextArea；新增名称输入非裸文本域"
    requirement: TABLE-01
    verification:
      - kind: unit
        ref: "packages/libs/editor-impl/src/table/__tests__/addFlow.uat.test.tsx#值单元格文本域为 antd Input.TextArea"
        status: pass
      - kind: unit
        ref: "packages/libs/editor-impl/src/table/__tests__/addFlow.uat.test.tsx#表格内任何 textarea 均为 antd 组件"
        status: pass
    human_judgment: false

# Metrics
duration: ~14min
completed: 2026-10-14
status: complete
---

# Phase 02 Plan 22: 添加按钮修复与文本域统一 Summary

**修复「点添加无事发生」：名称输入改为独立浮层，回车 / 失焦 / 「确定」三处都能提交；新字段插到锚点行之后并同步写父对象 `x-order`，整次插入可撤销；同时审计并钉死表格内文本域一律用 antd `Input.TextArea`。**

## Performance

- **Duration:** ~14 min
- **Started:** 2026-10-14T12:00:00Z
- **Completed:** 2026-10-14T12:14:00Z
- **Tasks:** 2
- **Files modified:** 3（1 新建，2 修改）

## Accomplishments

- **P12（添加按钮无效）修复**：根因是交互侧——名称输入框以 `.etable-gutter-input` 绝对定位 `left:0; width:96px` 压在「条目」列上（看上去像条目单元格变成输入框），且 `onBlur` 直接清空、只在回车时提交，用户「输入后点别处」就什么都不发生。
- 现在点 `+` 弹出**独立浮层** `.etable-add-popover`（antd `Input` + 「确定」/「取消」按钮，带边框 / 阴影 / 白底），DOM 上位于 gutter 而非条目单元格；提交在**回车、失焦、点确定**三处都生效；名称非空才提交、为空收起、校验失败给出可见红色提示。
- 新字段仍**插在锚点行之后**（不是末尾），并把完整同级顺序写进父对象对应的 `x-order`（数据表视图写 schema 资源）；整次插入记为**一次可撤销操作**，撤销同时还原数据与 schema。
- **P13（文本域统一）**：审计确认 `src/table/**` 内既无裸 `<textarea>` / `createElement('textarea')`，也无 `window.prompt/confirm`；值文本域 `TextareaInput` 已是 antd `Input.TextArea`。补两条回归用例把「值单元格文本域带 `.ant-input`」「表格内任何 `textarea` 都必须是 antd 控件」钉死，防将来回退。

## Task Commits

Each task was committed atomically:

1. **Task 1: 复现并修复添加流程（P12，端到端）** - `40945a3` (fix)
2. **Task 2: 文本域统一 antd 并审计（P13）** - `d2411ed` (test)

**Plan metadata:** `_pending_` (docs: complete plan)

_Note: Task 1 先写会失败的用例（RED：5 failed / 2 passed），再改实现转绿（GREEN：7 passed）。_

## Files Created/Modified

- `packages/libs/editor-impl/src/table/components/TableGrid.tsx` - `GutterButton` 的新增分支改为 `.etable-add-popover` 浮层；三入口提交（回车 / 失焦 / 确定）；校验失败可见提示；新增本地闭包 `cancelName`。
- `packages/libs/editor-impl/src/table/table.css` - 删除 `.etable-gutter-input`（压在条目列的旧输入框定位），新增 `.etable-add-popover` / `.etable-add-popover-input` / `.etable-add-popover-error`。
- `packages/libs/editor-impl/src/table/__tests__/addFlow.uat.test.tsx`（新） - 7 条用例：添加流程 5 条（失焦提交、确定提交、x-order 写回、独立浮层、撤销还原）+ 文本域审计 2 条。

## Decisions Made

- **不改写入路径**：`TablePanel.addItem` / `insertAfterFieldPath` / `withOrder` 在测试下已正确；UAT 的「无事发生」纯由交互侧（失焦丢弃 + 输入框压条目列）造成。计划明确授权「根因只在交互侧则不改写入逻辑」，故 `tablePanel.ts` 未改动。
- **浮层 + 三入口提交**：以独立浮层（带按钮）取代压列的裸输入框，同时把提交入口从「仅回车」扩为「回车 / 失焦 / 确定」。
- **按钮 `onMouseDown.preventDefault`**：点确定 / 取消时不让输入框失焦，避免失焦提交与点击提交重复触发。
- **P13 只补断言不改实现**：`TextareaInput.tsx` 已是 antd，按计划「若已如此则加回归守卫」处理。

## Deviations from Plan

### Auto-fixed / plan-anticipated adjustments

**1. [Rule 1 - Bug] `tablePanel.ts` 未改动（计划列为 files_modified，但根因不在写入侧）**
- **Found during:** Task 1（复现阶段）
- **Issue:** 计划 `files_modified` 列出 `tablePanel.ts`，但复现与既有测试表明 `addItem` 的锚点插入 + `x-order` 写入逻辑正确；失败纯属交互侧。
- **Fix:** 按计划 `<action>` 第 3 步的授权（「若根因只在交互侧则不改写入逻辑」），不改 `tablePanel.ts`。
- **Verification:** 新增 / 既有写入相关单测（x-order 写回、锚点插入、撤销全绿）。
- **Committed in:** `40945a3`（Task 1）

**2. [Rule 2 - plan-anticipated] `TextareaInput.tsx` 未改动（计划列为 files_modified，但已是 antd）**
- **Found during:** Task 2（审计）
- **Issue:** 计划 `files_modified` 列出 `TextareaInput.tsx`，但审计确认其已使用 antd `Input.TextArea`，无残留裸文本域。
- **Fix:** 按计划 `<action>` 第 2 步的授权（「若已是 antd 则不改实现，仅补回归断言」），未改实现，仅加断言。
- **Verification:** 两条 P13 回归用例全绿。
- **Committed in:** `d2411ed`（Task 2）

---

**Total deviations:** 2 plan-anticipated（均经计划 `<action>` 显式授权；无越权改动）
**Impact on plan:** 无范围外改动；未新增依赖；未触碰已确认命名形状（`ITablePanel` / `TableGridAddHandler` 等）。

## Issues Encountered

- 计划要求「至少『失焦提交』与『输入框不覆盖条目单元格』用例在未修复前失败」。实测未修复前共 5 条失败（失焦提交、确定提交、x-order、独立浮层、撤销还原），其中「独立浮层」用例断言 `input.closest('.etable-add-popover')` 非空——修复前无该容器故失败，满足要求。DOM 上旧输入框本就在 gutter（非条目单元格内），故仅靠「不在 `.etable-cell-name` 内」不足以失败，遂以「位于独立浮层」作为可失败断言。

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- 添加流程与文本域统一已就绪并单测锁死；02-23（dev 宿主演示内容 + 撤销/重做按钮）可在此基础上提供人眼手动验收（P12 的「浮层不压条目列」视觉、~100 条演示与纵向滚动）。
- 无阻塞。

---
*Phase: 02-table*
*Completed: 2026-10-14*

## Self-Check: PASSED

- FOUND: packages/libs/editor-impl/src/table/__tests__/addFlow.uat.test.tsx
- FOUND: 40945a3 (Task 1)
- FOUND: d2411ed (Task 2)
