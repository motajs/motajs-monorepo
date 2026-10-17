---
phase: 03-asset
plan: 02
subsystem: editor-impl-shared
tags: [typescript, json-schema, capability-seam, asset]

# Dependency graph
requires: []
provides:
  - "中立类型落位 src/shared/schemaForm/types.ts + 桶（shared/schemaForm、shared）"
  - "react 接缝上的素材能力契约（分类清单 / 默认选择器 / ITableEditorCapabilities.asset）"
affects: [03-03, 03-05, 03-06, 03-07, 03-12]

actuals:
  tokens: 2570
  tasks: 2
  commits: 2

tech-stack:
  added: []
  patterns:
    - "跨能力共享类型放中立 src/shared（capabilities-must-not-import-each-other 的解法，D-28）"
    - "能力接缝类型声明在 react/、由能力目录反向引用（分类形状不从 table/asset 引入 react）"

key-files:
  created:
    - packages/libs/editor-impl/src/shared/schemaForm/types.ts
    - packages/libs/editor-impl/src/shared/schemaForm/index.ts
    - packages/libs/editor-impl/src/shared/index.ts
  modified:
    - packages/libs/editor-impl/src/table/types.ts
    - packages/libs/editor-impl/src/react/types.ts
    - packages/libs/editor-impl/src/react/capabilities.ts

key-decisions:
  - "const enum 必须按值再导出、只能对 interface 用 export type——计划的单行 export type 写法在 TS1362 下无法编译"
  - "schema 类型迁址后 table/types.ts 用一行选择性再导出保住 ./table 公开面，未改动任何现有导入站点"
  - "按 AGENTS.md 代码风格，枚举本身不写 jsDoc（覆盖计划中「枚举写 jsDoc」的口径），改由成员 jsDoc 表达"

patterns-established:
  - "中立共享模块：table 与未来的 asset 都从 shared/schemaForm 取 schema 类型，互不 import"
  - "能力接缝只在 react/ 声明，react/ 不 import 任何能力目录"

requirements-completed: [ASSET-01]

coverage:
  - id: D1
    description: "7 个 schema 类型（ITableSchemaNode / ITableRowNode / TableControlKind / TableEditMode / TableExternalEditor / IPairedFieldGroup / ISchemaPresentationRule）迁到中立 shared/schemaForm，./table 对外面不变"
    requirement: "ASSET-01"
    verification:
      - kind: other
        ref: "pnpm --filter @motajs/editor-impl typecheck（退出码 0）+ node scripts/verify/coreBoundaries.js（0 违规）+ node scripts/verify/coreImportType.js"
        status: pass
    human_judgment: false
  - id: D2
    description: "能力接缝上出现素材能力：AssetCategoryKind / AssetListFormat / IAssetCategory / IAssetPickerOpenRequest / IAssetPickerResult / IAssetPickerOpener / IAssetEditorCapabilities / ITableEditorCapabilities.asset"
    requirement: "ASSET-01"
    verification:
      - kind: other
        ref: "pnpm --filter @motajs/editor-impl typecheck（退出码 0）+ node scripts/verify/coreEngineNeutral.js（0 违规）"
        status: pass
    human_judgment: false

duration: 8min
completed: 2026-10-17
status: complete
---

# Phase 3 Plan 02: schema 类型中立化 + 素材能力接缝 Summary

**把 schema 类型挪到引擎无关的中立目录 `shared/schemaForm`，并在 `react` 能力接缝上声明「素材能力」（分类清单 + 默认选择器），为后续 `asset` 域计划铺好不破边界的类型底座。**

## Performance

- **Duration:** 8 min
- **Started:** 2026-10-17T13:08:38Z
- **Completed:** 2026-10-17T13:16:47Z
- **Tasks:** 2
- **Files modified:** 6 (3 created, 3 modified)

## Accomplishments
- schema 相关的 7 个类型（`ITableSchemaNode` / `ITableRowNode` / `TableControlKind` / `TableEditMode` / `TableExternalEditor` / `IPairedFieldGroup` / `ISchemaPresentationRule`）原样迁入中立目录 `src/shared/schemaForm/types.ts`，并新建 `shared/schemaForm/index.ts` 与 `shared/index.ts` 桶。
- `table/types.ts` 用选择性再导出保住了 `./table` 的公开类型面——`editor-dev` 等既有导入方无需任何改动；`table` 与未来的 `asset` 因此可共用同一份 schema 类型而不互相 import（D-28）。
- `react/types.ts` 与 `react/capabilities.ts` 上出现素材能力契约：`AssetCategoryKind`、`AssetListFormat`、`IAssetCategory`（12 个成员，含回退 schema）、`IAssetPickerOpenRequest` / `IAssetPickerResult`、`IAssetPickerOpener`、`IAssetEditorCapabilities`，并给 `ITableEditorCapabilities` 增加可选 `asset` 字段。
- `react/` 仍不依赖任何能力目录（唯一新增跨目录 import 是 `../shared/schemaForm/types`），边界门禁全绿。

## Task Commits

Each task was committed atomically:

1. **Task 1: schema 类型落位到 `shared/schemaForm`** - `acce00c` (feat)
2. **Task 2: 接缝契约——素材分类、默认选择器、素材能力** - `0f6c851` (feat)

**Plan metadata:** (本 SUMMARY 提交)

## Files Created/Modified

