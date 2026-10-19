---
phase: 03-asset
plan: 18
subsystem: ui
tags: [react, antd, css-positioning, asset-panel, uat-gap-closure, vitest]

# Dependency graph
requires:
  - phase: 03-asset
    provides: "03-11 面板视图层（AssetPanelView / CategoryNav / AssetGrid / AssetDetail）与 03-14 配置视图（AssetConfigView 复用 shared/schemaForm 的 TableGrid）"
  - phase: 03-asset
    provides: "03-07 抽到 shared/schemaForm 的表格表单引擎与样式（`.etable { position: absolute; inset: 0 }`）"
  - phase: 03-asset
    provides: "03-17 开发宿主素材演示数据（ASSET_DEMO_CATEGORIES / ASSET_DEMO_FILES / registerAssetDemo）"
provides:
  - "配置模式的中间区成为 `.etable` 的有界定位祖先，表格只铺满配置区、不再覆盖整面板"
  - "配置校验提醒由阻断式错误改为非阻断 warning（标题「配置尚有未填项」），缺项列表与 test-id 不变"
  - "开发宿主演示条目补齐内置 schema 的必填字段，打开配置即为正常可编辑状态"
  - "组件级定位回归（assetConfigLayout.test.tsx）+ 宿主级打开配置回归（devHostAsset.test.tsx）"
affects: [03-asset UAT G-03-1 复验, 03-19 素材预览]

actuals:
  tokens: 2429
  tasks: 2
  commits: 2
  plan_head_before: 6378d341e74c7b47aa58ac766dd89535e150233d

tech-stack:
  added: []
  patterns:
    - "绝对定位的复用组件必须由使用方补一个有界定位祖先（不改共享样式）"
    - "校验提醒与阻断分离：提醒只呈现，不禁用任何交互"

key-files:
  created:
    - packages/libs/editor-impl/src/asset/__tests__/assetConfigLayout.test.tsx
  modified:
    - packages/libs/editor-impl/src/asset/asset.css
    - packages/libs/editor-impl/src/asset/components/AssetConfigView.tsx
    - packages/apps/editor-dev/src/demo/assetDemo.ts
    - packages/apps/editor-dev/src/__tests__/devHostAsset.test.tsx

key-decisions:
  - "只在 asset.css 给 .asset-config-body 加 position: relative，不修改 shared/schemaForm/schemaForm.css 的 .etable 定位规则（表格面板与表格能力都依赖它）"
  - "校验提醒改 warning + 「配置尚有未填项」，保留 data-test-id=\"asset-config-errors\" 与逐条列表，不新增禁用逻辑"
  - "演示图片条目补 read/usage、音频条目补 type，取内置 schema 枚举的合法值 0"

patterns-established:
  - "定位祖先回归：测试从 .etable 向上找到第一个非 static 祖先，断言它正好是配置主体"

requirements-completed: [ASSET-01]

coverage:
  - id: D1
    description: "点「配置」后表格只占中间素材区，左侧分类导航仍可见，返回按钮可点并回到素材网格"
    requirement: ASSET-01
    verification:
      - kind: unit
        ref: "packages/libs/editor-impl/src/asset/__tests__/assetConfigLayout.test.tsx#配置表格的第一个定位祖先是配置主体"
        status: pass
      - kind: unit
        ref: "packages/libs/editor-impl/src/asset/__tests__/assetConfigLayout.test.tsx#点返回按钮触发一次 onBack"
        status: pass
      - kind: unit
        ref: "packages/libs/editor-impl/src/asset/__tests__/assetConfigLayout.test.tsx#配置态点分类导航触发一次分类切换"
        status: pass
      - kind: integration
        ref: "packages/apps/editor-dev/src/__tests__/devHostAsset.test.tsx#打开配置无校验提醒且分类导航可退回浏览态"
        status: pass
    human_judgment: true
    rationale: "「表格只在视觉上铺满中间区、不再透出背后素材页」最终是浏览器里的视觉结果，jsdom 只能证明定位祖先与回调连通，真实观感须由用户复验 G-03-1"
  - id: D2
    description: "演示素材打开配置时不再一进来就显示校验失败；真的缺项时只给非阻断中文提醒"
    requirement: ASSET-01
    verification:
      - kind: integration
        ref: "packages/apps/editor-dev/src/__tests__/devHostAsset.test.tsx#打开配置无校验提醒且分类导航可退回浏览态"
        status: pass
      - kind: integration
        ref: "packages/libs/editor-impl/src/asset/__tests__/assetUndo.uat.test.tsx#defaults 的 @required 校验贯通到配置视图"
        status: pass
    human_judgment: false

duration: 15min
completed: 2026-10-19
status: complete
---

# Phase 03 Plan 18: 配置模式只占中间区域（G-03-1）Summary

**点「配置」后表格只在中间素材区铺满、左侧分类导航与「← 返回素材列表」照常可用；演示素材打开配置不再一进来就报校验失败，缺项时只给一条不挡路的提醒。**

## Performance

- **Duration:** 约 15 min
- **Started:** 2026-10-19T15:09:00+08:00
- **Completed:** 2026-10-19T15:14:07+08:00
- **Tasks:** 2
- **Files modified:** 5（1 新建 + 4 修改）

## Accomplishments

