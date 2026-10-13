---
phase: 02-table
verified: 2026-10-13T06:45:19Z
status: gaps_found
score: 7/9 must-haves verified
covered_files:
  - packages/libs/editor-core/src/shell/shellSystem.ts
  - packages/libs/editor-core/src/shell/__tests__/shellSwitch.test.ts
  - packages/libs/editor-impl/package.json
  - packages/libs/editor-impl/vitest.config.ts
  - packages/libs/editor-impl/src/index.ts
  - packages/libs/editor-impl/src/global.d.ts
  - packages/libs/editor-impl/src/__tests__/mapPolyfill.ts
  - packages/libs/editor-impl/src/react/index.ts
  - packages/libs/editor-impl/src/react/capabilities.ts
  - packages/libs/editor-impl/src/react/capabilitiesContext.ts
  - packages/libs/editor-impl/src/react/types.ts
  - packages/libs/editor-impl/src/react/modal.css
  - packages/libs/editor-impl/src/react/components/index.ts
  - packages/libs/editor-impl/src/react/components/CapabilityProvider.tsx
  - packages/libs/editor-impl/src/react/components/MultiSelectModal.tsx
  - packages/libs/editor-impl/src/react/components/PointPickerModal.tsx
  - packages/libs/editor-impl/src/table/index.ts
  - packages/libs/editor-impl/src/table/types.ts
  - packages/libs/editor-impl/src/table/resourceType.ts
  - packages/libs/editor-impl/src/table/tablePanel.ts
  - packages/libs/editor-impl/src/table/tablePanelType.ts
  - packages/libs/editor-impl/src/table/table.css
  - packages/libs/editor-impl/src/table/model/index.ts
  - packages/libs/editor-impl/src/table/model/traversal.ts
  - packages/libs/editor-impl/src/table/model/schemaPresentation.ts
  - packages/libs/editor-impl/src/table/model/control.ts
  - packages/libs/editor-impl/src/table/model/validation.ts
  - packages/libs/editor-impl/src/table/model/fieldPath.ts
  - packages/libs/editor-impl/src/table/components/index.ts
  - packages/libs/editor-impl/src/table/components/TableGrid.tsx
  - packages/libs/editor-impl/src/table/components/TableRow.tsx
  - packages/libs/editor-impl/src/table/components/TableToolbar.tsx
  - packages/libs/editor-impl/src/table/components/ActionButtons.tsx
  - packages/libs/editor-impl/src/table/components/EditModeSegmented.tsx
  - packages/libs/editor-impl/src/table/components/GapRow.tsx
  - packages/libs/editor-impl/src/table/components/SchemaBanner.tsx
  - packages/libs/editor-impl/src/table/components/inputs/index.ts
  - packages/libs/editor-impl/src/table/components/inputs/TextareaInput.tsx
  - packages/libs/editor-impl/src/table/components/inputs/SelectInput.tsx
  - packages/libs/editor-impl/src/table/components/inputs/CheckboxInput.tsx
  - packages/libs/editor-impl/src/table/components/inputs/CheckboxSet.tsx
  - packages/libs/editor-impl/src/table/components/inputs/ColorInput.tsx
  - packages/libs/editor-impl/src/table/__tests__/fixtures.ts
  - packages/libs/editor-impl/src/table/__tests__/tracer.test.tsx
  - packages/libs/editor-impl/src/table/__tests__/validation.test.ts
  - packages/libs/editor-impl/src/table/__tests__/inputs.test.tsx
  - packages/libs/editor-impl/src/table/__tests__/edit.test.tsx
  - packages/libs/editor-impl/src/table/__tests__/undo.test.ts
  - packages/libs/editor-impl/src/table/__tests__/schemaMode.test.tsx
  - packages/libs/editor-impl/src/table/__tests__/switchRefresh.test.tsx
  - packages/libs/editor-impl/src/table/__tests__/externalEditor.test.tsx
  - packages/libs/editor-impl/src/table/__tests__/modals.test.tsx
  - packages/libs/editor-impl/src/table/__tests__/integration.test.tsx
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
  - .planning/phases/02-table/02-CONTEXT.md
  - .planning/phases/02-table/02-VALIDATION.md
  - .planning/phases/02-table/INTERFACE-NAME.md
  - .planning/phases/02-table/deferred-items.md
  - .planning/REQUIREMENTS.md
