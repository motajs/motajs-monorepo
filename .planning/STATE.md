---
gsd_state_version: "1.0"
milestone: v1.0
current_phase: 4
current_phase_name: 地图编辑
current_plan: 5
status: executing
stopped_at: Completed 04-05-PLAN.md
last_updated: "2026-10-21T08:32:23.160Z"
last_activity: 2026-10-21
last_activity_desc: Phase 3 complete, transitioned to Phase 4
state_head: efd176cbab4e3c6bf01ff375269f992dc3807589
progress:
  total_phases: 8
  completed_phases: 0
  total_plans: 120
  completed_plans: 107
milestone_name: editor-core 空壳 + editor-impl 重做
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-10-09)

**Core value:** 把编辑器内核与引擎细节彻底解耦——`editor-core` 只给接口、`editor-impl` 写默认实现，让新旧引擎共用同一套编辑能力，第三方可高自由度定制。
**Current focus:** Phase 02.1 — 资源层重构与表格文件管理

## Current Position

Phase: 4 (地图编辑) — EXECUTING
Current Plan: 5
Total Plans in Phase: 16
Status: Ready to execute
Last activity: 2026-10-21 — 04-01 complete (naming report + map domain types)

Progress: [██████████] 100%

## Performance Metrics

**Velocity:**

