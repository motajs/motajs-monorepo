---
phase: 04-map
plan: 06
subsystem: map
tags: [passability, recent-tiles, dirty-state, validation, pure-model]

requires:
  - phase: 04-map
    provides: "中立文档 / 图块目录类型、渲染模型（04-03 已消费 passMarks）、几何与笔刷模型（04-05）"
provides:
  - "computePassabilityMarks：只读四方向通行度标记，直接喂给 buildMapRenderModel"
  - "normalizeRecentTiles / updateRecentTiles：对坏数据免疫的最近使用列表运算"
  - "isMapDataDirty / isMapPropertiesDirty：基线比较式脏判定"
  - "validateMapName / validateLayerName / validateMapSize：返回错误文案或 null 的纯校验"
affects: [04-map 面板数据层, 04-map 弹窗, 04-map 画布与工具栏]

actuals:
  tokens: 6757
  tasks: 3
  commits: 3
  plan_head_before: ac50353bbeb454383aae8e1d6ff3f8b63f62d001

tech-stack:
  added: []
  patterns:
    - "纯模型：只接收数据、只返回新值，不读文件、不碰渲染、不进撤销"

key-files:
  created:
    - packages/libs/editor-impl/src/map/model/passability.ts
    - packages/libs/editor-impl/src/map/model/recentTiles.ts
    - packages/libs/editor-impl/src/map/model/dirty.ts
    - packages/libs/editor-impl/src/map/model/validation.ts
    - packages/libs/editor-impl/src/map/__tests__/model.passability.test.ts
    - packages/libs/editor-impl/src/map/__tests__/model.recentTiles.test.ts
    - packages/libs/editor-impl/src/map/__tests__/model.dirty.test.ts
    - packages/libs/editor-impl/src/map/__tests__/model.validation.test.ts
  modified:
    - packages/libs/editor-impl/src/map/model/index.ts

key-decisions:
  - "通行度只画「不可通行」方向：out 或 in 任一为 false 即标；空格、未知编号、普通层上的 onlyEventLayer 图块都不输出"
  - "最近使用模型只做纯列表运算，目录编号集合由面板传入，不 import 资源层或 fs"
  - "脏判定按数组位置 + 图层标识逐层比较，发现首个差异立即返回；基线为空时文档只要有图层即视为脏"
  - "尺寸校验没有上限时只校验正整数，文案为「宽度 / 高度必须是正整数。」；有上限时逐字使用 UI-SPEC 的整句"

patterns-established:
  - "只读派生数据：模型输出直接作为渲染模型输入，渲染模型不自己算"
  - "坏输入退化：最近使用模型对任意输入返回数组，不抛错"

requirements-completed: [MAP-01]

coverage:
  - id: D1
    description: "只读通行度：每格只输出不可通行方向，空格 / 未知编号 / 普通层的 onlyEventLayer 图块不输出；输出可直接喂给渲染模型得到箭头或红点"
    requirement: MAP-01
    verification:
      - kind: unit
        ref: "packages/libs/editor-impl/src/map/__tests__/model.passability.test.ts"
        status: pass
      - kind: unit
        ref: "packages/libs/editor-impl/src/map/__tests__/model.renderModel.test.ts"
        status: pass
    human_judgment: false
  - id: D2
    description: "最近使用列表：过滤非正整数与未知编号、去重保序、按上限截断、置顶更新，坏输入不抛错"
    requirement: MAP-01
    verification:
      - kind: unit
        ref: "packages/libs/editor-impl/src/map/__tests__/model.recentTiles.test.ts"
        status: pass
    human_judgment: false
  - id: D3
    description: "脏状态：文档几何 / 图层名 / 图层顺序 / 属性表与基线比较，撤销回基线后重新变干净"
    requirement: MAP-01
    verification:
      - kind: unit
        ref: "packages/libs/editor-impl/src/map/__tests__/model.dirty.test.ts"
        status: pass
    human_judgment: false
  - id: D4
    description: "名字与尺寸校验：空名 / 重名 / 非整数 / 越界返回逐字文案或 null，超限不夹取"
    requirement: MAP-01
    verification:
      - kind: unit
        ref: "packages/libs/editor-impl/src/map/__tests__/model.validation.test.ts"
        status: pass
    human_judgment: false

duration: 7min
completed: 2026-10-21
status: complete
---

# Phase 4 Plan 6: 只读通行度 / 最近使用 / 脏比较 / 校验 Summary

**四个纯模型落地：通行度只画走不通的方向、最近使用对坏文件免疫、脏状态由基线比较决定、名字与尺寸校验返回逐字文案。**

