---
phase: 03-asset
plan: 06
subsystem: editor-impl-shared
tags: [typescript, schema-form, module-relocation, asset, refactor]

# Dependency graph
requires:
  - phase: 03-asset
    provides: "中立目录 src/shared（shared/index.ts + shared/schemaForm/types.ts + shared/jsonc），本计划向 schemaForm 加入 model"
  - phase: 02-table
    provides: "schema 驱动的表格模型层（traversal / control / validation / fieldPath / schemaPresentation）"
provides:
  - "中立 schema 模型层 src/shared/schemaForm/model（buildTableTree / buildSchemaTree / buildSchemaPresentation / inferControlKind / validateId / validateValue 与字段路径工具）"
  - "asset 可 import ../../shared/schemaForm/model 而不触发 asset → table（D-28 前提落地）"
affects: [03-07, 03-08, 03-10, 03-14]

actuals:
  tokens: 5888
  tasks: 3
  commits: 3
plan_head_before: bdf8aa4e7e6c77ce83e0174dec13479fa379b9ee

tech-stack:
  added: []
  patterns:
    - "跨能力共享的纯逻辑放中立 src/shared/<域>/model，table 与 asset 都从它 import 而不互相 import（D-28）"
    - "搬迁用 git mv + 字节级相等断言验证——只允许整体移动，禁止「顺手改逻辑」"

key-files:
  created:
    - packages/libs/editor-impl/src/shared/schemaForm/model/control.ts
    - packages/libs/editor-impl/src/shared/schemaForm/model/fieldPath.ts
    - packages/libs/editor-impl/src/shared/schemaForm/model/schemaPresentation.ts
    - packages/libs/editor-impl/src/shared/schemaForm/model/traversal.ts
    - packages/libs/editor-impl/src/shared/schemaForm/model/validation.ts
    - packages/libs/editor-impl/src/shared/schemaForm/model/index.ts
  modified:
    - packages/libs/editor-impl/src/shared/schemaForm/index.ts
    - packages/libs/editor-impl/src/table/index.ts
    - packages/libs/editor-impl/src/table/tablePanel.ts
    - packages/libs/editor-impl/src/table/components/TableGrid.tsx
    - packages/libs/editor-impl/src/table/components/TableRow.tsx
    - packages/libs/editor-impl/src/table/components/GapRow.tsx
    - packages/libs/editor-impl/src/table/__tests__/validation.test.ts
    - packages/libs/editor-impl/src/table/__tests__/inputs.test.tsx
    - packages/libs/editor-impl/src/table/__tests__/performance.uat.test.tsx
  removed:
    - packages/libs/editor-impl/src/table/model/control.ts
    - packages/libs/editor-impl/src/table/model/fieldPath.ts
    - packages/libs/editor-impl/src/table/model/schemaPresentation.ts
    - packages/libs/editor-impl/src/table/model/traversal.ts
    - packages/libs/editor-impl/src/table/model/validation.ts
    - packages/libs/editor-impl/src/table/model/index.ts

key-decisions:
  - "五个模型文件用 git mv 整体搬迁、逐字节不改——`../types` 在新位置正好指向 shared/schemaForm/types.ts，`./fieldPath` 仍是同目录，目录形状一一对应，故搬迁零内容改动"
  - "`table/index.ts` 移除 `export * from './model'` 且不保留任何转发（代码风格禁止跨目录导出不属于本文件夹的内容）；模型层对外统一由 `./shared` 暴露"
  - "Task 2 的结构改指先提交、其 typecheck 门禁留到 Task 3 满足——`table/model/index.ts`（空桶）与 `table/index.ts` 的转发同属 Task 3 删除范围，两者不删则整包必红，故 Task 2 的 typecheck 无法单独为绿（见 Deviations）"

patterns-established:
  - "中立共享模型：schema → 行树 / 字段路径 / 控件推断 / 校验是引擎无关的纯逻辑，落中立目录后 table 与 asset 共用同一份实现（D-28 落地）"

