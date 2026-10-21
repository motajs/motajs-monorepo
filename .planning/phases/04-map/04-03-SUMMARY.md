---
phase: 04-map
plan: 03
subsystem: editor-impl/map
tags: [editor-impl, map, pure-model, document, render-model, fixtures, vitest]

# Dependency graph
requires:
  - phase: 04-map
    provides: 04-01 已定稿的中立文档 / 图块目录 / 渲染模型类型与 `src/map` 桶文件
provides:
  - "`isMapDocumentValid`：拒绝畸形文档（宽高非正整数、无图层、行列数不符、负格 / 非整数格）"
  - "`collectNetCellChanges`：一笔写入合并成净变化（后写覆盖先写、值未变则丢弃、按首次出现稳定排序）"
  - "`applyCellChanges`：按 `layerId` 做不可变写入，只复制被触及的行与目标图层"
  - "`isTileCatalogEmpty`：只回答目录里有没有图块，不看图片字节"
  - "`buildMapRenderModel` + `IMapRenderView`：纯渲染模型（可见格 / zIndex 层序与透明度 / 网格线 / 大地图适配 / 通行度红点降级 / 框选 / 预览 / 悬停）"
  - "地图测试夹具：`FakeFileSystem` / `createMapHarness` / `createMapDocument` / `createTileGroup` / `createWideMapDocument`"
  - "`@motajs/editor-impl/map` 子路径从本波起即可解析模型层导出"
affects: [04-04, 04-05, 04-06, 04-12, 04-13]

actuals:
  tokens: 9853
  tasks: 3
  commits: 3
  plan_head_before: 99b57f0d019d7b0fb743e8d60f1ea366386b89c2

tech-stack:
  added: []
  patterns:
    - 文档层与渲染模型层都是纯函数，不 import React / Pixi / editor-core，可脱离 DOM 单测
    - 不可变写入只复制被触及的行与目标图层，其余保持原引用
    - 渲染模型只输出视口内格子；大地图整图适配并受图元上限保护

key-files:
  created:
    - packages/libs/editor-impl/src/map/__tests__/fixtures.ts
    - packages/libs/editor-impl/src/map/model/document.ts
    - packages/libs/editor-impl/src/map/model/renderModel.ts
    - packages/libs/editor-impl/src/map/model/index.ts
    - packages/libs/editor-impl/src/map/__tests__/model.document.test.ts
    - packages/libs/editor-impl/src/map/__tests__/model.renderModel.test.ts
  modified:
    - packages/libs/editor-impl/src/map/index.ts

key-decisions:
  - "`IPaintWrite` 落在 `model/document.ts` 并从这里导出（原计划把声明留给 04-05 的 `model/brush.ts`）：04-03 的 `collectNetCellChanges` 需要它，而 04-05 尚未落地；名称沿用已登记的 `IPaintWrite`，04-05 直接复用即可"
  - "`model/index.ts` 在 Task 2 只导出 `./document`，Task 3 才追加 `./renderModel`：让每个提交都能通过 typecheck，而不是留一个引用不存在文件的中间提交"
  - "普通模式的通行度标记统一 `dot = false`；大地图模式按 `cellSize < MAP_BIG_MAP_DOT_CELL` 决定红点，均不自己计算通行度"
  - "图元上限按 `宽 × 高 × 图层数 > MAP_BIG_MAP_MAX_SPRITES` 判定，超过时只输出当前层"

patterns-established:
  - "同一能力的测试替身自持一份（能力互不依赖门禁），不跨能力 import"
  - "渲染模型只在视图层现算，面板不缓存一帧结果"

requirements-completed: [MAP-01]

