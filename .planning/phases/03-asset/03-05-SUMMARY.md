---
phase: 03-asset
plan: 05
subsystem: editor-impl-shared
tags: [typescript, jsonc, json5, module-relocation, asset]

# Dependency graph
requires:
  - phase: 03-asset
    provides: "中立目录 src/shared（shared/index.ts + shared/schemaForm），本计划向它加入 shared/jsonc"
provides:
  - "中立 `.jsonc` 编解码实现 src/shared/jsonc（parseTableText / serializeTableText / SYSTEM_PREFIX_END_MARKER / TableTextParseStatus / ITableTextParseResult），表格与开发宿主共用"
  - "`@motajs/editor-impl/shared` 包子路径（package.json exports['./shared']）"
affects: [03-06, 03-07, 03-08, 03-10, 03-12, 03-14, 03-15, 03-17]

actuals:
  tokens: 1503
  tasks: 3
  commits: 3
plan_head_before: dda04414c6782a1772af5efcb4d6daa9df825657

tech-stack:
  added: []
  patterns:
    - "跨能力共享的实现代码放中立 src/shared/<域>，table 与 asset 双向共用而不互相 import（D-28）"
    - "搬迁用字节级相等断言验证——只允许整体搬迁，禁止「顺手改逻辑」"

key-files:
  created:
    - packages/libs/editor-impl/src/shared/jsonc/tableText.ts
    - packages/libs/editor-impl/src/shared/jsonc/index.ts
  modified:
    - packages/libs/editor-impl/src/shared/index.ts
    - packages/libs/editor-impl/src/table/model/index.ts
    - packages/libs/editor-impl/src/table/tablePanel.ts
    - packages/libs/editor-impl/package.json
    - packages/apps/editor-dev/src/demo/tableDemo.ts
    - packages/apps/editor-dev/src/__tests__/devHostJsonc.test.tsx
    - packages/apps/editor-dev/src/__tests__/devHostCodeEditor.test.tsx

key-decisions:
  - "`.jsonc` 编解码整体搬到 shared/jsonc，不重写一行逻辑——「系统前缀逐字保留」（D-24）重新实现必错，只搬不改"
  - "`./table` 不转发 `.jsonc` / schema 符号（代码风格禁止跨目录导出不属于本文件夹的内容），开发宿主三处导入改到 `@motajs/editor-impl/shared`"
  - "旧 tableText.test.ts 随代码一起 git mv 到 shared/jsonc/__tests__，只改第一处 import，断言一字不改"

patterns-established:
  - "中立共享实现：table 与未来的 asset 都从 shared/jsonc 取 `.jsonc` 编解码，互不 import（D-28 落地）"

requirements-completed: [ASSET-01]

coverage:
  - id: D1
    description: "`.jsonc` 解析 / 写回（含系统前缀逐字保留）成为中立目录 shared/jsonc 里的唯一实现；表格改从新位置引用，行为零变化"
    requirement: "ASSET-01"
    verification:
      - kind: unit
        ref: "packages/libs/editor-impl/src/shared/jsonc/__tests__/tableText.test.ts（10 tests）+ pnpm --filter @motajs/editor-impl test（191/191 通过）"
        status: pass
      - kind: other
        ref: "node scripts/verify/... 字节级相等断言（shared/jsonc/tableText.ts 与 table/model/tableText.ts 逐字节一致）+ pnpm --filter @motajs/editor-impl typecheck（退出码 0）"
        status: pass
    human_judgment: false
  - id: D2
    description: "`@motajs/editor-impl/shared` 子路径可被包外消费者引用；开发宿主三处导入从 ./table 改到 ./shared 后 typecheck 与 devHost 端到端测试全绿"
    requirement: "ASSET-01"
    verification:
      - kind: integration
        ref: "packages/apps/editor-dev/src/__tests__/devHostJsonc.test.tsx + devHostCodeEditor.test.tsx（pnpm --filter @motajs/editor-dev test -- devHost：4 files / 20 tests 通过）"
        status: pass
      - kind: other
        ref: "pnpm --filter @motajs/editor-dev typecheck（退出码 0）"
        status: pass
    human_judgment: false

