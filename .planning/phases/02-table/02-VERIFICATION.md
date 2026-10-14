---
phase: 02-table
verified: 2026-10-14T06:15:00Z
status: human_needed
score: 9/10 must-haves verified
covered_files:
  - .planning/REQUIREMENTS.md
  - .planning/phases/02-table/02-02-PLAN.md
  - .planning/phases/02-table/02-02-SUMMARY.md
  - .planning/phases/02-table/02-03-PLAN.md
  - .planning/phases/02-table/02-03-SUMMARY.md
  - .planning/phases/02-table/02-04-PLAN.md
  - .planning/phases/02-table/02-04-SUMMARY.md
  - .planning/phases/02-table/02-05-PLAN.md
  - .planning/phases/02-table/02-05-SUMMARY.md
  - .planning/phases/02-table/02-06-PLAN.md
  - .planning/phases/02-table/02-06-SUMMARY.md
  - .planning/phases/02-table/02-07-PLAN.md
  - .planning/phases/02-table/02-07-SUMMARY.md
  - .planning/phases/02-table/02-08-PLAN.md
  - .planning/phases/02-table/02-08-SUMMARY.md
  - .planning/phases/02-table/02-09-PLAN.md
  - .planning/phases/02-table/02-09-SUMMARY.md
  - .planning/phases/02-table/02-10-PLAN.md
  - .planning/phases/02-table/02-10-SUMMARY.md
  - .planning/phases/02-table/02-11-PLAN.md
  - .planning/phases/02-table/02-11-SUMMARY.md
  - .planning/phases/02-table/02-12-PLAN.md
  - .planning/phases/02-table/02-12-SUMMARY.md
  - .planning/phases/02-table/02-13-PLAN.md
  - .planning/phases/02-table/02-13-SUMMARY.md
  - .planning/phases/02-table/02-14-PLAN.md
  - .planning/phases/02-table/02-14-SUMMARY.md
  - .planning/phases/02-table/02-15-PLAN.md
  - .planning/phases/02-table/02-15-SUMMARY.md
  - .planning/phases/02-table/02-16-PLAN.md
  - .planning/phases/02-table/02-16-SUMMARY.md
  - .planning/phases/02-table/02-17-PLAN.md
  - .planning/phases/02-table/02-17-SUMMARY.md
  - .planning/phases/02-table/02-18-PLAN.md
  - .planning/phases/02-table/02-18-SUMMARY.md
  - .planning/phases/02-table/02-19-PLAN.md
  - .planning/phases/02-table/02-19-SUMMARY.md
  - .planning/phases/02-table/02-20-PLAN.md
  - .planning/phases/02-table/02-20-SUMMARY.md
  - .planning/phases/02-table/02-21-PLAN.md
  - .planning/phases/02-table/02-21-SUMMARY.md
  - .planning/phases/02-table/02-22-PLAN.md
  - .planning/phases/02-table/02-22-SUMMARY.md
  - .planning/phases/02-table/02-23-PLAN.md
  - .planning/phases/02-table/02-23-SUMMARY.md
  - .planning/phases/02-table/02-CONTEXT.md
  - .planning/phases/02-table/02-UAT.md
  - .planning/phases/02-table/02-VALIDATION.md
  - .planning/phases/02-table/INTERFACE-NAME.md
  - .planning/phases/02-table/deferred-items.md
  - packages/apps/editor-dev/package.json
  - packages/apps/editor-dev/src/__tests__/devHostTable.test.tsx
  - packages/apps/editor-dev/src/__tests__/mapPolyfill.ts
  - packages/apps/editor-dev/src/demo/devMenu.ts
  - packages/apps/editor-dev/src/demo/tableDemo.ts
  - packages/apps/editor-dev/src/main.tsx
  - packages/libs/editor-core/src/panel/types.ts
  - packages/libs/editor-core/src/shell/__tests__/shellOpenParam.test.ts
  - packages/libs/editor-core/src/shell/__tests__/shellTitle.test.ts
  - packages/libs/editor-core/src/shell/__tests__/shellUndoShortcut.test.ts
  - packages/libs/editor-core/src/shell/shellSystem.ts
  - packages/libs/editor-core/src/shell/types.ts
  - packages/libs/editor-impl/src/__tests__/mapPolyfill.ts
  - packages/libs/editor-impl/src/table/__tests__/addFlow.uat.test.tsx
  - packages/libs/editor-impl/src/table/__tests__/behaviour.uat.test.tsx
  - packages/libs/editor-impl/src/table/__tests__/edit.test.tsx
  - packages/libs/editor-impl/src/table/__tests__/indent.uat.test.tsx
  - packages/libs/editor-impl/src/table/__tests__/integration.test.tsx
  - packages/libs/editor-impl/src/table/__tests__/interaction.uat.test.tsx
  - packages/libs/editor-impl/src/table/__tests__/layout.uat.test.tsx
  - packages/libs/editor-impl/src/table/__tests__/openParam.test.tsx
  - packages/libs/editor-impl/src/table/__tests__/tracer.test.tsx
  - packages/libs/editor-impl/src/table/components/GapRow.tsx
  - packages/libs/editor-impl/src/table/components/TableGrid.tsx
  - packages/libs/editor-impl/src/table/components/TableRow.tsx
  - packages/libs/editor-impl/src/table/components/TableToolbar.tsx
  - packages/libs/editor-impl/src/table/components/inputs/NumberInput.tsx
  - packages/libs/editor-impl/src/table/components/inputs/TextareaInput.tsx
  - packages/libs/editor-impl/src/table/components/inputs/index.ts
  - packages/libs/editor-impl/src/table/model/fieldPath.ts
  - packages/libs/editor-impl/src/table/model/traversal.ts
  - packages/libs/editor-impl/src/table/table.css
  - packages/libs/editor-impl/src/table/tablePanel.ts
  - packages/libs/editor-impl/src/table/tablePanelType.ts
  - packages/libs/editor-impl/src/table/types.ts
