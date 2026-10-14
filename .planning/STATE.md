---
gsd_state_version: "1.0"
milestone: v1.0
current_phase: 02
current_phase_name: 表格编辑
current_plan: 9
status: verifying
stopped_at: Completed 02-24-PLAN.md
last_updated: "2026-10-14T08:23:15.956Z"
last_activity: 2026-10-12
last_activity_desc: "Completed 02-04 (table tracer): editor-impl test infra + end-to-end resource-layer read path"
state_head: 5750282e6b6c07ee320e61ca49e31b2cdd729ee4
progress:
  total_phases: 7
  completed_phases: 0
  total_plans: 37
  completed_plans: 30
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
| Phase 02 P16 | 10min | 2 tasks | 3 files |
| Phase 02 P17 | 1h 27m | 3 tasks | 8 files |
| Phase 02 P18 | ~30min | 3 tasks | 13 files |
| Phase 02-table P19 | ~15min | 2 tasks | 2 files |
| Phase 02-table P20 | ~13min | 3 tasks | 5 files |
| Phase 02 P21 | ~17min | 3 tasks | 5 files |
| Phase 02 P22 | 14min | 2 tasks | 3 files |
| Phase 02-table P23 | 11min | 2 tasks | 5 files |
| Phase 02-table P24 | 3min | 2 tasks | 2 files |

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
- [Phase 02]: 02-16: dev 宿主把 ITablePanelOpener 实现为 createTablePanelOpener(core)（开空白标签 + 带 param 开表格面板类型），经 CapabilityProvider.capabilities.tablePanel 注入，「编辑 Schema」按钮由禁用变为可用
- [Phase 02]: 02-16: 打开器只透传 param、不自行收窄 target——收窄由 tablePanelType.create 的 isTablePanelTarget 承担；保留 openTableDemoPanel 不动，无实例捕获、无新 API
- [Phase 02]: 02-16: 修正 devHostTable.test.tsx 数字字段过期断言（02-15 改渲染 InputNumber 后遗留，Rule 1）
- [Phase 02]: 02-17: resolveTabName 增第三参 getPanel，外壳经 props 接收实例解析器以读 IEditorPanel.getTitle（缺席回退类型名）；保持 editor-core 无模块级可变绑定
- [Phase 02]: 02-17: 编辑方法以 columnIndex 作末位可选参（缺省 0），既有单栏调用与测试不变；多栏请求序号放在私有 requestTokens 数组，ITablePanelColumn 保持四成员
- [Phase 02]: 02-17: 栏包装 .etable-column + 竖分隔线放在渲染根 TablePanelView，TableGrid 对外 props 语义不变；多栏结构为将来拖拽/缩放预留（本次不实现）
- [Phase 02]: 02-18: B4 新字段名来源——点 + 后在插入点内联渲染 antd Input（Enter 确认 / Escape、失焦取消），确认前经 validateId 校验；不使用原生 prompt / confirm
- [Phase 02]: 02-18: L3 x-order——数据表新增时按完整同级顺序把新名称写进该层 schema 的 x-order（缺省时新建）；行树按 x-order 排同级字段，缺失时回退对象自然键序
- [Phase 02]: 02-18: 删除不再用 window.confirm——左侧红底圆形 − 直接在统一撤销路径上删除一行（可 Ctrl+Z 回退）；schema 禁止 null 时 − 禁用
- [Phase 02]: 02-19: 全局撤销/重做快捷键绑在 editor-core 外壳（ShellSystem 的 ShellRoot），任何渲染 shellSystem.render() 的宿主零接线即得；Ctrl/Cmd+Z 撤销、Ctrl/Cmd+Shift+Z 与 Ctrl/Cmd+Y 重做，命中即 preventDefault（B5）
- [Phase 02]: 02-19: 快捷键监听挂 window 而非 document——PORT-02 门禁在 editor-core（含测试）禁 document 全局，window 由 D-38 明确允许；按键解析抽成非导出纯函数 resolveUndoRedoShortcut，无模块级可变绑定
- [Phase 02-table]: 02-20: 栏数由 window.innerWidth 决定（N = max(1, floor(innerWidth / 栏宽))），可视栏在容器内等分（flex 1 1 0），既满足末栏不偏宽又不产生横向滚动条（P5/P6 冲突落点）
- [Phase 02-table]: 02-20: 面板不自行读窗口——视图经只读回调 onLayout 回报可视栏数，模型只在 0..visibleColumnCount-1 内找空栏，越界即回退打开器（T-02-20-02）
- [Phase 02-table]: 02-20: 栏分隔线改为覆盖整列高度的 ::before 竖线（align-self: stretch + min-height: 100%），两侧表格高度不一致时不断口（P9）
- [Phase 02-table]: 02-20: 测试环境缺省 window.innerWidth 归零（mapPolyfill.ts），等价改造前未桩 clientWidth 的单栏缺省；产品代码零行为影响（Rule 3）
- [Phase 02]: 02-21: 层级以渲染期 level 参数在 renderRows / renderRowNode / renderSchemaRows 里层层传递（顶层 0），不给 ITableRowNode 加深度字段，避免数据模型类型变更
- [Phase 02]: 02-21: 层级缩进只在「条目」列——取消 .etable-group-children 的 padding/border（不再整行收窄），改由条目列内 level 个 .etable-tree-guide 等宽占位同时承担缩进与树形引导竖线
- [Phase 02]: 02-21: 展开行逐级底色用 data-level 整数驱动 CSS（[data-level='1'] 等），不写内联背景色；缩进步长 12→9px（组件常量 TREE_INDENT_STEP 与 CSS 变量 --etable-indent 同步）
- [Phase 02]: 02-21: .etable-cell 改 flex 垂直居中后，纯文本统一包 .etable-cell-text 容器以保留省略号截断（新增内部 CSS 钩子，特此登记备查）
- [Phase 02]: P12 根因在交互侧（失焦丢弃 + 输入框压条目列），写入路径本就正确，故不改 tablePanel.ts
- [Phase 02]: 名称输入改为独立浮层 .etable-add-popover，提交入口扩为回车 / 失焦 / 确定三处（P12）
- [Phase 02]: P13 审计确认无裸 textarea / 原生对话框，TextareaInput 已是 antd，仅补回归断言
- [Phase 02]: Dev demo table scales via a count constant + generator functions (TABLE_DEMO_ENTRY_COUNT / createTableDemoData / createTableDemoSchema)
- [Phase 02]: Undo/redo exposed as flat top-level dev-host menu items (registerDevMenu) calling core.undoSystem; no shell sub-menu, no core/impl change
- [Phase 02]: 02-24: P15 组件侧契约（仅类型）——ITableGridProps.onCloseColumn 与 ITableToolbarProps.onCloseColumn / closeButtonEnabled 均为可选成员，接口计划先落地不致既有构造点 typecheck 失败，透传在 02-31 实现

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

Last session: 2026-10-14T08:23:15.794Z
Stopped at: Completed 02-24-PLAN.md
Resume file: None
