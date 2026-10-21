---
phase: 04-map
plan: 08
subsystem: map
tags: [react, antd, modal, unsaved-guard, recent-tiles, undo-barrier]
requires:
  - phase: 04-map
    provides: 04-02 map validation + neutral document model
  - phase: 04-map
    provides: 04-07 panel save / baseline / barrier
provides:
  - controlled new-map, add-layer and unsaved-confirmation dialogs
  - one unsaved-decision gate for switch map / create map / add layer / close tab
  - host-backed createMap / addLayer with clean baseline and undo barrier
  - recent tiles load / write / clear through the project resource layer
affects: [04-10, 04-11, 04-13, 04-15]
actuals:
  tokens: 19520
  tasks: 3
  commits: 2
  plan_head_before: 7c9ce2521a9a3a2940d64bac4c59fe74d36d2af3
tech-stack:
  added: []
  patterns: [controlled-antd-modal, promise-settled-dialog, token-guarded-async-load]
key-files:
  created:
    - packages/libs/editor-impl/src/map/components/dialogs/MapNewDialog.tsx
    - packages/libs/editor-impl/src/map/components/dialogs/MapLayerDialog.tsx
    - packages/libs/editor-impl/src/map/components/dialogs/MapUnsavedDialog.tsx
    - packages/libs/editor-impl/src/map/components/dialogs/index.ts
    - packages/libs/editor-impl/src/map/__tests__/mapDialogs.test.tsx
  modified:
    - packages/libs/editor-impl/src/map/mapPanel.ts
    - packages/libs/editor-impl/src/map/__tests__/mapPanel.test.tsx
key-decisions:
  - "四个入口共用 MapPanel.requestUnsavedDecision；三个弹窗按钮只把 MapUnsavedChoice 交给 MapPanel.resolveUnsavedDecision"
  - "宿主新建 / 加层成功后立即 captureBaseline，宿主已写盘所以不置脏；放弃改动用基线深拷贝覆盖并登记屏障"
  - "最近使用读取带序号，晚到的读取结果被丢弃，避免刚画的一笔被打开时的旧读取覆盖"
  - "弹窗的创建中状态是组件本地状态；视图状态只使用 04-01 已声明的 dialog / dialogError / saving"
requirements-completed: [MAP-01]
coverage:
  - id: D1
    description: "新建地图弹窗：默认值、尺寸上限提示、行内校验、创建中禁用、宿主失败不关闭"
    requirement: MAP-01
    verification:
      - kind: unit
        ref: "packages/libs/editor-impl/src/map/__tests__/mapDialogs.test.tsx#新建地图弹窗"
        status: pass
    human_judgment: false
  - id: D2
    description: "新增图层弹窗：预填图层 N、聚焦全选、行内错误、创建中禁用"
    requirement: MAP-01
    verification:
      - kind: unit
        ref: "packages/libs/editor-impl/src/map/__tests__/mapDialogs.test.tsx#新增图层弹窗"
        status: pass
    human_judgment: false
  - id: D3
    description: "宿主执行的新建地图 / 新增图层：新文档打开、当前层正确、层名写入文档、不置脏、登记屏障"
    requirement: MAP-01
    verification:
      - kind: unit
        ref: "packages/libs/editor-impl/src/map/__tests__/mapDialogs.test.tsx#面板：新建地图与新增图层"
        status: pass
    human_judgment: false
  - id: D4
    description: "未保存确认：四个入口共用同一询问，保存失败不继续，放弃回基线并登记屏障，关闭标签接 onBeforeClose"
    requirement: MAP-01
    verification:
      - kind: unit
        ref: "packages/libs/editor-impl/src/map/__tests__/mapDialogs.test.tsx#面板：未保存确认"
        status: pass
    human_judgment: false
  - id: D5
    description: "最近使用：从项目文件读出、落笔写回、坏文件忽略、清除写空、写失败不打断绘制"
    requirement: MAP-01
    verification:
      - kind: unit
        ref: "packages/libs/editor-impl/src/map/__tests__/mapDialogs.test.tsx#面板：最近使用图块"
        status: pass
    human_judgment: false
duration: 55min
completed: 2026-10-21
status: complete
---

# Phase 4 Plan 8: 地图弹窗、未保存闸门与最近使用 Summary

**新建 / 加层弹窗接上宿主回调，四个会丢改动的入口共用一道未保存确认，最近使用图块落进项目内文件**

## Performance

- **Duration:** 约 55 分钟
- **Completed:** 2026-10-21T11:02:07Z
- **Tasks:** 3
- **Files modified:** 7（新增 5，修改 2）

## Accomplishments

- `MapNewDialog` / `MapLayerDialog` / `MapUnsavedDialog` 三个受控弹窗，校验、忙碌与失败态都在弹窗内表达，失败不关闭。
- 切图、新建地图、新增图层、关闭标签四个入口都先经过 `MapPanel.requestUnsavedDecision`；「保存并继续」失败时原操作不继续。
- 宿主新建 / 加层返回整份文档后重新记基线，新层名字写进文档，并各登记一条撤销屏障。
- 最近使用从项目内文件读出、落笔写回、清除写空；文件缺失 / 损坏 / 写失败都不会挡住画图。

## Task Commits

三个任务的改动集中在同两个文件（`mapPanel.ts` 与测试），无法在不拆散文件的前提下逐个提交，故合并为一条原子提交；之后补一条收口弹窗写入入口的小重构：

1. **Task 1-3：弹窗 + 未保存闸门 + 最近使用** - `2e5dd0e` (feat)
2. **收口：成功关闭弹窗统一走 `MapPanel.closeDialog`** - `5031451` (refactor)

