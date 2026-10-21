---
phase: 04-map
plan: 05
subsystem: editor-impl/map
tags: [editor-impl, map, pure-model, geometry, brush, fill, clipboard, vitest]

# Dependency graph
requires:
  - phase: 04-map
    provides: 04-01 已定稿的 `IMapRect` / `IMapCellPosition` / `IMapBrushPattern` / `IMapClipboard` / `IMapSize` 类型
  - phase: 04-map
    provides: 04-03 已落地的 `IPaintWrite`（本计划直接复用，未重复声明）
provides:
  - "`walkOrthogonalPath` / `rectanglePositions` / `normalizeRect` / `clampRectToMap`：格子几何与越界裁剪的唯一入口"
  - "`tileNumberAt` / `buildStrokeWrites` / `buildRectWrites` / `buildFillWrites`：线 / 矩形 / 填充 / 擦除都产出同一种 `IPaintWrite[]`"
  - "`fillConnectedPositions`：四邻域、同值、显式队列的连通区域"
  - "`copyMapRegion` / `buildPasteWrites` / `buildClearWrites`：区域复制、左上角锚点粘贴、清空，含被裁格数"
  - "`@motajs/editor-impl/map` 模型层桶文件按 document → renderModel → geometry → brush → fill → clipboard 顺序导出"
affects: [04-08, 04-09, 04-10, 04-11, 04-12, 04-13]

actuals:
  tokens: 7743
  tasks: 3
  commits: 3
  plan_head_before: 9c93e9c

tech-stack:
  added: []
  patterns:
    - 几何 / 笔刷 / 填充 / 剪贴板四个模块都是纯函数，只 import `../types` 与 `./document`，不碰 DOM / Pixi / editor-core
    - 笔刷只算「该写哪些格、写什么」，越界裁剪统一由 `clampRectToMap` 负责，写入路径不抛错
    - 图案平铺按图案宽高取模（相位由锚点决定），不依赖「首编号 + 偏移」，适配新引擎编号不连续
    - 多笔重叠用数组顺序表达「后写覆盖先写」，不引入额外优先级字段

key-files:
  created:
    - packages/libs/editor-impl/src/map/model/geometry.ts
    - packages/libs/editor-impl/src/map/model/brush.ts
    - packages/libs/editor-impl/src/map/model/fill.ts
    - packages/libs/editor-impl/src/map/model/clipboard.ts
    - packages/libs/editor-impl/src/map/__tests__/model.geometry.test.ts
    - packages/libs/editor-impl/src/map/__tests__/model.brush.test.ts
    - packages/libs/editor-impl/src/map/__tests__/model.fill.test.ts
    - packages/libs/editor-impl/src/map/__tests__/model.clipboard.test.ts
  modified:
    - packages/libs/editor-impl/src/map/model/index.ts

key-decisions:
  - "`IPaintWrite` 从 `model/document.ts` 复用（04-03 已落地），`model/brush.ts` 只 import 不再声明，与计划正文的例外说明一致"
  - "`clampRectToMap` 返回 `IMapClampResult`、`buildPasteWrites` 返回 `IMapPasteResult`：计划只描述了返回形状，项目代码风格禁止内联对象类型，因此各提成一个接口（见 Deviations）"
  - "`model/index.ts` 分三步追加导出（Task 1 geometry + brush、Task 2 fill、Task 3 clipboard），让每个提交都能单独通过 typecheck"
  - "填充用数字键 `y * 宽度 + x` 做访问集合，避免大地图上拼字符串键的开销；队列用下标游标推进，不用 `shift()`"
  - "图案缺格与空图案一律按 0 处理；`tileNumberAt` 按图案宽高取模，因此同一个图案可以直接平铺到矩形 / 连通区域"

patterns-established:
  - "写路径统一形状：线 / 矩形 / 填充 / 擦除 / 粘贴 / 清空都输出 `IPaintWrite[]`，视图层只有一条提交路径"
  - "被裁格数由裁剪函数自己统计并返回，提示文案不自己重算"