- Total plans completed: 67 (this milestone)
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
| 02.1 | 26 | - | - |
| 3 | 31 | - | - |

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
| Phase 02 P25 | 15 | 3 tasks | 5 files |
| Phase 02 P26 | 10min | 2 tasks | 3 files |
| Phase 02 P27 | ~25min | 2 tasks | 2 files |
| Phase 02 P28 | 9min | 2 tasks | 3 files |
| Phase 02 P29 | 12min | 2 tasks | 2 files |
| Phase 02 P30 | 11min | 2 tasks | 4 files |
| Phase 02-table P31 | 12min | 2 tasks | 4 files |
| Phase 02-table P32 | 14min | 2 tasks | 3 files |
| Phase 02 P33 | 6min | 2 tasks | 3 files |
| Phase 02 P34 | 11min | 2 tasks | 2 files |
| Phase 02.1 P01 | 8min | 3 tasks | 4 files |
| Phase 02.1 P02 | 3min | 2 tasks | 3 files |
| Phase 02.1 P03 | 9min | 3 tasks | 14 files |
| Phase 02.1 P04 | 7 | 3 tasks | 7 files |
| Phase 02.1 P5 | 7min | 2 tasks | 2 files |
| Phase 02.1 P06 | 40min | 2 tasks | 9 files |
| Phase 02.1 P07 | 29min | 1 tasks | 9 files |
| Phase 02.1 P08 | 44min | 1 tasks | 10 files |
| Phase 02.1 P09 | 20min | 3 tasks | 8 files |
| Phase 02.1 P10 | 35min | 3 tasks | 7 files |
| Phase 02.1 P11 | 6min | 2 tasks | 2 files |
| Phase 02.1 P12 | 12min | 3 tasks | 4 files |
| Phase 02.1 P13 | 12min | 2 tasks | 5 files |
| Phase 02.1 P14 | 10min | 2 tasks | 3 files |
| Phase 02.1 P15 | 22 | 2 tasks | 11 files |
| Phase 02.1 P17 | 8min | 3 tasks | 5 files |
| Phase 02.1 P16 | 7 | 2 tasks | 3 files |
| Phase 02.1 P18 | 6min | 3 tasks | 4 files |
| Phase 02.1 P19 | 8min | 1 tasks | 5 files |
| Phase 02.1 P20 | ~45min | 3 tasks | 5 files |
| Phase 02.1 P21 | ~50min | 3 tasks | 10 files |
| Phase 02.1 P22 | ~20min | 3 tasks | 7 files |
| Phase 02.1 P23 | ~40min | 3 tasks | 11 files |
| Phase 02.1 P24 | ~19min | 3 tasks | 3 files |
| Phase 02.1 P25 | 13 min | 3 tasks | 5 files |
| Phase 02.1 P26 | 17 | 3 tasks | 5 files |
| Phase 4 P02 | 2 min | 2 tasks | 2 files |
| Phase 04 P05 | 14 min | 3 tasks | 9 files |

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
- [Phase 02]: P14 用受限高度链（.etable-column 定高 + .etable 绝对填充）使 .etable-body 成为唯一滚动容器，不改 DOM 结构
- [Phase 02]: P17 弹性占位 .etable-toolbar-spacer 仅在空栏出现，有表栏沿用 title 撑开；P25 操作列 1fr→1.5fr
- [Phase 02]: 02-26: P19 折叠行整行 onClick 切换折叠，折叠箭头按钮先 stopPropagation 再切换以保证只切换一次；gutter 增删按钮本已 stopPropagation 不改动，子行在兄弟容器 .etable-group-children 内故不误折叠父行
- [Phase 02]: 02-26: P16 折叠行上下边框显式用 2px solid rgba(0,0,0,0.15)（比 .etable-cell 的 1px 更明显），不改 02-21 的层级底色；jsdom 不应用外部 CSS，边框断言以 ../table.css?inline 读样式表原文正则核对
- [Phase 02]: 02-27: P21 x-order 仍以文本域编辑（x-control: Text），只把校验从 { type:'string' } 改为按字符串数组（{ type:'array', items:{type:'string'} }）；traversal.readOrder 的排序语义不变
- [Phase 02]: 02-27: P22 type 的合法取值放非导出模块级常量 SCHEMA_TYPE_VALUES（string/number/integer/boolean/object/array/null），经 keywordConfig 合成 { enum } —— 同一份 enum 同时驱动下拉候选与 ajv 校验
- [Phase 02]: 02-27: 测试查下拉候选项改用 screen.getAllByRole('option') 而非 document 全局 —— coreModuleState 门禁（PORT-02）同样扫描 editor-impl/src，禁 document 全局
- [Phase 02]: 02-28: P24 值文本域默认行数由非导出函数 resolveTextareaRows(text) 计算（按 text 行数夹在 1..6），去掉 autoSize 改传 rows
- [Phase 02]: 02-28: P24 值文本域开启纵向拖拽——table.css .etable-input-textarea 加 resize: vertical 并去掉 max-height:160px；React 只控 rows 不控行内 height，拖拽设定的高度不会被重渲染重置
- [Phase 02]: 02-29: P18/P20 同面板依赖同步——新增私有 TablePanel.refreshDependents(columnIndex, changedId)，在 commitValue/deleteItem/addItem/openCurrentViewInCodeEditor/applyUndoRedo 写盘后按被写资源 id 精确匹配本面板引用它的其它栏并 void refresh；不做全量刷新、不跨面板广播（D-15 修订 / D-31）
- [Phase 02]: P23 值校验改为共享单个 ajv 实例（模块级 const）+ WeakMap 按 schema 引用缓存已编译校验器；行树 buildTableTree/buildSchemaTree 按输入对象引用用 WeakMap 缓存，命中即复用同一数组
- [Phase 02]: ✕ 仅当 onCloseColumn 传入时渲染；禁用态由 closeButtonEnabled 决定（本栏 NoTarget 即禁用）
- [Phase 02]: TablePanel.closeColumn 递增本栏 nextToken 丢弃在途结果，只清空 columnAt(columnIndex) 一栏
- [Phase 02]: 02-32: P26 刷新原地更新——TablePanel.refresh 仅在本栏尚无就绪行树（首载/失败重试）时才发 Loading+空行树，已有内容时保持 Ready 就地更新，避免约 100 行 DOM 整树卸载重挂
- [Phase 02]: 02-32: TablePanel.setTable 仅在换到另一张目标表（data.id 变化或此前无目标）时清旧行树；refresh 自身不再清树
- [Phase 02]: 02-32: React.memo(TableGrid) + Ready 分支行元素列表 useMemo + TableColumn 各回调 useCallback（依赖取具体 props 字段，不取整个 props 对象）；内容未变的刷新跳过整表重渲染，无需改 ITableRowProps/IGapRowProps
- [Phase 02]: P27/P28: 折叠行整行加 cursor:pointer；值文本域精确回退到 antd autoSize（撤销 02-28 的 rows + resize）
- [Phase 02]: 02-34: P29 分组行默认折叠（expanded 初值 false，折叠子树不挂载）+ 首次可见自动展开（GapRow 自持 IntersectionObserver，首次相交即展开并 disconnect）；autoRevealPending 本地标记使自动展开只发生一次且用户点击后不再自动展开；无 IntersectionObserver 时退化立即展开（jsdom 既有用例因此保持绿）；折叠状态仍为组件本地 useState、不进撤销；IGapRowProps/GapRow 签名不变，无接口计划
- [Phase 02.1]: D-06 已由用户预先裁定为 delete-injection：核心初始化只注入文件系统实现（IEditorCoreInjection.fs），彻底删除 IResourceInjection
- [Phase 02.1]: IResourceIdentifier 采用 type 别名 = string（纯路径），不用 interface 包装对象，贴合 D-01 原文并减少迁移包装层
- [Phase 02.1]: 02.1-01 接口先于实现：只声明资源层类型契约，实现（FileIndex/ContentCache/core.ts 接线）留待 Plan 03/04；中间态整包 tsc 预期为红
- [Phase 02.1]: 02.1-02: ITablePanelTarget 收敛为单一 readonly dataPath:string（schema 路径按文件名约定推导），删除原 data / schema 两成员；schema 视图复用同一字段
- [Phase 02.1]: 02.1-02: ITablePreset 唯一声明于接缝层 react/types.ts，table/types.ts 引入后 export type 再导出——维持依赖方向 table → react（react 不得反向 import table）
- [Phase 02.1]: 02.1-02: 预设表清单经能力接缝注入（ITableEditorCapabilities.tablePresets?），非经面板打开参数（D-11）；缺省时「打开表格」列表只显示目录树
- [Phase 02.1]: 02.1-03: ResourceSystem.initialize 只接收 fs（省略 options）——本计划不实现忽略模式（Plan 04），避免未使用形参；接口 initialize(fs, options?) 仍成立（实现少参合法）
- [Phase 02.1]: 02.1-03: readContent 直接委托 fs.readFile（返回原文、不缓存不解析）；writeContent 按 typeof data 分流 writeFile / writeBinary，二进制与文本路径分离（T-02.1-07）
- [Phase 02.1]: 02.1-03: FakeFileSystem 越界拒绝采用「任一路径段为 .. 即抛错」（比计划描述的以 .. 开头更严）；目录条目由已 seed 文件路径 + 显式 makeDirectory 集合推导，seed 即自动保证父目录可列
- [Phase 02.1]: 02.1-04: 忽略模式按条目名匹配（含 * 通配），索引/缓存键为 / 规范化相对路径精确比对
- [Phase 02.1]: 02.1-04: ContentCache 单条超总上限时不入缓存；LRU 用 Map 插入序，get 命中即刷新
- [Phase 02.1]: 02.1-04: ResourceSystem 接线——listDirectory 索引驱动、读写经缓存、增删移同步；updateResource 先失效缓存，readBinary 为类公开方法（不入接口）
- [Phase 02.1]: 02.1-05: coreFsSurface 反转后只扫 editor-core/src，扫描文件数下界由 20 调为 30（editor-core 全量 42、排除测试树 28，故 30 仍钉住『含测试树』）
- [Phase 02.1]: 02.1-05: coreBoundaries (e) 判据由『是否出现文件读写调用形态』改为『是否触达真实文件系统』（node:fs / from 'fs' / require('fs') / fetch），避免误伤测试替身的 .readFile(...)
- [Phase 02.1]: 02.1-06: 每栏单槽 prefix/pendingStrip——注释剥离确认针对该栏主文件（数据视图为主数据文件、schema 视图为该 schema 文件），写回时按该栏记住的前缀逐字还原
- [Phase 02.1]: 02.1-06: 打开三段检测落在 TablePanel.refresh——读原文后 parseTableText 分类：合规记住前缀打开；NeedsCommentStrip 暂存宽松值并发布 commentStripPending；Invalid 落既有 Error 态（D-29）
- [Phase 02.1]: 02.1-06: 注释剥离确认框直接在表格面板视图内用 antd Modal 渲染（renderCommentStripModal），未新增 IConfirmOpener/IConfirmRequest，未改 react/types.ts 与 react/capabilities.ts
- [Phase 02.1]: 02.1-06: 外部代码编辑器返回文本改用 parseTableText 解析（只接受 Conforming）以支持系统前缀往返，保留原非合法 JSON 不写回的严格性
- [Phase 02.1]: 02.1-06: json5 上收至 catalog（2.2.3）并加入 editor-impl 依赖（离线安装）；系统前缀往返路径本身不依赖 json5，仅非合规回退路径需要
- [Phase 02.1]: 02.1-07: createTableHarness 只装配并初始化 EditorCore、不注册面板类型——保住 tracer『真实 tablePanelType 可注册进外壳』断言，且不新增对外命名
- [Phase 02.1]: 02.1-07: 测试 seed 一律先于 createTableHarness（核心初始化即建文件索引）；Plan 08 须沿用此约定
- [Phase 02.1]: 02.1-07: 缺失的 schema 文件按『无 schema』处理而非错误（TablePanel.fileExists + TablePanel.readSchemaText），存在但读取失败仍落错误态
- [Phase 02.1]: 本计划只改 __tests__ 下测试，未改任何生产源码；复用 Plan 07 的 FakeFileSystem / createTableHarness，不新增第二份替身
- [Phase 02.1]: performance.uat.test.tsx 不含资源装配（仅纯函数断言），原样保留仅复跑；计划 <files> 将其列入实为清单出入
- [Phase 02.1]: layout 的 getTitle 断言随路径约定由「表格 table.demo」改为「表格 demo.json」，为标识串更新而非放松断言
- [Phase 02.1]: 02.1-09: 「打开表格」做成独立面板类型（tableListPanelType，id=table-list），预设表经能力接缝 ITableEditorCapabilities.tablePresets 注入（D-10 / D-11），非经打开参数
- [Phase 02.1]: 02.1-09: 目录树为单层可导航浏览器（当前目录直接子条目 + 「..」父目录行），文件项按 isTableDataPath 过滤、排除 *.schema.json(c)；面板只持有当前目录与其直接子条目
- [Phase 02.1]: 02.1-09: 删除确认用视图内受控 antd Modal（同 Plan 06 注释剥离确认），非 window.confirm / 非命令式 Modal.confirm；TableListPanel.deleteTable 不登记任何 IUndoContext（D-13 不可撤销）
- [Phase 02.1]: 02.1-09: CapabilityProvider 漏转发 tablePresets 能力已修正（Rule 2），使预设表注入接缝端到端可用（Plan 10 开发宿主将经同一 Provider 注入 TABLE_PRESETS）
- [Phase 02.1]: 02.1-09: ITableListPanelViewState 与 ITableListPanelViewProps 同落 TableListPanelView.tsx，面板从视图文件引入状态类型以规避 panel ↔ view 循环引用
- [Phase 02.1]: MemoryBackend.moveFile 迁移子树（含路径前缀下的全部文件与已显式创建的目录），而非只搬单个文件；越界拒绝沿用「任一路径段为 .. 即抛错」（与 FakeFileSystem 同形，承接 T-02.1-23）
- [Phase 02.1]: openTableDemoPanel 改为打开列表面板；迁移后的 devHostTable 用例另用测试本地 helper openDemoTable(core) 直接带 dataPath 打开表格面板，避免引入新对外命名
- [Phase 02.1]: 演示数据 TABLE_DEMO_DATA / TABLE_DEMO_SCHEMA 由对象改为文本（JSON.stringify(..., null, 2)），seed 进内存 fs；测试经 JSON.parse 读回断言
- [Phase 02.1]: main.tsx 同时注册 DEMO_PANEL_TYPE / tablePanelType / tableListPanelType 三种面板类型；ignore 传 node_modules / .git
- [Phase 02.1]: 02.1-11: 阶段级端到端集成用例以单个用例贯穿「打开列表 → 预设/目录树打开 → 编辑 + 撤销 → 切入刷新 → 新建 → 打开新表 → 删除确认后消失」
- [Phase 02.1]: 02.1-11: 「删除不可撤销」以 undoSystem.addUndoContext 计数为 0 的集成断言落地（T-02.1-21）；「切入刷新」以外部 createResource 改索引 + activateTab 触发并以 listDirectory spy 断言重取
- [Phase 02.1]: 02.1-11: 复用 Plan 07 的 FakeFileSystem / createTableHarness 与 Plan 09/10 的能力注入装配，零生产源码改动、零新对外命名
- [Phase 02.1]: 02.1-11: 三包 test / typecheck 与五条生效门禁整验全绿；VALIDATION.md 置 nyquist_compliant true / status validated，Wave 1–8 行依各自 SUMMARY 置绿、Plan 12 行保留 pending
- [Phase 02.1]: 02.1-12: CORE-01 由「只定义接口、不提供实现」改为 core 资源系统驱动注入的文件系统（唯一调用方）；TABLE-01 扩展为打开（预设表 + 目录树）/ 新建 / 删除表格文件
- [Phase 02.1]: 02.1-12: 03-CONTEXT / 03-UI-SPEC 中残留的类型号、IResourceInjection、IResourceIdentifier.path 前提全部收口为「路径标识 + 索引 + core 驱动 fs」；INTERFACE-NAME 记入最终定稿（随 Plan 01–11 落地）
- [Phase 02.1]: 02.1-13: TableEmptyMode 落 table/types.ts（叶子模块）而非 tablePanel.ts，避免 tablePanel → TableGrid → TableEmptyColumn → tablePanel 环依赖
- [Phase 02.1]: 02.1-13: ITablePanelViewState 追加四个空栏字段全部可选（emptyMode/pickerDirectory/pickerEntries/pickerError），既有 publish / publishCommentStrip / createColumn 零改动即通过类型检查
- [Phase 02.1]: 02.1-13: ITablePickerProps.onSelect 保持 required——打开/删除两组件唯一差异是 presets 是否传入，删除态由 TableEmptyColumn 传空操作满足契约
- [Phase 02.1]: 02.1-14: 两个可复用组件落地——TablePicker 无自身状态、纯 props 驱动，打开态与删除态唯一差异是 presets 是否传入（onSelect 必填，删除态由 Plan 15 传空操作）
- [Phase 02.1]: 02.1-14: 文件行仅经 isTableDataPath 放行、预设区仅在 presets 非空时渲染；TableCreateForm 只回调 name.trim()，合法性 / 拼路径留 Plan 15 面板侧
- [Phase 02.1]: 02.1-14: 两组件复用 Plan 09 的 .etable-list* 类名与 table-list-* data-test-id 前缀，降低 Plan 17 测试迁移面
- [Phase 02.1]: 02.1-15: 空栏内联承载——TableColumn 在 NoTarget 渲染 TableEmptyColumn（三按钮 + 打开/新建/删除内联态），不再渲染 TableGrid 未设目标态；TableGrid.renderState 删除 NoTarget 分支（枚举成员保留）
- [Phase 02.1]: 02.1-15: TablePanel.publish 在 target===null 时经对象展开一并发布 emptyMode/pickerDirectory/pickerEntries/pickerError（store.setState 为整体替换语义）；TablePanel.closeColumn 复位 emptyMode=Buttons/directory=''/entries=[]/pickerError，deleteFromColumn 后保持 Delete（连续删除）
- [Phase 02.1]: 02.1-15: 删除态向 TablePicker 传模块级空操作 ignoreSelect 满足 required 的 onSelect、不传 presets；删除二次确认用组件本地受控 antd Modal（table-list-delete-confirm/cancel）
- [Phase 02.1]: 02.1-15: 移除独立列表面板（tableListPanel/tableListPanelType/TableListPanelView）；INITIAL_TABLE_DATA_TEXT/INITIAL_TABLE_SCHEMA_TEXT/joinPath/tableBaseName 迁入 tablePanel.ts（名字与 export 不变）；TablePanel.getTitle 多表为「表格 {a} {b}」
- [Phase 02.1]: 02.1-17: Plan 15 已先做掉删除 tableList.test.tsx 与迁移 openNewDelete.uat.test.tsx，本计划只做剩余部分（新建 tableEmptyColumn.test.tsx + 迁移 layout/tracer/openParam/closeColumn）——计划 scope delta 记入 SUMMARY
- [Phase 02.1]: 02.1-17: 空栏相关断言统一限定到单栏（container.querySelectorAll('.etable-column')[i]），避免加宽窗口铺出多栏时同 data-test-id / 文案重复命中
- [Phase 02.1]: 02.1-17: 打开 / 新建「开进本栏」断言外壳标签数不变；逐张操作前以本栏 ✕ 关栏复位三按钮（TablePanel.closeColumn），使单表 getTitle 断言始终成立
- [Phase 02.1]: 02.1-17: 删除态「无预设区」以注入预设但断言其不出现落地；新建态「开进本栏」以 getTitle==='表格 hero.json' + 本栏无三按钮落地（新表 schema 为空、无行树）
- [Phase 02.1]: 02.1-16: 开发宿主去掉「打开表格」工具栏入口与 tableListPanelType 注册，删除 openTableDemoPanel / TABLE_DEMO_MENU_ID / TABLE_DEMO_MENU_TITLE；e2e 迁到表格面板空栏内联流程（预设开进本栏、✕ 关栏回三按钮、新建前导航进 tables、删除二次确认）
- [Phase 02.1]: 02.1-18: 合规 .jsonc 样本前缀逐字往返以 parseTableText(样本常量).prefix 作期望值——测试不硬编码前缀字符串，样本与断言同源
- [Phase 02.1]: 02.1-18: 非合规样本为两行中文注释 + 尾逗号、无标记行（严格 JSON.parse 失败、json5 可解析 → NeedsCommentStrip）；两样本共用 TABLE_DEMO_SAMPLE_SCHEMA（title/level + x-order）
- [Phase 02.1]: 02.1-18: 确认剥离注释后写回原文不含注释，以 JSON.parse 成功 + title 为改后值断言；取消后该栏落 NoTarget + emptyMode=Buttons（空栏三按钮）
- [Phase 02.1]: 02.1-19: 缺口 G-02.1-3 五处接口面（ITablePanel.save? / ITablePanelViewState.unsaved? / 视图与工具栏 onSave? / TableCreateForm entries?+onNavigate?）只声明不实现，零行为改动
- [Phase 02.1]: 02.1-19: 新增接口成员一律可选（optional）——TablePanel.save 实现留 Plan 20，写成必选会令既有 TablePanel 立即 TS2420 失败
- [Phase 02.1]: 02.1-20: 表格面板改手动保存——commitValue/addItem/deleteItem/openCurrentViewInCodeEditor/applyUndoRedo 只改内存 + 置 unsaved（必要时 unsavedSchema）+ 登记撤销 + applyData；refreshDependents 移到 TablePanel.save 成功后
- [Phase 02.1]: 02.1-20: 注释剥离记忆以「路径 → 确认时原文」记录（stripConfirmed），TablePanel.refresh 命中且原文逐字未变才免弹框，原文变化即重弹
- [Phase 02.1]: 02.1-20: TablePanel.flushColumn 写成异步方法（同步前缀完成快照与清标记），void 调用先于 setTable/closeColumn 的目标切换，既保快照又不引入函数内局部函数
- [Phase 02.1]: 02.1-20: 列表实时同步复用既有 IEditorPanel.onUpdateResource 通道（TablePanel.onUpdateResource→refreshAwaitingPickers），未新增 editor-core 接口（D-04 锁定）
- [Phase 02.1]: 02.1-21: 既有表格测试迁到手动保存——读回资源前补 TablePanel.save（本地辅助 savePanel(panel) 或按栏号直调）；撤销/重做只改内存故读回前也先保存
- [Phase 02.1]: 02.1-21: 「添加成功」等面板级内存态提示断言保留在保存之前（保存会把提示改为「已保存」），其余资源读回断言在保存之后
- [Phase 02.1]: 02.1-21: panelSync 同面板同步断言改到 TablePanel.save(栏号) 之后（refreshDependents 已移到保存成功路径）
- [Phase 02.1]: 02.1-22: 新建表单目录区在 entries / onNavigate 缺省时返回 null 不渲染，保持对既有仅传 directory 的调用点向后兼容
- [Phase 02.1]: 02.1-22: renderDirectoryRow / renderCurrentDirectory 为 TableCreateForm.tsx 模块级自由函数，类名 / data-test-id 沿用表格浏览器惯例（etable-list-entry etable-list-directory、table-list-entry-<path>、table-list-up）
- [Phase 02.1]: 02.1-22: 空栏三按钮 size 由 small 改 middle（更大），断言「不带 ant-btn-sm」作为「已由 small 改回 middle」的可失败代理；.etable-empty-actions 改竖列
- [Phase 02.1]: 02.1-22: TablePanel.setEmptyMode 把进入 Create 态纳入 TablePanel.refreshPicker（与 Open/Delete 一致），未改 refreshAwaitingPickers 的 Open/Delete 范围
- [Phase 02.1]: 02.1-23: 工具栏两个低频动作（编辑 Schema / 在代码编辑器中打开）收进一个 antd Dropdown（触发按钮 table-more），菜单项 data-test-id 落在 label 节点、菜单级 onClick 按 key 分发；disabled 由菜单项自身体现（aria-disabled）
- [Phase 02.1]: 02.1-23: 「不显示 / 隐藏」类断言必须先展开下拉再断言菜单项不存在（下拉关闭时菜单项本就不在 DOM，直接断言会永真），并以常驻的 table-open-code 存在性确认菜单确已展开
- [Phase 02.1]: 02.1-23: layout / closeColumn 的位置参照由已收进下拉的菜单项换成常驻的 table-more 触发按钮，位置关系语义逐字保留
- [Phase 02.1]: 02.1-23: editor-core vitest 开启 css: true（否则 ?inline 返回空串、样式断言无法成立）；重量级 integration 用例超时放宽到 20s（并行争用临界超时，HEAD 亦同）
- [Phase 02.1]: [Phase 02.1]: 02.1-24: 开发宿主表格 e2e 迁到新交互——工具栏两个动作改经 table-more 下拉、新建在新建表单里进入 tables 目录选位置、读回资源前补一次保存（手动保存模型）
- [Phase 02.1]: [Phase 02.1]: 02.1-24: 开发宿主 .jsonc e2e 用捕获的面板实例驱动 TablePanel.onSwitchIn（复用 tablePanelType.create 以应用打开参数 target），断言外部改写回原文后再次切入不再弹确认框且内容仍在（只提示一次）
- [Phase 02.1]: [Phase 02.1]: 02.1-24: 再次切入复用 IEditorPanel.onSwitchIn（接口成员）而非把面板强转成 TablePanel，避免 as 断言并贴合 e2e 的真实切换语义
- [Phase 02.1]: DevCodeEditorProvider 复用既有 ICodeEditorOpener / ITableCapabilitiesProviderProps，类型面零新增；用 JSX（antd Modal 的 data-test-id 无法经 createElement 表达）
- [Phase 02.1]: 缺口收口 G-02.1-5：把 TableCreateForm 的确认入口移到新建视图顶部（Fragment 子元素顺序 control, location, error），配两层可失败 DOM 顺序断言；不改任何对外契约。
- [Phase 4]: IEditorPanel.onBeforeClose 语义按用户确认定稿：true 允许关闭 / false 取消；仅用户主动点 ✕ 时询问，先激活目标标签；释放编辑器、注销类型、内部关闭实例永不询问 — one-way 跨包接口，行为由 04-15 落地
- [Phase 4]: 地图写路径统一形状：线 / 矩形 / 填充 / 擦除 / 粘贴 / 清空都输出 IPaintWrite[]，越界裁剪只由 clampRectToMap 负责
- [Phase 4]: 图案平铺按图案宽高取模、相位由锚点决定（矩形传角点、填充传点击格），不依赖编号连续

### Pending Todos

None yet.

### Blockers/Concerns

- 旧 `@motajs/editor` 仍与 mota-js 文件格式深度耦合；`editor-impl` 成为默认实现后，`@motajs/editor` 需改为调用 core/impl 并自行承担引擎适配（对外行为保持不变）。
- 各能力阶段的 schema / 端口设计尚未展开，由对应阶段的 discuss/plan 时确定，本 roadmap 不预设。

### Roadmap Evolution

- Phase 1 edited: renamed phase 1 to 编辑器外壳 (shell-focused)
- Phase 1.1 inserted after Phase 1: 编辑器开发宿主（最小可运行整合，用于验证 editor-core/editor-impl） (URGENT)
- Phase 02.1 inserted after Phase 2: 资源层重构与表格文件管理 (URGENT)

## Deferred Items

Items acknowledged and deferred at milestone close, most recent first:

| Category | Item | Status | Deferred At | Milestone |
|----------|------|--------|-------------|-----------|
| *(none)* | | | | |

## Session Continuity

Last session: 2026-10-21T08:32:01.446Z
Stopped at: Completed 04-05-PLAN.md
Resume file: None