covered_digest: "v1:sha256:36c94ded86c6dbdb3cd374e56ccddc4db552366e1d9120224ab17baa061166bb"
behavior_unverified: 0
overrides_applied: 0
re_verification:
  previous_status: gaps_found
  previous_score: 7/9
  gaps_closed:
    - "开发宿主须持续接入：把 Phase 2 表格能力接入 packages/apps/editor-dev，可在浏览器里被打开与手动验收"
  gaps_remaining: []
  regressions: []
advisory:
  - finding: "失效门禁 implExports.js / coreExports.js 仍以退出码 1 报告（多副本 react/react-dom/antd realpath；sideEffects 非 false；缺已归档 subpathStatus.json）"
    category: architectural
    reason: "02-VALIDATION.md 已明确将二者列为『失效门禁、不作阶段门禁』（引用已归档里程碑产物）。它们提示 editor-impl 侧潜在的双 React 解析，建议后续包边界 / 版本对齐阶段以 catalog pin 或 overrides 收敛后重跑。"
    evidence_status: "none provided"
human_verification:
  - test: "在 editor-dev 里点「打开表格」，目视表格画面与旧 @motajs/editor 表格是否对齐（约 500px 栏宽、栏间/行间分割线、窄于总宽不横向滚动、行悬停高亮、四列 2:2:4:1、行高约 1.3×）"
    expected: "整体与现状一致（允许为适配 JSON Schema 做必要微调，D-27）"
    why_human: "布局 / 滚动 / 悬停依赖真实浏览器渲染；jsdom 不做布局计算，editor-impl 无独立运行壳"
  - test: "运行 pnpm --filter @motajs/editor-dev dev，打开 http://127.0.0.1:1056，点「打开表格」，观察约 100 行、表体纵向滚动、顶部「撤销」「重做」按钮"
    expected: "菜单可打开表格面板；约 100 行渲染；表体可上下滚动；点「撤销」可还原一次改值编辑"
    why_human: "02-13 Task 3 的浏览器人工验收尚未由人确认；真实滚动高度与观感需目视"
  - test: "schema 模式观感：打开 table#schema.demo（经「编辑 Schema」），观察 schema 提示条、工具栏、成对关键字行"
    expected: "外观合理、与数据视图区分清晰；提示条单行 muted、窄面板省略号截断"
    why_human: "视觉呈现需目视"
  - test: "弹窗外观与「独立面板切走即关」行为（多选 / 坐标弹窗；代码 / 事件字段打开独立面板后切走自动关闭）"
    expected: "符合 D-11…D-14；列表滚动、页脚固定、长标签省略号 + title"
    why_human: "需真实外壳（标签页）与弹窗挂载；真实代码 / 事件编辑器由 Phase 5/6 提供"
  - test: "D-30「在代码编辑器中打开」的真实集成与写回观感"
    expected: "数据视图→数据文件、schema 视图→schema 文件；整份替换经统一撤销记一次操作"
    why_human: "真实代码编辑器能力由宿主 / 后续阶段（Phase 5）提供"
  - test: "真实浏览器里按 Ctrl/Cmd+Z 走编辑器统一撤销而非浏览器原生撤销（02-19）"
    expected: "命中时 preventDefault，原生撤销被拦下"
    why_human: "jsdom 不执行浏览器原生撤销，只能用 event.defaultPrevented 作代理断言"
