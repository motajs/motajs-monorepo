---
phase: 03-asset
plan: 34
subsystem: asset-registration-ui
tags: [asset-panel, asset-grid, asset-detail, registration, unregister, confirmation, vitest, css]

# Dependency graph
requires:
  - phase: 03-asset
    provides: "AssetPanel.registerAsset / AssetPanel.unregisterAsset 与 IAssetEntry.registered（03-33）"
  - phase: 03-asset
    provides: "AssetGrid / AssetDetail / AssetPanelView / AssetPanelContainer 现有界面与回调转发（03-03…03-30）"
provides:
  - "is-unregistered / data-registered：卡片上的未登记标记"
  - "IAssetDetailProps.onRegister / IAssetDetailProps.onUnregister：详情栏两个互斥动作"
  - "AssetDetail 的两步注销状态机（0 / 1 / 2）与两个确认弹窗"
  - "IAssetPanelViewProps.onRegister / IAssetPanelViewProps.onUnregister：视图层带素材名转发"
  - "IAssetPanelContainerProps.onRegister / IAssetPanelContainerProps.onUnregister：接到面板数据方法"
  - "ASSET_DELETE_CONFIRM_TEXT / ASSET_UNREGISTER_CONFIRM_TEXT / ASSET_UNREGISTER_FINAL_CONFIRM_TEXT：删除与两步注销文案"
  - "转码候选过滤掉未登记条目"
affects: [03-36 开发宿主整合, 03-37 人工验收]

actuals:
  tokens: 5584
  tasks: 2
  commits: 0

tech-stack:
  added: []
  patterns:
    - "未登记视觉只加一个类与一个 data 属性，样式只染缩略图，不整卡换色"
    - "详情栏按 entry.registered 二选一渲染「注册到游戏」或「注销」，杜绝两按钮同现"
    - "注销用小状态机：第一次确认只切弹窗，第二次确认才回调；两个弹窗都禁用遮罩与 ESC"
    - "界面动作全部转交 03-33 的数据方法，界面层不自行改写列表"

key-files:
  created:
    - packages/libs/editor-impl/src/asset/__tests__/assetUnregistered.uat.test.tsx
  modified:
    - packages/libs/editor-impl/src/asset/components/AssetGrid.tsx
    - packages/libs/editor-impl/src/asset/components/AssetDetail.tsx
    - packages/libs/editor-impl/src/asset/components/AssetPanelView.tsx
    - packages/libs/editor-impl/src/asset/assetPanel.ts
    - packages/libs/editor-impl/src/asset/constants.ts
    - packages/libs/editor-impl/src/asset/asset.css
  deleted: []

key-decisions:
  - "`is-unregistered` 挂在卡片根节点，背景规则只作用于 `.asset-card-thumb`；卡片其余部分保持原样"
  - "`data-registered` 始终输出 `String(entry.registered)`，未登记卡片同时带类与属性，测试可双钉"
  - "两步注销用 `useState<number>`（0 未打开 / 1 说明框 / 2 最终确认），hook 写在「未选中提前 return」之前，与删除确认并排"
  - "只有第二个弹窗的「确认注销」调用 `IAssetDetailProps.onUnregister`；两处「取消」都只把步进归 0"
  - "删除弹窗正文改用共享常量，明确「移除文件」并指向「注销」；删除行为本身仍是删文件 + 单次确认"
  - "`transcodeCandidates` 增加 `entry.registered` 条件：未进游戏的素材没有转码必要"
  - "容器回调分别转交 `AssetPanel.registerAsset` / `AssetPanel.unregisterAsset`，均为 `void` 调用，沿用 `onAddAsset` 风格"

patterns-established:
  - "未登记态在界面层只依赖 `entry.registered`，数据动作不在组件内部实现"
  - "破坏性动作的文案常量化，界面与测试共用同一份字面量"

requirements-completed: [ASSET-01]

# Coverage metadata
coverage:
  - id: D1
    description: "未登记卡片的缩略图底色为黄色，已登记卡片保持原样"
    requirement: "ASSET-01"
    verification:
      - kind: unit
        ref: "packages/libs/editor-impl/src/asset/__tests__/assetUnregistered.uat.test.tsx#未登记卡片带标记且缩略图使用黄色底色"
        status: pass
    human_judgment: false
  - id: D2
    description: "未登记素材详情只给「注册到游戏」，不给「配置」与「注销」；已登记素材只给「注销」"
    requirement: "ASSET-01"
    verification:
      - kind: unit
        ref: "packages/libs/editor-impl/src/asset/__tests__/assetUnregistered.uat.test.tsx#选中未登记素材只显示注册按钮 / 注册后卡片变已登记且保存写进列表"
        status: pass
    human_judgment: false
  - id: D3
    description: "注销必须连续两次确认；任一确认框取消都保持已登记"
    requirement: "ASSET-01"
    verification:
      - kind: unit
        ref: "packages/libs/editor-impl/src/asset/__tests__/assetUnregistered.uat.test.tsx#注销第一个确认框取消后保持已登记 / 注销第二个确认框取消后保持已登记"
        status: pass
    human_judgment: false
  - id: D4
    description: "完整注销后回到未登记、保存只去掉清单名字，文件字节仍在"
    requirement: "ASSET-01"
    verification:
      - kind: unit
        ref: "packages/libs/editor-impl/src/asset/__tests__/assetUnregistered.uat.test.tsx#两次确认注销后保存只去掉登记，文件字节保留"
        status: pass
    human_judgment: false
  - id: D5
    description: "删除确认文案明确说明会移除文件并指向「注销」，取消不删文件"
    requirement: "ASSET-01"
    verification:
      - kind: unit
        ref: "packages/libs/editor-impl/src/asset/__tests__/assetUnregistered.uat.test.tsx#删除确认文案与注销区分且取消不删文件"
        status: pass
    human_judgment: false
  - id: D6
    description: "未登记素材不进入转码弹窗候选"
    requirement: "ASSET-01"
    verification:
      - kind: other
        ref: "packages/libs/editor-impl/src/asset/components/AssetPanelView.tsx#transcodeCandidates（过滤 registered）"
        status: pass
    human_judgment: false