requirements-completed: [ASSET-01]

coverage:
  - id: D1
    description: "schema → 行树 / 字段路径 / 控件推断 / 校验五个纯逻辑模块成为 shared/schemaForm/model 下的唯一实现；表格编辑、校验、schema 视图行为完全不变（同一份实现，只换位置）"
    requirement: "ASSET-01"
    verification:
      - kind: unit
        ref: "packages/libs/editor-impl/src/table/__tests__/{validation,inputs,performance.uat}.test.* + pnpm --filter @motajs/editor-impl test（26 files / 191 tests 通过）"
        status: pass
      - kind: other
        ref: "字节级相等断言（git show HEAD:...table/model/<f>.ts 与 shared/schemaForm/model/<f>.ts 逐文件 === 一致）+ pnpm --filter @motajs/editor-impl typecheck（退出码 0）"
        status: pass
    human_judgment: false
  - id: D2
    description: "旧 table/model 目录消失、table/index.ts 不再转发模型；asset 可 import ../../shared/schemaForm/model 而不触发 asset → table 能力互斥"
    requirement: "ASSET-01"
    verification:
      - kind: other
        ref: "结构断言（table/model/index.ts 不存在、table/index.ts 无 './model' 且保留 './tablePanel'）+ node scripts/verify/coreBoundaries.js（真实树 0 违规、222 条包内相对边全解析回本包）"
        status: pass
      - kind: unit
        ref: "pnpm --filter @motajs/editor-impl test（191/191，含 validation.test.ts 的 __proto__/constructor/prototype 拦截用例）"
        status: pass
    human_judgment: false

duration: 8min
completed: 2026-10-17
status: complete
---

# Phase 3 Plan 06: schema 模型层抽到 `shared/schemaForm/model` Summary

**把表格里「schema → 行树 / 字段路径 / 控件推断 / 校验」这五个纯逻辑模块整体搬进中立目录 `shared/schemaForm/model`，表格改指新位置、桶不再转发，一行逻辑未改。**

## Performance

- **Duration:** 8 min
- **Started:** 2026-10-17T15:08:13Z
- **Completed:** 2026-10-17T15:16:33Z
- **Tasks:** 3
- **Files modified:** 21 file changes（6 新增/迁入、9 修改、6 删除旧位置；净为 6 个文件整体搬迁）

## Accomplishments
- 五个纯逻辑模型模块（`control` / `fieldPath` / `schemaPresentation` / `traversal` / `validation`，共 719 行）用 `git mv` 整体搬到 `src/shared/schemaForm/model/`，逐字节不改——`git commit` 记录为 100% rename，且以 `git show HEAD:` 基线做逐文件 `===` 比对全部 EQUAL。
- 新增 `shared/schemaForm/model/index.ts` 桶（保持原 `table/model/index.ts` 的五条 `export *` 顺序：traversal / control / validation / fieldPath / schemaPresentation），并在 `shared/schemaForm/index.ts` 追加 `export * from './model'`。
- 表格侧七处引用改指新位置：`tablePanel.ts` 四条 `./model/*` → `../shared/schemaForm/model/*`；`TableGrid` / `TableRow` / `GapRow` 与三个测试文件 `../model/*` → `../../shared/schemaForm/model/*`——只改 import 路径，符号与断言一字未动。
- 删除已空的 `table/model/` 目录（连桶 `index.ts`），并从 `table/index.ts` 去掉 `export * from './model'`；表格桶其余导出（resourceType / types / tablePanel / tablePanelType / components）保持不变。
- 整包收口绿：`pnpm --filter @motajs/editor-impl test` 26 文件 / 191 用例全通过；`typecheck` 退出码 0；`node scripts/verify/coreBoundaries.js` 退出码 0（真实树 0 error 违规、125 个模块 / 222 条包内相对边全部解析回本包内部）。

