---
phase: 04-map
plan: 02
subsystem: editor-core + editor-impl
tags: [editor-core, editor-impl, panel, onBeforeClose, tablegrid, formMode, interface]

# Dependency graph
requires:
  - phase: 04-map
    provides: 04-01 已定稿的地图域类型、命名表与 `INTERFACE-NAME.md` §Plan 04-02
provides:
  - "`IEditorPanel.onBeforeClose?(): Promise<boolean>` 可选钩子（含调用时机 / 返回值 / 不询问路径的 JSDoc）"
  - "`ITableGridProps.formMode?: boolean` 可选成员（含缺省行为说明）"
  - "关闭前询问语义的 one-way 定稿：04-15 只补行为、04-08 按此语义实现 `MapPanel.onBeforeClose`"
affects: [04-08, 04-09, 04-15]

actuals:
  tokens: 5225
  tasks: 2
  commits: 3
  plan_head_before: 0efc3ac3e34db706cbcb8928b1832b05d9b9b807

tech-stack:
  added: []
  patterns:
    - 跨包接口只用可选成员扩展，既有实现零改动
    - 接口声明与行为实现分属不同计划（先接口、后实现）

key-files:
  modified:
    - packages/libs/editor-core/src/panel/types.ts
    - packages/libs/editor-impl/src/shared/schemaForm/components/TableGrid.tsx

key-decisions:
  - "关闭前询问语义按用户确认定稿：true = 允许关闭，false = 取消；只在用户主动点 ✕ 关闭标签时询问；询问前先把目标标签切成活动标签；释放编辑器 / 注销面板类型 / 内部关闭实例永不询问；钩子抛错记日志并按取消关闭处理"
  - "`onBeforeClose` 与 `formMode` 均为可选成员：表格 / 素材 / 演示面板不实现钩子，行为零变化"
  - "`formMode` 只声明、不实现渲染分支（实现留给 04-09）；`ITableGridProps` 沿用既有 `readonly` 成员约定，写成 `readonly formMode?: boolean`"

patterns-established:
  - "接口扩展优先用可选成员 + 完整 JSDoc，避免破坏既有实现"
  - "同一份表格表单由 `formMode` 复用为属性表单，不复制行渲染链"

requirements-completed: [MAP-01]

coverage:
  - id: D1
    description: "`IEditorPanel` 新增可选方法 `onBeforeClose?(): Promise<boolean>`，JSDoc 写清调用时机、返回值含义与不会询问的内部路径"
    requirement: MAP-01
    verification:
      - kind: other
        ref: "node -e 结构检查（onBeforeClose?(): Promise<boolean>）exit 0"
        status: pass
      - kind: other
        ref: "pnpm --filter @motajs/editor-core typecheck exit 0"
        status: pass
    human_judgment: false
  - id: D2
    description: "`ITableGridProps` 新增可选成员 `readonly formMode?: boolean`，JSDoc 说明 true 时只渲染字段行 / 值控件、缺省 false 且既有调用点不受影响"
    requirement: MAP-01
    verification:
      - kind: other
        ref: "node -e 结构检查（formMode?: boolean）exit 0"
        status: pass
      - kind: other
        ref: "pnpm --filter @motajs/editor-impl typecheck exit 0"
        status: pass
    human_judgment: false
  - id: D3
    description: "本计划没有任何行为变化：`shellSystem.ts` 与 `TableGrid` 渲染函数均未被改动"
    requirement: MAP-01
    verification:
      - kind: other
        ref: "git diff -- packages/libs/editor-core/src/shell/shellSystem.ts（输出为空）"
        status: pass
      - kind: other
        ref: "git show 02ab67f --stat（仅两个接口文件 +12 行）"
        status: pass
      - kind: other
        ref: "node scripts/verify/coreImportType.js exit 0（186 个源码文件、0 条 import type）"
        status: pass
    human_judgment: false

duration: 2 min
completed: 2026-10-21
status: complete
---

# Phase 4 Plan 2: 面板关闭前钩子 + 表格表单模式（仅声明）Summary

**给面板接口加了可选的「关闭前先问一句」钩子，给表格组件加了可选的「只显示字段行」开关；两处都只写声明与 JSDoc，外壳与表格渲染行为一字未改。**

