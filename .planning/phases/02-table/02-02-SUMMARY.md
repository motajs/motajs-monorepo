---
phase: 02-table
plan: 02
subsystem: editor-impl
tags: [types, json-schema, table, editor-impl, declarations-only]

# Dependency graph
requires:
  - phase: 01-shell
    provides: "editor-core 资源层（IResourceIdentifier）与外壳面板模型"
provides:
  - "@motajs/editor-impl/table 的公开类型面：JSON Schema 节点、资源标识约定、面板接缝、行树/编辑、呈现规则"
  - "json-schema-typed@8.0.2 依赖接入（catalog 固定条目）"
affects: [02-04, 02-06, 02-07, 02-08, 02-09]

# Actuals (#2632)
actuals:
  tokens: 740
  tasks: 2
  commits: 0

# Tech tracking
tech-stack:
  added:
    - "json-schema-typed@8.0.2（Draft 2020-12 类型库，零校验运行时）"
  patterns:
    - "schema 节点类型以标准类型库为基、薄扩展编辑器注解键（x-editor / x-control）"
    - "数值 const enum + 大驼峰成员表达资源类型号与编辑/控件种类"

key-files:
  created:
    - "packages/libs/editor-impl/src/table/types.ts"
    - "packages/libs/editor-impl/src/table/resourceType.ts"
    - "packages/libs/editor-impl/src/table/index.ts"
    - "packages/libs/editor-impl/src/global.d.ts"
  modified:
    - "packages/libs/editor-impl/package.json"
    - "pnpm-workspace.yaml"
    - "pnpm-lock.yaml"

key-decisions:
  - "schema 节点基于标准库 json-schema-typed 的 JSONSchema.Interface 薄扩展，自造 JSON Schema 关键字类型被否决"
  - "id 约定（table.<name> / table#schema.<name>）以文件级注释声明，而非枚举 JSDoc（AGENTS.md 禁止枚举 JSDoc）"
  - "global.d.ts 提前到本计划交付（原计划 02-04），修 editor-impl 程序引入 editor-core 时的 CSS 模块类型缺口"

patterns-established:
  - "类型面只依赖 editor-core 与标准类型库，不导入宿主/引擎/通用 fs 接口"
  - "数据表与 schema 表共用一个资源类型号，靠 id 区分"

requirements-completed: []

# Coverage metadata (#1602)
coverage:
  - id: D1
    description: "@motajs/editor-impl/table 子路径可解析并导出完整类型面，typecheck 退出 0"
    requirement: TABLE-01
    verification:
      - kind: other
        ref: "pnpm --filter @motajs/editor-impl typecheck"
        status: pass
    human_judgment: false
  - id: D2
    description: "类型形状与已确认命名/JSON Schema 方向一致（成员语义、枚举取值）"
    requirement: TABLE-01
    verification: []
    human_judgment: true
    rationale: "类型面语义是否符合已确认命名与方向属人工判断；自动化只能证明其可编译。"

# Metrics
duration: 4min
completed: 2026-10-12
status: complete
---

# Phase 2 Plan 02: 表格类型面（JSON Schema 方向）Summary

**声明 `@motajs/editor-impl/table` 的引擎无关类型面：标准 JSON Schema 节点、`table.<name>` / `table#schema.<name>` 资源约定、面板接缝与行树/呈现规则——纯声明，零行为**

## Performance

- **Duration:** ~4 min
- **Started:** 2026-10-12T20:28:48+08:00
- **Completed:** 2026-10-12T20:32:28+08:00
- **Tasks:** 2
- **Files created/modified:** 7 (4 created + 3 modified)

## Accomplishments

- 接入标准类型库 `json-schema-typed@8.0.2`（Draft 2020-12）：写入 `pnpm-workspace.yaml` 的 catalog（固定版本）与 `editor-impl/package.json` 的 dependency（`catalog:default`），经本地代理安装成功。
- `src/table/types.ts` 声明完整类型面：`ITableSchemaNode`（以 `JSONSchema.Interface` 为基、薄扩展 `x-editor` / `x-control`、`properties` / `items` 递归）、`TableExternalEditor` / `TableControlKind` / `TableEditMode`（数值 `const enum`）、`ITableRowNode`、`TableAction`、`ITablePanelTarget`、`ITablePanel`（含 `ITablePanel.setTable`）、`ITablePanelParam`、`ISchemaPresentationRule` / `IPairedFieldGroup`。
- `src/table/resourceType.ts` 声明 `TableResourceType`（数值 `const enum`，成员 `Table`）与 id 约定（文件级注释），不含函数体。
- `src/table/index.ts` 用 `export *` 汇总三者，`./table` 子路径现可解析并通过 `tsc -b`。
- 补 `src/global.d.ts`（`declare module '*.css';`），使 editor-impl 的 tsc 程序能引入 editor-core 源（其 `shellSystem.ts` 有 `import './shell.css'`）。