covered_digest: "v1:sha256:99b8327f0053efb6e7cc64233c9cef67f4eec82512ec3249a4994d935f609893"
behavior_unverified: 0
overrides_applied: 0
gaps:
  - truth: "每个 editor-impl 能力阶段（Phase 2–6）完成后，必须把该阶段能力接入开发宿主（packages/apps/editor-dev），使其可在浏览器里被打开与手动验收——属各阶段收尾工作之一，不得遗漏（ROADMAP §Cross-cutting Constraints）。"
    status: failed
    reason: "Phase 2 完全没有触碰开发宿主。editor-dev 的 package.json 未声明 @motajs/editor-impl 依赖；main.tsx 只注册了演示面板 DEMO_PANEL_TYPE，既未注册 tablePanelType，内存后端也未 seed 任何表格资源；git 历史显示 packages/apps/editor-dev 自 Phase 1.1（6d7f2d0）之后没有一次改动；02-table 的全部计划/摘要都未提及 editor-dev，仅把目视验收含糊地推给一个并不存在于 ROADMAP 的「后续 @motajs/editor 接入阶段」。因此该能力无法在浏览器里被人工打开与验收。"
    artifacts:
      - path: "packages/apps/editor-dev/package.json"
        issue: "未声明 @motajs/editor-impl 依赖（只有 @motajs/editor-core / react / vite / vitest）"
      - path: "packages/apps/editor-dev/src/main.tsx"
        issue: "顶层仅 core.shellSystem.registerPanelType(DEMO_PANEL_TYPE)，未 import / 注册 tablePanelType"
      - path: "packages/apps/editor-dev/src/backend/memoryBackend.ts"
        issue: "未 seed 任何 `table.<name>` 数据表或 `table#schema.<name>` schema，打开表格面板只会落在「尚未设置目标表」态"
    missing:
      - "在 editor-dev 的 dependencies 中加入 @motajs/editor-impl"
      - "main.tsx 顶层 import { tablePanelType } from '@motajs/editor-impl/table' 并 registerPanelType(tablePanelType)"
      - "为内存后端 seed 至少一张数据表及其 schema（table.demo + table#schema.demo），并记录如何在浏览器里打开表格面板"
advisory: []
---

# Phase 2: 表格编辑 Verification Report

**Phase Goal:** 用户可编辑 schema 驱动的表格数据；默认实现落在 `editor-impl`。
**Requirement:** TABLE-01「用户可编辑 schema 驱动的表格数据」
**Verified:** 2026-10-13T06:45:19Z
**Status:** gaps_found
**Re-verification:** No — initial verification（无既有 VERIFICATION.md）

> 说明：本次为**目标回推**验收，从 ROADMAP 的 Phase 2 目标 + 4 条 Success Criteria + TABLE-01 + §Cross-cutting Constraints（开发宿主须持续接入）出发，而非「任务是否做完」。SUMMARY.md 的说法一律当作待证主张，以代码 + 真实命令退出码为准。

---

## Goal Achievement

### Observable Truths