- **配置区变成表格的有界定位祖先。** `asset.css` 为 `.asset-config-view` / `.asset-config-breadcrumb` / `.asset-config-errors` / `.asset-config-body` 补齐纵向 flex 与定位规则；`.etable` 的 `position: absolute; inset: 0` 从此以 `.asset-config-body` 为基准，只铺满配置区，不再覆盖整个面板、也不再拦截面板上的点击。`shared/schemaForm/schemaForm.css` 一个字节未动。
- **分类导航与返回按钮恢复可用。** 配置态下 `CategoryNav` 仍是 `.asset-body` 里配置视图的兄弟节点，左侧固定 184px 不受表格影响；「← 返回素材列表」与「点其它分类退回浏览态」都有回归用例钉住。
- **校验提醒不再读成「坏掉了」。** `AssetConfigView` 的 `Alert` 由 `type="error"` 改为 `type="warning"`，标题由「配置校验未通过」改为「配置尚有未填项」；`data-test-id="asset-config-errors"`、逐条错误列表、`props.errors.length === 0` 的判断与「不禁用任何按钮」的语义全部保留。
- **演示素材打开配置即正常。** `assetDemo.ts` 的图片条目补 `read: 0` / `usage: 0`，音频条目补 `type: 0`，满足内置 schema 的 `required`（图片 `source`/`read`/`usage`，音频 `type`/`source`），演示数据不再一进配置就出现缺项。
- **两条回归落地。** 组件级 `assetConfigLayout.test.tsx` 断言 `.asset-config-body` 的 computed position 是 `relative`、且从 `.etable` 向上第一个非 static 祖先正好是它；宿主级 `devHostAsset.test.tsx` 走完「卡片 → 配置 → 无错误、导航仍在 → 点动画分类退回浏览」全链路。

## Task Commits

Each task was committed atomically:

1. **Task 1: 给配置区一个有界定位祖先，并钉住中间区域 / 导航 / 返回的回归** - `e625039` (fix)
2. **Task 2: 校验提醒改为非阻断，演示条目补齐必填配置，并钉住宿主级回归** - `c55c800` (fix)

**Plan metadata:** 见本文件所在提交（docs: complete 03-18 plan）

## Files Created/Modified

- `packages/libs/editor-impl/src/asset/asset.css` — 新增 `.asset-config-view` / `.asset-config-breadcrumb` / `.asset-config-errors` / `.asset-config-body` 四条规则；其中 `.asset-config-body { position: relative }` 是有界定位祖先的关键。
- `packages/libs/editor-impl/src/asset/__tests__/assetConfigLayout.test.tsx` — 新建：4 条用例（配置视图与导航共存、定位祖先、返回回调、分类切换回调）。
- `packages/libs/editor-impl/src/asset/components/AssetConfigView.tsx` — `Alert` 改 `type="warning"`、标题改「配置尚有未填项」。
- `packages/apps/editor-dev/src/demo/assetDemo.ts` — 图片条目 `{ source, read: 0, usage: 0 }`、音频条目 `{ source, type: 0 }`。
- `packages/apps/editor-dev/src/__tests__/devHostAsset.test.tsx` — 追加宿主级用例，并补 `fireEvent` 导入。

## Decisions Made

- **只在使用方补定位祖先，不改共享样式。** `.etable` 的 `position: absolute; inset: 0` 是表格面板 / 表格能力共同依赖的既有契约（`plan.key_links` 与禁令明确要求），因此修复只能落在 `asset.css`。
- **提醒降级但不弱化。** 缺项仍逐条列出、仍带 `data-test-id="asset-config-errors"`，只是配色与标题从「失败」改成「尚有未填项」，且不引入任何禁用逻辑（T-03-58 的缓解）。
- **演示值取枚举 0 而非编造字段。** 图片 `read: 0`（整图）/ `usage: 0`（普通图片）、音频 `type: 0`（背景音乐），均来自 `builtInSchemas.ts` 声明的合法枚举值。

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- **并行跑两个测试包时 `devHostAsset.test.tsx` 曾整文件失败一次。** 现象是 suite 级 `Failed Suites 1`，堆栈为 antd 的 `getComputedStyle` / `useScrollLocker` 在 jsdom 下的未实现告警。单独重跑 `pnpm --filter @motajs/editor-dev test` 两次均 25/25 通过；`@motajs/editor-impl` 308/308 通过。判定为两个 vitest 进程并行争用（jsdom + antd portal）导致的偶发，与本计划改动无关——改动只涉及配置区样式、一条 Alert 文案与演示数据。最终验收按串行执行，全部通过。

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- G-03-1 的代码侧修复与两层回归已就位，等待用户按 03-UAT 复验真实浏览器观感（D1 标记为需人工判断）。
- 同批次的 G-03-2（素材预览）由 03-19 处理，本计划未触碰卡片预览相关代码。
- `ASSET-01` 在本计划范围内标记完成；未新增对 `table` / `code` / `map` 的 import，`coreBoundaries` / `coreModuleState` / `coreEngineNeutral` / `coreImportType` 四道门禁均 0 违规。

---

## Self-Check: PASSED

- 五个改动文件全部存在（`asset.css`、`assetConfigLayout.test.tsx`、`AssetConfigView.tsx`、`assetDemo.ts`、`devHostAsset.test.tsx`）。
- 两个任务提交存在：`e625039`（Task 1）、`c55c800`（Task 2）。
- `shared/schemaForm/schemaForm.css` 在 `6378d34..HEAD` 的 diff 中未出现（禁令已遵守）。
- 提交计数由 ledger 实测：`git rev-list --count 6378d34..HEAD` = 2。

---

*Phase: 03-asset*
*Completed: 2026-10-19*
