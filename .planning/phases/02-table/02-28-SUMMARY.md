---
phase: 02-table
plan: 28
subsystem: ui
tags: [react, css, table, editor-impl, textarea, uat-gap-closure]

# Dependency graph
requires:
  - phase: 02-table
    provides: "TextareaInput（antd Input.TextArea 值控件）+ table.css 值控件样式（02-06）；layout.uat.test.tsx 装配 helper（02-04/02-25）"
provides:
  - "值文本域默认高度按内容行数（夹在 1–6，超出内部滚动，P24）"
  - "值文本域可纵向拖拽调整大小（resize: vertical，去 max-height，P24）"
affects: [02-table, verify-work]

# Actuals (#2632)
actuals:
  tokens: 1067
  tasks: 2
  commits: 2

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "去 autoSize 改显式 rows：React 只控 rows 属性、不控行内 height，故拖拽设置的高度不被重置"
    - "jsdom 读不到外部 CSS 时以 ?inline 样式表原文正则断言尺寸/拖拽规则"

key-files:
  created: []
  modified:
    - packages/libs/editor-impl/src/table/components/inputs/TextareaInput.tsx
    - packages/libs/editor-impl/src/table/table.css
    - packages/libs/editor-impl/src/table/__tests__/layout.uat.test.tsx

key-decisions:
  - "默认行数由非导出函数 resolveTextareaRows(text) 计算：split('\\n').length 夹在 [1, 6]"
  - "去掉 autoSize 改用显式 rows；拖拽高度不被 React 重置（React 只管 rows，不管 height）"
  - "table.css 去掉 max-height:160px 并加 resize: vertical，使拖拽不被固定上限封顶"

patterns-established:
  - "多行文本域默认高度 = 内容行数（上限 6），超出由浏览器原生内部滚动承担"

requirements-completed: [TABLE-01]

# Coverage metadata (#1602)
coverage:
  - id: D1
    description: "值文本域默认高度按内容行数（单行→1、3 行→3、超过 6 行封顶 6，P24）"
    requirement: TABLE-01
    verification:
      - kind: unit
        ref: "src/table/__tests__/layout.uat.test.tsx#单行值文本域默认 1 行"
        status: pass
      - kind: unit
        ref: "src/table/__tests__/layout.uat.test.tsx#三行文本的文本域行数为 3"
        status: pass
      - kind: unit
        ref: "src/table/__tests__/layout.uat.test.tsx#超过 6 行的文本行数封顶 6"
        status: pass
    human_judgment: false
  - id: D2
    description: "值文本域可纵向拖拽调整大小且不受固定最大高度封顶（resize: vertical，无 max-height，P24）"
    requirement: TABLE-01
    verification:
      - kind: unit
        ref: "src/table/__tests__/layout.uat.test.tsx#文本域可纵向拖拽且无固定最大高度"
        status: pass
    human_judgment: false
  - id: D3
    description: "值文本域仍为 antd Input.TextArea，失焦提交 / 非法 JSON 恢复语义不变"
    requirement: TABLE-01
    verification:
      - kind: unit
        ref: "src/table/__tests__/layout.uat.test.tsx#值文本域使用 antd Input.TextArea"
        status: pass
      - kind: unit
        ref: "src/table/__tests__/inputs.test.tsx#失焦时提交解析后的值"
        status: pass
      - kind: unit
        ref: "src/table/__tests__/inputs.test.tsx#解析失败时恢复原值且不提交"
        status: pass
    human_judgment: false

# Metrics
duration: 9min
completed: 2026-10-14
status: complete
---

# Phase 2 Plan 28: 值文本域高度与可拖拽（P24）Summary

**值文本域默认高度改为按内容行数（夹在 1–6、超出内部滚动），并开启右下角纵向拖拽调整大小，修复「看起来像单行、拖不动」的 P24。**

## Performance

- **Duration:** ~9 min
- **Started:** 2026-10-14T18:17Z
- **Completed:** 2026-10-14T18:26Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- `TextareaInput` 去掉 `autoSize={{ minRows:1, maxRows:6 }}`，改用 `rows={resolveTextareaRows(text)}`：默认高度随文本行数变化，超过 6 行由浏览器原生内部滚动条承担。
- `.etable-input-textarea` 加 `resize: vertical` 并去掉 `max-height:160px`，启用右下角纵向拖拽且不再被固定上限封顶。
- `ITextareaInputProps` 形状未变、未新增依赖；失焦提交 / 非法 JSON 恢复语义与禁用态均不变。
- 新增 4 条 UAT 用例（1 行 / 3 行 / 封顶 6 行 / 可拖拽无 max-height），既有「antd `Input.TextArea`」用例继续通过。