| #   | Truth | Status | Evidence |
| --- | ----- | ------ | -------- |
| T1 | 用户可打开表格视图并查看 schema 驱动的项目数据（SC1） | ✓ VERIFIED | `tablePanelType`（`tablePanelType.ts:32-37`）可经 `ShellSystem.registerPanelType` 注册；`TablePanel.setTable` + `refresh()` 经资源层读 `table.<name>` / `table#schema.<name>`（`tablePanel.ts:352-358,588-623`）；`buildTableTree` 按 `properties` 递归成行（`traversal.ts:126-130`）；`tracer.test.tsx` 9 用例 + `integration.test.tsx#数据表完整流程…` 断言列头/行/值/注释 |
| T2 | 用户可新增 / 修改 / 删除表格行，改动即时反映（SC2） | ✓ VERIFIED | `commitValue` / `addItem` / `deleteItem` 写资源后 `applyData` 立即重算视图（`tablePanel.ts:276-345,439-446`）；`edit.test.tsx` 5 用例、`integration.test.tsx` 逐步断言写回与显示 |
| T3 | 表格编辑经统一命令 / 撤销路径，可撤销、可重做（SC3） | ✓ VERIFIED | 每次变更走 `context.addUndoContext`（`tablePanel.ts:264-267,292-295,321-324,340-343`）→ `UndoSystem`（`undoSystem.ts:23-55`）；`TablePanel.undo/redo` 经 `computeState` 还原（`tablePanel.ts:212-218,542-583`）；`undo.test.ts` 7 用例 + `integration.test.tsx` 三步撤销/重做 |
| T4 | 表格数据经统一层（`editor-core` 资源层）读写，不使用通用 fs 接口（SC4 机制，D-03） | ✓ VERIFIED | 读写全经 `context.requestResource` / `resource.write`（`tablePanel.ts:352-358,477-487`）→ `ResourceSystem.requestResource/writeContent`（`resourceSystem.ts:45-88`）；`tablePanel.ts` 无 `IEditorFileSystem` 引用；`coreFsSurface.js` 门禁退出 0 |
| T5 | 表格「行为 / 画面与现状一致」（SC4 对齐要求；PROJECT.md「对外功能/UI 必须保持现状」） | ? UNCERTAIN | 仅能由真实宿主的目视 / 交互验收判定；`editor-impl` 无独立运行壳，jsdom 不断言布局（列宽/分割线/横向滚动/hover）。**属人工项**，见下节 |
| T6 | 外壳在活动面板变化时调用 `onSwitchIn` / `onSwitchOut`（02-05，D-15 修订版 / D-31） | ✓ VERIFIED | `shellSystem.ts:675-729`（`syncActiveInstance` / `invokeSwitchIn` / `invokeSwitchOut`，含抛错隔离）；`shellSwitch.test.ts` 4 用例；`integration.test.tsx` 以「改 schema 后切回、注释更新」证明切入刷新 |
| T7 | 字段名 / 注释 / 值中的脚本样文本以字面文本渲染（XSS 回归守卫） | ✓ VERIFIED | 组件一律用 React 文本节点，无 `dangerouslySetInnerHTML`；`integration.test.tsx#脚本样字段名、注释与值以字面文本渲染` 断言 `querySelector('img'|'script')` 为空 |
| T8 | `table#schema.<name>` 一律按标准 JSON Schema 处理；`x-editor` / `x-control` 扩展键；外部编辑器按 `x-editor` 分发 | ✓ VERIFIED | `types.ts:41-50`（`ITableSchemaNode` 基于 `json-schema-typed`）；`control.ts:11-24`（标准关键字推导 + `x-control` 兜底）；`TableRow.tsx:134-190`（按 `x-editor` 路由 code/event/material/point/multiselect）；`externalEditor.test.tsx` 9 用例 |
| T9 | 生效门禁与测试基线全绿（`editor-impl` / `editor-core` test + typecheck + 4 个生效门禁） | ✓ VERIFIED | 见下方 Behavioral Spot-Checks：impl 82/82、core 58/58、两处 typecheck 退出 0、四门禁退出 0 |
| T10 | **开发宿主须持续接入**：能力接入 `packages/apps/editor-dev`，可在浏览器打开验收（ROADMAP §Cross-cutting Constraints，**必须 / 不得遗漏**） | ✗ FAILED | editor-dev 未依赖 `@motajs/editor-impl`，`main.tsx` 只注册演示面板；`git log packages/apps/editor-dev` 自 Phase 1.1 后无改动；02-table 文档从未提及 editor-dev。详见 Gaps |

**Score:** 7/9 truths verified（1 项 FAILED，1 项 UNCERTAIN→人工项）