---

# Phase 2: 表格编辑 Verification Report

**Phase Goal:** 用户可编辑 schema 驱动的表格数据；默认实现落在 `editor-impl`。
**Requirement:** TABLE-01「用户可编辑 schema 驱动的表格数据」
**Verified:** 2026-10-14T06:15:00Z
**Status:** human_needed
**Re-verification:** Yes — after gap closure（上一版为 `gaps_found`，唯一 BLOCKER 为开发宿主接入缺失）

> 说明：本次为**目标回推**验收——从 ROADMAP 的 Phase 2 目标 + 4 条 Success Criteria + TABLE-01 + §Cross-cutting Constraints（开发宿主须持续接入）出发，而非「任务是否做完」。SUMMARY.md 的说法一律当作待证主张，以代码 + 真实命令退出码为准。上一版验收（commit `5ce6211`）判定 `gaps_found`：表格能力本身已交付，但**未接入开发宿主**。本次复核 02-11…02-23 的改动是否关闭该缺口。

---

## Goal Achievement

### Observable Truths

| #   | Truth | Status | Evidence |
| --- | ----- | ------ | -------- |
| T1 | 用户可打开表格视图并查看 schema 驱动的项目数据（SC1） | ✓ VERIFIED | `tablePanelType`（`tablePanelType.ts`）经 `ShellSystem.registerPanelType` 注册；`TablePanel.setTable` + `refresh()` 经资源层读 `table.<name>` / `table#schema.<name>`（`tablePanel.ts:663,810,844`）；`buildTableTree` 按 `properties` + `x-order` 递归成行；`tracer.test.tsx` / `openParam.test.tsx` / `integration.test.tsx` / dev-host 端到端测试全绿 |
| T2 | 用户可新增 / 修改 / 删除表格行，改动即时反映（SC2） | ✓ VERIFIED | `commitValue` / `addItem` / `deleteItem` 写资源后立即重算视图（`tablePanel.ts`）；`edit.test.tsx`、`interaction.uat.test.tsx`、`addFlow.uat.test.tsx`、`integration.test.tsx` 断言写回与显示 |
| T3 | 表格编辑经统一命令 / 撤销路径，可撤销、可重做（SC3） | ✓ VERIFIED | 每处变更走 `context.addUndoContext`（`tablePanel.ts` 5 处）→ `UndoSystem`；`TablePanel.undo/redo` 经 `computeState` 还原；`undo.test.ts` + `integration.test.tsx` 三步撤销/重做 + dev-host 端到端撤销改值（`devHostTable.test.tsx:217`）+ 外壳全局快捷键（`shellUndoShortcut.test.ts`，02-19） |
| T4 | 表格数据经统一层（`editor-core` 资源层）读写，不使用通用 fs 接口（SC4 机制，D-03） | ✓ VERIFIED | 读写全经 `context.requestResource` / `resource.write`（`tablePanel.ts`）；`table/**` 中 `IEditorFileSystem` 引用 **0** 处；`coreFsSurface.js` 门禁退出 0 |
| T5 | 表格「行为 / 画面与现状一致」（SC4 对齐要求；PROJECT.md「对外功能/UI 必须保持现状」） | ? UNCERTAIN → 人工项 | 仅能由真实宿主的目视 / 交互验收判定；jsdom 不断言布局（列宽/分割线/横向滚动/hover/行高比例）。**属人工项**，见下节 |
| T6 | 外壳在活动面板变化时调用 `onSwitchIn` / `onSwitchOut`；标签按实例标题（02-05 / 02-17） | ✓ VERIFIED | `shellSystem.ts` 的 `syncActiveInstance` / `invokeSwitchIn` / `invokeSwitchOut`（含抛错隔离）+ `resolveTabName` 读 `IEditorPanel.getTitle?.()`；`shellSwitch.test.ts`、`shellTitle.test.ts`、`integration.test.tsx` 全绿 |
| T7 | 字段名 / 注释 / 值中的脚本样文本以字面文本渲染（XSS 回归守卫） | ✓ VERIFIED | 组件一律用 React 文本节点；`table/**` 与 `editor-dev/src` 中 `dangerouslySetInnerHTML` **0** 处；`integration.test.tsx` 断言 `querySelector('img'\|'script')` 为空 |
| T8 | `table#schema.<name>` 一律按标准 JSON Schema 处理；`x-editor` / `x-control` 扩展键；外部编辑器按 `x-editor` 分发 | ✓ VERIFIED | `types.ts`（`ITableSchemaNode` 基于 `json-schema-typed` + `x-order`）；`control.ts` 标准关键字推导 + `x-control` 兜底；`TableRow.tsx` 按 `x-editor` 路由；`externalEditor.test.tsx`、`openParam.test.tsx` 全绿 |
| T9 | 生效门禁与测试基线全绿（`editor-impl` / `editor-core` / `editor-dev` test + typecheck + 4 个生效门禁） | ✓ VERIFIED | 见下方 Behavioral Spot-Checks：impl 16 文件/123 用例、core 9 文件/70 用例、dev 12 用例；三处 typecheck 退出 0；四门禁退出 0 |
| T10 | **开发宿主须持续接入**：能力接入 `packages/apps/editor-dev`，可在浏览器打开验收（ROADMAP §Cross-cutting Constraints） | ✓ VERIFIED（此前 FAILED，本次关闭） | `editor-dev/package.json:14` 声明 `@motajs/editor-impl`；`main.tsx:26` `registerPanelType(tablePanelType)`、`main.tsx:22-24` seed `table.demo` / `table#schema.demo`、`main.tsx:27-33` 注册「打开表格」菜单、`main.tsx:39-41` 用 `CapabilityProvider` 注入 `createTablePanelOpener`；`devHostTable.test.tsx` 9 用例全绿；`git log -- packages/apps/editor-dev` 显示 02-13/02-16/02-23 均已改动 |

