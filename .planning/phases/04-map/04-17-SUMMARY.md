---
phase: 04-map
plan: 17
subsystem: map
tags: [map, properties, drawer, view-state, regression, vitest]
requires:
  - phase: 04-map
    provides: 地图面板 / 属性域（04-09）、开发宿主端到端与属性抽屉假绿记录（04-13）
provides:
  - 属性抽屉的三份状态（加载状态 / 行树 / 错误）只有一个来源：`IMapPanelViewState`
  - `MapPanel` 在六个写入点即时发布属性状态，首开不再依赖外壳重渲染
  - 一条不碰外壳的面板级回归用例（`ShellSystem.activateTab` 调用次数为 0）
affects: [04-verify, 04-14 手动验收第 6 步]
actuals:
  tokens: 2567
  tasks: 2
  commits: 2
  plan_head_before: e697a3a9cc636e2ea4a8b1513a94e232c4e96e3c
tech-stack:
  added: []
  patterns:
    - 面板私有字段是工作源，每次写入后立即 `MapPanel.publish` 到视图状态；视图只经 `useStore` 读
    - 回归测试渲染面板自己的组件（`MapPanel.render()`），用 spy 钉住「没有外壳重渲染」这一前提
key-files:
  created: []
  modified:
    - packages/libs/editor-impl/src/map/types.ts
    - packages/libs/editor-impl/src/map/mapPanel.ts
    - packages/libs/editor-impl/src/map/components/MapPanelView.tsx
    - packages/libs/editor-impl/src/map/__tests__/mapProperties.test.tsx
    - packages/libs/editor-impl/src/map/__tests__/mapView.toolbar.test.tsx
key-decisions:
  - "三份属性状态并入 `IMapPanelViewState`，`IMapPanelViewProps` 上的三个一次性 props 整体删除，双来源在类型层面不可能再出现"
  - "私有字段继续作为唯一工作源（既有测试直接读 `panel['propertiesStatus']` 等），本次只增加「每次改完就发布」，不改从 store 反读"
  - "`MapPanel.refreshPropertyRows` 的两条出口都发布：schema 缺失时也发布 `propertyRows: []`，避免切图后残留上一张图的行"
  - "回归测试只渲染 `MapPanel.render()` 返回的组件并 spy `ShellSystem.activateTab`，不经过外壳，杜绝 04-13 那种靠重渲染制造的假绿"
requirements-completed: [MAP-01]
coverage:
  - id: D1
    description: "属性抽屉第一次打开即显示宿主 schema 的字段行，不需要切标签 / 重渲染外壳 / 任何额外用户动作"
    requirement: MAP-01
    verification:
      - kind: integration
        ref: "packages/libs/editor-impl/src/map/__tests__/mapProperties.test.tsx#属性抽屉首次打开即显示字段（不依赖外壳重渲染）"
        status: pass
    human_judgment: false
  - id: D2
    description: "属性加载状态 / 行树 / 错误只有一个来源（视图状态），视图不再持有构造时的一次性副本"
    requirement: MAP-01
    verification:
      - kind: unit
        ref: "pnpm --filter @motajs/editor-impl exec vitest run src/map/__tests__/mapProperties.test.tsx (19 tests)"
        status: pass
      - kind: unit
        ref: "pnpm --filter @motajs/editor-impl typecheck"
        status: pass
    human_judgment: false
  - id: D3
    description: "切图 / 关图 / 新建 / 字段提交 / 撤销重做之后，抽屉里的行与面板内存属性表一致（每次写入都伴随一次发布）"
    requirement: MAP-01
    verification:
      - kind: unit
        ref: "packages/libs/editor-impl/src/map/__tests__/mapProperties.test.tsx (19 tests, 含撤销/重做与关闭再打开)"
        status: pass
      - kind: unit
        ref: "pnpm --filter @motajs/editor-impl exec vitest run src/map (20 files / 306 tests)"
        status: pass
    human_judgment: false
duration: 13 min
completed: 2026-10-22
status: complete
---

# Phase 04 Plan 17: 地图属性抽屉首开为空修复 Summary

**属性抽屉的加载状态、行树与错误并入面板视图状态，`MapPanel` 每次写入即发布；首开不再依赖外壳重渲染，并用一条不碰外壳的面板级回归钉死**

## Performance

- **Duration:** 13 min
- **Started:** 2026-10-22T06:14Z
- **Completed:** 2026-10-22T06:27Z
- **Tasks:** 2/2
- **Files modified:** 5

## RED → GREEN 证据

**RED（Task 1 提交后、实现前）** — `pnpm --filter @motajs/editor-impl exec vitest run src/map/__tests__/mapProperties.test.tsx`：

```text
Test Files  1 failed (1)
     Tests  1 failed | 18 passed (19)
FAIL 地图面板：属性域 > 属性抽屉首次打开即显示字段（不依赖外壳重渲染）
TestingLibraryElementError: Unable to find an element by: [data-test-id="table-input-name"]
  at src/map/__tests__/mapProperties.test.tsx:349
```