> 关于 SC4：「经统一层读写」（TABLE-01 的机制性要求，与锁定决策 D-03 一致）已由 T4 证实；而其「行为与现状一致」的对齐部分是目视项（T5），计入人工验收。二者合计构成 SC4。

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | -------- | ------ | ------- |
| `packages/libs/editor-impl/src/table/tablePanel.ts` | `TablePanel implements IEditorPanel + ITablePanel`，经资源层读写、记撤销 | ✓ VERIFIED | 624 行；13 个方法体（commit/add/delete/undo/redo/refresh/openSchema/openCode…） |
| `packages/libs/editor-impl/src/table/tablePanelType.ts` | 可注册面板类型（id/name/icon/factory） | ✓ VERIFIED | `tablePanelType` 常量 + 内联 SVG 图标 |
| `packages/libs/editor-impl/src/table/model/traversal.ts` | schema(properties)+data → 行树（递归） | ✓ VERIFIED | 130 行；递归 `buildRows`，含未声明字段兜底 |
| `packages/libs/editor-impl/src/table/model/schemaPresentation.ts` | schema 专用呈现规则（成对 / 紧凑） | ✓ VERIFIED | 184 行；`buildSchemaTree` + `buildSchemaPresentation` |
| `packages/libs/editor-impl/src/table/model/validation.ts` | `validateId` + ajv `validateValue` | ✓ VERIFIED | ajv Draft 2020-12，`strict:false`，`enum` 成员校验；无表达式求值 |
| `packages/libs/editor-impl/src/table/components/TableGrid.tsx` | 四栏网格 + 状态视图 + 工具栏 | ✓ VERIFIED | 353 行；Loading/NoTarget/Empty/EmptySchema/Error/Ready 全分支 |
| `packages/libs/editor-impl/src/table/components/TableRow.tsx` | 叶子行：值控件映射 / 校验 / 双击分发 / 操作列 | ✓ VERIFIED | 386 行 |
| `packages/libs/editor-impl/src/react/capabilities.ts` | 注入式能力接缝（6 个可缺省打开器） | ✓ VERIFIED | `react` 不导入 `table`；参数用 `Record<string, unknown>` |
| `packages/libs/editor-core/src/shell/shellSystem.ts` | 活动面板变化时调用 `onSwitchIn`/`onSwitchOut` | ✓ VERIFIED | 758 行；`syncActiveInstance` 等 |
| `packages/apps/editor-dev/src/main.tsx` | **应注册表格面板类型 + seed 表格资源** | ✗ MISSING | 仅注册 `DEMO_PANEL_TYPE`；无表格内容（T10） |

### Key Link Verification

| From | To | Via | Status | Details |
| ---- | -- | --- | ------ | ------- |
| `tablePanelType.create` | `ShellSystem.registerPanelType` / `createInstance` | Phase 1 注册 + 工厂契约 | WIRED | `shellSystem.ts:580-606`；`tracer.test.tsx` 端到端开面板 |
| `TablePanel.setTable(target)` | `context.requestResource(table.<name> / table#schema.<name>)` | 资源层（D-03/D-04） | WIRED | `tablePanel.ts:220-223,612-617` |
| `TablePanel.render()` | 外壳 `PanelHost` | 返回的 FC 被外壳挂载 | WIRED | `shellSystem.ts:223`；`tablePanel.ts:194-196` |
| `commitValue/addItem/deleteItem` | `context.addUndoContext(this, …)` | 统一撤销路径（D-09） | WIRED | `tablePanel.ts:264,292,321,340` → `UndoSystem` |
| `TableRow` 值提交 | `inferControlKind` + 五个输入控件 | 控件映射（02-06） | WIRED | `TableRow.tsx:199-237`；`inputs.test.tsx` 19 用例 |
| 操作列「编辑」 | `ITableEditorCapabilities` 各打开器 | 注入接缝（02-03） | WIRED | `TableRow.tsx:134-190,276-293`；`externalEditor.test.tsx` |
| `onSwitchIn` | 资源层重新请求 + 重算 | D-15 修订版 / D-31 | WIRED | `tablePanel.ts:202-204,588-623`；`shellSwitch.test.ts` |
| `main.tsx` 组合根 | `tablePanelType` → 外壳 | **开发宿主接入（要求）** | NOT_WIRED | `main.tsx` 未导入/注册表格面板类型（T10） |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| -------- | ------------- | ------ | ------------------ | ------ |
| `TablePanel` | `data` / `schema` | `context.requestResource(...).request()` → `ResourceSystem.readContent` → 注入的 `IResourceInjection` | 是（生产路径指向注入后端；测试用 `FakeResourceInjection`） | ✓ FLOWING |
| `TablePanelView` | `view.rows` | `buildTableTree(schema, data)` | 是 | ✓ FLOWING |
| 弹窗候选项 | `row.config.items.enum` | schema 节点 | 是 | ✓ FLOWING |