**Score:** 9/10 truths verified（T5 为目视 / 交互人工项；无 FAILED）

> 关于 SC4：「经统一层读写」（TABLE-01 的机制性要求，与锁定决策 D-03 一致）已由 T4 证实；其「行为与现状一致」的对齐部分是目视项（T5），计入人工验收。二者合计构成 SC4。
>
> 关于 T10（本次关闭的缺口）：上一版判定其为 FAILED 的三条代码证据——未声明依赖、未注册面板类型、未 seed 资源——**均已消除**；且 02-16 进一步实现了 `ITablePanelOpener`（「编辑 Schema」可用）、02-19 把全局撤销快捷键绑进外壳、02-23 把演示数据扩到约 100 条并加了「撤销/重做」按钮。`02-13-SUMMARY.md` 的 `status: halted` 仅停在其 Task 3（浏览器人工验收 checkpoint），Task 1–2 的接线已提交并通过端到端测试；后续计划已在其基础上继续，故该 `halted` 不构成交付缺口（详见下节）。

### Deferred Items

未发现被后续 ROADMAP 阶段明确承接的缺口：Phase 3–6 分别覆盖素材 / 地图 / 代码 / 事件，**没有任何后续阶段的 goal / 成功标准**覆盖「表格视觉对齐」或「表格能力的宿主接入」。故 T5 保留为人工项，不作 deferred。