## Task Commits

Each task was committed atomically:

1. **Task 1: 五个模型文件整体搬到 `shared/schemaForm/model`** - `0a98f0b` (refactor)
2. **Task 2: 把表格侧引用改指到新位置** - `39a9f8c` (refactor)
3. **Task 3: 删除空的 `table/model` 与表格桶里的转发** - `bfb1fa0` (refactor)

**Plan metadata:** (本 SUMMARY 提交) (docs)

_Note: 本计划为纯搬迁，无 TDD 循环。_

## Files Created/Modified

- `src/shared/schemaForm/model/control.ts` - 迁：`inferControlKind`（`x-control` 优先、否则按标准关键字推导控件）
- `src/shared/schemaForm/model/fieldPath.ts` - 迁：`parseFieldPath` / `getParentFieldPath` / `getShortField` / `setByFieldPath` / `deleteByFieldPath` / `insertAfterFieldPath`（含原型污染拦截）
- `src/shared/schemaForm/model/schemaPresentation.ts` - 迁：`buildSchemaPresentation` / `buildSchemaTree`（schema 视图行树 + 成对关键字合行）
- `src/shared/schemaForm/model/traversal.ts` - 迁：`buildTableTree`（数据 + schema → 行树，按引用缓存）
- `src/shared/schemaForm/model/validation.ts` - 迁：`validateId` / `validateValue`（共享 ajv 实例 + 校验器缓存）
- `src/shared/schemaForm/model/index.ts` - 新：五条 `export *` 桶
- `src/shared/schemaForm/index.ts` - 改：追加 `export * from './model'`
- `src/table/tablePanel.ts` - 改：四条模型 import 改指 `../shared/schemaForm/model/*`
- `src/table/components/TableGrid.tsx` / `TableRow.tsx` / `GapRow.tsx` - 改：模型 import 改指 `../../shared/schemaForm/model/*`
- `src/table/__tests__/validation.test.ts` / `inputs.test.tsx` / `performance.uat.test.tsx` - 改：模型 import 改指 `../../shared/schemaForm/model/*`
- `src/table/index.ts` - 改：去掉 `export * from './model'`
- `src/table/model/{control,fieldPath,schemaPresentation,traversal,validation}.ts` 与 `src/table/model/index.ts` - 删：旧位置（内容已迁至 shared/schemaForm/model）

## Decisions Made

- **只搬不改。** 五个文件以 `git mv` 整体移动，`git show HEAD:` 基线逐文件比对 `===` 全部相等；`../types` 在 `shared/schemaForm/model/` 下正好解析到 `shared/schemaForm/types.ts`、`./fieldPath` 仍在同目录，目录形状一一对应，故无需改动任何一行。
- **`table` 不转发模型。** 代码风格禁止「一个文件导出不属于本文件夹的内容」，故 `table/index.ts` 直接删除 `./model` 导出、不给跨目录转发；模型层对外由 `./shared`（经 `schemaForm` 桶）暴露。
- **搬迁与引用改指分两个提交，收口在第三个。** Task 1 只搬文件（旧位置仅剩空桶），Task 2 只改引用，Task 3 删空桶与桶转发——沿用 03-05 的节奏，使每次提交的意图单一。

## Deviations from Plan

### Plan-doc inconsistency (not a code defect)