- `packages/libs/editor-impl/src/shared/schemaForm/types.ts` - 新：7 个 schema 类型的中立落位（含 `json-schema-typed` 的唯一引用）
- `packages/libs/editor-impl/src/shared/schemaForm/index.ts` - 新：`export * from './types';`
- `packages/libs/editor-impl/src/shared/index.ts` - 新：`export * from './schemaForm';`
- `packages/libs/editor-impl/src/table/types.ts` - 改：删除已迁走的声明与 `json-schema-typed` import；加选择性再导出（枚举按值、接口按类型）；保留 `TableEmptyMode` / `TableAction` / `ITablePanel*` 本地声明
- `packages/libs/editor-impl/src/react/types.ts` - 改：新增素材分类 / 列表格式 / 分类描述 / 选择器请求与结果类型；从 `../shared/schemaForm/types` 引入 `ITableSchemaNode`
- `packages/libs/editor-impl/src/react/capabilities.ts` - 改：新增 `IAssetPickerOpener`、`IAssetEditorCapabilities`，并给 `ITableEditorCapabilities` 增加 `asset?`

## Decisions Made

- **const enum 按值再导出，interface 按类型再导出。** 计划的单行 `export type { …, TableEditMode, … }` 无法编译（`const enum` 是值，`export type` 会让消费方 `TableEditMode.Change` 报 TS1362）。故拆成两行：`export { TableControlKind, TableEditMode, TableExternalEditor } from …`（值）+ `export type { ITableSchemaNode, ITableRowNode, IPairedFieldGroup, ISchemaPresentationRule } from …`（类型）。
- **枚举本身不写 jsDoc。** 计划括号里提到「jsDoc 说明分类种类」，但 AGENTS.md 代码风格明确「类、接口、枚举本身不写 jsDoc」，故只保留成员单行 jsDoc，枚举用途由 `INTERFACE-NAME.md` 与本 SUMMARY 承载。
- **保持既有导入站点零改动。** 通过 `table/types.ts` 的选择性再导出，`table` 内部组件、测试与 `editor-dev` 均继续从原路径取类型。

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] 计划的单行 `export type` 再导出无法编译**
- **Found during:** Task 1（schema 类型落位）
- **Issue:** 计划要求用一行 `export type { … } from '../shared/schemaForm/types'` 再导出全部 7 个名字。但其中 `TableControlKind` / `TableEditMode` / `TableExternalEditor` 是 `const enum`（值），`export type` 会让所有按值使用的消费方（`TableRow.tsx` / `TableGrid.tsx` / `control.ts` / 多个测试）报 TS1362，typecheck 非零退出。
- **Fix:** 拆成两行——三个枚举按值再导出（`export { … } from`），四个接口按类型再导出（`export type { … } from`）。语义与公开面目标完全一致。
- **Files modified:** `packages/libs/editor-impl/src/table/types.ts`
- **Verification:** `pnpm --filter @motajs/editor-impl typecheck` 退出码 0；`test` 191/191 通过；`coreBoundaries` 0 违规。
- **Committed in:** `acce00c`（Task 1 提交）

### Plan-conformance adjustments

**2. [Style] 枚举不写 jsDoc**
- **Found during:** Task 2（接缝契约）
- **Issue:** 计划括号中要求为 `AssetCategoryKind` 写 jsDoc 说明其用途；AGENTS.md「类、接口、枚举本身不写 jsDoc」与之冲突，AGENTS.md 优先级更高。
- **Fix:** 省略枚举级 jsDoc，仅保留成员单行 jsDoc。
- **Files modified:** `packages/libs/editor-impl/src/react/types.ts`
- **Committed in:** `0f6c851`（Task 2 提交）

---

**Total deviations:** 1 auto-fixed (Rule 1) + 1 style conformance
**Impact on plan:** 均为「按计划意图让编译/门禁通过」的最小修正，无范围蔓延；公开面与命名与 `INTERFACE-NAME.md` §03-02 完全一致。

## Issues Encountered

- **stale 计划基线台账：** `.git/gsd-plan-head-before-03-02` 已存在一份远古值（`b26f6c6`，来自更早里程碑中同名阶段）。已用真实派生基点 `b9a0576`（= 首个任务提交 `acce00c` 的父提交）覆盖，测得的 `commits` = 2 与事实一致。SUMMARY 的 `commits:` 由该台账实测，未叙述。

## User Setup Required

None - 本计划纯类型 / 契约，无外部服务或环境变量。

## Known Stubs

None - 本计划只搬类型与声明契约，不含运行期代码与桩。

## Threat Flags

None - 未新增网络端点、鉴权路径、文件访问或信任边界；`react/types.ts` 仅声明形状，不含宿主路径或凭据。

## Next Phase Readiness

- `shared/schemaForm/types.ts` 成为 schema 类型的唯一中立来源，后续 03-05（`.jsonc` 编解码）、03-06（schema 模型）、03-07（表单渲染）可继续向 `shared/` 迁移而不破 `capabilities-must-not-import-each-other`。
- `react` 接缝上的素材能力契约就位，03-03（asset 域类型）、03-12（默认素材选择器）可直接引用 `IAssetCategory` / `IAssetPickerOpener` / `ITableEditorCapabilities.asset`。
- 无阻塞。

---

## Self-Check: PASSED

- FOUND: packages/libs/editor-impl/src/shared/schemaForm/types.ts
- FOUND: packages/libs/editor-impl/src/shared/schemaForm/index.ts
- FOUND: packages/libs/editor-impl/src/shared/index.ts
- FOUND commit: acce00c (Task 1)
- FOUND commit: 0f6c851 (Task 2)

*Phase: 03-asset*
*Completed: 2026-10-17*
