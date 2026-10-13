---
phase: 02-table
plan: 09
subsystem: ui
tags: [react, antd, table, external-editor, modal, capability-injection, json-schema]

requires:
  - phase: 02-table
    provides: 能力接缝类型（ITableEditorCapabilities / ICodeEditorOpener / IMultiSelectOpener / IPointSelectOpener / ICopyCapability）与能力 Context
  - phase: 02-table
    provides: TablePanel.commitValue 统一校验后可撤销提交入口与 validateValue（ajv）

provides:
  - 共享多选弹窗（素材 + 多选共用，缩略图多选）与坐标选择弹窗
  - CapabilityProvider：提供能力包并挂载共享弹窗，未注入时以「默认走弹窗」打开器补齐
  - 操作列按钮（注释 / 编辑 / 多选框编辑 / 复制）与按 x-editor 的外部编辑器分发
  - 外部编辑器结果经同一校验后可撤销路径重入；能力缺失时优雅降级

affects: [02-table, editor-host-integration]

actuals:
  tokens: 12581
  tasks: 3
  commits: 3
  plan_head_before: f0650e5f41b1831e9d20c95317c95bcbbc75826f

tech-stack:
  added: []
  patterns:
    - "共享弹窗以「open → Promise → resolve」imperative 打开器暴露，Provider 持有 resolve 引用"
    - "能力包经 React Context 注入；缺省能力以默认实现补齐，传入者优先"
    - "按字段 x-editor 分发到注入打开器，结果经 onChange → TablePanel.commitValue 提交"

key-files:
  created:
    - packages/libs/editor-impl/src/react/components/MultiSelectModal.tsx
    - packages/libs/editor-impl/src/react/components/PointPickerModal.tsx
    - packages/libs/editor-impl/src/react/components/CapabilityProvider.tsx
    - packages/libs/editor-impl/src/react/components/index.ts
    - packages/libs/editor-impl/src/react/modal.css
    - packages/libs/editor-impl/src/table/components/ActionButtons.tsx
    - packages/libs/editor-impl/src/table/__tests__/externalEditor.test.tsx
    - packages/libs/editor-impl/src/table/__tests__/modals.test.tsx
  modified:
    - packages/libs/editor-impl/src/react/index.ts
    - packages/libs/editor-impl/src/table/components/TableRow.tsx
    - packages/libs/editor-impl/src/table/components/index.ts
    - packages/libs/editor-impl/src/table/table.css

key-decisions:
  - "操作列「注释」以图标按钮 + aria-label/title 呈现，而非文字「注释」——避免与表头「注释」列在同一次 getByText 断言中重复命中，破坏既有红灯"
  - "分发函数置于 TableRow.tsx（模块内、不额外导出），结果经既有 onChange → TablePanel.commitValue 提交；未新增第二处代码打开器"
  - "tablePanel.ts 无需改动：统一校验后可撤销提交入口 TablePanel.commitValue 已由 02-07 提供，外部结果经既有 onChange 通道重入"

patterns-established:
  - "共享弹窗 Holder：Provider 条件挂载弹窗，open 返回 Promise，确认/取消时 resolve"
  - "能力降级：isExternalEditorAvailable 判定 → ActionButtons 禁用并给出中文提示"

requirements-completed: [TABLE-01]

