---
phase: 03-asset
plan: 29
subsystem: ui
tags: [asset-panel, error-bar, schema-jsonc, uat-gap-closure, d-09, vitest]

# Dependency graph
requires:
  - phase: 03-asset
    provides: "AssetPanel.openConfig 在工程内 `.schema.jsonc` 解析失败时已把「该素材的配置无法解析」写进 IAssetPanelViewState.error"
  - phase: 03-asset
    provides: "AssetPanelView 按 status 渲染加载 / 空 / 整屏错误 / 就绪分支的既有版面"
provides:
  - "AssetPanelView 在工具栏与三栏主体之间渲染可见错误条（`.asset-panel-error` / data-test-id `asset-panel-error` / role=alert）"
  - "错误条只在 state.error 有值且 status 不是 Error 时出现，整屏错误态不重复"
  - "AssetPanel.publish 后续成功动作清空 error，重新加载分类后错误条自动消失"
  - "界面级回归：非法工程 schema 的错误文案可见、面板保持 ready 可浏览、重新加载后消失"
affects: [03-asset UAT G-03-11 复验]

actuals:
  tokens: 1473
  tasks: 2
  commits: 2
  plan_head_before: c3820c8ff9f0a887fe11b771534afe2ea553d0c1

tech-stack:
  added: []
  patterns:
    - "面板级错误条挂在 renderContent 之外：分支函数会按 status 提前返回，放进去会被吞掉"
    - "同一条 error 通道按 status 分流：整屏 Error 由 asset-state-error 表达，其余状态由 asset-panel-error 表达，两者互斥"
    - "错误不是模态：错误条只占一条窄栏，分类导航、网格与详情继续可操作"

key-files:
  created: []
  modified:
    - packages/libs/editor-impl/src/asset/components/AssetPanelView.tsx
    - packages/libs/editor-impl/src/asset/asset.css
    - packages/libs/editor-impl/src/asset/__tests__/assetView.test.tsx
    - packages/libs/editor-impl/src/asset/__tests__/assetUndo.uat.test.tsx

key-decisions:
  - "错误条放在工具栏之后、asset-body 之前，而不是 renderContent 内部：后者按 status 提前返回，会把错误吞掉"
  - "status 为 AssetPanelStatus.Error 时不渲染错误条，避免与既有整屏错误态重复"
  - "只消费既有的 state.error，不改 AssetPanel.openConfig 的数据逻辑，也不碰 shared/schemaForm"
  - "错误条文案固定为用户可读句子，不拼接原始 schema 文件内容（T-03-29-01）"

patterns-established:
  - "面板内非致命错误的呈现方式：一条带 role=alert 的窄错误条 + 面板保持原状态可继续操作"
  - "错误可消失的回归写法：断言错误条出现 → act 中重新加载分类 → 断言错误条消失"

requirements-completed: [ASSET-01]

# Coverage metadata (#1602)
coverage:
  - id: D1
    description: "工程内 `.schema.jsonc` 非法时，点「配置」后工具栏下方出现「该素材的配置无法解析」错误条，面板仍停留在浏览态"
    requirement: "ASSET-01"
    verification:
      - kind: unit
        ref: "packages/libs/editor-impl/src/asset/__tests__/assetView.test.tsx#就绪态显示面板级错误条"
        status: pass
      - kind: integration
        ref: "packages/libs/editor-impl/src/asset/__tests__/assetUndo.uat.test.tsx#非法工程 schema 时显示错误条并保持浏览态"
        status: pass
    human_judgment: false
  - id: D2
    description: "整屏加载错误态照旧呈现，不再重复出现错误条；无错误时不渲染错误条"
    requirement: "ASSET-01"
    verification:
      - kind: unit
        ref: "packages/libs/editor-impl/src/asset/__tests__/assetView.test.tsx#整屏错误态不重复渲染错误条"
        status: pass
      - kind: unit
        ref: "packages/libs/editor-impl/src/asset/__tests__/assetView.test.tsx#无错误时不渲染错误条"
        status: pass
    human_judgment: false
  - id: D3
    description: "错误条可随重新加载分类清除（不是永久粘住），且不遮挡分类导航与素材网格"
    requirement: "ASSET-01"
    verification:
      - kind: integration
        ref: "packages/libs/editor-impl/src/asset/__tests__/assetUndo.uat.test.tsx#非法工程 schema 时显示错误条并保持浏览态"
        status: pass
    human_judgment: false

duration: 8min
completed: 2026-10-20
status: complete
---

# Phase 03 Plan 29: 非法工程 schema 的可见错误态 Summary

