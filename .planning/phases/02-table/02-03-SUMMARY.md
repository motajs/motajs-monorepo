---
phase: 02-table
plan: 03
subsystem: editor-impl
tags: [types, capabilities, seam, editor-impl, declarations-only]

# Dependency graph
requires:
  - phase: 01-shell
    provides: "editor-core 面板模型（IEditorPanel 等）与引擎无关的接缝落点约定"
  - phase: 02-table
    provides: "src/table 的公开类型面（本计划与其保持单向依赖：src/table → src/react，反向禁止）"
provides:
  - "@motajs/editor-impl/react 的注入式能力接缝类型：各外部编辑器打开器 + 能力包 + 剪贴板能力 + React Provider 契约"
  - "代码/事件/多选/坐标四类请求与结果形状（代码编辑器请求为通用整份内容形状，兼容 D-30）"
affects: [02-05, 02-07, 02-08, 02-09]

# Actuals (#2632)
actuals:
  tokens: 1196
  tasks: 2
  commits: 0

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "注入式能力接缝：能力均为可选成员，缺省时表格优雅降级而非崩溃"
    - "能力类型用结构化形状（纯数据 id/label/数字）表达，不携带表格类型；D-06 打开器参数用不透明 Record<string, unknown>"
    - "src/react 为依赖 DAG 的叶子（只依赖 react 与同目录 types），不导入 src/table 或任何能力子路径"

key-files:
  created:
    - "packages/libs/editor-impl/src/react/types.ts"
    - "packages/libs/editor-impl/src/react/capabilities.ts"
    - "packages/libs/editor-impl/src/react/index.ts"
  modified: []

key-decisions:
  - "ITableCapabilitiesProviderProps 落在 capabilities.ts 而非 types.ts：Provider props 引用能力包 ITableEditorCapabilities（定义于 capabilities.ts），若置于 types.ts 会形成 types ↔ capabilities 环依赖（AGENTS.md 禁循环引用），故 types.ts 保持为只含请求/结果形状的叶子"
  - "ICodeEditorOpenRequest 为通用整份内容形状（title + content 均 string），既服务单字段也服务 D-30 的整份数据/schema 文件；不引入字段路径等表格语义"
  - "ITablePanelOpener.open 参数为不透明 Record<string, unknown>（具体形状 ITablePanelParam 由 src/table 声明、组合根收窄），以维持 src/react ↛ src/table 的依赖方向"
  - "不声明 IValueEvaluator 或任何表达式求值器（D-22 已废弃）"

patterns-established:
  - "能力接缝全部只读成员且可选，表达「缺省即降级」的契约"
  - "打开器的 open 方法以换行 JSDoc 逐参说明，返回值（含取消时返回 null）在 @returns 写明"

requirements-completed: []

# Coverage metadata (#1602)
coverage:
  - id: D1
    description: "@motajs/editor-impl/react 子路径可解析并导出完整接缝类型面，typecheck 退出 0"
    requirement: TABLE-01
    verification:
      - kind: other
        ref: "pnpm --filter @motajs/editor-impl typecheck"
        status: pass
    human_judgment: false
  - id: D2
    description: "能力接缝的形状与已确认命名/方向一致（打开器签名、能力包成员全可选、无表达式求值器）"
    requirement: TABLE-01
    verification: []
    human_judgment: true
    rationale: "类型面语义是否符合已确认命名与方向属人工判断；自动化只能证明其可编译且不破坏既有门禁。"

# Metrics
duration: 3min
completed: 2026-10-12
status: complete
---

# Phase 2 Plan 03: 注入式能力接缝（`@motajs/editor-impl/react`）Summary

**声明表格触达外部编辑器的注入式能力接缝：代码/事件/多选/坐标四类打开器、可选能力包、剪贴板能力与 React Provider 契约——纯声明，零行为、零组件**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-10-12T20:37:00+08:00
- **Completed:** 2026-10-12T20:40:00+08:00
- **Tasks:** 2
- **Files created:** 3

## Accomplishments

