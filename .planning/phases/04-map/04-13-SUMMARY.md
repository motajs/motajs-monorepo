---
phase: 04-map
plan: 13
subsystem: dev-host
tags: [map, editor-dev, adapter, json, pixi-mock, vitest]
requires:
  - phase: 04-map
    provides: 地图能力接口（04-08）、面板与属性域（04-09）、演示宿主内存后端（01.1）
provides:
  - 开发宿主地图适配器（演示扁平文件 ↔ 中立文档，两个保存域互不覆盖）
  - 两张演示地图、两个图块分组（含一组缺图）、两字段属性 Schema 与开发宿主注册
  - 地图端到端用例（注册 → 打开 → 画/擦/切层 → 加层 → 属性 → 保存 → 关闭重开）
affects: [04-verify, 未来 @motajs/editor 宿主接入]
actuals:
  tokens: 13774
  tasks: 3
  commits: 3
tech-stack:
  added: []
  patterns:
    - 宿主适配器只负责「演示文件形状 ↔ 中立文档」，数据域与属性域各走各的写回函数
    - 图块目录只经 IMapCapabilityOptions.tileGroups 注入，能力包不自行装配
    - jsdom 端到端按相对模块标识 mock Pixi 表面（不发 vi.mock('@motajs/editor-impl/map')）
key-files:
  created:
    - packages/apps/editor-dev/src/backend/mapFiles.ts
    - packages/apps/editor-dev/src/backend/__tests__/mapFiles.test.ts
    - packages/apps/editor-dev/src/demo/mapDemo.ts
    - packages/apps/editor-dev/src/__tests__/devHostMap.test.tsx
  modified:
    - packages/apps/editor-dev/src/main.tsx
key-decisions:
  - "演示地图文件不存 height，由各层完整行数的最小值推导；参差层统一补 0 / 截断"
  - "saveMapData 写回 section 里的图层名，用户新起的图层名因此能落盘；addLayer 先写默认名，保存时再覆盖"
  - "registerMapDemo 不重复订阅「无法撤销」提示，复用素材 demo 已注册的同一条钩子"
  - "端到端用例在属性读取完成后调用 activateTab 让外壳重渲染一次，绕开「属性行是面板 props、面板自身 store 更新不刷新 props」的既有缺陷"
requirements-completed: [MAP-01]
coverage:
  - id: D1
    description: "演示宿主地图适配器：扁平文件转中立文档，保存数据域保留事件 / 属性 / 额外字段，保存属性域保留几何"
    requirement: MAP-01
    verification:
      - kind: unit
        ref: "packages/apps/editor-dev/src/backend/__tests__/mapFiles.test.ts (12 tests)"
        status: pass
    human_judgment: false
  - id: D2
    description: "两张演示地图 + 两组图块（含一组缺图）+ 两字段属性 Schema，经 tileGroups 注入并注册进开发宿主"
    requirement: MAP-01
    verification:
      - kind: integration
        ref: "packages/apps/editor-dev/src/__tests__/devHostMap.test.tsx#就绪后调色板出现两个演示分组与属于目录的图块"
        status: pass
      - kind: unit
        ref: "pnpm --filter @motajs/editor-dev typecheck"
        status: pass
    human_judgment: false
  - id: D3
    description: "开发宿主端到端：注册 → 打开 → 画/擦/切层 → 加层 → 改属性 → 保存 → 关闭重开，事件与额外字段不变"
    requirement: MAP-01
    verification:
      - kind: e2e
        ref: "packages/apps/editor-dev/src/__tests__/devHostMap.test.tsx (4 tests)"
        status: pass
    human_judgment: false
  - id: D4
    description: "浏览器里点一次「地图属性」即看到字段行"
    requirement: MAP-01
    verification: []
    human_judgment: true
    rationale: "面板把属性状态与行树作为 props 传给视图，读取完成后 store 只发布与之前同值的 unsaved，视图不会重渲染；端到端用例用 activateTab 让外壳重渲染后断言。真实浏览器首次打开抽屉可能仍是空的，需人工确认并修复 editor-impl（本计划文件范围外）"
duration: 1h 45m
completed: 2026-10-22
status: complete
---

# Phase 04 Plan 13: 开发宿主地图接入 Summary

**开发宿主地图适配器（演示扁平文件 ↔ 中立文档，保存不丢事件 / 属性 / 额外字段）＋ 两张演示地图、两组图块（含缺图）、两字段属性 Schema 与 4 条端到端用例**

## Performance