duration: 9min
completed: 2026-10-17
status: complete
---

# Phase 3 Plan 05: `.jsonc` 编解码抽到 `shared/jsonc` Summary

**把表格里那份 `.jsonc` 解析 / 写回（含系统前缀注释块逐字保留）整体搬进中立目录 `shared/jsonc`，并给 `@motajs/editor-impl` 加一个 `./shared` 子路径，让表格与素材将来共用同一份、不再各写各的。**

## Performance

- **Duration:** 9 min
- **Started:** 2026-10-17T14:27:44Z
- **Completed:** 2026-10-17T14:36:33Z
- **Tasks:** 3
- **Files modified:** 9 (2 created, 3 deleted/renamed, 4 modified)

## Accomplishments
- `.jsonc` 编解码（`parseTableText` / `serializeTableText` / `SYSTEM_PREFIX_END_MARKER` / `TableTextParseStatus` / `ITableTextParseResult`）逐字节（4,127 bytes，`===` 校验）搬到中立目录 `src/shared/jsonc/tableText.ts`，一行逻辑、一处注释都没改——满足 D-24「系统前缀逐字保留」不能重写的硬要求。
- 新增 `shared/jsonc/index.ts` 桶并把 `shared/index.ts` 扩成同时导出 `./schemaForm` 与 `./jsonc`；表格桶 `table/model/index.ts` 去掉 `tableText` 导出，`tablePanel.ts` 改为从 `../shared/jsonc` 取同三个符号（调用点一字未动）。
- `package.json` 新增 `"./shared": "./src/shared/index.ts"` 子路径——`./table` 不再转发 `.jsonc` / schema 符号（代码风格禁止跨目录导出）。
- 编解码测试随代码整体 `git mv` 到 `shared/jsonc/__tests__/tableText.test.ts`（保留历史，只改第一处 import），10 个用例全绿。
- 开发宿主三处（`tableDemo.ts` / `devHostJsonc.test.tsx` / `devHostCodeEditor.test.tsx`）改从 `@motajs/editor-impl/shared` 取共享符号，`tablePanelType` 仍从 `/table` 取；`editor-dev` typecheck 与 4 个 devHost 端到端文件（20 用例）全绿。

## Task Commits

Each task was committed atomically:

1. **Task 1: 在中立目录落一份同源代码与桶文件** - `746917d` (refactor)
2. **Task 2: 切换表格引用、删除旧文件、加 `./shared` 子路径、迁移测试** - `1fdfee2` (refactor)
3. **Task 3: 开发宿主的导入改到 `./shared`** - `c5616e3` (refactor)

**Plan metadata:** (本 SUMMARY 提交) (docs)

_Note: 本计划为纯搬迁，无 TDD 循环。_

## Files Created/Modified

- `packages/libs/editor-impl/src/shared/jsonc/tableText.ts` - 新：表格 `.jsonc` 编解码的逐字副本（含文件级注释、`json5` import、三个私有工具函数）
- `packages/libs/editor-impl/src/shared/jsonc/index.ts` - 新：`export * from './tableText';`
- `packages/libs/editor-impl/src/shared/index.ts` - 改：在 `./schemaForm` 之后追加 `export * from './jsonc';`
- `packages/libs/editor-impl/src/table/model/tableText.ts` - 删：旧位置（内容已迁至 shared/jsonc）
- `packages/libs/editor-impl/src/table/model/index.ts` - 改：删掉 `export * from './tableText';`
- `packages/libs/editor-impl/src/table/tablePanel.ts` - 改：第 27 行 import 由 `./model/tableText` 改为 `../shared/jsonc`（覆盖读 / 写 / 注释剥离三条分支）
- `packages/libs/editor-impl/src/shared/jsonc/__tests__/tableText.test.ts` - 迁：自 `table/__tests__/` git mv 而来，仅改第一处 import 为 `../tableText`
- `packages/libs/editor-impl/package.json` - 改：exports 新增 `./shared`
- `packages/apps/editor-dev/src/demo/tableDemo.ts` - 改：`ITableSchemaNode` / `SYSTEM_PREFIX_END_MARKER` 改由 `@motajs/editor-impl/shared` 取
- `packages/apps/editor-dev/src/__tests__/devHostJsonc.test.tsx` - 改：`parseTableText` / `SYSTEM_PREFIX_END_MARKER` / `TableTextParseStatus` 改由 `./shared` 取
- `packages/apps/editor-dev/src/__tests__/devHostCodeEditor.test.tsx` - 改：`parseTableText` / `serializeTableText` / `SYSTEM_PREFIX_END_MARKER` 改由 `./shared` 取

