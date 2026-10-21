---
phase: 04-map
plan: 04
subsystem: map
tags: [map, panel, pixi, editor-impl, tracer]

requires:
  - phase: 04-map
    provides: "中立 document / renderModel / IPaintWrite / isTileCatalogEmpty（04-03），笔刷写入几何（04-05）"
provides:
  - "MapPanel：打开地图、净变化落笔、整份数据域保存（MapPanel.commitCells / MapPanel.save）"
  - "createMapPanelType(capabilities)：能力闭包注入的面板类型工厂"
  - "MapPanelView / MapSurface / useMapObjectUrl：状态驱动的面板视图与 Pixi 画布"
  - "@motajs/editor-impl/map 在 04-04 即可导入面板类型、面板类与组件"
affects: [04-map 工具栏, 04-map 调色板, 04-map 画布升级, 04-map 开发宿主]

actuals:
  tokens: 9956
  tasks: 2
  commits: 1
  plan_head_before: 423ee04

tech-stack:
  added: []
  patterns:
    - "渲染模型归属：只在 MapPanelView 每次渲染时调 buildMapRenderModel，面板与画布都不缓存"
    - "唯一写路径：净变化 → applyCellChanges 不可变写入 → 一条 MapUndoType.Cells 撤销记录 → save 交回整份数据域"
    - "Pixi 缓存挂组件 ref：应用 / 场景 / 纹理表 / 临时裁切纹理都在实例作用域，模块顶层零缓存"

key-files:
  created:
    - packages/libs/editor-impl/src/map/mapPanel.ts
    - packages/libs/editor-impl/src/map/mapPanelType.ts
    - packages/libs/editor-impl/src/map/components/index.ts
    - packages/libs/editor-impl/src/map/components/MapPanelView.tsx
    - packages/libs/editor-impl/src/map/components/MapSurface.tsx
    - packages/libs/editor-impl/src/map/components/useMapObjectUrl.ts
    - packages/libs/editor-impl/src/map/__tests__/mapTracer.test.tsx
  modified:
    - packages/libs/editor-impl/src/map/index.ts

key-decisions:
  - "MapPanel.setMap 按 IMapPanel 接口接收 IMapPanelTarget（计划正文写 mapId 字符串，接口优先），mapPanelType 传 { mapId }"
  - "图块图片按路径去重后由 useMapObjectUrl 生成 blob 地址，MapSurface 只负责把地址变成纹理；路径守卫拒绝绝对路径与含 .. 段"
  - "图块目录为空时 MapPanel.commitCells 直接返回：不落笔、不置脏、不登记撤销"

patterns-established:
  - "面板只发布文档与视图状态；视图现算渲染模型；Pixi 只消费 props"
  - "图片字节只经 IEditorPanelContext.requestResource(...).requestBinary()，失败折叠成 undefined 不改变面板状态"

requirements-completed: [MAP-01]