duration: 25min
completed: 2026-10-21
status: complete
---

# Phase 03 Plan 34: 未登记素材的注册 / 注销界面 Summary

**未登记素材在网格里是黄底缩略图，详情栏按状态给「注册到游戏」或「注销」；注销必须连点两次确认，且永远不删文件，和「删除」在文案上彻底分开**

## Performance

- **Duration:** 25 min
- **Tasks:** 2
- **Files modified:** 7（1 新增，6 修改）

## Accomplishments

- `AssetGrid`：`cardClassName` 在 `entry.registered === false` 时追加 `is-unregistered`；卡片根节点新增 `data-registered={String(entry.registered)}`
- `asset.css`：`.asset-panel` 新增 `--easset-unregistered-bg: #fffbe6` 与 `--easset-unregistered-fg: #ad8b00`；新增 `.asset-card.is-unregistered .asset-card-thumb { background: var(--easset-unregistered-bg); }`，只染缩略图
- `constants.ts`：新增删除与两步注销三条共享文案常量
- `AssetDetail`：
  - `IAssetDetailProps` 新增可选 `onRegister` / `onUnregister`
  - 新增 `useState<number>` 作为 `unregisterStep`（0 未打开 / 1 说明框 / 2 最终确认），与 `confirmingState` 并排写在「未选中提前 return」之前
  - 操作行：替换 / 删除保持；「配置」只在已登记时出现；未登记只出「注册到游戏」，已登记只出「注销」
  - 第一个弹窗「注销素材」：正文说明只移除登记与配置、文件保留；按钮「取消」/「继续」
  - 第二个弹窗「再次确认注销」：正文说明配置永久丢失；按钮「取消」/「确认注销」；两个弹窗都 `closable={false}`、`maskClosable={false}`、`keyboard={false}`
  - 只有第二次确认先归零步进再调用 `onUnregister`
  - 删除弹窗正文换成 `ASSET_DELETE_CONFIRM_TEXT`，标题、按钮与测试标记不变
- `AssetPanelView`：新增 `onRegister(name)` / `onUnregister(name)` 并带当前选中素材名接到 `AssetDetail`；`transcodeCandidates` 过滤 `entry.registered`
- `assetPanel.ts`：容器 props 新增两个必需回调并原样转交；构造函数里分别 `void this.registerAsset(name)` / `void this.unregisterAsset(name)`
- 新增 7 条界面回归：黄卡、只给注册、注册后保存、两步注销各自取消、完整注销后文件仍在、删除文案区分

## Task Outcomes

1. **Task 1: 黄色缩略图 + 注册 / 注销按钮 + 两步确认 + 文案区分** —— 6 个文件改动；`typecheck` exit 0，`test -- asset` 23 文件 / 214 用例通过
2. **Task 2: 界面回归** —— 新增 `assetUnregistered.uat.test.tsx` 7 条用例；`test -- assetUnregistered` 1 文件 / 7 用例通过，`typecheck` exit 0，prettier 通过

## Deviations from Plan

None - plan executed exactly as written.

**说明（非偏差）：** 计划 Task 2 的 ④ 同时描述两次取消；为了让失败点可定位，把它拆成「第一步取消」「第二步取消」两条 `it`，因此该文件共 7 条而不是 6 条。其余断言内容与计划逐条对应。

## Issues Encountered

- 素材测试输出中仍有既有的 jsdom `window.getComputedStyle` 未实现与 antd `addonAfter` 弃用警告，属于测试环境噪音，不影响退出码与用例结果。

## Verification Evidence

| 命令 | 结果 |
|------|------|
| `pnpm --filter @motajs/editor-impl typecheck` | exit 0（`tsc -b` 无错误输出） |
| `pnpm --filter @motajs/editor-impl test -- asset` | 24 files / 221 tests passed，exit 0 |
| `pnpm --filter @motajs/editor-impl test -- assetUnregistered` | 1 file / 7 tests passed，exit 0 |
| `pnpm exec prettier --check <7 个改动文件>` | All matched files use Prettier code style，exit 0 |

## Known Stubs

无。

## Threat Surface Scan

计划内已覆盖：注销两步确认（T-03-34-01）、删除与注销文案区分（T-03-34-02）、未登记卡片视觉标记（T-03-34-03）。本次改动未引入新的网络、鉴权或文件访问面。

## Next Phase Readiness

- 03-36 可在开发宿主里放一张未登记样本，直接走「黄卡 → 注册 → 保存 → 注销（两次）→ 保存 → 配置消失且回黄卡」
- 03-37 人工验收可直接按上述链路操作，删除仍会真删文件，与注销互不混淆
- 按用户要求本计划未提交；改动仍留在工作区，另有执行前已存在的 `.gsd/dispatch-isolation-sentinel.json` 与 `.planning/phases/02.1-resource-layer/*` 改动，与本计划无关

---

*Phase: 03-asset*
*Completed: 2026-10-21*

## Self-Check: PASSED

- 文件存在：`assetUnregistered.uat.test.tsx`；其余 6 个文件均已修改
- 未修改 `STATE.md`、`ROADMAP.md`、`packages/apps/**` 或计划外源文件
- 本计划未产生提交（用户要求独立验证后自行提交）；工作区其余改动均来自执行前