**1. [Rule 3 - Blocking / plan gate unsatisfiable] Task 2 的 `typecheck` 门禁无法单独为绿**
- **Found during:** Task 2（把表格侧引用改指到新位置）
- **Issue:** Task 2 的 `<verify>` 要求 `pnpm --filter @motajs/editor-impl typecheck` 退出 0，但 Task 2 的同段 `<action>` 又明确要求「不要动仍留在 `table/model/index.ts` 的任何东西（Task 3 删）」。由于 `table/model/index.ts` 仍逐条 `export *` 指向已被移走的五个文件，TS 报 5 条 `TS2307`；且 `table/index.ts` 的 `export * from './model'` 又会经该空桶解析失败——**要让它变绿，必须同时删掉空桶并去掉 `table/index.ts` 的转发，而这正是 Task 3 的两项动作**。即 Task 2 的 typecheck 门禁在「尊重 Task 3 文件归属」的前提下不可能单独满足。
- **Fix:** 保持计划的文件归属与提交边界不变——Task 2 只做引用改指并按其结构断言提交（`pnpm typecheck` 在这一中间态报的 5 条 `TS2307` **全部**落在待删的 `table/model/index.ts` 内，无其它错误）；Task 3 删除空桶与转发后，整包 `test` 与 `typecheck` 全绿。该中间态与 Task 1（文件已移、引用未改）一样是计划自身设计的过渡红，Task 1 的 `<verify>` 亦只做结构检查、不含 typecheck，印证作者接受过渡红。
- **Files modified:** 无（未超出计划授权范围）
- **Verification:** Task 2 结构断言通过；Task 3 的 `pnpm --filter @motajs/editor-impl test`（191/191）与 `typecheck`（退出码 0）全绿。
- **Committed in:** Task 2 `39a9f8c`（引用改指）、Task 3 `bfb1fa0`（删空桶 + 去转发）

---

**Total deviations:** 0 auto-fixed code changes（仅 1 处计划文档内部矛盾，按计划文件归属处置并如实记录）
**Impact on plan:** 无代码影响。计划级 `<verification>` 三条命令全部通过，成功标准全部满足；唯一影响是 Task 2 这一中间提交不是独立 typecheck-green（与 Task 1 同性质的过渡态）。

## Issues Encountered

None - 除上述计划文档门禁矛盾外，执行过程无意外。

## User Setup Required

None - 本计划纯代码搬迁与引用改指，无外部服务或环境变量。

## Known Stubs

None - 本计划只搬既有实现与新增桶 / 改指引用，不含桩或占位。

## Threat Flags

None - 未新增网络端点、鉴权路径或文件访问。搬迁的 `setByFieldPath` 保留 `__proto__` / `constructor` / `prototype` 写入拦截（T-03-16 mitigate，`validation.test.ts` 相关用例随整包 191 用例全绿）；整文件字节级相等证明纯移动未被「顺手改逻辑」（T-03-18 mitigate）；`buildTableTree` 复杂度与 Phase 2 相同、本次仅换位置（T-03-17 accept）。

## Next Phase Readiness

- `shared/schemaForm/model` 成为 schema 模型的唯一实现位置，`asset` 可直接 import `../../shared/schemaForm/model` 而不触发 `asset → table`（D-28 前提落地）。
- 03-07（表单渲染迁移到 `shared/schemaForm/components`）可在此之上继续向 `shared/` 迁移；03-10（素材面板数据层）、03-14（每素材配置表单）可直接复用同一份模型实现。
- 无阻塞。

---

## Self-Check: PASSED

- FOUND: packages/libs/editor-impl/src/shared/schemaForm/model/control.ts
- FOUND: packages/libs/editor-impl/src/shared/schemaForm/model/fieldPath.ts
- FOUND: packages/libs/editor-impl/src/shared/schemaForm/model/schemaPresentation.ts
- FOUND: packages/libs/editor-impl/src/shared/schemaForm/model/traversal.ts
- FOUND: packages/libs/editor-impl/src/shared/schemaForm/model/validation.ts
- FOUND: packages/libs/editor-impl/src/shared/schemaForm/model/index.ts
- ABSENT (expected): packages/libs/editor-impl/src/table/model/
- FOUND commit: 0a98f0b (Task 1)
- FOUND commit: 39a9f8c (Task 2)
- FOUND commit: bfb1fa0 (Task 3)

*Phase: 03-asset*
*Completed: 2026-10-17*