- **Duration:** 约 1h 45m
- **Started:** 2026-10-22T22:56Z
- **Completed:** 2026-10-22T00:41Z（本地时间跨零点）
- **Tasks:** 3/3
- **Files modified:** 5

## Accomplishments

- `mapFiles.ts`：演示文件（扁平行主序层、无 height）与中立文档 `[y][x]` 双向转换；数据域只替换 `width / layers / layerNames`，属性域只替换 `properties`，`events` / `extra` / 另一域逐字保留。
- `mapDemo.ts` + `main.tsx`：8×6 与 40×26 两张演示地图、两个 32×32 图块分组（物件组故意缺图）、字符串 + 数字两字段的属性 Schema；先 seed 再注册面板、最后初始化。
- `devHostMap.test.tsx`：Pixi 表面按相对模块标识 mock，贯通「打开 → 画/擦/切层 → 加层 → 改属性 → 保存 → 关闭重开」，并断言事件、额外字段、图层名与属性值都保留；另覆盖未保存确认的取消 / 放弃两条分支与调色板目录来源。

## Task Commits

1. **Task 1: 宿主适配器** - `21b6464` (feat)
2. **Task 2: 演示数据与注册** - `d08c1d3` (feat)
3. **Task 3: 端到端用例** - `4560be1` (test)

**Plan head before:** `21b6464^`；本计划共 3 个提交（`git rev-list --count 21b6464^..HEAD` = 3）。

## Files Created/Modified

- `packages/apps/editor-dev/src/backend/mapFiles.ts` - 演示文件记录、转换函数、两个保存域、地图能力工厂与路径越界拒绝
- `packages/apps/editor-dev/src/backend/__tests__/mapFiles.test.ts` - 12 条适配器用例（造型、保留、别名、目录、越界、空目录报错）
- `packages/apps/editor-dev/src/demo/mapDemo.ts` - 演示地图 / 图块 / 属性 Schema、seed 与注册
- `packages/apps/editor-dev/src/main.tsx` - seed 地图演示、注册地图面板
- `packages/apps/editor-dev/src/__tests__/devHostMap.test.tsx` - 4 条端到端用例

## Decisions Made

- 高度由各层完整行数的最小值推导，参差层补 0 / 截断，演示文件不新增 `height` 字段。
- 图层名走两条路径都落盘：`addLayer` 先写默认名，`saveMapData` 用面板当前图层名覆盖；因此用户输入的名字关掉重开仍在。
- 图块目录必须经 `IMapCapabilityOptions.tileGroups` 注入；选项为空时 `openMap` 直接报错而不是返回空目录。
- 「无法撤销」提示复用素材 demo 已订阅的同一条钩子，避免一次撤销弹两次。
- 端到端用例在属性读取完成后调用 `activateTab` 强制外壳重渲染一次（见下方 Issues）。

## Deviations from Plan

None - 计划内容按原样执行；实现细节（层名回退规则、缺省字段补空）按计划允许的方式落地。

## Issues Encountered

- **属性抽屉不随读取完成自动刷新（editor-impl 既有缺陷，超出本计划文件范围）**：`MapPanel.loadProperties` 完成后只调用 `refreshUnsaved()`，`unsaved` 与打开前同值，而属性状态 / 行树是以 props 形式传给 `MapPanelView`；面板自身 store 的浅比较更新不会重渲染视图，因此抽屉正文保持空。端到端用例先等待宿主读取完成，再调用 `shellSystem.activateTab` 让外壳重渲染一次后断言字段行。浏览器里首次打开抽屉很可能同样为空，需要后续计划修复（建议把属性状态与行树纳入 store，或读取完成后发布一个真正变化的字段）。本计划未修改 `packages/libs/editor-impl/src/map/**`。
- 端到端首版曾把「画一格」落在本来就是编号 1 的格子上（无净变化），改为落在编号 3 的格子，保证脏状态来自真实改动。

## User Setup Required

None - 无外部服务配置。

## Next Phase Readiness

- 开发宿主的自动验收入口已就绪：`pnpm --filter @motajs/editor-dev test`（8 文件 / 51 用例全绿）、`pnpm --filter @motajs/editor-dev typecheck`、`node scripts/verify/coreEngineNeutral.js`、`node scripts/verify/coreModuleState.js` 均通过。
- 人工验收前需留意属性抽屉的刷新缺陷；其余「打开 / 画 / 擦 / 切层 / 加层 / 保存 / 关闭重开」路径已由端到端用例覆盖。

---
*Phase: 04-map*
*Completed: 2026-10-22*

## Self-Check: PASSED