## Task Commits

Each task was committed atomically:

1. **Task 1: 文本域默认高度按内容行数、上限 6 行（tracer）** - `34ff5f5` (feat)
2. **Task 2: 文本域允许拖拽调整大小** - `014f42c` (style)

**Plan metadata:** 见本 SUMMARY 的最终文档提交

## Files Created/Modified

- `packages/libs/editor-impl/src/table/components/inputs/TextareaInput.tsx` - 新增 `resolveTextareaRows(text)`；渲染去 `autoSize`、改传 `rows`。
- `packages/libs/editor-impl/src/table/table.css` - `.etable-input-textarea` 加 `resize: vertical`、去 `max-height`。
- `packages/libs/editor-impl/src/table/__tests__/layout.uat.test.tsx` - 新增 P24 行数 / 拖拽用例。

## Decisions Made

- 用非导出模块函数 `resolveTextareaRows(text)`（`text.split('\n').length` 夹在 `[1, 6]`）计算默认行数；空文本自然为 1。
- 以显式 `rows` 取代 `autoSize`：React 只控制 `rows` 属性、不控制行内 `height`，因此拖拽设定的高度不会被重渲染重置。
- `resolveTextareaRows` 的 jsDoc 采用与本文件既有 `toText` / `parseText` 一致的多行 `@param` / `@returns` 风格（AGENTS §Code style「模块级函数须有 jsDoc、公共函数换行风格」覆盖计划中「单行 jsDoc」的措辞）。

## Deviations from Plan

### Auto-fixed Issues

None.

### Style alignment (not a behavioral deviation)

**1. [Style] `resolveTextareaRows` 采用多行 JSDoc 而非计划所述「单行 jsDoc」**
- **Found during:** Task 1
- **Issue:** 计划 `<action>` 写「写单行 jsDoc」；`AGENTS.md` §Code style 规定「公共方法 jsDoc 换行风格、写清每个参数」，且本文件相邻的 `toText` / `parseText` 均用多行 `@param` / `@returns`。
- **Fix:** 按 AGENTS + 文件既有约定写多行 JSDoc（行为零差异）。
- **Files modified:** `packages/libs/editor-impl/src/table/components/inputs/TextareaInput.tsx`
- **Committed in:** `34ff5f5` (Task 1 commit)

---

**Total deviations:** 0 auto-fixed；1 条纯 style 对齐（JSDoc 风格）。
**Impact on plan:** 无行为差异，未改 props 形状、未新增依赖、未改提交 / 校验语义。

## Issues Encountered

- 计划 `<action>` 以「字符串值含 3 行 / 10 行」描述用例，但值单元格的 `TextareaInput` 以 `JSON.stringify(value, null, indent)`（indent 缺省 0）序列化，字符串值中的换行会被转义为单行文本。因此用例改为在已装配的单元格文本域上 `fireEvent.change` 注入多行文本后断言 `rows`，直接、忠实地验证 `resolveTextareaRows` 与 `rows` 绑定。既有「显示值的 JSON 文本」用例仍绿，证明序列化语义未改。
- 运行期间 jsdom 对 antd 浮层打印 `window.getComputedStyle` 未实现噪声（既有、非失败）；本计划未引入新噪声源。

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- P24 已修复；`resolveTextareaRows` 名称已按「重要命名先确认」门禁确认后落实现。
- 供 `verify-work` 复核 P24。

---
*Phase: 02-table*
*Completed: 2026-10-14*

## Self-Check: PASSED

- FOUND: packages/libs/editor-impl/src/table/components/inputs/TextareaInput.tsx
- FOUND: packages/libs/editor-impl/src/table/table.css
- FOUND: packages/libs/editor-impl/src/table/__tests__/layout.uat.test.tsx
- FOUND: .planning/phases/02-table/02-28-SUMMARY.md
- FOUND commit: 34ff5f5
- FOUND commit: 014f42c