coverage:
  - id: D1
    description: "地图测试夹具：自持的 `FakeFileSystem`（八个文件系统方法 + seed / failing / hanging）、`createMapHarness`、文档与图块目录样例构造器"
    requirement: MAP-01
    verification:
      - kind: other
        ref: "pnpm --filter @motajs/editor-impl typecheck exit 0"
        status: pass
      - kind: unit
        ref: "src/map/__tests__/model.document.test.ts + model.renderModel.test.ts（两文件共用夹具）"
        status: pass
    human_judgment: false
  - id: D2
    description: "文档层纯函数：校验、净变化合并、按层不可变写入、图块目录空判定"
    requirement: MAP-01
    verification:
      - kind: unit
        ref: "src/map/__tests__/model.document.test.ts（23 用例）"
        status: pass
    human_judgment: false
  - id: D3
    description: "纯渲染模型：可见格、zIndex 层序与透明度、网格线、大地图适配居中、通行度红点降级、框选 / 预览 / 悬停透传"
    requirement: MAP-01
    verification:
      - kind: unit
        ref: "src/map/__tests__/model.renderModel.test.ts（13 用例）"
        status: pass
    human_judgment: false
  - id: D4
    description: "`@motajs/editor-impl/map` 子路径按 `types → constants → model` 顺序导出模型层"
    requirement: MAP-01
    verification:
      - kind: other
        ref: "node -e barrel 顺序检查 → 'map barrel ok: ./types -> ./constants -> ./model'，exit 0"
        status: pass
    human_judgment: false
  - id: D5
    description: "两条结构门禁保持为绿（引擎中立词、模块级可变状态）"
    requirement: MAP-01
    verification:
      - kind: other
        ref: "node scripts/verify/coreEngineNeutral.js exit 0"
        status: pass
      - kind: other
        ref: "node scripts/verify/coreModuleState.js exit 0"
        status: pass
    human_judgment: false

duration: 23 min
completed: 2026-10-21
status: complete
---

# Phase 04 Plan 03: 纯模型（文档与渲染模型）Summary

**地图的「文档怎么算」与「一帧画什么」被拆成两层纯函数：脏数据进不来、一笔只复制一行、渲染模型输出可断言的数据，附一套后续计划复用的地图测试夹具。**

## Performance

- **Duration:** 23 min
- **Started:** 2026-10-21T07:53:00Z
- **Completed:** 2026-10-21T08:15:00Z
- **Tasks:** 3
- **Files modified:** 7

## Accomplishments

- 地图测试有了自己的夹具：文件系统替身自持八个方法，`createMapHarness` 只装配并初始化 `EditorCore`（不注册面板类型），另有 4×3 两层样例文档、2×2 图块分组与大地图样例。
- 文档层能拒绝 8 种畸形输入（宽 0 / 高 0 / 宽非整数 / 无图层 / 行数不符 / 行长不符 / 负格 / 非整数格）；净变化合并做到「后写覆盖先写 + 值未变丢弃 + 首次出现顺序」。
- `applyCellChanges` 的不可变写入用引用相等钉死：一笔横画只复制一行，未触及的行与其余图层保持原引用。
- 渲染模型输出可见格、按 `zIndex` 的层序与透明度（低于 / 当前层 1.0，高于当前层取 `aboveLayerOpacity`）、网格线、大地图保持宽高比居中、格边长 < 16px 时通行度降级红点、以及框选 / 预览 / 悬停透传。
- `@motajs/editor-impl/map` 在本波即可解析模型导出，避免 04-13 与 04-14 之间的循环依赖。

## Task Commits

Each task was committed atomically:

1. **Task 1: 地图测试夹具（文件系统替身 + harness + 地图样例）** - `9ab129b` (feat)
2. **Task 2: 文档校验与不可变写入** - `1f73efb` (feat)
3. **Task 3: 纯渲染模型（可见格 / 层序 / 大地图 / 框选 / 预览）** - `1f4b551` (feat)

## Files Created/Modified

