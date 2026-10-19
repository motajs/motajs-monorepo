---
phase: 03-asset
plan: 21
subsystem: ui
tags: [schema-form, select-input, enum-labels, asset-schema, editor-impl, gap-closure]

requires:
  - phase: 03-asset
    provides: IEnumTitleMap / x-enum-titles 扩展键 / ISelectInputProps.titles（03-20 契约）
provides:
  - 共享下拉按 x-enum-titles 渲染中文标签，提交值仍是原类型（数字仍是数字）
  - TableRow 把字段的 x-enum-titles 透传给共享下拉
  - 内置图片 read / usage 与音频 type 三组中文标签
affects: [03-verify（G-03-6 验收）]

actuals:
  tokens: 3529
  tasks: 2
  commits: 2
  plan_head_before: e2157f2658c90f0f266d80a6fea699066f60a45c

tech-stack:
  added: []
  patterns:
    - "标签只替换选项 label；选项 value 仍是 JSON 文本、提交仍 JSON.parse，显示与存储解耦"
    - "标签映射的键取枚举值的 String 形式（数字 0 → \"0\"，字符串原样），不用 JSON.stringify 以免多一层引号"

key-files:
  created:
    - packages/libs/editor-impl/src/shared/schemaForm/__tests__/selectInput.test.tsx
  modified:
    - packages/libs/editor-impl/src/shared/schemaForm/components/inputs/SelectInput.tsx
    - packages/libs/editor-impl/src/shared/schemaForm/components/TableRow.tsx
    - packages/libs/editor-impl/src/shared/schemaForm/__tests__/enumTitlesContract.test.ts
    - packages/libs/editor-impl/src/asset/schemas/builtInSchemas.ts
    - packages/libs/editor-impl/src/asset/model/__tests__/assetConfig.test.ts
    - packages/libs/editor-impl/src/asset/__tests__/assetUndo.uat.test.tsx

key-decisions:
  - "标签映射键用 String(option)：数字 0 对应 `\"0\"`，字符串枚举原样，避免 JSON.stringify 给字符串多套一层引号"
  - "选中值与 onChange 的 JSON.parse 逻辑一律不动，标签只影响 Select 的 label"
  - "内置标签沿用 INTERFACE-NAME 已确认文案：读取方式 整图/网格/逐行动画/逐列动画/扫描动画；用途 常规图/图块/图块集；音频类型 背景音乐/音效"

patterns-established:
  - "枚举展示：schema 携带 x-enum-titles，控件只改 label、不改 value，实现「显示标签、存储原值」"

requirements-completed: [ASSET-01]

coverage:
  - id: D1
    description: "共享枚举下拉按 schema 的标签映射显示中文标签；不传标签时仍显示原值；点选后提交的仍是原值（数字 1 而不是 '1'）"
    requirement: "ASSET-01"
    verification:
      - kind: unit
        ref: "packages/libs/editor-impl/src/shared/schemaForm/__tests__/selectInput.test.tsx#数字枚举显示标签并按数字原值提交"
        status: pass
      - kind: unit
        ref: "packages/libs/editor-impl/src/shared/schemaForm/__tests__/selectInput.test.tsx#字符串枚举显示标签并按字符串原值提交"
        status: pass
      - kind: unit
        ref: "packages/libs/editor-impl/src/shared/schemaForm/__tests__/selectInput.test.tsx#不传标签时显示原值"
        status: pass
      - kind: unit
        ref: "packages/libs/editor-impl/src/shared/schemaForm/__tests__/enumTitlesContract.test.ts#传入标签时选中项显示标签"
        status: pass
      - kind: other
        ref: "pnpm --filter @motajs/editor-impl typecheck"
        status: pass
    human_judgment: false
  - id: D2
    description: "内置图片 read / usage 与音频 type 字段都带完整中文标签，enum 仍是数字数组、required 不变"
    requirement: "ASSET-01"
    verification:
      - kind: unit
        ref: "packages/libs/editor-impl/src/asset/model/__tests__/assetConfig.test.ts#图片读取方式带完整标签"
        status: pass
      - kind: unit
        ref: "packages/libs/editor-impl/src/asset/model/__tests__/assetConfig.test.ts#图片用途带中文标签"
        status: pass
      - kind: unit
        ref: "packages/libs/editor-impl/src/asset/model/__tests__/assetConfig.test.ts#音频类型带中文标签"
        status: pass
      - kind: unit
        ref: "pnpm --filter @motajs/editor-impl test（41 文件 / 329 用例全绿）"
        status: pass
    human_judgment: false

duration: 15min
completed: 2026-10-19
status: complete
---

# Phase 3 Plan 21: 枚举标签渲染与内置素材标签 Summary

**共享下拉按 schema 的 `x-enum-titles` 显示「整图 / 网格 / 图块集」等中文标签，点选后写回的仍是数字；内置图片 / 音频三组枚举全部带上中文标签，表格与素材 329 个既有用例零回归。**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-10-19T20:15:21+08:00
- **Completed:** 2026-10-19T20:30:32+08:00
- **Tasks:** 2
- **Files modified:** 7（6 改 + 1 新建）

## Accomplishments

- `SelectInput` 的选项 `label` 先查标签映射：`enumTitleKey` 把数字 `0` 归一为 `"0"`、字符串原样；未命中时保持原有「字符串原样 / 其余 JSON 文本」逻辑。选项 `value` 与 `onChange` 的 `JSON.parse` 一律未动，所以写回类型不变。
- `TableRow` 的 `TableControlKind.Select` 分支把 `config['x-enum-titles']` 透传给下拉，表格其它调用点无需改动。
- 内置 schema：图片 `read`（5 个值）、`usage`（3 个值）与音频 `type`（2 个值）各带一组 `Object.freeze` 标签常量，`description` 只留「读取方式 / 用途 / 音频类型」，`enum` 与 `required` 未动。
- 测试：契约测试改为断言标签并补「不传标签仍显示原值」；新增下拉组件级回归测试（数字 / 字符串 / 无标签三种）；素材 schema 补三组标签断言与数字枚举断言。