## Performance

- **Duration:** 2 min
- **Started:** 2026-10-21T15:24:09+08:00
- **Completed:** 2026-10-21T15:25:26+08:00
- **Tasks:** 2（Task 1 为已确认的 checkpoint，Task 2 为代码声明）
- **Files modified:** 2

## Task 1：关闭前钩子语义（checkpoint:decision）已确认

用户在 04-01 的命名确认中已经拍板 `IEditorPanel.onBeforeClose` 的语义，本次不再重复询问：

- `true` = 允许关闭；`false` = 取消关闭（标签保留、实例不释放）。
- 只在**用户主动点 ✕ 关闭标签**时询问。
- 询问前先把目标标签切换为活动标签，保证确认框有 DOM 可挂。
- 释放整个编辑器（`ShellSystem.dispose`）、注销面板类型（`ShellSystem.unregisterPanelType`）、内部关闭实例（`ShellSystem.closePanelInstance`）等路径**永不询问**。
- 钩子抛错时记录日志并按「取消关闭」处理（数据安全优先），面板实现需自行 catch。

行为落地属于 04-15，本计划不写调用点。

## Task 2：声明两个可选成员

- `packages/libs/editor-core/src/panel/types.ts`：在 `IEditorPanel.getTitle?()` 之后、`initialize()` 之前插入 `onBeforeClose?(): Promise<boolean>` 与完整 JSDoc。
- `packages/libs/editor-impl/src/shared/schemaForm/components/TableGrid.tsx`：在 `ITableGridProps.onSave` 之后追加 `readonly formMode?: boolean` 与单行 JSDoc；渲染函数未改。

## Task Commits

1. **Task 2: 声明两个可选成员** - `02ab67f` (feat)

Task 1 是 checkpoint，按设计不产生代码提交。

## Verification

| 检查 | 结果 |
|------|------|
| 结构检查（两个成员都在）`node -e ...` | exit 0 |
| `pnpm --filter @motajs/editor-core typecheck` | exit 0，无 `error TS` |
| `pnpm --filter @motajs/editor-impl typecheck` | exit 0，无 `error TS` |
| `node scripts/verify/coreImportType.js` | exit 0（186 个源码文件、0 条 `import type`） |
| `git diff -- packages/libs/editor-core/src/shell/shellSystem.ts` | 空 |
| `TableGrid` 渲染函数 diff | 仅接口成员 +2 行，渲染体未动 |

## Files Created/Modified

- `packages/libs/editor-core/src/panel/types.ts` - `IEditorPanel` 新增可选 `onBeforeClose`
- `packages/libs/editor-impl/src/shared/schemaForm/components/TableGrid.tsx` - `ITableGridProps` 新增可选 `formMode`

## Decisions Made

- 语义严格按用户确认版本落进 JSDoc，不扩大也不缩小。
- `formMode` 使用 `readonly`（与 `ITableGridProps` 其余成员一致），结构检查仍命中 `formMode?: boolean`。

## Deviations from Plan

None - 计划中的两个文件、两处声明均按原文执行；`shellSystem.ts` 与 `TableGrid` 渲染体未触碰。

实施层唯一调整：`formMode` 写成 `readonly formMode?: boolean`，沿用该接口所有成员均为 `readonly` 的既有约定，不改变可选性与语义。

## Issues Encountered

- 执行期间同一工作树上有另一个并行流程提交了 03-37 的文档/测试提交（`5404785`、`0efc3ac`）。本计划的提交只 stage 了自己拥有的两个文件，未夹带任何其它改动；`plan_head_before` 取本计划 task commit 的父提交 `0efc3ac`（首次写入 ledger 时与并发提交发生竞态，已修正为真实父提交）。

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- 04-15 可直接按本计划 JSDoc 语义实现 `ShellSystem.closeTab` 的询问时序。
- 04-08 的 `MapPanel.onBeforeClose`、04-09 的 `TableGrid.formMode` 实现已有稳定签名。
- 无阻塞项。

---
*Phase: 04-map*
*Completed: 2026-10-21*

## Self-Check: PASSED

- `04-02-SUMMARY.md` 存在于磁盘
- 任务提交 `02ab67f` 存在
- 两个源码文件在提交后为干净状态