coverage:
  - id: D1
    description: "共享多选弹窗（素材 + 多选共用、缩略图、列表滚动页脚固定）与坐标弹窗，含空 / 加载 / 错误 / 就绪态"
    requirement: TABLE-01
    verification:
      - kind: unit
        ref: "packages/libs/editor-impl/src/table/__tests__/modals.test.tsx#有候选项时列出多选列表并确认选中 id"
        status: pass
      - kind: unit
        ref: "packages/libs/editor-impl/src/table/__tests__/modals.test.tsx#无候选项时显示空态"
        status: pass
      - kind: unit
        ref: "packages/libs/editor-impl/src/table/__tests__/modals.test.tsx#加载中显示加载态"
        status: pass
      - kind: unit
        ref: "packages/libs/editor-impl/src/table/__tests__/modals.test.tsx#失败时显示错误态"
        status: pass
      - kind: unit
        ref: "packages/libs/editor-impl/src/table/__tests__/modals.test.tsx#确认时回调 2D 坐标"
        status: pass
    human_judgment: false
  - id: D2
    description: "操作列显示规则（description→注释、x-editor→编辑/多选框编辑、readOnly→复制）与按 x-editor 的打开器分发（Code/Event→面板，Material/Point/MultiSelect→弹窗）"
    requirement: TABLE-01
    verification:
      - kind: unit
        ref: "packages/libs/editor-impl/src/table/__tests__/externalEditor.test.tsx#「编辑」仅在声明 x-editor 的字段显示"
        status: pass
      - kind: unit
        ref: "packages/libs/editor-impl/src/table/__tests__/externalEditor.test.tsx#material 字段分发到多选弹窗而非代码面板"
        status: pass
      - kind: unit
        ref: "packages/libs/editor-impl/src/table/__tests__/externalEditor.test.tsx#code 字段打开独立面板并经可撤销路径提交"
        status: pass
    human_judgment: false
  - id: D3
    description: "外部编辑器 / 弹窗返回值经同一校验（validateValue）后可撤销路径重入；能力缺失时禁用动作并提示，不崩溃"
    requirement: TABLE-01
    verification:
      - kind: unit
        ref: "packages/libs/editor-impl/src/table/__tests__/externalEditor.test.tsx#code 字段打开独立面板并经可撤销路径提交"
        status: pass
      - kind: unit
        ref: "packages/libs/editor-impl/src/table/__tests__/externalEditor.test.tsx#能力缺失时「编辑」禁用并提示"
        status: pass
    human_judgment: false
  - id: D4
    description: "复制经注入的 ICopyCapability.copyText（绝不 navigator.clipboard）；D-30 整份文件打开与字段级代码编辑共用同一 ICodeEditorOpener"
    requirement: TABLE-01
    verification:
      - kind: unit
        ref: "packages/libs/editor-impl/src/table/__tests__/externalEditor.test.tsx#只读字段的「复制」经注入能力复制值文本"
        status: pass
      - kind: unit
        ref: "packages/libs/editor-impl/src/table/__tests__/externalEditor.test.tsx#剪贴板能力缺失时「复制」禁用并提示"
        status: pass
      - kind: unit
        ref: "packages/libs/editor-impl/src/table/__tests__/externalEditor.test.tsx#整份文件打开与字段级代码编辑复用同一个代码编辑器打开器"
        status: pass
    human_judgment: false
  - id: D5
    description: "弹窗外观细节（列表滚动 / 页脚固定 / 长标签省略号 + title）与独立面板「切走即关」行为"
    requirement: TABLE-01
    verification: []
    human_judgment: true
    rationale: "属视觉 / 交互外观细节，jsdom 无法断言计算样式；计划明确留待宿主集成阶段人工验收"

# Metrics
duration: 30min
completed: 2026-10-13
status: complete
---

# Phase 2 Plan 9: 外部编辑器与共享弹窗 Summary

**表格操作列的外部编辑器分发（代码 / 事件走独立面板，素材 / 坐标 / 多选走共享弹窗）与经注入能力包的优雅降级，返回值经同一 ajv 校验后的可撤销路径重入。**

## Performance

- **Duration:** ~30 min
- **Started:** 2026-10-13T12:55:00+08:00
- **Completed:** 2026-10-13T13:25:00+08:00
- **Tasks:** 3
- **Files modified:** 12

## Accomplishments
- 在 `src/react` 落地两个共享弹窗与能力 Provider：素材选择与多选合一（缩略图多选），未注入弹窗打开器时由 Provider 以「默认走弹窗」补齐
- 操作列按新模型显示：`description` → 注释；`x-editor` → 编辑；`x-editor: MultiSelect` → 多选框编辑；`readOnly` → 复制
- 字段级代码 / 事件编辑与 D-30「在代码编辑器中打开」复用同一个 `ICodeEditorOpener`；复制经注入的 `ICopyCapability.copyText`，无任何浏览器全局引用
- 返回值经 `TablePanel.commitValue`（内部 `validateValue` ajv 校验）重入撤销路径；能力缺失时禁用并给出中文提示

## Task Commits

Each task was committed atomically:

1. **Task 1: 共享多选 / 坐标弹窗与能力 Provider** - `2bb1ddf` (feat)
2. **Task 2: 操作列与外部编辑器分发** - `b5efe34` (feat)
3. **Task 3: 测试操作列、分发与共享弹窗** - `b2b251d` (test)

**Plan metadata:** (docs: complete plan) — 见最终提交

## Files Created/Modified
- `src/react/components/MultiSelectModal.tsx` - 通用多选弹窗（素材 + 多选共用）
- `src/react/components/PointPickerModal.tsx` - 坐标选择弹窗
- `src/react/components/CapabilityProvider.tsx` - 提供能力包 Context 并挂载弹窗 holder
- `src/react/components/index.ts` - 组件 barrel
- `src/react/modal.css` - 共享弹窗局部样式（列表滚动、标签省略号、缩略图）
- `src/react/index.ts` - 追加 `export * from './components'`
- `src/table/components/ActionButtons.tsx` - 操作列按钮（纯展示）
- `src/table/components/TableRow.tsx` - 行内分发：按 `x-editor` 选择打开器并提交；注释展开、复制
- `src/table/components/index.ts` - 追加 ActionButtons 导出
- `src/table/table.css` - 新增 `.etable-actions` / `.etable-comment-full`
- `src/table/__tests__/externalEditor.test.tsx` - 操作列与分发测试
- `src/table/__tests__/modals.test.tsx` - 共享弹窗与 Provider 默认打开器测试