### Advisory (New Scope, Unevidenced)

| # | Finding | Category | Why Advisory |
|---|---------|----------|--------------|
| 1 | `scripts/verify/implExports.js` 与 `coreExports.js` 仍退出 1（`react` / `react-dom` / `antd` 各解析到两个 `realpath`；`sideEffects` 非 `false`；缺已归档 `subpathStatus.json`） | architectural | `02-VALIDATION.md` 明确列为『失效门禁、不作阶段门禁』（引用已归档里程碑产物）。它提示 `editor-impl` 侧潜在双 React 解析，建议后续包边界 / 版本对齐阶段以 catalog pin 或 overrides 收敛后重跑。非本阶段阻塞。 |

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | -------- | ------ | ------- |
| `packages/libs/editor-impl/src/table/tablePanel.ts` | `TablePanel implements IEditorPanel + ITablePanel`，经资源层读写、记撤销、多栏 | ✓ VERIFIED | ~880 行；`commitValue/addItem/deleteItem/undo/redo/refresh/openSchemaPanel` 等；5 处 `addUndoContext`；`getTitle()` |
| `packages/libs/editor-impl/src/table/tablePanelType.ts` | 可注册面板类型（id/name/icon/factory）+ openParam 收窄 | ✓ VERIFIED | `tablePanelType` 常量；`create` 读 `param.openParam.target` 并 `setTable`（02-12） |
| `packages/libs/editor-impl/src/table/model/traversal.ts` | schema(properties + x-order)+data → 行树（递归） | ✓ VERIFIED | 递归 `buildRows`，`x-order` 同级排序 |
| `packages/libs/editor-impl/src/table/model/fieldPath.ts` | 字段路径助手 + `insertAfterFieldPath` | ✓ VERIFIED | 02-18 新增锚点插入助手 |
| `packages/libs/editor-impl/src/table/model/validation.ts` | `validateId` + ajv `validateValue` | ✓ VERIFIED | ajv Draft 2020-12；无表达式求值 |
| `packages/libs/editor-impl/src/table/components/TableGrid.tsx` | 四栏网格 + 状态视图 + 工具栏 + gutter | ✓ VERIFIED | 常驻 gutter、`GutterButton`、浮层式名称输入（02-22） |
| `packages/libs/editor-impl/src/table/components/TableRow.tsx` | 叶子行：值控件映射 / 校验 / 双击分发 / 操作列 | ✓ VERIFIED | 数字字段走 `NumberInput`（02-15） |
| `packages/libs/editor-impl/src/table/components/inputs/NumberInput.tsx` | 数字行内控件（antd InputNumber） | ✓ VERIFIED | 02-15 新增 |
| `packages/libs/editor-impl/src/react/capabilities.ts` | 注入式能力接缝（6 个可缺省打开器） | ✓ VERIFIED | `react` 不导入 `table` |
| `packages/libs/editor-core/src/shell/shellSystem.ts` | 切换调 `onSwitchIn/Out` + 全局撤销快捷键 + 实例标题 | ✓ VERIFIED | 02-05 / 02-17 / 02-19 叠加；`shellSwitch` / `shellTitle` / `shellUndoShortcut` 测试全绿 |
| `packages/apps/editor-dev/src/main.tsx` | **注册表格面板类型 + seed 表格资源 + 注入打开器** | ✓ VERIFIED（此前 MISSING） | 依赖已加、面板类型已注册、资源已 seed、菜单已注册、`CapabilityProvider` 已注入打开器（T10） |
| `packages/apps/editor-dev/src/demo/tableDemo.ts` | 演示表 seed + 菜单常量 + `openTableDemoPanel` + `createTablePanelOpener` | ✓ VERIFIED | 约 100 字段数据/schema 生成器（02-23） |
| `packages/apps/editor-dev/src/demo/devMenu.ts` | dev 宿主「撤销 / 重做」顶层菜单 | ✓ VERIFIED | 02-23 新增，调 `core.undoSystem` |

