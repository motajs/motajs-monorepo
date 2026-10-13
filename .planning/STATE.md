---
gsd_state_version: "1.0"
milestone: v1.0
current_phase: 02
current_phase_name: 表格编辑
current_plan: 9
status: verifying
stopped_at: Completed 02-15-PLAN.md
last_updated: "2026-10-13T10:52:22.262Z"
last_activity: 2026-10-12
last_activity_desc: "Completed 02-04 (table tracer): editor-impl test infra + end-to-end resource-layer read path"
state_head: a4ec78754671193f284ed65eb7bc4cbc52ddca7c
progress:
  total_phases: 7
  completed_phases: 0
  total_plans: 25
  completed_plans: 21
milestone_name: editor-core 空壳 + editor-impl 重做
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-10-09)

**Core value:** 把编辑器内核与引擎细节彻底解耦——`editor-core` 只给接口、`editor-impl` 写默认实现，让新旧引擎共用同一套编辑能力，第三方可高自由度定制。
**Current focus:** Phase 02 — 表格编辑

## Current Position

Phase: 02 — 表格编辑
Current Plan: 9
Total Plans in Phase: 9
Status: Phase complete — ready for verification
Last activity: 2026-10-12 — Completed 02-04（表格 tracer：工程脚手 + 端到端只读表格面板）

Progress: [██████████] 100%

## Performance Metrics

**Velocity:**

- Total plans completed: 7 (this milestone)
- Average duration: - min
- Total execution time: 0.0 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 1. 编辑器外壳与通用 fs 接口 | 0 | - | - |
| 2. 表格编辑 | 3 | 9 | - |
| 3. 素材管理 | 0 | - | - |
| 4. 地图编辑 | 0 | - | - |
| 5. 代码编辑 | 0 | - | - |
| 6. 事件编辑器 | 0 | - | - |
| 1.1 | 3 | - | - |
| 1 | 4 | - | - |

**Recent Trend:**

- Last 5 plans: -
- Trend: N/A

*Updated after each plan completion*
**Per-Plan Metrics:**