## Task Commits

**未提交**——本计划明确要求「DO NOT COMMIT」，所有改动留在工作树，由编排器负责提交。故 `actuals.commits: 0`。

1. **Task 1: 接入标准 JSON Schema 类型库** — 未提交（工作树）
2. **Task 2: 声明资源约定、数据模型、行树、面板接缝与呈现规则类型** — 未提交（工作树）

## Files Created/Modified

- `packages/libs/editor-impl/src/table/types.ts` — JSON Schema 节点、三个编辑器/控件枚举、行树、编辑载荷、面板接缝、呈现规则类型。
- `packages/libs/editor-impl/src/table/resourceType.ts` — `TableResourceType` 枚举 + id 约定（函数体留待 Plan 04）。
- `packages/libs/editor-impl/src/table/index.ts` — `./table` 桶（`export *`）。
- `packages/libs/editor-impl/src/global.d.ts` — `declare module '*.css';`（本次提前交付）。
- `packages/libs/editor-impl/package.json` — 新增 `"json-schema-typed": "catalog:default"`。
- `pnpm-workspace.yaml` — catalog 新增 `json-schema-typed: 8.0.2`。
- `pnpm-lock.yaml` — `pnpm install` 更新（新增 11 个包解析）。

## Decisions Made

- **schema 节点基于标准库**：`ITableSchemaNode extends JSONSchema.Interface`，`type` 直接继承库的字符串/字符串数组形态，不转数字枚举，也不自造 JSON Schema 关键字类型（遵循 D-19/D-21/D-23 与委派约束）。
- **id 约定落点为文件级注释**：AGENTS.md §注释规范明确「枚举本身不写 JSDoc」，故计划原文「在枚举 JSDoc 中写明 id 约定」改为写在 `resourceType.ts` 的文件级注释（import 之后/无 import 时置于顶部）。
- **`ITablePanel` 为「额外方法集合」**：按 INTERFACE-NAME「面板实现它 + `IEditorPanel`」的措辞，声明为不含 `IEditorPanel` 继承的独立接口，仅含 `setTable`。

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] 提前交付 `src/global.d.ts`（原计划 02-04）**
- **Found during:** Task 2（首次 `pnpm --filter @motajs/editor-impl typecheck`）
- **Issue:** `types.ts` 从 `@motajs/editor-core`（包根）引入类型后，tsc 会把 editor-core 全量源码（经 `index.ts` → `shell/index.ts` → `shellSystem.ts` 的 `import './shell.css'`）拉进 editor-impl 的程序；而 editor-core 自己的 `global.d.ts` 不在 editor-impl 的 `include` 内，`declare module '*.css'` 不可见 → CSS 导入缺类型声明。
- **Fix:** 新增 `packages/libs/editor-impl/src/global.d.ts`，内容仅 `declare module '*.css';`。
- **Files modified:** `packages/libs/editor-impl/src/global.d.ts`
- **Verification:** `pnpm --filter @motajs/editor-impl typecheck` 退出 0。
- **Committed in:** 未提交（工作树，编排器负责）

**2. [Rule 2 / AGENTS.md 驱动] id 约定改写在文件级注释**
- **Found during:** Task 2（编写 `resourceType.ts`）
- **Issue:** 计划 Task 2 要求「在枚举 JSDoc 中写明 id 约定」，但 AGENTS.md §注释规范规定「类、接口、枚举本身不写 jsDoc」；按硬约束「AGENTS.md 优先于计划」，改为文件级注释。
- **Fix:** 在 `resourceType.ts` 顶部写文件级 `//` 注释，声明 `table.<name>` / `table#schema.<name>` 约定与「共用一个类型号」。
- **Files modified:** `packages/libs/editor-impl/src/table/resourceType.ts`
- **Verification:** typecheck 退出 0；`coreEngineNeutral.js` 无引擎标识命中。
- **Committed in:** 未提交（工作树）