## Task Commits

Each task was committed atomically:

1. **Task 1: 下拉按标签显示、按原值提交** - `a1e1f67` (feat)
2. **Task 2: 给内置图片 / 音频 schema 补中文标签** - `600b685` (feat)

**Plan metadata:** 见本次 docs 提交

## Files Created/Modified

- `packages/libs/editor-impl/src/shared/schemaForm/components/inputs/SelectInput.tsx` - 新增 `enumTitleKey`，`optionLabel` 接受标签映射并优先用标签
- `packages/libs/editor-impl/src/shared/schemaForm/components/TableRow.tsx` - `Select` 分支透传 `x-enum-titles`
- `packages/libs/editor-impl/src/shared/schemaForm/__tests__/selectInput.test.tsx` - 下拉标签渲染 / 原值提交 3 用例
- `packages/libs/editor-impl/src/shared/schemaForm/__tests__/enumTitlesContract.test.ts` - 断言从「显示原值」改为「显示标签」，并保留无标签基线
- `packages/libs/editor-impl/src/asset/schemas/builtInSchemas.ts` - 三组 `IEnumTitleMap` 常量与三个字段的 `x-enum-titles`
- `packages/libs/editor-impl/src/asset/model/__tests__/assetConfig.test.ts` - 三组标签断言（含 `read.enum` 仍为数字）
- `packages/libs/editor-impl/src/asset/__tests__/assetUndo.uat.test.tsx` - 配置表单显示值断言从 `'0' / '2'` 改为 `'整图' / '逐行动画'`

## Decisions Made

- 标签映射的键用 `String(option)`，不用 `JSON.stringify`：后者会把字符串枚举的键写成带引号的 `"full"`，与 `IEnumTitleMap` 的约定不符。
- 保持「显示与存储解耦」：只改 `label`，`value` 仍是 `JSON.stringify(option)`，提交仍走 `JSON.parse`，因此 `read` / `usage` / `type` 写回仍为 number。
- 标签文案严格采用 `INTERFACE-NAME.md` §03-21 已确认的写法。

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] 既有 UAT 测试按旧显示文本断言**
- **Found during:** Task 2 全量测试
- **Issue:** `assetUndo.uat.test.tsx` 的三个用例断言配置表单显示 `'2'` / `'0'`，而本计划正是把显示改成中文标签，导致 3 个用例失败。
- **Fix:** 把显示值断言改为 `'逐行动画'` / `'整图'`；撤销、重做、屏障的语义断言未动。
- **Files modified:** `packages/libs/editor-impl/src/asset/__tests__/assetUndo.uat.test.tsx`
- **Verification:** `pnpm --filter @motajs/editor-impl test` 41 文件 / 329 用例全绿
- **Committed in:** `600b685`（Task 2 提交）

**2. [Rule 3 - Blocking] antd 6 的下拉 DOM 类名与计划所写不同**
- **Found during:** Task 1 新增下拉测试
- **Issue:** 计划要求用 `.ant-select-selector` 打开下拉，但当前 antd 6.2.1 渲染的是 `.ant-select-content`（选中值在 `.ant-select-content-value`），按计划选择器取到 null，测试无法打开下拉。
- **Fix:** 测试改用 `.ant-select-content` 打开下拉、`.ant-select-content-value` 读选中文本；选项仍按计划的 `.ant-select-item-option-content` 查找。未使用全局 `document`，浮层经 `baseElement` 查找。
- **Files modified:** `packages/libs/editor-impl/src/shared/schemaForm/__tests__/selectInput.test.tsx`
- **Verification:** 下拉测试 3/3 通过；ESLint / Prettier / typecheck 通过
- **Committed in:** `a1e1f67`（Task 1 提交）

---

**Total deviations:** 2 auto-fixed (1 bug, 1 blocking)
**Impact on plan:** 均为实现层适配，未改变「显示标签、写回数字」的目标；无范围扩张。

## Issues Encountered

None。

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- G-03-6 的第二步已落地：共享下拉与内置素材 schema 都能显示中文标签，数据格式未变。
- 工程内自定义 schema 只要带 `x-enum-titles` 即可获得同样的标签显示；不带则保持原值。

---

*Phase: 03-asset*
*Completed: 2026-10-19*

## Self-Check: PASSED

- FOUND: packages/libs/editor-impl/src/shared/schemaForm/__tests__/selectInput.test.tsx
- FOUND: packages/libs/editor-impl/src/shared/schemaForm/components/inputs/SelectInput.tsx
- FOUND: packages/libs/editor-impl/src/shared/schemaForm/components/TableRow.tsx
- FOUND: packages/libs/editor-impl/src/asset/schemas/builtInSchemas.ts
- FOUND: a1e1f67 (Task 1)
- FOUND: 600b685 (Task 2)
- `pnpm --filter @motajs/editor-impl test -- src/shared/schemaForm/__tests__` 2 文件 / 6 用例通过
- `pnpm --filter @motajs/editor-impl test` 41 文件 / 329 用例全绿
- `pnpm --filter @motajs/editor-impl typecheck` exit 0
- `coreModuleState.js` / `coreImportType.js` / `coreEngineNeutral.js` / `coreBoundaries.js` 全部 exit 0