### Key Link Verification

| From | To | Via | Status | Details |
| ---- | -- | --- | ------ | ------- |
| `tablePanelType.create` | `ShellSystem.registerPanelType` / `createInstance` | Phase 1 注册 + 工厂契约 | WIRED | `shellSystem.ts`；`tracer.test.tsx` 端到端开面板 |
| `TablePanel.setTable(target)` | `context.requestResource(table.<name> / table#schema.<name>)` | 资源层（D-03/D-04） | WIRED | `tablePanel.ts:663,810,844` |
| `TablePanel.render()` | 外壳 `PanelHost` | 返回的 FC 被外壳挂载 | WIRED | `shellSystem.ts`；`tablePanel.ts` |
| `commitValue/addItem/deleteItem` | `context.addUndoContext(this, …)` | 统一撤销路径（D-09） | WIRED | `tablePanel.ts` 5 处 → `UndoSystem` |
| `TableRow` 值提交 | `inferControlKind` + 输入控件（含 `NumberInput`） | 控件映射（02-06 / 02-15） | WIRED | `TableRow.tsx`；`inputs.test.tsx`、`behaviour.uat.test.tsx` |
| 操作列「编辑」/「编辑 Schema」 | `ITableEditorCapabilities` 各打开器 | 注入接缝（02-03 / 02-16） | WIRED | `TableRow.tsx`；`externalEditor.test.tsx`、dev-host 端到端 |
| `onSwitchIn` | 资源层重新请求 + 重算 | D-15 修订版 / D-31 | WIRED | `tablePanel.ts`；`shellSwitch.test.ts` |
| **`main.tsx` 组合根** | **`tablePanelType` → 外壳 + `CapabilityProvider` 打开器** | **开发宿主接入（前次要求）** | **WIRED（此前 NOT_WIRED）** | `main.tsx:19-42`；`devHostTable.test.tsx` 9 用例 |
| `registerDevMenu(main.tsx)` | `core.undoSystem.undo()` / `redo()` | dev 宿主撤销 / 重做入口（02-23） | WIRED | `devMenu.ts`；`devHostTable.test.tsx` 点击触发用例 |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| -------- | ------------- | ------ | ------------------ | ------ |
| `TablePanel` | `data` / `schema` | `context.requestResource(...).request()` → `ResourceSystem.readContent` → 注入的 `IResourceInjection` / dev 宿主 `MemoryBackend` | 是（生产路径指向注入后端；测试用 Fake / `MemoryBackend`） | ✓ FLOWING |
| `TablePanelView` | `view.rows` | `buildTableTree(schema, data)` | 是 | ✓ FLOWING |
| dev 宿主演示表 | `TABLE_DEMO_DATA` / `TABLE_DEMO_SCHEMA` | `createTableDemoData(100)` / `createTableDemoSchema(100)` seed 进 `MemoryBackend` | 是（约 100 行可渲染） | ✓ FLOWING |
| 弹窗候选项 | `row.config.items.enum` | schema 节点 | 是 | ✓ FLOWING |