- 新建 `src/react/types.ts`：声明 `ICodeEditorOpenRequest`（通用 `title` + `content`）、`IEventEditorOpenRequest`、`IMultiSelectItem` / `IMultiSelectOpenRequest` / `IMultiSelectResult`、`IPointSelectOpenRequest` / `IPointSelectResult`——全部具名 `interface`，禁内联对象类型、禁对象联合。
- 新建 `src/react/capabilities.ts`：声明 `ICodeEditorOpener` / `IEventEditorOpener` / `IMultiSelectOpener` / `IPointSelectOpener` / `ITablePanelOpener` / `ICopyCapability`，以及能力包 `ITableEditorCapabilities`（`codeEditor?` / `eventEditor?` / `multiSelect?` / `pointSelect?` / `tablePanel?` / `copy?` 全可选）与 React Provider 契约 `ITableCapabilitiesProviderProps`。
- 新建 `src/react/index.ts`：仅以 `export *` 汇总 `./capabilities` 与 `./types`，无注释。`./react` 子路径现可解析并通过 `tsc -b`（此前该目标缺失）。
- 未声明任何表达式求值器；`src/react` 不含 `../table` / `@motajs/editor-impl/table` 导入，也不含 `IValueEvaluator`。

## Task Commits

**未提交**——本计划明确要求「DO NOT COMMIT」，所有改动留在工作树，由编排器负责提交。故 `actuals.commits: 0`。

1. **Task 1: 声明请求/结果形状与打开器接口** — 未提交（工作树）
2. **Task 2: 声明 React Provider 契约并加桶** — 未提交（工作树）

## Files Created/Modified

- `packages/libs/editor-impl/src/react/types.ts` — 代码/事件/多选/坐标的请求与结果形状（叶子，无导入）。
- `packages/libs/editor-impl/src/react/capabilities.ts` — 各打开器、`ITablePanelOpener`、`ICopyCapability`、能力包 `ITableEditorCapabilities`、Provider 契约 `ITableCapabilitiesProviderProps`。
- `packages/libs/editor-impl/src/react/index.ts` — `./react` 桶（`export *`，无注释）。

## Decisions Made

- **Provider 契约的落点（关键）**：`ITableCapabilitiesProviderProps` 放入 `capabilities.ts`。计划 Task 2 字面要求放入 `types.ts`，但 Provider props 引用能力包 `ITableEditorCapabilities`（在 `capabilities.ts`），而 `capabilities.ts` 又引用 `types.ts` 的请求/结果形状——若按字面放置将形成 `types.ts ↔ capabilities.ts` 环依赖。AGENTS.md「无循环引用」与 dependency-cruiser 的 `no-circular` 规则均禁止，故 `types.ts` 保持为纯请求/结果叶子，Provider 契约与打开器、能力包同置 `capabilities.ts`。详见「Deviations from Plan」。
- **代码编辑器请求为通用整份内容形状**：`ICodeEditorOpenRequest` = `{ title: string; content: string }`，按 D-30 同时服务「单个字段」与「整份数据/schema 文件」，不携带字段路径/资源 id 等表格语义。
- **能力包成员全可选**：D-11 的代码/事件编辑器在本阶段尚不存在，能力缺省时表格须优雅降级，故 `ITableEditorCapabilities` 每个成员均为可选。
- **不声明表达式求值器**：D-22 明确废弃 `IValueEvaluator`；能力包不含 `valueEvaluator` 成员。

## Deviations from Plan

### Auto-fixed Issues

**1. [AGENTS.md 驱动 / Rule 3 - Blocking] `ITableCapabilitiesProviderProps` 改置 `capabilities.ts`（计划字面为 `types.ts`）**
- **Found during:** Task 2（声明 Provider 契约）
- **Issue:** 计划 Task 2 要求把 `ITableCapabilitiesProviderProps` 追加到 `types.ts`。但该接口引用 `ITableEditorCapabilities`（定义于 `capabilities.ts`），而 `capabilities.ts` 已从 `types.ts` 引入请求/结果形状；按字面放置会产生 `types.ts → capabilities.ts` 与 `capabilities.ts → types.ts` 的双向导入，即环依赖，违反 AGENTS.md「无循环引用」及 `.dependencyCruiser.cjs` 的 `no-circular` 规则。
- **Fix:** `types.ts` 只保留请求/结果形状（成为无导入的叶子）；将打开器、`ITablePanelOpener`、`ICopyCapability`、能力包 `ITableEditorCapabilities` 与 Provider 契约 `ITableCapabilitiesProviderProps` 一律放进 `capabilities.ts`。功能与公开面不变（`index.ts` 同时 `export *` 两文件）。
- **Files modified:** `packages/libs/editor-impl/src/react/types.ts`、`packages/libs/editor-impl/src/react/capabilities.ts`
- **Verification:** `pnpm --filter @motajs/editor-impl typecheck` 退出 0；`node scripts/verify/coreImportType.js` 退出 0（无 `import type`）；依赖方向未被破坏（`src/react` 无 `../table` 导入）。
- **Committed in:** 未提交（工作树，编排器负责）

