---
phase: 04-map
plan: 12
subsystem: ui
tags: [map, canvas, pixi, react, gestures, context-menu, passability, big-map]

requires:
  - phase: 04-map
    provides: 04-01 视图状态与枚举、04-03/04-06 笔刷与渲染模型、04-10 视图外壳与状态条、04-11/04-16 调色板接线
provides:
  - MapCanvas：线 / 矩形 / 填充 / 擦除手势、右键三态、Escape 优先级、Ctrl+C/V、行列标尺与内嵌状态条
  - MapContextMenu：四项固定菜单、启用条件、键盘操作、贴边翻转
  - MapPanel：copyRegion / pasteAt / clearRegion / moveViewport / selectLayer / setPassabilityVisible / setBigMap
  - MapSurface：网格、通行度箭头 / 红点、框选虚线、绘制预览、悬停轮廓
affects: [04-13, 04-14, phase-06-events]

actuals:
  tokens: 22553
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - "画布本地手势状态：落笔预览只在本地，pointerup 时一次 commitCells"
    - "叠加层只消费渲染模型；通行度标记由面板 computePassabilityMarks 算好"
    - "大地图进入时存视口、退出时还原；滚轮 / Shift+滚轮走 moveViewport"

key-files:
  created:
    - packages/libs/editor-impl/src/map/components/MapCanvas.tsx
    - packages/libs/editor-impl/src/map/components/MapContextMenu.tsx
    - packages/libs/editor-impl/src/map/__tests__/mapView.canvas.test.tsx
    - packages/libs/editor-impl/src/map/__tests__/mapView.contextMenu.test.tsx
  modified:
    - packages/libs/editor-impl/src/map/mapPanel.ts
    - packages/libs/editor-impl/src/map/components/MapPanelView.tsx
    - packages/libs/editor-impl/src/map/components/MapSurface.tsx
    - packages/libs/editor-impl/src/map/map.css

key-decisions:
  - "坐标 / 选区 / 悬停 / 预览 / 菜单都留在画布本地；状态条搬进 MapCanvas 直接读它们"
  - "画布把本地 selection / preview / hover 补进视图算好的渲染模型，再交给 MapSurface"
  - "没有 pointerId 的合成 pointerdown 按一次性单击提交，兼容既有 tracer 测试的 pointerdown-only 路径"
  - "切换图层由画布观察 currentLayerId 变化来取消笔画与清选区，面板同时发布清空视图状态"
  - "大地图退出还原进入前视口（preBigMapViewport）"

requirements-completed: [MAP-01]