> 生命周期末期，注入后端由宿主提供（`@motajs/editor` / SW）；本阶段不在范围内。构件本身无「静态兜底 / 硬编码字面量」冒充数据。

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| editor-impl 测试全绿 | `pnpm --filter @motajs/editor-impl test` | 10 文件 / 82 用例通过，退出 0 | ✓ PASS |
| editor-impl 类型检查 | `pnpm --filter @motajs/editor-impl typecheck` | `tsc -b` 退出 0 | ✓ PASS |
| editor-core 测试全绿 | `pnpm --filter @motajs/editor-core test` | 6 文件 / 58 用例通过，退出 0 | ✓ PASS |
| editor-core 类型检查 | `pnpm --filter @motajs/editor-core typecheck` | `tsc -b` 退出 0 | ✓ PASS |
| import type 门禁 | `node scripts/verify/coreImportType.js` | 退出 0（80 文件 0 违规） | ✓ PASS |
| 引擎中性门禁 | `node scripts/verify/coreEngineNeutral.js` | 退出 0（61 生产文件 0 违规） | ✓ PASS |
| 模块状态 / PORT-02 门禁 | `node scripts/verify/coreModuleState.js` | 退出 0 | ✓ PASS |
| 通用 fs 面门禁 | `node scripts/verify/coreFsSurface.js` | 退出 0（`IEditorFileSystem` 仅声明文件命中） | ✓ PASS |
| 开发宿主启动并注册表格面板 | `pnpm --filter @motajs/editor-dev dev`（浏览器） | **未运行 / 无表格内容可开** | ✗ FAIL（T10） |

### Probe Execution

未发现本阶段声明或约定的探针脚本（`scripts/*/tests/probe-*.sh` 不存在；PLAN/SUMMARY 未声明 probe）。Step 7c: SKIPPED。

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| ----------- | ----------- | ----------- | ------ | -------- |
| TABLE-01 | 02-02…02-10 | 用户可编辑 schema 驱动的表格数据 | ⚠️ PARTIAL | 机制与四栏编辑 / 增删 / 统一撤销 / 资源层读写均已证（T1–T4、T6–T9）；但 ROADMAP §Cross-cutting Constraints 的「接入开发宿主」未做（T10），且「与现状视觉对齐」为人工项（T5） |

> 无孤儿需求：本阶段仅映射 TABLE-01。REQUIREMENTS.md 已把 TABLE-01 标为 Complete——本次验收指出该「Complete」应附带 T10 的缺口。

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| （本阶段新增源码） | — | `TBD` / `FIXME` / `XXX` / `HACK` / `TODO` / `PLACEHOLDER` | ℹ️ 无 | 全部 `editor-impl/src` 与 `editor-core/src` 扫描 0 命中 |
| （占位实现） | — | `return null` / `return {}` / `dangerouslySetInnerHTML` 冒充数据 | ℹ️ 无 | 未见；状态视图均为固定文案 + 明确分支 |
| `packages/apps/editor-dev/package.json` | 11-24 | 未接入能力阶段产的表格能力 | 🛑 BLOCKER | 见 T10 / Gaps |

**Advisory（本阶段外、非阻塞）：** `scripts/verify/implExports.js` 仍以退出码 1 报告 `react` / `react-dom` / `antd` 各解析到两个 `realpath`（`19.2.3` 与 `19.3.0`）。该门禁引用已归档的 `subpathStatus.json`，被 `02-VALIDATION.md` 明确列为**失效门禁、不作阶段门禁**；但它提示 `editor-impl` 侧存在潜在的双 React 解析（会影响 hooks / context）。建议在后续包边界 / 版本对齐阶段以 catalog pin 或 overrides 收敛后重跑。`coreExports.js` 退出 1 亦为同一已归档产物缺失所致的失效门禁。