requirements-completed: [MAP-01]

coverage:
  - id: D1
    description: "格子几何：正交路径（先走差值大的轴）、矩形展开（含边界、行优先）、矩形归一化、按地图尺寸裁剪并统计被裁格数"
    requirement: MAP-01
    verification:
      - kind: unit
        ref: "src/map/__tests__/model.geometry.test.ts（10 用例）"
        status: pass
    human_judgment: false
  - id: D2
    description: "多格笔刷：单点落笔写满图案、线覆盖后写覆盖先写、矩形内按图案平铺、填充位置平铺、全 0 擦除、缺格按 0"
    requirement: MAP-01
    verification:
      - kind: unit
        ref: "src/map/__tests__/model.brush.test.ts（11 用例）"
        status: pass
    human_judgment: false
  - id: D3
    description: "四邻域连通填充：只收集同值连通格，对角不算连通，越界不访问，200×200 全同值不爆栈"
    requirement: MAP-01
    verification:
      - kind: unit
        ref: "src/map/__tests__/model.fill.test.ts（8 用例）"
        status: pass
    human_judgment: false
  - id: D4
    description: "区域复制 / 粘贴 / 清空：复制只含当前层数字块、粘贴以给定格为左上角且越界逐格跳过并计数、清空等同写 0"
    requirement: MAP-01
    verification:
      - kind: unit
        ref: "src/map/__tests__/model.clipboard.test.ts（9 用例）"
        status: pass
    human_judgment: false
  - id: D5
    description: "模型层不依赖 DOM / Pixi / editor-core，且没有模块级可变状态"
    requirement: MAP-01
    verification:
      - kind: other
        ref: "node scripts/verify/coreEngineNeutral.js exit 0（123 个生产文件、0 条引擎标识违规）"
        status: pass
      - kind: other
        ref: "node scripts/verify/coreModuleState.js exit 0（200 个文件、受限规则 error 级 0 条）"
        status: pass
      - kind: other
        ref: "pnpm --filter @motajs/editor-impl typecheck exit 0；pnpm exec eslint packages/libs/editor-impl/src/map exit 0"
        status: pass
    human_judgment: false

duration: 14 min
completed: 2026-10-21
status: complete
---

# Phase 04 Plan 05: 纯模型（几何 / 笔刷 / 填充 / 剪贴板）Summary

**把「画出来对不对」的四组规则钉成纯函数：线怎么走、图案怎么盖与平铺、连通区域怎么找、一块区域怎么复制粘贴；越界一律裁剪、不报错，大地图上填充不爆栈。**

## Performance

- **Duration:** 14 min
- **Started:** 2026-10-21T16:20:00+08:00
- **Completed:** 2026-10-21T16:34:00+08:00
- **Tasks:** 3
- **Files modified:** 9（8 新增 + 1 追加导出）

## Accomplishments

- **线**：`walkOrthogonalPath` 每一步只沿一个轴走一格，斜向拖动补齐中间格、终点精确；起点与终点相同时返回空路径。轴向选择与旧编辑器一致（先走差值大的轴，相等时先走横轴）。
- **图案盖法**：指针格 = 图案左上角。1×1 落笔写一格，2×2 落笔写四格；线上连续落笔时相邻位置重叠，靠数组顺序实现「后写覆盖先写」，不需要额外字段。
- **矩形与填充是平铺而不是拉伸**：按图案宽高取模，相位由锚点决定，因此 6×3 的矩形 + 2×2 图案会重复贴 9 次，而不是把一块图案放大到整片。
- **擦除与画笔同路**：全 0 图案写出的就是 0，线 / 矩形 / 填充都只是覆盖范围不同，没有单独的擦除代码。
- **越界只裁剪**：`clampRectToMap` 是唯一裁剪点，返回裁剪后的矩形与被裁格数；负坐标被夹到地图左上角，完全在外时宽高为 0。粘贴的「超出地图的 N 格已裁剪」直接来自 `buildPasteWrites` 的 `clipped`。
- **填充**：四邻域、同值、显式队列 + 访问集合；对角相邻不算连通，200×200 全同值一次走完 40000 格不栈溢出。
- **复制粘贴**：复制只取当前图层的数字块（剪贴块只有宽 / 高 / 编号，没有事件或引擎字段），粘贴以给定格为左上角逐格判界，负方向越界同样逐格跳过。