**Plan metadata:** `65416d0` (docs: complete plan，随后随本 SUMMARY 修订再提交一次)。

## Files Created/Modified

- `packages/libs/editor-impl/src/map/mapPanel.ts` - 弹窗状态、创建 / 加层、未保存结算、放弃、关闭前询问、最近使用读写
- `packages/libs/editor-impl/src/map/components/dialogs/MapNewDialog.tsx` - 新建地图弹窗
- `packages/libs/editor-impl/src/map/components/dialogs/MapLayerDialog.tsx` - 新增图层弹窗
- `packages/libs/editor-impl/src/map/components/dialogs/MapUnsavedDialog.tsx` - 未保存确认弹窗
- `packages/libs/editor-impl/src/map/components/dialogs/index.ts` - 弹窗桶文件
- `packages/libs/editor-impl/src/map/__tests__/mapDialogs.test.tsx` - 36 个用例覆盖三个弹窗、宿主创建 / 加层、四个入口与最近使用
- `packages/libs/editor-impl/src/map/__tests__/mapPanel.test.tsx` - 04-07 的跨图撤销用例补上未保存确认的结算（仅测试改动）

## Decisions Made

- 四个入口只共用一个询问点；三个按钮不含判断，`MapPanel.resolveUnsavedDecision` 是唯一结算点。
- 弹窗的「创建中」是组件本地状态，避免往 04-01 已冻结的视图状态里新增字段。
- 最近使用读取加序号保护，避免打开地图时的旧读取覆盖刚落下的一笔。

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `IMapEditorCapabilities.addLayer` 只接收地图标识，没有图层名参数**
- **Found during:** Task 1（新增图层）
- **Issue:** 04-08 计划写的是 `capabilities.addLayer(id, layerName)`，但 04-01 已声明的接口只有 `addLayer(mapId)`，而 `types.ts` 不在本计划允许修改的文件清单里。
- **Fix:** 仍只向宿主传地图标识；宿主返回整份文档后，用用户输入的名字覆盖最后一个（新追加的）图层，再 `captureBaseline`。名称随之后的整份保存写回。
- **Files modified:** `packages/libs/editor-impl/src/map/mapPanel.ts`
- **Verification:** `mapDialogs.test.tsx` 的新增图层用例断言宿主返回的「宿主默认名」被替换成「新图层」。
- **Committed in:** `2e5dd0e`

**2. [Rule 1 - Bug] 打开地图时的最近使用读取会覆盖刚落下的一笔**
- **Found during:** Task 3（最近使用）
- **Issue:** 打开文档后异步读最近使用，读取晚于落笔返回时会把新列表冲回空列表。
- **Fix:** 给最近使用读取加序号；落笔 / 清除会推进序号，晚到的读取结果直接丢弃。
- **Files modified:** `packages/libs/editor-impl/src/map/mapPanel.ts`
- **Verification:** 「同一编号只留一条」「擦除不更新最近使用」两个用例稳定通过。
- **Committed in:** `2e5dd0e`

**3. [Rule 3 - Blocking] 04-07 的跨图撤销用例被新的未保存闸门挂起**
- **Found during:** 全量地图测试
- **Issue:** 该用例先画一格再切图并直接 `await openMap`，新闸门会等待一个永远不会到来的用户决定，导致 5s 超时。
- **Fix:** 只在该用例里补一次「放弃改动」的结算，再等切图完成；断言内容未改。
- **Files modified:** `packages/libs/editor-impl/src/map/__tests__/mapPanel.test.tsx`
- **Verification:** `vitest run src/map` 187 个用例全绿。
- **Committed in:** `2e5dd0e`

---

**Total deviations:** 3 auto-fixed（2 blocking、1 bug）
**Impact on plan:** 都是为了兑现计划本身的语义：层名不能丢、最近使用不能被旧读取覆盖、既有测试要承认新闸门。没有扩展到重命名 / 排序 / 删除图层等计划明确排除的能力。

## Issues Encountered

- `InputNumber` 在失焦时会把超过上限的输入夹到上限，所以「超限整句」在真实 UI 里只能由面板侧防线触发；弹窗侧的行内尺寸错误用非整数输入覆盖，另有一条面板侧超限拒绝用例。未改变 `max` 的上限提示语义。

## User Setup Required

None - 没有外部服务配置。

## Next Phase Readiness

- 04-10 可以直接用 `view.dialog` / `view.dialogError` / `view.saving` 渲染三个弹窗，并把 `onUnsavedDecision` 接到 `MapPanel.resolveUnsavedDecision`。
- 04-11 可以调用 `MapPanel.clearRecentTiles`，并消费 `view.recentTiles`。
- 04-15 的外壳只需调用 `MapPanel.onBeforeClose` 并尊重 `false`。

---

## Self-Check: PASSED

- 5 个新增文件与 2 个修改文件均存在于磁盘
- 提交 `2e5dd0e` 与 `5031451` 在 `git log` 中可见
- `pnpm --filter @motajs/editor-impl exec vitest run src/map/__tests__/mapDialogs.test.tsx`：36 passed
- `pnpm --filter @motajs/editor-impl exec vitest run src/map`：187 passed
- `pnpm --filter @motajs/editor-impl exec vitest run`：625 passed
- `pnpm --filter @motajs/editor-impl typecheck`：exit 0
- `node scripts/verify/coreEngineNeutral.js`：exit 0
- `node scripts/verify/coreModuleState.js`：exit 0