## Decisions Made
- 分发函数落在 `TableRow.tsx` 且不额外导出（表内实现），避免新增未确认的对外命名，也避免 `tablePanel → TableGrid → TableRow → tablePanel` 的循环引用。
- `tablePanel.ts` 未改动：统一提交入口 `TablePanel.commitValue` 已由 02-07 提供，外部结果经既有 `onChange` 通道重入（见「偏差」）。
- 「注释」动作以图标 + `aria-label`/`title` 呈现（见「偏差」）。

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `tablePanel.ts` 未按计划文件清单改动**
- **Found during:** Task 2（操作列与外部编辑器分发）
- **Issue:** 计划将 `tablePanel.ts` 列入 `files_modified`，并称其提供「外部编辑器分发（结果经 `TablePanel.commitValue` 提交）」。但分发所需的打开器来自 React Context（`useTableCapabilities`），而 `TablePanel` 是 React 之外的类；把分发放入 `tablePanel.ts` 会形成 `tablePanel → TableGrid → TableRow → tablePanel` 的循环引用（`.dependencyCruiser.cjs` 的 `no-circular` 为 error）。
- **Fix:** 分发实现于 `TableRow.tsx`，结果经既有 `onChange`（在 `TablePanelView` 中即 `TablePanel.commitValue`）提交——计划的意图（结果经统一校验后可撤销入口重入）已满足，未新增第二条提交路径。
- **Files modified:** 无（`tablePanel.ts` 保持原样）
- **Verification:** `coreBoundaries.js` 真实树 0 违规；`no-circular` 未触发；相关单测绿。
- **Committed in:** b5efe34（Task 2）

**2. [Rule 1 - Bug] 「注释」按钮文案与表头列名冲突，会打破既有红灯**
- **Found during:** Task 2
- **Issue:** 既有 `tracer.test.tsx` 断言 `screen.getByText('注释')`（表头列名）。若操作列注释动作渲染文字「注释」，同一渲染中出现多个「注释」文本节点，`getByText` 抛错。
- **Fix:** 注释动作改为内联 SVG 图标按钮，以 `aria-label="注释"` + `title=<description>` 暴露语义与全文；点击展开完整描述行。语义（「注释」动作仅在 `description` 存在时显示）保持不变。
- **Files modified:** `src/table/components/ActionButtons.tsx`、`src/table/components/TableRow.tsx`
- **Verification:** `tracer.test.tsx` 全绿；`externalEditor.test.tsx` 覆盖显示规则。
- **Committed in:** b5efe34（Task 2）

**3. [Rule 3 - Blocking] 需要 `src/react/components/index.ts` 与 `src/react/modal.css` 两个计划外文件**
- **Found during:** Task 1
- **Issue:** 计划要求把弹窗放在 `src/react/components/*` 并由 `src/react/index.ts` 用 `export *` 追加导出；但项目规则禁止跨目录深路径 `export *`（「不要写 `export * from './xxx/yyy'`」），且共享弹窗需要局部 CSS（D-08：antd + 局部 CSS）。
- **Fix:** 新增 `src/react/components/index.ts`（barrel，`export *` 同目录）与 `src/react/modal.css`；`src/react/index.ts` 仅追加 `export * from './components'`。
- **Files modified:** `src/react/components/index.ts`、`src/react/modal.css`、`src/react/index.ts`
- **Verification:** typecheck 退出 0；`coreEngineNeutral` / `coreImportType` 均通过。
- **Committed in:** 2bb1ddf（Task 1）

---

**Total deviations:** 3 auto-fixed (1 bug, 2 blocking)
**Impact on plan:** 全部为满足既有规则 / 测试与架构约束所必需；功能面与计划意图一致，无范围蔓延。

## Issues Encountered
- antd `Modal` 在 jsdom 中触发 `window.getComputedStyle(elt, pseudoElt)` 的 not-implemented 告警（滚动锁定器）；不影响测试结果，仅噪音。
- 弹窗内容经 portal 渲染在 `container` 之外，测试须经 `screen` 查询（已修正）。
- 测试文件首版漏写 `configure({ testIdAttribute: 'data-test-id' })` 与 `CapabilityProvider` 的 `children` 传参；均已修正。

## Authentication Gates
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- 外部编辑器接缝与共享弹窗就绪；真实的代码 / 事件 / 素材编辑器由后续 Phase 5/6 的能力实现提供（本计划以假件注入测试，见计划 flagged assumptions）。
- 弹窗外观细节与独立面板「切走即关」行为留待宿主集成阶段人工验收。

---
*Phase: 02-table*
*Completed: 2026-10-13*

## Self-Check: PASSED

- 所有创建文件存在；三个任务提交 `2bb1ddf` / `b5efe34` / `b2b251d` 均在历史中。
- 验证：`pnpm --filter @motajs/editor-impl typecheck` 退出 0；`@motajs/editor-impl test` 9 文件 80 用例全绿；`@motajs/editor-core test` 6 文件 58 用例全绿；`coreImportType` / `coreEngineNeutral` / `coreModuleState` / `coreFsSurface` 均退出 0；`coreBoundaries` 真实树 0 违规。`src/react` 无任何指向 `src/table` 的导入。