> 注入后端在生命周期末期由宿主提供（`@motajs/editor` / SW）；本阶段不在范围内。构件本身无「静态兜底 / 硬编码字面量」冒充数据。

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| editor-core 测试全绿 | `pnpm --filter @motajs/editor-core test` | 9 文件 / 70 用例通过，退出 0 | ✓ PASS |
| editor-core 类型检查 | `pnpm --filter @motajs/editor-core typecheck` | `tsc -b` 退出 0 | ✓ PASS |
| editor-impl 测试全绿 | `pnpm --filter @motajs/editor-impl test` | 16 文件 / 123 用例通过，退出 0 | ✓ PASS |
| editor-impl 类型检查 | `pnpm --filter @motajs/editor-impl typecheck` | `tsc -b` 退出 0 | ✓ PASS |
| editor-dev 测试全绿 | `pnpm --filter @motajs/editor-dev test` | 2 文件 / 12 用例通过，退出 0（隔离串行复跑 5 次均 12/12；见下注） | ✓ PASS |
| editor-dev 类型检查 | `pnpm --filter @motajs/editor-dev typecheck` | `tsc -b` 退出 0 | ✓ PASS |
| import type 门禁 | `node scripts/verify/coreImportType.js` | 退出 0（真实树 90 文件 0 违规） | ✓ PASS |
| 引擎中性门禁 | `node scripts/verify/coreEngineNeutral.js` | 退出 0（62 生产文件 0 违规） | ✓ PASS |
| 模块状态 / PORT-02 门禁 | `node scripts/verify/coreModuleState.js` | 退出 0 | ✓ PASS |
| 通用 fs 面门禁 | `node scripts/verify/coreFsSurface.js` | 退出 0（`IEditorFileSystem` 仅声明文件命中） | ✓ PASS |
| 开发宿主启动并注册表格面板 | `pnpm --filter @motajs/editor-dev dev`（浏览器） | **代码已接线、端到端测试绿；浏览器观感未由人确认** | ? 人工 |

> **关于 editor-dev 首次运行的 1 条失败：** 首轮 `editor-dev test` 曾报 `1 failed | 11 passed`；该轮与 `editor-impl test`（导入耗时 380s）**并行**执行。隔离串行复跑 **5 次均 12/12 通过**，判为并行资源竞争的偶发，非代码缺陷；后续人工验收时按隔离串行命令跑。

### Probe Execution

未发现本阶段声明或约定的探针脚本（`scripts/*/tests/probe-*.sh` 不存在；PLAN/SUMMARY 未声明 probe）。Step 7c: SKIPPED。

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| ----------- | ----------- | ----------- | ------ | -------- |
| TABLE-01 | 02-02…02-23 | 用户可编辑 schema 驱动的表格数据 | ✓ SATISFIED（机制 + 宿主接入）；对齐为人工 | 四栏编辑 / 增删 / 统一撤销 / 资源层读写均已证（T1–T4、T6–T9）；ROADMAP §Cross-cutting Constraints 的「接入开发宿主」本次已证（T10）。余「与现状视觉/交互对齐」为人工项（T5） |

> 无孤儿需求：本阶段仅映射 TABLE-01。REQUIREMENTS.md 已把 TABLE-01 标为 Complete——本次验收支持该结论（机制与宿主接入均已交付，仅余目视对齐的人工验收）。

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| （本阶段新增源码） | — | `TBD` / `FIXME` / `XXX` / `HACK` / `PLACEHOLDER` / `TODO` | ℹ️ 无 | `editor-impl/src/table`、`editor-dev/src`、`editor-core/src/shell` 扫描 0 命中 |
| （占位实现） | — | `return null` / `dangerouslySetInnerHTML` 冒充数据 | ℹ️ 无 | 未见；状态视图均为固定文案 + 明确分支 |
| `packages/apps/editor-dev/package.json` | 14 | 未接入能力阶段产的表格能力（**上一版 BLOCKER**） | ℹ️ 已解除 | 现已声明 `@motajs/editor-impl` 并完成接线（T10） |

### Human Verification Required

1. **表格画面 / 交互与旧表格视觉对齐（T5 / SC4 对齐部分）**
   **Test:** 在 `pnpm --filter @motajs/editor-dev dev`（http://127.0.0.1:1056）里点「打开表格」，观察约 500px 栏宽、栏间与行间分割线、窄于总宽时无横向滚动、行悬停高亮、四列 2:2:4:1、行高约 1.3×。
   **Expected:** 与现状整体一致（允许为适配 JSON Schema 做必要微调，D-27）。
   **Why human:** 布局 / 滚动 / 悬停依赖真实浏览器渲染，jsdom 不做布局。