- `packages/libs/editor-impl/src/map/__tests__/fixtures.ts` - 自持文件系统替身、`createMapHarness`、文档 / 图块目录 / 大地图样例
- `packages/libs/editor-impl/src/map/model/document.ts` - `IPaintWrite` / `isMapDocumentValid` / `collectNetCellChanges` / `applyCellChanges` / `isTileCatalogEmpty`
- `packages/libs/editor-impl/src/map/model/renderModel.ts` - `IMapRenderView` / `buildMapRenderModel`（普通模式与大地图模式）
- `packages/libs/editor-impl/src/map/model/index.ts` - 模型层桶文件
- `packages/libs/editor-impl/src/map/index.ts` - 追加 `export * from './model';`
- `packages/libs/editor-impl/src/map/__tests__/model.document.test.ts` - 23 个用例
- `packages/libs/editor-impl/src/map/__tests__/model.renderModel.test.ts` - 13 个用例

## Decisions Made

- `IPaintWrite` 的声明位置（见 Deviations）：放在 `model/document.ts` 并从模型桶导出，04-05 直接复用。
- `model/index.ts` 分两步追加导出，保证每个提交都能通过 typecheck。
- 普通模式通行度统一 `dot = false`，大地图按格边长决定红点；渲染模型不自己算通行度。
- 图元上限按「宽 × 高 × 图层数」判定，超过只输出当前层。

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `IPaintWrite` 在 04-03 尚无声明位置**
- **Found during:** Task 2（`collectNetCellChanges` 的入参类型）
- **Issue:** 计划要求 `collectNetCellChanges(cells, writes)` 接收 `IPaintWrite`，但该接口按 04-05 计划要到 `model/brush.ts` 才声明；04-05 尚未执行，直接 import 会让 04-03 的 typecheck 失败。`src/map/types.ts` 不在本计划的 `files_modified` 内，不能改。
- **Fix:** 在 `model/document.ts` 中声明并导出 `IPaintWrite`（名称与 `INTERFACE-NAME.md` 已登记的一致），供 04-05 直接复用；未改动 `types.ts`。
- **Files modified:** `packages/libs/editor-impl/src/map/model/document.ts`
- **Verification:** `pnpm --filter @motajs/editor-impl typecheck` 退出 0；document 测试 23 个用例全绿
- **Committed in:** `1f73efb`

**2. [Rule 3 - Blocking] 模型桶文件分两步追加导出**
- **Found during:** Task 2（`model/index.ts` 与 `renderModel.ts` 的落地顺序）
- **Issue:** 计划让 Task 2 的桶文件同时写出 `export * from './document'` 与 `export * from './renderModel'`，但 `renderModel.ts` 到 Task 3 才创建；若照写，Task 2 的提交会因引用不存在的文件而 typecheck 失败。
- **Fix:** Task 2 只导出 `./document`，Task 3 创建 `renderModel.ts` 时再追加 `./renderModel`；最终文件与计划一致。
- **Files modified:** `packages/libs/editor-impl/src/map/model/index.ts`
- **Verification:** 每个任务提交后 `pnpm --filter @motajs/editor-impl typecheck` 退出 0
- **Committed in:** `1f73efb`、`1f4b551`

---

**Total deviations:** 2 auto-fixed (2 blocking)
**Impact on plan:** 两处都是提交可编译所必需；没有任何范围扩大，最终产物与计划规定一致。

## Issues Encountered

- 曾尝试用 `node:fs` 在渲染模型测试里静态断言「不 import React / Pixi / editor-core」，但 `editor-impl` 的 tsconfig 不含 Node 类型，会让 typecheck 失败；改为用 grep 验证（`src/map/model` 下的 import 只有 `../constants` 与 `../types`），测试用例保持在 13 个。

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- 04-04 可以直接用 `createMapHarness` / `createMapDocument` 组装 tracer；`buildMapRenderModel` 已就绪，视图层只需每次渲染现算（不缓存）。
- 04-05 应从 `model/document.ts` 复用 `IPaintWrite`，不要重复声明；04-06 只需把 `passMarks` 算好传入 `IMapRenderView`，不再改 `renderModel.ts`。
- 无阻塞项。

---
*Phase: 04-map*
*Completed: 2026-10-21*

## Self-Check: PASSED

