---
phase: 03-asset
plan: 20
subsystem: ui
tags: [schema-form, json-schema, select-input, enum-labels, editor-impl, contract]

requires:
  - phase: 03-asset
    provides: shared schemaForm 类型目录与共享下拉控件（03-02 / 03-06 / 03-07 迁移结果）
provides:
  - IEnumTitleMap（枚举值字符串 → 显示标签的映射类型）
  - ITableSchemaNode['x-enum-titles'] 可选扩展键（沿 x-editor / x-control / x-order 约定）
  - ISelectInputProps.titles 可选 props（共享下拉先接受标签映射，渲染留待 03-21）
  - 契约测试 enumTitlesContract.test.ts（钉住「可携带 / 可读出」与「不传标签时行为基线不变」）
affects: [03-21（枚举标签渲染与内置素材标签）]

actuals:
  tokens: 884
  tasks: 2
  commits: 2

tech-stack:
  added: []
  patterns:
    - "schema 扩展键：新增能力先经可选 `x-*` 扩展键声明，缺省时向后兼容既有 schema 字面量"
    - "两步契约：03-20 只声明契约（类型 + 可选 props，零渲染改动），03-21 才落地渲染"

key-files:
  created:
    - packages/libs/editor-impl/src/shared/schemaForm/__tests__/enumTitlesContract.test.ts
  modified:
    - packages/libs/editor-impl/src/shared/schemaForm/types.ts
    - packages/libs/editor-impl/src/shared/schemaForm/components/inputs/SelectInput.tsx

key-decisions:
  - "契约与渲染拆成两个计划：本计划只加可选类型 / props，不读取 props.titles，保证表格既有行为零变化"
  - "IEnumTitleMap 用单索引签名（键为枚举值字符串形式，数字 0 记为 \"0\"），避免为每种枚举另造映射类型"

patterns-established:
  - "枚举标签契约：schema 侧 `x-enum-titles` + 控件侧 `titles` props，两处均为可选，缺省即原值"

requirements-completed: [ASSET-01]

coverage:
  - id: D1
    description: "共享 schema 类型可携带枚举标签映射（IEnumTitleMap + 可选 x-enum-titles），现有 schema 字面量无需改动即可编译"
    requirement: "ASSET-01"
    verification:
      - kind: unit
        ref: "packages/libs/editor-impl/src/shared/schemaForm/__tests__/enumTitlesContract.test.ts#schema 可携带并按字符串键读出枚举标签"
        status: pass
      - kind: other
        ref: "pnpm --filter @motajs/editor-impl typecheck"
        status: pass
    human_judgment: false
  - id: D2
    description: "共享枚举下拉先接受 titles 映射；不传（或传入但尚未使用）时选中项与提交值仍是原值，渲染行为保持不变"
    requirement: "ASSET-01"
    verification:
      - kind: unit
        ref: "packages/libs/editor-impl/src/shared/schemaForm/__tests__/enumTitlesContract.test.ts#传入标签时选中项仍显示原值"
        status: pass
      - kind: unit
        ref: "pnpm --filter @motajs/editor-impl test（39 文件 / 318 用例全绿，含表格 300+ 既有用例）"
        status: pass
    human_judgment: false

duration: 5min
completed: 2026-10-19
status: complete
---

# Phase 3 Plan 20: 枚举标签接口（schema 扩展键与下拉 props）Summary

**共享 schema 增加 `x-enum-titles` 可选扩展键、共享下拉增加可选 `titles` props——只定契约不改渲染，表格 300+ 既有用例零回归。**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-10-19T19:45:00Z
- **Completed:** 2026-10-19T19:50:00Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- 在 `shared/schemaForm/types.ts` 声明 `IEnumTitleMap`（枚举值字符串形式 → 显示标签），并给 `ITableSchemaNode` 增加可选的 `x-enum-titles` 扩展键，沿用既有 `x-editor` / `x-control` / `x-order` 约定；缺省时行为与新增前一致。
- 在共享下拉 `SelectInput.tsx` 的 props 上增加可选 `titles`，**不读取**它——纯契约变更，渲染逻辑保持现值（`JSON.stringify` 作选项 value）。
- 新增契约测试 `enumTitlesContract.test.ts`，钉住「schema 可携带并按字符串键读出标签」与「传入标签时选中项仍显示原值 0」两条基线（后者在 03-21 会改为断言标签「整图」，作为缺省 / 接入两态的分界）。

## Task Commits

Each task was committed atomically:

1. **Task 1: 在共享 schema 类型里声明枚举标签扩展键** - `db91fe9` (feat)
2. **Task 2: 让枚举下拉接受标签映射，并钉住「不传时行为不变」** - `20544c8` (feat)

**Plan metadata:** (见下方本次 docs 提交)

## Files Created/Modified

- `packages/libs/editor-impl/src/shared/schemaForm/types.ts` - 新增 `IEnumTitleMap`；`ITableSchemaNode['x-enum-titles']` 可选扩展键
- `packages/libs/editor-impl/src/shared/schemaForm/components/inputs/SelectInput.tsx` - `ISelectInputProps.titles?`（可选，暂未读取）
- `packages/libs/editor-impl/src/shared/schemaForm/__tests__/enumTitlesContract.test.ts` - 契约测试（2 用例）

## Decisions Made

- 契约与渲染拆两个计划：本计划只声明类型 / 可选 props，不读取 `props.titles`，确保表格既有 schema 与渲染结果一字不变。
- `IEnumTitleMap` 用单个索引签名（键为枚举值的字符串形式：数字 `0` → `"0"`，字符串原样），不为每种枚举另造映射类型。
- 测试文件为 `.ts`，用 `createElement(SelectInput, {...})` 渲染（不用 JSX）。

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None。

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- 共享层已「能接收」枚举标签，但尚未使用它；表格与素材配置的现有渲染路径零变化。
- 03-21 可直接读取 `props.titles` 渲染标签、写回原值，并给内置图片 / 音频 schema 补 `x-enum-titles`；本计划的契约测试中「选中项仍显示原值」一条届时会改成断言标签。

---
*Phase: 03-asset*
*Completed: 2026-10-19*

## Self-Check: PASSED

- FOUND: packages/libs/editor-impl/src/shared/schemaForm/types.ts
- FOUND: packages/libs/editor-impl/src/shared/schemaForm/components/inputs/SelectInput.tsx
- FOUND: packages/libs/editor-impl/src/shared/schemaForm/__tests__/enumTitlesContract.test.ts
- FOUND: .planning/phases/03-asset/03-20-SUMMARY.md
- FOUND: db91fe9 (Task 1)
- FOUND: 20544c8 (Task 2)
- typecheck exit 0; 契约测试 2/2 通过; 整套 test 39 文件 / 318 用例全绿; coreImportType 门禁通过