### Flagged Assumptions（非偏差，但需后续计划确认）

- `TableAction`、`ISchemaPresentationRule`、`IPairedFieldGroup` 的确切成员形状在 `INTERFACE-NAME.md` 只给了用途描述、未逐成员确认；本计划按用途声明了最简形状（`TableAction` 为 `[编辑模式, 字段路径, 值]` 只读元组；`IPairedFieldGroup` 为 `{ keywords: readonly string[] }`；`ISchemaPresentationRule` 为 `{ keyword, pair?, compact? }`）。实现计划（02-07 / 02-08）如需调整，应回到命名确认流程。
- `ITablePanelParam extends Record<string, unknown>` 会触发 `@typescript-eslint/no-empty-object-type` 的 **warning**（非 error）；该形状是 INTERFACE-NAME 已确认的约定（「无固定成员」），故保留，未改为 type 别名。

---

**Total deviations:** 2 auto-fixed（1 blocking、1 AGENTS.md 驱动）
**Impact on plan:** 均为必要修正；无范围蔓延。计划主体按 JSON Schema 方向完成。

## Issues Encountered

- **验证脚本并行竞态：** `coreFsSurface.js` 与 `coreModuleState.js` 都会在 `packages/libs/editor-core/src` 下临时写入/删除探针，并让 ESLint 扫描整个 src；并行运行时 `coreModuleState.js` 读到正被删除的探针文件，报「无法解析 ESLint 的 JSON 输出：Unexpected end of JSON input」并以 1 退出。**改为顺序运行后四个脚本全部退出 0**（探针文件无残留）。这些脚本必须串行执行。

## Known Stubs

无。本计划为纯声明；id 生成函数（`tableDataResourceId` / `tableSchemaResourceId`）是**计划内推迟**到 Plan 04，不是未接线的 stub。

## Threat Flags

无新增威胁面（纯类型声明；未引入网络端点、鉴权路径、文件访问或信任边界变更）。计划 `<threat_model>` 的 T-02-03 / T-02-04 / T-02-SC 在本计划以「只声明文本为 string、id 为不透明字符串、仅新增固定版本类型库」落实。

## Verification Evidence

| 命令 | 结果 |
|------|------|
| `pnpm --filter @motajs/editor-impl typecheck` | 退出 0 |
| `node scripts/verify/coreImportType.js` | 退出 0（扫描 37 文件，0 条 import type） |
| `node scripts/verify/coreEngineNeutral.js` | 退出 0（扫描 31 生产文件，0 条引擎标识） |
| `node scripts/verify/coreModuleState.js` | 退出 0（受限规则 error 级 0 条） |
| `node scripts/verify/coreFsSurface.js` | 退出 0（`IEditorFileSystem` 仅声明文件命中） |
| `pnpm --filter @motajs/editor-core test` | 退出 0（5 文件 / 54 测试全通过） |
| `node node_modules/eslint/bin/eslint.js packages/libs/editor-impl/src/table ...` | 0 error / 1 warning（`ITablePanelParam` 空接口） |

## Next Phase Readiness

- Wave 1 的类型面已就位，`./table` 子路径可解析并通过 typecheck；后续实现计划（tracer / 控件 / 面板 / schema 呈现 / 外部编辑器）可直接构建其上。
- 待办：`src/index.ts` 根桶改为 `export * './table'` 属 Plan 04（`implExports.js` 期望 `.` 汇总 `resources+edit+table-exports`）；`subpathStatus.json` 与其余六个 subpath 目标缺失属既有状态，未在本计划范围内处理。
- 本计划所有改动留在工作树，未提交——提交由编排器负责。

## Self-Check: PASSED

- 创建文件均存在：`src/table/types.ts`、`src/table/resourceType.ts`、`src/table/index.ts`、`src/global.d.ts` ✔
- 修改文件均生效：`package.json`、`pnpm-workspace.yaml`、`pnpm-lock.yaml` ✔
- 未执行 `git commit`（符合「DO NOT COMMIT」）✔
- 未修改 `STATE.md` / `ROADMAP.md` ✔

---
*Phase: 02-table*
*Completed: 2026-10-12*