## Decisions Made

- **只搬不改。** 用字节级相等断言（`a !== b`）验证 `shared/jsonc/tableText.ts` 与源文件完全一致，杜绝搬迁时改动前缀处理逻辑——D-24 的前缀逐字保留是硬要求，重新实现必然出错。
- **`./table` 不转发。** 代码风格禁止「一个文件导出不属于本文件夹的内容」，故不给 `table` 加跨目录 `export *`；仓库内唯一外部消费者（开发宿主）改到 `./shared`（对应 `INTERFACE-NAME.md` §03-05 的偏离 #3）。
- **测试随代码走。** 用 `git mv` 迁移测试保留历史，只改第一处 import；断言与用例名一字未改，确保「行为不变」可被原测试直接证明。

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- **额外门禁 `implExports.js` / `coreExports.js` 非零退出（预先存在，非本计划所致）。** 计划 `<verification>` 只要求 3 条命令（editor-impl test / typecheck、editor-dev typecheck + devHost），全部通过。额外跑的边界门禁中，`implExports.js` 与 `coreExports.js` 报 `./map` / `./shell` 子路径在磁盘上不存在等问题；已确认这些在台账基点 `dda0441` 就存在、且新增的 `./shared` 未被涉及——属范围外，记入 `deferred-items.md`，不在本计划修复（SCOPE BOUNDARY）。
- 其余边界门禁 `coreBoundaries` / `coreEngineNeutral` / `coreImportType` / `coreModuleState` 均退出码 0，0 违规。

## User Setup Required

None - 本计划纯代码搬迁与包子路径新增，无外部服务或环境变量。

## Known Stubs

None - 本计划只搬迁既有实现与新增桶 / 子路径，不含桩或占位。

## Threat Flags

None - 未新增网络端点、鉴权路径或文件访问；新增的 `./shared` 子路径只暴露文本编解码与 schema 类型，不含宿主路径或凭据（T-03-15 accept）。搬迁的字节级相等断言满足 T-03-13 的 mitigate 处置。

## Next Phase Readiness

- `shared/jsonc` 成为 `.jsonc` 编解码的唯一实现，03-06（schema 模型迁移）、03-07（表单渲染迁移）可继续向 `shared/` 迁移；03-10（素材面板数据层）可直接用 `serializeTableText` 写回列表并逐字保留前缀。
- `@motajs/editor-impl/shared` 子路径就位，包外消费者（开发宿主，及将来的装配方）有稳定入口引用共享件。
- 无阻塞。

---

## Self-Check: PASSED

- FOUND: packages/libs/editor-impl/src/shared/jsonc/tableText.ts
- FOUND: packages/libs/editor-impl/src/shared/jsonc/index.ts
- FOUND: packages/libs/editor-impl/src/shared/jsonc/__tests__/tableText.test.ts
- ABSENT (expected): packages/libs/editor-impl/src/table/model/tableText.ts
- FOUND commit: 746917d (Task 1)
- FOUND commit: 1fdfee2 (Task 2)
- FOUND commit: c5616e3 (Task 3)

*Phase: 03-asset*
*Completed: 2026-10-17*