## Verification Evidence

| 命令 | 结果 |
|------|------|
| `pnpm --filter @motajs/editor-impl exec vitest run src/map/__tests__/model.geometry.test.ts src/map/__tests__/model.brush.test.ts` | 2 files / **21 passed**（要求 ≥14） |
| `pnpm --filter @motajs/editor-impl exec vitest run src/map/__tests__/model.fill.test.ts` | 1 file / **8 passed**（要求 ≥7） |
| `pnpm --filter @motajs/editor-impl exec vitest run src/map/__tests__/model.clipboard.test.ts` | 1 file / **9 passed**（要求 ≥7） |
| 四个文件一起跑 | 4 files / **38 passed** |
| `pnpm --filter @motajs/editor-impl exec vitest run src/map`（整目录回归） | 6 files / **74 passed** |
| `pnpm --filter @motajs/editor-impl typecheck` | exit 0 |
| `pnpm exec eslint packages/libs/editor-impl/src/map` | exit 0 |
| `node scripts/verify/coreEngineNeutral.js` | exit 0（123 个生产文件、0 条违规） |
| `node scripts/verify/coreModuleState.js` | exit 0（200 个文件、受限规则 error 级 0 条） |

## Task Commits

1. **Task 1: 格子几何 + 多格笔刷写入** — `ff5541b` (feat)
2. **Task 2: 四邻域连通填充** — `bff93dd` (feat)
3. **Task 3: 区域复制 / 粘贴 / 清空** — `efd176c` (feat)

## Files Created/Modified

- `packages/libs/editor-impl/src/map/model/geometry.ts` — `IMapClampResult` / `normalizeRect` / `walkOrthogonalPath` / `rectanglePositions` / `clampRectToMap`
- `packages/libs/editor-impl/src/map/model/brush.ts` — `tileNumberAt` / `buildStrokeWrites` / `buildRectWrites` / `buildFillWrites`（复用 `IPaintWrite`）
- `packages/libs/editor-impl/src/map/model/fill.ts` — `fillConnectedPositions`
- `packages/libs/editor-impl/src/map/model/clipboard.ts` — `IMapPasteResult` / `copyMapRegion` / `buildPasteWrites` / `buildClearWrites`
- `packages/libs/editor-impl/src/map/model/index.ts` — 追加 geometry → brush → fill → clipboard 四条导出
- `packages/libs/editor-impl/src/map/__tests__/model.geometry.test.ts` — 10 个用例
- `packages/libs/editor-impl/src/map/__tests__/model.brush.test.ts` — 11 个用例
- `packages/libs/editor-impl/src/map/__tests__/model.fill.test.ts` — 8 个用例
- `packages/libs/editor-impl/src/map/__tests__/model.clipboard.test.ts` — 9 个用例

## Decisions Made