### Human Verification Required

1. **表格画面 / 交互与旧表格视觉对齐（T5 / SC4 对齐部分）**
   **Test:** 在可运行宿主里打开表格面板，观察约 400px 固定栏宽、栏间与行间分割线、窄于总宽时横向滚动、行悬停高亮；对照旧 `@motajs/editor` 表格。
   **Expected:** 与现状整体一致（允许为适配 JSON Schema 做必要微调，D-27）。
   **Why human:** 布局/滚动/悬停依赖真实浏览器渲染，jsdom 不做布局；`editor-impl` 无独立运行壳。

2. **schema 模式观感（T4/T8）**
   **Test:** 打开 `table#schema.<name>` 视图，观察 schema 提示条（单行 muted、窄面板省略号截断）、工具栏、成对关键字行（两个小 number 输入）。
   **Expected:** 外观合理、与数据视图区分清晰。
   **Why human:** 视觉呈现需目视。

3. **弹窗外观与「独立面板切走即关」行为（D-11…D-14）**
   **Test:** 打开多选 / 坐标弹窗（列表滚动、页脚固定、长标签省略号 + title）；代码 / 事件字段打开独立面板并切走应自动关闭。
   **Expected:** 行为符合 D-11…D-14。
   **Why human:** 需要真实外壳（标签页）与弹窗挂载；真实代码 / 事件编辑器由 Phase 5/6 提供。

4. **D-30「在代码编辑器中打开」的真实集成与写回观感**
   **Test:** 点击工具栏「在代码编辑器中打开」，在真实 Monaco（Phase 5）里编辑并写回。
   **Expected:** 数据视图→数据文件、schema 视图→schema 文件；整份替换经统一撤销记一次操作。
   **Why human:** 真实代码编辑器能力由宿主 / 后续阶段提供。

> 另有 **must-do 缺口**（非人工项）：T10 未把表格能力接入开发宿主，**无法**在浏览器里打开表格面板进行上述人工验收。需先补齐接入。

### Gaps Summary

本阶段的**表格能力本身已实质交付并被测试证明**：面板类型可注册、打开、设目标；数据与 schema 全经 `editor-core` 资源层读写（D-03/D-04）；行树按标准 JSON Schema 递归构建；`x-editor` / `x-control` 扩展键与 ajv 校验到位；增删改各为一步可撤销操作并全部经统一撤销路径；外壳已按 D-15 修订版在切入时调用 `onSwitchIn`。`editor-impl` 82/82、`editor-core` 58/58 测试与两处 typecheck、四个生效门禁全部退出 0。

**唯一 BLOCKER** 是 ROADMAP §Cross-cutting Constraints 的硬性收尾要求未完成：**未把表格能力接入开发宿主 `packages/apps/editor-dev`**。代码证据是决定性的——editor-dev 未依赖 `@motajs/editor-impl`、只注册演示面板、其后端未 seed 表格资源，且该包自 Phase 1.1 起零改动。这使本阶段的能力**无法在浏览器里被打开与手动验收**，也正是「必须…不得遗漏」所禁止的情形。这不是视觉主观项，而是可观察的缺失。

因此整体判定为 **gaps_found**（gaps 优先于人工项）。补齐 T10 接入后，剩余仅为视觉 / 交互的人工验收项，届时可转 `human_needed` 或 `passed`。

---

## Deferred Items

未发现被后续 ROADMAP 阶段明确承接的缺口：Phase 3–6 分别覆盖素材 / 地图 / 代码 / 事件，**没有任何后续阶段的 goal / 成功标准**覆盖「把 Phase 2 表格能力接入 dev 宿主」或「表格视觉对齐」。故 T5、T10 均保留为真实缺口 / 人工项，不作 deferred。

---

_Verified: 2026-10-13T06:45:19Z_
_Verifier: gsd-verifier_