2. **开发宿主浏览器人工验收（02-13 Task 3 遗留）**
   **Test:** 打开 http://127.0.0.1:1056，点「打开表格」，观察约 100 行渲染、表体纵向滚动、顶部「撤销」「重做」按钮；点「撤销」应还原一次改值编辑。
   **Expected:** 菜单可打开表格面板；约 100 行；表体可滚动；撤销生效。
   **Why human:** 该 checkpoint 尚未由人确认；真实滚动高度与观感需目视。

3. **schema 模式观感（T4/T8）**
   **Test:** 经「编辑 Schema」打开 `table#schema.demo`，观察 schema 提示条（单行 muted、窄面板省略号截断）、工具栏、成对关键字行。
   **Expected:** 外观合理、与数据视图区分清晰。
   **Why human:** 视觉呈现需目视。

4. **弹窗外观与「独立面板切走即关」行为（D-11…D-14）**
   **Test:** 打开多选 / 坐标弹窗；代码 / 事件字段打开独立面板并切走应自动关闭。
   **Expected:** 符合 D-11…D-14。
   **Why human:** 需真实外壳（标签页）与弹窗挂载；真实代码 / 事件编辑器由 Phase 5/6 提供。

5. **D-30「在代码编辑器中打开」的真实集成与写回观感**
   **Test:** 点击工具栏「在代码编辑器中打开」，在真实 Monaco（Phase 5）里编辑并写回。
   **Expected:** 数据视图→数据文件、schema 视图→schema 文件；整份替换经统一撤销记一次操作。
   **Why human:** 真实代码编辑器能力由宿主 / 后续阶段提供。

6. **全局撤销快捷键的真实浏览器行为（02-19）**
   **Test:** 在 dev 宿主里按 Ctrl/Cmd+Z。
   **Expected:** 走编辑器统一撤销、原生撤销被 `preventDefault()` 拦下。
   **Why human:** jsdom 不执行浏览器原生撤销。

### Gaps Summary

上一版的**唯一 BLOCKER**（ROADMAP §Cross-cutting Constraints 的「能力须接入开发宿主」）**已关闭**：`editor-dev` 现声明 `@motajs/editor-impl` 依赖、`main.tsx` 注册 `tablePanelType` 与「打开表格」菜单、seed `table.demo` / `table#schema.demo`、并以 `CapabilityProvider` 注入 `createTablePanelOpener`；`devHostTable.test.tsx` 9 用例端到端全绿；`git log` 证实该包已由 02-13/02-16/02-23 改动。02-16 还让「编辑 Schema」按钮可用、02-19 把全局撤销快捷键绑进外壳、02-23 把演示数据扩到约 100 条并加了「撤销 / 重做」按钮。

**当前无任何必须项 FAILED、无 MISSING / STUB 构件、无 NOT_WIRED 关键链路、无债务标记。** 生效门禁与测试基线全绿：`editor-core` 70、`editor-impl` 123、`editor-dev` 12 用例，三处 typecheck 退出 0，四个生效门禁退出 0。

余下的全部为**人工 / 目视验收项**（T5 及 UAT 中 9 条待验视觉 / 交互项）——这正是 ROADMAP「画面/行为与现状一致」这类无法用 jsdom 断言的验收。故整体判定为 **human_needed**（不再是 `gaps_found`）。

> 说明：`02-13-SUMMARY.md` 的 frontmatter 仍为 `status: halted`（停在其 Task 3 人工验收 checkpoint），ROADMAP 亦显示 Phase 2 为 `21/22 plans executed`。其 Task 1–2 的接线已交付并有测试证据、后续计划已在其上继续，故不影响目标达成；但该 `halted` 状态与浏览器人工验收应在 UAT 中一并确认 / 收尾。

### Deferred Items

未发现被后续 ROADMAP 阶段明确承接的缺口（见上「Deferred Items」小节）。

---

_Verified: 2026-10-14T06:15:00Z_
_Verifier: the agent (gsd-verifier)_