coverage:
  - id: D1
    description: "宿主注入地图后，外壳里出现地图面板，状态走到就绪，渲染模型送达画布"
    requirement: MAP-01
    verification:
      - kind: unit
        ref: "packages/libs/editor-impl/src/map/__tests__/mapTracer.test.tsx#打开宿主注入的地图后画布渲染出格子"
        status: pass
    human_judgment: false
  - id: D2
    description: "Pixi 画布真实绘制图层（jsdom 无法初始化 WebGL，测试替换了 MapSurface）"
    requirement: MAP-01
    verification: []
    human_judgment: true
    rationale: "自动化只验证渲染模型与 props 送达；真实 WebGL 绘制需要人工在浏览器里看一眼"
  - id: D3
    description: "左键落笔后当前格变成调色板第一个图块，并出现未保存标记"
    requirement: MAP-01
    verification:
      - kind: unit
        ref: "packages/libs/editor-impl/src/map/__tests__/mapTracer.test.tsx#左键落笔后出现未保存标记"
        status: pass
    human_judgment: false
  - id: D4
    description: "保存把整份地图数据域（标识 / 宽 / 高 / 完整图层）交回宿主并清掉未保存标记"
    requirement: MAP-01
    verification:
      - kind: unit
        ref: "packages/libs/editor-impl/src/map/__tests__/mapTracer.test.tsx#保存把整份地图数据域交回宿主并清掉未保存标记"
        status: pass
    human_judgment: false
  - id: D5
    description: "保存失败时宿主错误按纯文本显示，内存改动与未保存标记保留"
    requirement: MAP-01
    verification:
      - kind: unit
        ref: "packages/libs/editor-impl/src/map/__tests__/mapTracer.test.tsx#保存失败时显示纯文本错误并保留未保存标记"
        status: pass
    human_judgment: false
  - id: D6
    description: "图块目录为空时拒绝落笔：文档不变、不置脏、不登记撤销"
    requirement: MAP-01
    verification:
      - kind: unit
        ref: "packages/libs/editor-impl/src/map/__tests__/mapTracer.test.tsx#图块目录为空时拒绝落笔且不登记撤销"
        status: pass
    human_judgment: false
  - id: D7
    description: "图块图片路径 → 资源层字节 → blob 地址，可疑路径被拒绝且不请求资源层"
    requirement: MAP-01
    verification:
      - kind: unit
        ref: "packages/libs/editor-impl/src/map/__tests__/mapTracer.test.tsx#useMapObjectUrl"
        status: pass
    human_judgment: false

duration: 11min
completed: 2026-10-21
status: complete
---

# Phase 4 Plan 04: Map Tracer Summary

**宿主注入一张地图 → 面板打开 → 按 zIndex 分层渲染 → 左键画一格 → 保存把整份地图数据域交回宿主，端到端链路一次打通**

## Performance

- **Duration:** 11 min
- **Started:** 2026-10-21T17:02:00+08:00
- **Completed:** 2026-10-21T17:13:00+08:00
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments

- `MapPanel` 打通「打开 → 落笔 → 保存」：净变化经 `collectNetCellChanges` / `applyCellChanges` 不可变写入，登记一条 `MapUndoType.Cells` 撤销记录，保存时交回完整 `{ id, width, height, layers }`。
- `MapPanelView` 按状态渲染加载 / 错误 / 就绪三态；就绪时现算 `buildMapRenderModel`，再交给 `MapSurface`。面板类里没有渲染模型字段。
- `MapSurface` 是唯一 import `pixi.js` 的文件：按图层 zIndex 顺序画占位格 / 图块 / 网格 / 通行度标记，纹理与应用都挂在 ref 上，卸载销毁。
- `useMapObjectUrl` 把资源层字节变成可回收的 blob 地址；绝对路径与含 `..` 段的路径不请求资源层。
- `@motajs/editor-impl/map` 已按 `types → constants → model → components → mapPanel → mapPanelType` 导出，wave 12 可直接取 `createMapPanelType` 与 `MapSurface`。

## Task Commits

两个任务共用 `MapSurface.tsx` 与 `mapTracer.test.tsx`，拆成两次提交会让第一个提交引用尚未提交的模块，故合并为一次可构建的提交：

1. **Task 1 + Task 2: 端到端 tracer 与图片链路** - `1eef3ca` (feat)

**Plan metadata:** 待本 SUMMARY 提交后生成（docs: complete 04-04 plan）

## Files Created/Modified

- `packages/libs/editor-impl/src/map/mapPanel.ts` - 地图面板数据层：打开、落笔、保存、最小生命周期方法
- `packages/libs/editor-impl/src/map/mapPanelType.ts` - `createMapPanelType(capabilities)` 工厂与内联图标
- `packages/libs/editor-impl/src/map/components/index.ts` - 组件桶（只导出 `MapPanelView` / `MapSurface`）
- `packages/libs/editor-impl/src/map/components/MapPanelView.tsx` - 三态视图、指针换算、现算渲染模型、保存按钮与提示
- `packages/libs/editor-impl/src/map/components/MapSurface.tsx` - Pixi 画布：占位格、图块精灵、网格、通行度标记、边框
- `packages/libs/editor-impl/src/map/components/useMapObjectUrl.ts` - 字节 → blob 地址 hook 与路径守卫
- `packages/libs/editor-impl/src/map/__tests__/mapTracer.test.tsx` - 9 条 tracer / 图片链路测试
- `packages/libs/editor-impl/src/map/index.ts` - 追加 `./components` / `./mapPanel` / `./mapPanelType` 三行