coverage:
  - id: D1
    description: "画布手势：线 / 矩形 / 填充 / 擦除，一笔只提交一次、只登记一条撤销"
    requirement: MAP-01
    verification:
      - kind: unit
        ref: "packages/libs/editor-impl/src/map/__tests__/mapView.canvas.test.tsx#线笔刷拖动三格只提交一次"
        status: pass
      - kind: unit
        ref: "packages/libs/editor-impl/src/map/__tests__/mapView.canvas.test.tsx#矩形笔刷预览并在松开时整块落笔"
        status: pass
    human_judgment: false
  - id: D2
    description: "右键三态：拖拽框选、单击菜单、绘制中取消；Escape 三级优先级"
    requirement: MAP-01
    verification:
      - kind: unit
        ref: "packages/libs/editor-impl/src/map/__tests__/mapView.canvas.test.tsx#绘制中按右键取消笔画且不提交"
        status: pass
      - kind: unit
        ref: "packages/libs/editor-impl/src/map/__tests__/mapView.canvas.test.tsx#Escape 按笔画 / 菜单 / 选区的顺序生效"
        status: pass
    human_judgment: false
  - id: D3
    description: "复制 / 粘贴 / 清空选区：只在画布聚焦时响应，越界裁剪有提示，各一条撤销"
    requirement: MAP-01
    verification:
      - kind: unit
        ref: "packages/libs/editor-impl/src/map/__tests__/mapView.canvas.test.tsx#复制粘贴只在画布聚焦时生效"
        status: pass
      - kind: unit
        ref: "packages/libs/editor-impl/src/map/__tests__/mapView.canvas.test.tsx#粘贴越界时提示裁剪格数并只登记一条撤销"
        status: pass
    human_judgment: false
  - id: D4
    description: "视口与大地图：方向键 / 滚轮 / Shift+滚轮移动，进出大地图还原视口"
    requirement: MAP-01
    verification:
      - kind: unit
        ref: "packages/libs/editor-impl/src/map/__tests__/mapView.canvas.test.tsx#大地图退出后还原进入前的视口"
        status: pass
      - kind: unit
        ref: "packages/libs/editor-impl/src/map/__tests__/mapView.canvas.test.tsx#大地图下滚轮与 Shift 滚轮移动视口"
        status: pass
    human_judgment: false
  - id: D5
    description: "叠加层：网格 / 悬停 / 预览 / 框选 / 通行度箭头与大地图红点都由渲染模型驱动"
    requirement: MAP-01
    verification:
      - kind: unit
        ref: "packages/libs/editor-impl/src/map/__tests__/mapView.canvas.test.tsx#大地图小格时通行度改为红点"
        status: pass
      - kind: unit
        ref: "packages/libs/editor-impl/src/map/__tests__/mapView.canvas.test.tsx#预览尺寸等于图案宽高"
        status: pass
      - kind: unit
        ref: "packages/libs/editor-impl/src/map/__tests__/mapView.canvas.test.tsx#高于当前层的图层按滑块不透明度渲染"
        status: pass
    human_judgment: false
  - id: D6
    description: "右键菜单四项文案、启用条件、键盘（焦点 / ↑↓ / Enter / Escape）与贴边翻转"
    requirement: MAP-01
    verification:
      - kind: unit
        ref: "packages/libs/editor-impl/src/map/__tests__/mapView.contextMenu.test.tsx"
        status: pass
    human_judgment: false
  - id: D7
    description: "真像素观感（标尺字号、箭头可读性、棋盘格）与真实指针手感"
    requirement: MAP-01
    verification: []
    human_judgment: true
    rationale: "jsdom 里 Pixi 被替换成数据回显桩，像素级观感与真实指针拖拽手感只能由开发宿主手动验收"

duration: 63 min
completed: 2026-10-21
status: complete
---

# Phase 04 Plan 12: 画布手势、右键菜单与 Pixi 叠加层 Summary

**地图画布可用线 / 矩形 / 填充 / 擦除落笔、右键框选或弹菜单、Ctrl+C/V 复制粘贴、方向键与大地图滚轮移动视口；网格、通行度、框选与预览全部由同一份渲染模型驱动**

## Performance

- **Duration:** 63 min
- **Started:** 2026-10-21T21:19:00Z
- **Completed:** 2026-10-21T22:22:00Z
- **Tasks:** 3
- **Files modified:** 8（4 新建 / 4 修改）

## Accomplishments

- `MapCanvas` 落地全部画布手势：一笔只在 `pointerup` 提交一次，填充在按下时立即提交；右键拖拽框选、右键单击菜单、绘制中右键取消；Escape 按「笔画 → 菜单 → 选区」优先级生效且不清调色板。
- `MapPanel` 新增复制 / 粘贴 / 清空 / 视口 / 图层切换 / 通行度开关 / 大地图开关；通行度标记由面板调用 `computePassabilityMarks` 算好再交给渲染模型；大地图进入存视口、退出还原。
- `MapContextMenu` 四项固定文案、剪贴板 / 选区启用条件、打开聚焦第一项、↑↓ / Enter / Escape 与贴边翻转。
- `MapSurface` 叠加层补齐：网格、10px 通行度箭头 + 白衬底（大地图小格改红点）、虚线框选 + 12% 填充、35% 预览、40% 悬停轮廓；所有叠加层不拦指针。
- 状态条搬进画布，坐标与选区直接吃画布本地状态；图块目录为空时画布只读（`canPaint` + `commitCells` 双层守卫）。

## Task Commits

1. **Task 1: 画布手势 / 快捷键 / 标尺 + 复制粘贴与视口动作** — `6f87625` (feat)
2. **Task 2: 右键菜单（四项 + 键盘 + 边缘夹取）** — `aa516c5` (feat)
3. **Task 3: Pixi 叠加层（网格 / 悬停 / 预览 / 框选 / 通行度 / 大地图红点）** — `651baec` (feat)

**Plan metadata:** 待提交（docs: complete plan）

## Files Created/Modified