### Flagged Assumptions（非偏差，但含本计划自主补全的成员形状）

- `IEventEditorOpenRequest`、`IMultiSelectOpenRequest`、`IPointSelectOpenRequest` 的**成员**在 `INTERFACE-NAME.md` 的 rev.2 成员级命名中未逐条列出（仅给出结果形状与打开器签名）。本计划按最简且自洽的形状声明：
  - `IEventEditorOpenRequest` = `{ title: string; content: string }`（与代码编辑器平行；事件内容以整份文本承载）。
  - `IMultiSelectOpenRequest` = `{ title: string; items: readonly IMultiSelectItem[]; selectedIds: readonly string[] }`；`IMultiSelectItem.thumbnail` 取 `string`（不透明缩略图地址）。
  - `IPointSelectOpenRequest` = `{ title: string; x?: number; y?: number }`（可选初始坐标）。
  - `ITableCapabilitiesProviderProps.capabilities` 为可选（计划措辞「可选的能力包」），`children` 为必需 `ReactNode`。
  若后续计划（02-09 弹窗实现）需调整，应回到 `INTERFACE-NAME.md` 命名确认流程。

---

**Total deviations:** 1 auto-fixed（AGENTS.md 驱动 / blocking）
**Impact on plan:** 唯一偏差是为满足「无循环引用」而调整 Provider 契约的落点，公开面与能力接缝内容完全不变；无范围蔓延。

## Issues Encountered

- **验证脚本必须串行：** `coreFsSurface.js` 与 `coreModuleState.js` 都会在 `packages/libs/editor-core/src` 下临时写入/删除探针并让 ESLint 扫描整片 src；并行会产生读取竞态。本计划四个脚本**顺序**执行，全部退出 0，探针无残留（与 02-02 的结论一致）。

## Known Stubs

无。本计划为纯声明。`ITableEditorCapabilities` 各能力在本阶段「无实现、可缺省」是**已确认的设计**（D-11：代码/事件编辑器留待 Phase 5/6），不是未接线的 stub。

## Threat Flags

无新增威胁面。本计划只声明类型：请求/结果只承载纯数据（string / number / id），能力为注入函数，未引入 `eval` / `new Function`，未新增依赖（计划 `<threat_model>` 的 T-02-05 / T-02-06 / T-02-07 / T-02-SC 均已落实为「无 schema 可执行载荷、纯数据形状、受信组合根装配、零新增依赖」）。

## Verification Evidence

| 命令 | 结果 |
|------|------|
| `pnpm --filter @motajs/editor-impl typecheck` | 退出 0 |
| `node scripts/verify/coreImportType.js` | 退出 0（扫描 40 文件，0 条 import type） |
| `node scripts/verify/coreEngineNeutral.js` | 退出 0（扫描 34 生产文件，0 条引擎标识） |
| `node scripts/verify/coreModuleState.js` | 退出 0（40 文件，受限规则 error 级 0 条） |
| `node scripts/verify/coreFsSurface.js` | 退出 0（扫描 40 文件，`IEditorFileSystem` 仅声明文件命中） |
| `pnpm --filter @motajs/editor-core test` | 退出 0（5 文件 / 54 测试全通过） |
| `Select-String -Path packages/libs/editor-impl/src/react/*.ts -Pattern '\.\./table\|@motajs/editor-impl/table\|IValueEvaluator'` | 0 命中 |

## Next Phase Readiness

- `@motajs/editor-impl/react` 子路径类型面已就位、可解析并通过 typecheck；后续实现计划（Skill 2 的弹窗 / Provider 组件、表格面板的外部编辑器分发）可直接引用这些接缝类型。
- 待办（非本计划范围）：`src/react` 的 `subpathStatus.json` 条目 `content` 仍记为 `probe`；本计划将其变为真实声明 barrel，但未改 `subpathStatus.json`（不属本计划 `files_modified`）。`implExports.js` 只把该 JSON 与硬编码期望比对、不检查 barrel 内容，故仍会通过。
- 本计划所有改动留在工作树，未提交——提交由编排器负责。

## Self-Check: PASSED

- 创建文件均存在：`src/react/types.ts`、`src/react/capabilities.ts`、`src/react/index.ts` ✔
- 未执行 `git commit`（符合「DO NOT COMMIT」）✔
- 未修改 `STATE.md` / `ROADMAP.md` ✔
- 依赖方向成立：`src/react` 无 `../table` / `@motajs/editor-impl/table` 导入、无 `IValueEvaluator` ✔

---
*Phase: 02-table*
*Completed: 2026-10-12*