## Decisions Made

- `MapPanel.setMap` 以 `IMapPanel` 接口为准接收 `IMapPanelTarget`，而非计划正文写的 `mapId` 字符串；`mapPanelType` 传 `{ mapId }`。
- 渲染模型只在 `MapPanelView` 现算，`MapPanel` 不保存渲染模型；后续 `MapCanvas` 升级只换消费方。
- 图块图片按路径去重，由 `useMapObjectUrl` 生成 blob 地址，`MapSurface` 只建纹理；守卫拒绝绝对路径与含 `..` 段路径。
- 空图块目录的唯一拒绝点在 `MapPanel.commitCells`；图片读取失败不算空目录，仍可落笔。

## Deviations from Plan

### Auto-fixed Issues

**1. [Process - Commit granularity] 两个任务合并为一次提交**
- **Found during:** Task 2
- **Issue:** Task 1 与 Task 2 共用 `MapSurface.tsx` 和 `mapTracer.test.tsx`；按任务拆提交会让第一个提交 import 尚未提交的 `useMapObjectUrl`。
- **Fix:** 以一次可构建的 `feat(04-04)` 提交承载两个任务。
- **Files modified:** 本计划全部 8 个文件
- **Verification:** 该提交上 `tsc -b --force` 与 `vitest run src/map` 均通过
- **Committed in:** `1eef3ca`

**2. [Rule 3 - Blocking] 测试用原生 `MouseEvent` 触发 pointerdown**
- **Found during:** Task 1
- **Issue:** jsdom 26 没有 `PointerEvent`，testing-library 的 `fireEvent.pointerDown` 只能造出不带 `button` 的通用 `Event`，落笔处理器拿不到左键。
- **Fix:** 测试改为派发带 `clientX` / `clientY` / `button` 的 `MouseEvent('pointerdown')`，仍然命中同一个 pointerdown 监听。
- **Files modified:** `packages/libs/editor-impl/src/map/__tests__/mapTracer.test.tsx`
- **Verification:** 9 条测试全绿
- **Committed in:** `1eef3ca`

---

**Total deviations:** 2 (1 process consolidation, 1 test-harness blocking fix)
**Impact on plan:** 生产行为与计划一致；合并提交只影响历史粒度，测试适配不影响产品代码。

## Issues Encountered

- 运行 typecheck / `coreModuleState` 期间，工作树里并发存在的未跟踪 `src/asset/**` 文件一度让门禁变红（不是本计划改动）。这些文件稳定后两条门禁均以 0 退出；本计划未触碰 `asset/**`。

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- 04-07 可直接复用 `MapPanel.commitCells` 与 `MapUndoType.Cells` 载荷补齐撤销 / 重做。
- 04-10 / 04-11 / 04-12 只需在 `MapPanelView` 两侧加工具栏、调色板与 `MapCanvas`，不改变「渲染模型归视图」的归属。
- 04-05 的笔刷几何与 04-06 的通行度 / 脏判定已可挂到同一条写路径上。

## Verification Evidence

- `pnpm --filter @motajs/editor-impl exec vitest run src/map/__tests__/mapTracer.test.tsx` → 9 passed
- `pnpm --filter @motajs/editor-impl exec vitest run src/map` → 129 passed（11 个文件）
- `pnpm --filter @motajs/editor-impl exec tsc -b --force` → exit 0
- `node scripts/verify/coreEngineNeutral.js` → exit 0（134 个生产文件，0 条引擎标识违规）
- `node scripts/verify/coreModuleState.js` → exit 0（218 个文件，受限规则 error 级 0 条）
- map barrel 检查 → `map barrels ok`

## Self-Check: PASSED

- 8 个目标文件均存在且已在 `1eef3ca` 提交
- 测试 9 passed / 129 passed，typecheck 与两条门禁 exit 0