| Plan | Duration | Tasks | Files |
|------|----------|-------|-------|
| Phase 02 P04 | 44min | 3 tasks | 16 files |
| Phase 02 P05 | 12min | 1 tasks | 2 files |
| Phase 02 P06 | 16min | 3 tasks | 16 files |
| Phase 02 P07 | 24 | 3 tasks | 13 files |
| Phase 02 P08 | 34 | 3 tasks | 12 files |
| Phase 02 P9 | 30min | 3 tasks | 12 files |
| Phase 02 P10 | 8min | 2 tasks | 2 files |
| Phase 02-table P11 | 6min | 2 tasks | 2 files |
| Phase 02-table P12 | 10min | 2 tasks | 4 files |
| Phase 02 P14 | ~4min | 2 tasks | 2 files |
| Phase 02 P15 | 16min | 3 tasks | 9 files |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- [Milestone v1.0, 2026-10-09]: 旧里程碑阶段全部作废，归档至 `.planning/milestones/archived-20261009-phases/`；本里程碑 Phase 重新从 1 编号。
- [Roadmap v1.0]: `editor-core` 只定义接口（含通用 fs 接口 CORE-01），`editor-impl` 写默认实现；外壳先行（SHELL-01），能力顺序 table → asset → map → code → event。
- [Roadmap v1.0]: CORE-01（通用 fs 接口）并入 Phase 1——外壳与接口同为最底层地基，避免把「只定义接口」单列成一个空阶段。
- [Phase 05.3]: `editor-core` 的 `window` 门禁豁免；`editor-impl` 对外 subpath 为 `.` / `./code` / `./table` / `./map` / `./asset` / `./shell` / `./react`。
- [Phase 02]: 02-04: schema 缺失或非对象 → 空态（正文「尚未定义任何字段。」）；是对象但无 properties → 回退用数据自身键作叶子行（must_haves 真值 35 与 Task 2 action 两处要求的取舍）
- [Phase 02]: 02-04: TablePanelStatus / ITableGridProps 落在 TableGrid.tsx（types.ts 不在 files_modified；且避免 TableGrid ↔ tablePanel 环依赖）
- [Phase 02]: 02-04: 表格组件完全由 props 驱动、面板类型只是其一个消费者（D-01/D-18）；TablePanel.onSwitchIn 重取数据与 schema（D-15 修订 / D-31）
- [Phase 02]: 02-05: 外壳用实例字段 lastActiveInstanceId 判定活动面板是否真正变化，凡改变活动面板的路径（activateTab/openPanelInTab/openBlankTab/closeTab 切邻）汇聚到私有 syncActiveInstance 投递 onSwitchIn/onSwitchOut
- [Phase 02]: 02-05: 关闭/替换活动面板时先 onSwitchOut() 再 dispose()；关闭非活动标签不触发钩子；钩子抛错经既有 logger 记 shell.callbackFailed 隔离（T-02-08）
- [Phase 02]: 02-06: 校验用 ajv（catalog 固定 8.20.0，--offline 安装）；validateValue 在函数内 new Ajv2020({ strict:false, allErrors:true }) 编译字段的 JSON Schema 节点，绝不对 schema 求值（D-22 / T-02-14）
- [Phase 02]: 02-06: 行内控件由标准关键字推导、x-control 兜底（enum→Select、boolean→Checkbox、array→MultiSelect、number/integer→Number、缺省→Text），inferControlKind
- [Phase 02]: 02-06: ColorInput 仅按源值是否四通道决定 alpha 回写；TextareaInput 空白文本提交 null；SelectInput 关闭虚拟滚动以便枚举选项稳定渲染
- [Phase 02]: 字段路径采用 legacy 括号形式 ['a']['b']（用户确认）；buildTableTree 同步改为括号键
- [Phase 02]: 统一撤销：每次编辑写资源后记录一条可逆 IUndoContext；写入失败不记录（T-02-18）
- [Phase 02]: 字段路径写操作拒绝 __proto__/constructor/prototype（T-02-17 原型污染）
- [Phase 02]: 02-08: schema 模式按资源 id 约定（table#schema.<名>）判定；schema 视图只读自身文档、不请求 schema 资源（D-05）
- [Phase 02]: 02-08: 呈现规则内建（buildSchemaPresentation + Object.freeze 常量），成对关键字在渲染期合行；绝不由被编辑的 schema 描述
- [Phase 02]: 02-08: 面板方法 openSchemaPanel / openCurrentViewInCodeEditor 由 TableGrid 从 useTableCapabilities() 取打开器后传入——面板类不读 React Context
- [Phase 02]: 02-08: D-30 写回为一次整份资源替换（TableUndoType.Replace），复用既有 { path:'', previousValue, nextValue } 载荷走统一撤销路径
- [Phase 02]: 02-09: 操作列注释动作以图标 + aria-label/title 呈现，避免与表头「注释」列在同一次 getByText 断言中重复命中
- [Phase 02]: 02-09: 外部编辑器分发落在 TableRow.tsx（模块内、不额外导出），结果经既有 onChange → TablePanel.commitValue 重入；字段级与 D-30 复用同一 ICodeEditorOpener
- [Phase 02]: 02-09: tablePanel.ts 未改动——统一校验后可撤销提交入口 TablePanel.commitValue 已由 02-07 提供，外部结果经既有 onChange 通道重入；避免 tablePanel→TableGrid→TableRow→tablePanel 环依赖
- [Phase 02]: 02-10: 阶段级集成测试以单个用例贯穿完整流程（打开→编辑→增删→撤销/重做→注入打开器新开 schema 面板→改 schema→切回数据面板因切入刷新而重算）；注入打开器以真实外壳开新标签承载 schema 面板。
- [Phase 02]: 02-10: 生效门禁（coreImportType/coreEngineNeutral/coreModuleState/coreFsSurface）全绿；失效门禁如实记录（coreBoundaries 0、coreExports 1、implExports 1），不作阶段门禁；nyquist_compliant 仅在生效检查全绿时置真。
- [Phase 02]: 02-12: 外壳 createInstance 未提供打开参数时整个省略 openParam 键（三元构造两种工厂入参）——不关心该参数的既有工厂行为一字不变
- [Phase 02]: 02-12: tablePanelType 在构造阶段据 param.openParam.target 调用 ITablePanel.setTable（一打开即瞄准）；收窄用非导出谓词 isTablePanelTarget，畸形值落回 NoTarget，无 as 断言
- [Phase 02]: 02-14: 表格修复轮接口（仅类型）——IEditorPanel 增加可选 getTitle?()（按实例标题，缺席回退类型名）；ITablePanel.setTable 增加可选 columnIndex（0 基，省略为 0）；ITablePanelParam 增加 columnWidth?（缺省约 400px）；ITableSchemaNode 增加 x-order?（同级字段呈现顺序）。均非破坏，实现文件零改动。
- [Phase 02]: 02-15: 外部编辑器返回值在 TableRow.runExternalEditor 提交前统一 validateValue，非法值落行内 .etable-row-error 且不写资源（B1）；TablePanel.commitValue 面板级校验保留为防御性兜底
- [Phase 02]: 02-15: 数字字段（TableControlKind.Number）改渲染新控件 NumberInput（包一层 antd InputNumber），不再落 TextareaInput（B2）
- [Phase 02]: 02-15: 提示行改为常驻预留（renderNotice 恒渲染 .etable-notice + min-height），成功文案去掉「刷新后生效」为「添加成功」/「删除成功」（B3）

### Pending Todos

None yet.

### Blockers/Concerns

- 旧 `@motajs/editor` 仍与 mota-js 文件格式深度耦合；`editor-impl` 成为默认实现后，`@motajs/editor` 需改为调用 core/impl 并自行承担引擎适配（对外行为保持不变）。
- 各能力阶段的 schema / 端口设计尚未展开，由对应阶段的 discuss/plan 时确定，本 roadmap 不预设。

### Roadmap Evolution

- Phase 1 edited: renamed phase 1 to 编辑器外壳 (shell-focused)
- Phase 1.1 inserted after Phase 1: 编辑器开发宿主（最小可运行整合，用于验证 editor-core/editor-impl） (URGENT)

## Deferred Items

Items acknowledged and deferred at milestone close, most recent first:

| Category | Item | Status | Deferred At | Milestone |
|----------|------|--------|-------------|-----------|
| *(none)* | | | | |

## Session Continuity

Last session: 2026-10-13T10:51:57.249Z
Stopped at: Completed 02-15-PLAN.md
Resume file: None