**工程里的 `.schema.jsonc` 写坏后点「配置」，面板内会出现一条「该素材的配置无法解析」的错误条；面板保持打开、照常浏览，重新加载分类后错误条自动消失**

## Performance

- **Duration:** 8 min
- **Started:** 2026-10-20T13:55:00+08:00
- **Completed:** 2026-10-20T14:03:00+08:00
- **Tasks:** 2
- **Files modified:** 4（0 新增，4 修改）

## Accomplishments
- `AssetPanelView` 现在读取 `IAssetPanelViewState.error`，在工具栏与 `asset-body` 之间渲染 `.asset-panel-error`（`role="alert"`、`data-test-id="asset-panel-error"`），只在 `status` 不是 `AssetPanelStatus.Error` 时出现
- `asset.css` 增加 `.asset-panel-error`：`flex: 0 0 auto`、内边距 4px 8px、下边框沿用 `--editor-border`、背景沿用 `--easset-missing-bg`、文字 `--easset-danger-fg`、12px——全部复用面板上已定义的变量，不引入新主题键
- 纯视图三条断言：就绪态显示错误条（且 `data-status` 仍是 `ready`、没有整屏错误态）、无错误时没有错误条、整屏错误态不重复渲染
- 集成用例 ⑥ 补界面级断言：错误条文案可见、配置视图不出现、状态为 `ready`、分类导航与网格仍在；随后 `act` 中重新加载分类，断言错误条消失

## Task Commits

Each task was committed atomically:

1. **Task 1: 在面板内渲染可见错误条** - `6e475db` (feat)
2. **Task 2: 界面级回归——非法 schema 的错误可见且可消失** - `b17e416` (test)

**Plan metadata:** 见本计划的 `docs(03-29): complete 03-29 plan` 提交

## Files Created/Modified
- `packages/libs/editor-impl/src/asset/components/AssetPanelView.tsx` - 计算 `panelError` 并在工具栏之后、通知条之前渲染错误条
- `packages/libs/editor-impl/src/asset/asset.css` - 新增 `.asset-panel-error` 样式
- `packages/libs/editor-impl/src/asset/__tests__/assetView.test.tsx` - 三条纯视图断言（显示 / 不显示 / 整屏错误态不重复）
- `packages/libs/editor-impl/src/asset/__tests__/assetUndo.uat.test.tsx` - 用例 ⑥ 增加错误条文案、可浏览性与「重新加载后消失」断言

## Decisions Made
- 错误条放在 `AssetPanelView` 的返回树里、`renderContent` 之外：`renderContent` 会按 Loading / Error / Empty / Ready 提前返回，放进去会被吞掉
- `status === AssetPanelStatus.Error` 时不渲染错误条：整屏错误态已经承担该场景，重复出现只是噪音
- 不改 `AssetPanel.openConfig` 与 `shared/schemaForm`：数据层早已正确发布错误，缺口纯粹在视图没消费
- 文案沿用数据层给出的固定句子，不拼接原始 schema 文件内容（T-03-29-01）

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- 无。根因（视图从不读取 `error`）判断准确，两个任务一次通过。

## User Setup Required
None - no external service configuration required.

## Verification Evidence

| 命令 | 结果 |
|------|------|
| `pnpm --filter @motajs/editor-impl test -- asset` | 18 files / 167 tests passed |
| `pnpm --filter @motajs/editor-impl test` | 46 files / 364 tests passed（03-28 后基线 361 + 3） |
| `pnpm --filter @motajs/editor-impl typecheck` | exit 0 |
| `node scripts/verify/coreModuleState.js` | exit 0（173 文件，error 级受限规则 0 条） |
| `node scripts/verify/coreEngineNeutral.js` | exit 0（109 生产文件，0 条引擎标识违规） |
| `pnpm exec prettier --check <4 个改动文件>` | 全部通过 |
| `pnpm exec eslint <AssetPanelView.tsx + 2 个测试文件>` | 无输出（无错误） |

## Next Phase Readiness
- G-03-11 的自动化证据已就位，等待人工在开发宿主复验：把某分类的 `.schema.jsonc` 改成非法内容 → 点「配置」→ 面板内出现「该素材的配置无法解析」，仍可切换分类 / 选择素材；恢复 schema 后重新加载分类，错误消失
- 人工复验时同时确认既有整屏加载错误态（列表文件无法解析）未发生变化

---
*Phase: 03-asset*
*Completed: 2026-10-20*

## Self-Check: PASSED

- 文件存在：`AssetPanelView.tsx`、`asset.css`、`assetView.test.tsx`、`assetUndo.uat.test.tsx`
- 提交存在：`6e475db`、`b17e416`
- 未修改 `STATE.md` 与 `ROADMAP.md`（由编排器负责）