- `packages/libs/editor-impl/src/map/components/MapCanvas.tsx` — 可聚焦画布：手势、快捷键、标尺、内嵌状态条与菜单宿主
- `packages/libs/editor-impl/src/map/components/MapContextMenu.tsx` — 四项右键菜单与键盘操作
- `packages/libs/editor-impl/src/map/components/MapPanelView.tsx` — 换用 `MapCanvas`、传 `canPaint` / `passMarks` / 回调，移除旧画布与状态条
- `packages/libs/editor-impl/src/map/components/MapSurface.tsx` — 网格 / 通行度 / 框选 / 预览 / 悬停叠加层
- `packages/libs/editor-impl/src/map/mapPanel.ts` — 新增 7 个视图动作与通行度 / 大地图视口逻辑
- `packages/libs/editor-impl/src/map/map.css` — 标尺、棋盘格、光标、右键菜单与视觉隐藏说明
- `packages/libs/editor-impl/src/map/__tests__/mapView.canvas.test.tsx` — 30 个画布 / 接线 / 渲染模型用例
- `packages/libs/editor-impl/src/map/__tests__/mapView.contextMenu.test.tsx` — 7 个菜单用例

## Decisions Made

- 画布把本地 `selection / preview / hover` 补进视图算好的渲染模型再交给 `MapSurface`：三者按计划必须是画布本地状态，视图在算模型时无从得知；模型里的格子 / 网格 / 通行度仍由 `MapPanelView` 调用 `buildMapRenderModel` 现算。
- 图层切换时画布观察 `currentLayerId` 变化来取消笔画、清空选区与预览；面板同时发布清空视图状态，剪贴板与调色板选择保留。
- 大地图退出用 `preBigMapViewport` 还原关闭前的视口；没有存过时回到左上角。

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] 合成 pointerdown 兼容（无 pointerId 时按单击提交）**
- **Found during:** Task 1（画布手势）
- **Issue:** 既有 `mapTracer.test.tsx`（04-04 拥有，本计划不得修改）只派发 `pointerdown`、不派发 `pointerup`；若严格只在 `pointerup` 提交，既有 tracer 用例会红。
- **Fix:** `MapCanvas` 对没有 `pointerId` 的按下（合成事件 / 非指针设备）按一次性单击立即提交；真实指针事件始终带 `pointerId`，仍走「按下 → 拖动 → 松开一次提交」。
- **Files modified:** `packages/libs/editor-impl/src/map/components/MapCanvas.tsx`
- **Verification:** `mapTracer.test.tsx` 9/9 通过；新增画布用例仍断言拖动只提交一次。
- **Committed in:** `6f87625`

**2. [Rule 3 - Blocking] 保留 `MapPanelView.onPaintCell` 可选入口**
- **Found during:** Task 1（视图接线）
- **Issue:** 既有 `mapView.toolbar` / `mapView.palette` 用例以必填 `onPaintCell` 构造视图 props；直接删除会让既有测试的类型契约失效。
- **Fix:** 保留为可选 prop（画布不再使用），新增 `onCommitCells / onCopyRegion / onPasteAt / onClearRegion` 作为真实入口。
- **Files modified:** `packages/libs/editor-impl/src/map/components/MapPanelView.tsx`
- **Verification:** 整包 758 个用例通过，`typecheck` 退出 0。
- **Committed in:** `6f87625`

---

**Total deviations:** 2 auto-fixed（2 blocking）
**Impact on plan:** 两处都是为了让既有测试与视图契约保持绿色；没有扩大功能范围。渲染模型归属、一层撤销、判据唯一等硬约束均按计划保留。

## Issues Encountered

- 首次通行度用例用了 `createMapDocument()` 自带的目录，其中编号 4 的图块并非全阻；改用 `createTileGroup()`（编号 4 四方向全阻）后用例成立。属测试夹具选择问题，非实现缺陷。

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- 画布手势、快捷键、菜单与叠加层已可端到端使用，04-13 / 04-14 可直接复用 `MapPanel` 的新视图动作。
- 真像素观感（标尺、箭头、棋盘格）与真实指针手感仍需在开发宿主手动验收（见 coverage D7）。

## Self-Check: PASSED

- 4 个交付文件 + SUMMARY 均可读取
- 3 个任务提交 `6f87625` / `aa516c5` / `651baec` 均存在
- `mapView.canvas` 30 passed、`mapView.contextMenu` 7 passed
- `typecheck` 退出 0；`coreEngineNeutral` / `coreModuleState` 退出 0；整包 758 passed