- `IPaintWrite` 复用 04-03 在 `model/document.ts` 的声明，`brush.ts` 只 import —— 与计划正文的例外说明和 04-03 的偏差记录一致。
- `model/index.ts` 分三步追加导出，每个提交都能单独通过 typecheck，不留引用不存在文件的中间提交。
- 平铺相位一律由锚点决定（矩形传第一个角点、填充传点击格），而不是矩形 / 区域的左上角；这样预览与实际落笔一致。
- 填充的访问集合用数字键 `y * 宽 + x`、队列用下标游标推进，避免 200×200 场景的字符串键与 `shift()` 开销。

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical] 两个返回形状提成具名接口**
- **Found during:** Task 1（`clampRectToMap`）与 Task 3（`buildPasteWrites`）
- **Issue:** 计划只描述了返回「裁剪后的矩形与 `clipped` 格数」和 `{ writes, clipped }` 两种对象形状，但项目代码风格要求「必须出现对象类型时单独声明 interface，禁止内联对象类型」。不加接口就只能写内联类型，会违反风格规则。
- **Fix:** 在 `geometry.ts` 声明 `IMapClampResult`、在 `clipboard.ts` 声明 `IMapPasteResult`，字段名沿用计划里的 `rect` / `writes` / `clipped`。两者都只在这两个模块及其测试里被引用，没有扩到 `src/map/types.ts`（不在本计划 `files_modified` 内）。
- **Files modified:** `packages/libs/editor-impl/src/map/model/geometry.ts`、`packages/libs/editor-impl/src/map/model/clipboard.ts`
- **Verification:** `pnpm --filter @motajs/editor-impl typecheck` exit 0；四个测试文件 38 个用例全绿
- **Committed in:** `ff5541b`、`efd176c`

**2. [Rule 1 - Bug] `normalizeRect` 测试用例把同一角点与自己配对**
- **Found during:** Task 1（首次跑 geometry 测试）
- **Issue:** 手写的「四个方向」用例用了 4 个角点的笛卡尔积，其中包含 `a === b` 的两对，期望值仍是 5×4，实际退化矩形是 1×1，导致 1 个用例失败。
- **Fix:** 改成显式四组对角配对（正反两个方向 + 另外两个方向），语义不变，用例通过。
- **Files modified:** `packages/libs/editor-impl/src/map/__tests__/model.geometry.test.ts`
- **Verification:** 两文件 21 个用例全绿
- **Committed in:** `ff5541b`

---

**Total deviations:** 2 auto-fixed（1 missing critical、1 bug）
**Impact on plan:** 无范围扩大。两个接口只是计划已描述形状的具名化；测试修正只涉及本计划新增文件的断言写法，产物与计划规定一致。

## Issues Encountered

- 计划正文提到 `IPaintWrite` 在 `model/brush.ts` 声明，但 04-03 已把它落在 `model/document.ts` 供 `collectNetCellChanges` 使用。按用户指示与 04-03 的偏差记录复用同一份声明，未重复声明、也未改动 `document.ts`。
- 本计划不涉及图层渲染与大地图平移（按范围说明排除），`renderModel.ts` 未改动。

## Threat Model Coverage

| Threat ID | 处置 | 落地位置 |
|-----------|------|----------|
| T-04-05-01 | mitigate | `buildPasteWrites` / `buildClearWrites` 逐格判 `0 ≤ x < width`、`0 ≤ y < height`（半开区间），越界只累加 `clipped`；用例覆盖部分越界、负方向越界、完全在外 |
| T-04-05-02 | mitigate | `fillConnectedPositions` 用显式队列 + 访问集合；200×200 全同值用例钉住不爆栈 |
| T-04-05-03 | mitigate | 写入量天然受地图尺寸约束（矩形 / 填充都先经 `clampRectToMap`，粘贴逐格判界），本计划不新增其他上限 |
| T-04-05-04 | accept | 图案缺格按 0 处理（`patternTileAt` 的 `?? 0`），用例覆盖「编号数组比宽高乘积短」 |
| T-04-05-SC | mitigate | 未安装任何依赖 |

## Known Stubs

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- 视图层（后续计划）只需把指针坐标传进来：线用 `walkOrthogonalPath` + `buildStrokeWrites`，矩形用 `normalizeRect` + `buildRectWrites`，填充用 `fillConnectedPositions` + `buildFillWrites`，擦除用全 0 图案走同一条路。
- 粘贴提示直接用 `buildPasteWrites().clipped`；清空选区用 `buildClearWrites`。
- 未发现阻塞项；`model/index.ts` 已导出全部四个模块，后续计划从 `@motajs/editor-impl/map` 即可取到。

---
*Phase: 04-map*
*Completed: 2026-10-21*

## Self-Check: PASSED