失败点正是「抽屉已出现、但字段输入行没有」——第一条 `map-properties-drawer` 的 `waitFor` 已通过，随后卡在 `table-input-name`，不是找不到 `map-properties` 按钮、也不是渲染崩溃。原因即缺陷本体：`MapPanel.loadProperties` 更新私有字段后只发布 `unsaved`，`unsaved` 与打开前同值，视图拿到的一次性 props 仍是 `NoTarget` / 空行树。

**GREEN（Task 2 提交后）**：

| 命令 | 结果 |
|------|------|
| `pnpm --filter @motajs/editor-impl exec vitest run src/map/__tests__/mapProperties.test.tsx` | 19 passed (19) |
| `pnpm --filter @motajs/editor-impl exec vitest run src/map/__tests__/mapView.toolbar.test.tsx` | 24 passed (24) |
| `pnpm --filter @motajs/editor-impl exec vitest run src/map` | 20 files passed / 306 tests passed |
| `pnpm --filter @motajs/editor-impl typecheck` | 退出码 0（`tsc -b` 无输出） |
| `node scripts/verify/coreEngineNeutral.js` | 退出码 0（146 个生产文件，引擎标识违规 0 条） |
| `node scripts/verify/coreModuleState.js` | 退出码 0（242 个文件，受限规则 0 条） |

## Accomplishments

- `IMapPanelViewState` 新增 `propertiesStatus` / `propertyRows` / `propertiesError?`；`IMapPanelViewProps` 上的三个同名一次性 props 及其 import 一并删除，视图改为 `view.*`。
- `MapPanel` 在六个写入点发布：store 初始化、加载开始、加载成功、加载失败、`MapPanel.resetProperties`、`MapPanel.refreshPropertyRows`（含 schema 缺失的提前返回分支）。
- `mapProperties.test.tsx` 新增一条面板级回归：渲染 `MapPanel.render()` 的组件，点击 `map-properties`，断言抽屉与 `table-input-name` / `table-input-level` 出现、`map-properties-error` 不存在、`ShellSystem.activateTab` 调用 0 次；用例数 18 → 19。
- `mapView.toolbar.test.tsx` 的视图状态夹具补齐两个必填成员，原「属性抽屉按视图状态打开」用例把覆盖从 props 移到视图状态。

## Task Commits

1. **Task 1: 先写面板级回归测试（RED）** - `2c260c8` (test)
2. **Task 2: 属性状态并入视图状态（GREEN）** - `519ed9b` (fix)

**Plan head before:** `e697a3a`；本计划共 2 个提交（`git rev-list --count e697a3a..HEAD` = 2）。

## Files Created/Modified

- `packages/libs/editor-impl/src/map/types.ts` - `IMapPanelViewState` 增加三个成员，补 `TablePanelStatus` / `ITableRowNode` 导入（普通 import）
- `packages/libs/editor-impl/src/map/mapPanel.ts` - store 初始化补三键、删除三个一次性 props、五处写入后发布
- `packages/libs/editor-impl/src/map/components/MapPanelView.tsx` - 抽屉改读 `view`，删除三个 props 与不再使用的 import
- `packages/libs/editor-impl/src/map/__tests__/mapProperties.test.tsx` - 新增 1 条面板级回归，补 MapSurface 桩与 `act` / `waitFor` / `createElement`
- `packages/libs/editor-impl/src/map/__tests__/mapView.toolbar.test.tsx` - 视图状态夹具补两必填成员，覆盖点从 props 移到视图状态

## Decisions Made

- 三份属性状态全部并入视图状态，props 一份、视图一份的双来源在类型层面被消除。
- 私有字段仍是唯一工作源；本次只增加「每次写入即发布」，不改成从 store 反读，也不新增辅助方法。
- `MapPanel.refreshPropertyRows` 两条出口都发布，schema 缺失时也清空 `propertyRows`，防止切图 / 关图残留旧行。
- 回归测试只渲染面板自己的组件并 spy `ShellSystem.activateTab`，确保它不是靠外壳重渲染蒙混通过。

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None。`MapPropertiesDrawer`、`devHostMap.test.tsx` 的 `activateTab`、既有地图测试断言与门禁脚本均未改动。

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- 04-14 手动验收第 6 步（打开地图属性 → 改字段）现在有自动化证据支撑，不必再靠切换标签观察。
- 属性状态只有一份来源；后续给面板加属性相关字段时，沿用「改私有字段后调用 `MapPanel.publish`」即可。

---

*Phase: 04-map*
*Completed: 2026-10-22*

## Self-Check: PASSED

- 5 个改动文件均存在于磁盘；提交 `2c260c8`、`519ed9b` 均可在 `git log` 中找到。
- 19/19、24/24、`src/map` 306/306、typecheck 0、两条门禁 0 全部复跑通过。