## Performance

- **Duration:** 7 min
- **Started:** 2026-10-21T16:35:00+08:00
- **Completed:** 2026-10-21T16:42:00+08:00
- **Tasks:** 3
- **Files modified:** 9（8 新建 + 1 追加导出）

## Accomplishments

- `computePassabilityMarks` 按图块目录算出每格不可通行方向；空格、未知编号、只落在普通层的 `onlyEventLayer` 图块都不输出标记，输出直接喂给 04-03 的 `buildMapRenderModel`（普通模式箭头、大地图小格红点）。
- `normalizeRecentTiles` / `updateRecentTiles` 对任意畸形输入返回数组，过滤未知编号与非正整数，去重保序、按上限截断、置顶更新。
- `isMapDataDirty` / `isMapPropertiesDirty` 用基线快照判断未保存改动，发现首个差异立即返回；属性表键顺序不同不算脏。
- `validateMapName` / `validateLayerName` / `validateMapSize` 统一返回「错误文案或 `null`」，超限返回错误而不是静默夹取。
- `model/index.ts` 按创建顺序追加四份模型的导出。

## Task Commits

1. **Task 1: 只读通行度纯函数** - `7d7eefc` (feat)
2. **Task 2: 最近使用列表 + 脏状态比较** - `2e710ef` (feat)
3. **Task 3: 名字与尺寸校验** - `b9de6a8` (feat)

## Files Created/Modified

- `packages/libs/editor-impl/src/map/model/passability.ts` - 只读四方向通行度标记
- `packages/libs/editor-impl/src/map/model/recentTiles.ts` - 最近使用列表的过滤 / 去重 / 置顶 / 截断
- `packages/libs/editor-impl/src/map/model/dirty.ts` - 文档几何与属性表的基线比较
- `packages/libs/editor-impl/src/map/model/validation.ts` - 地图名 / 图层名 / 尺寸校验
- `packages/libs/editor-impl/src/map/model/index.ts` - 追加四份模型导出
- `packages/libs/editor-impl/src/map/__tests__/model.passability.test.ts` - 12 个用例，含渲染模型对接
- `packages/libs/editor-impl/src/map/__tests__/model.recentTiles.test.ts` - 10 个用例
- `packages/libs/editor-impl/src/map/__tests__/model.dirty.test.ts` - 12 个用例
- `packages/libs/editor-impl/src/map/__tests__/model.validation.test.ts` - 12 个用例

## Decisions Made

- 通行度判定直接对同一方向键比较 `out` 与 `in`：任一为 `false` 即不可通行，符合 UI-SPEC「只画走不通的方向」。
- 脏判定用「数组位置 + 图层标识」逐层比较，图层顺序变化因此也能被发现。
- 尺寸校验在没有上限时使用「宽度 / 高度必须是正整数。」，有上限时逐字使用 UI-SPEC 的「1 到 {最大} 之间的整数」整句。
- 最近使用模型不 import 资源层或 fs；目录编号集合由调用方面板构建后传入。

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Verification

| 命令 | 结果 |
|------|------|
| `pnpm --filter @motajs/editor-impl exec vitest run src/map/__tests__/model.passability.test.ts src/map/__tests__/model.renderModel.test.ts` | 25 passed（passability 12 / renderModel 13） |
| `pnpm --filter @motajs/editor-impl exec vitest run src/map/__tests__/model.recentTiles.test.ts src/map/__tests__/model.dirty.test.ts` | 22 passed（recentTiles 10 / dirty 12） |
| `pnpm --filter @motajs/editor-impl exec vitest run src/map/__tests__/model.validation.test.ts` | 12 passed |
| `pnpm --filter @motajs/editor-impl exec vitest run`（五个模型测试一起） | 59 passed |
| `pnpm --filter @motajs/editor-impl typecheck` | exit 0 |
| `node scripts/verify/coreEngineNeutral.js` | exit 0（127 个生产文件，0 条违规） |
| `node scripts/verify/coreModuleState.js` | exit 0（208 个文件，受限规则 0 条） |

## Next Phase Readiness

- 面板数据层（04-07）可以直接调用这四个模型；画布（04-12）把 `computePassabilityMarks` 的结果放进 `IMapRenderView.passMarks` 即可，渲染模型无需改动。
- 无遗留阻塞。

## Self-Check: PASSED

- All 9 plan files exist on disk.
- Commits 7d7eefc, 2e710ef, b9de6a8 exist.
- renderModel.ts has no working-tree changes and was not modified.
