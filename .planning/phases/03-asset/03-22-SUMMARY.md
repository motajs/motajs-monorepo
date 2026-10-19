---
phase: 03-asset
plan: 22
subsystem: ui
tags: [asset, transcode, antd, modal, uat-gap]

# Dependency graph
requires:
  - phase: 03-asset
    provides: 转码弹窗与批量编排（03-16）、面板视图（03-11）
provides:
  - 分区、竖排自滚动的转码弹窗，含输出格式说明与「正在转码…」状态
  - 转码结果改由全局 antd `message` 呈现，面板顶部不再出现操作结果提示行
affects: [03-asset]

# Actuals (#2632) — chars/4 over the realized diff
actuals:
  tokens: 7116
  tasks: 2
  commits: 2

tech-stack:
  added: []
  patterns:
    - "操作结果统一走全局 antd message，视图状态只保留结构化数据"
    - "弹窗正文按 .asset-transcode-section 分区，相邻分区用 border-top 分隔"

key-files:
  created:
    - packages/libs/editor-impl/src/asset/__tests__/transcodeModal.test.tsx
  modified:
    - packages/libs/editor-impl/src/asset/components/TranscodeModal.tsx
    - packages/libs/editor-impl/src/asset/components/AssetPanelView.tsx
    - packages/libs/editor-impl/src/asset/assetPanel.ts
    - packages/libs/editor-impl/src/asset/types.ts
    - packages/libs/editor-impl/src/asset/transcode/types.ts
    - packages/libs/editor-impl/src/asset/asset.css
    - packages/libs/editor-impl/src/asset/__tests__/transcode.uat.test.tsx

key-decisions:
  - "样式断言改用 Vite `?inline` 导入 CSS 文本，因为 editor-impl 未引入 Node 类型、jsdom 下 import.meta.url 不是 file URL"
  - "InputNumber 保留 addonAfter 标注 bps / Hz；antd 6 会给出弃用警告但不影响行为"
  - "能力探测提示 asset-transcode-notice 保留，只移除操作结果提示行与常驻绿色汇总块"

patterns-established:
  - "AssetPanel.publish 的第二个参数只触发全局提示，不再写入视图状态"
  - "转码弹窗列表固定 max-height: 240px + overflow-y: auto，弹窗高度不随素材数增长"

requirements-completed: [ASSET-01]

coverage:
  - id: D1
    description: "转码弹窗正文分区、素材列表竖向排列并自身滚动、写明输出格式与「正在转码…」"
    requirement: ASSET-01
    verification:
      - kind: unit
        ref: "src/asset/__tests__/transcodeModal.test.tsx#转码弹窗版面"
        status: pass
    human_judgment: false
  - id: D2
    description: "转码结果只经全局 antd message 提示，面板顶部提示行与常驻绿色汇总块被移除"
    requirement: ASSET-01
    verification:
      - kind: unit
        ref: "src/asset/__tests__/transcode.uat.test.tsx#素材瘦身转码编排"
        status: pass
    human_judgment: false
  - id: D3
    description: "弹窗整体观感不再拥挤，分区、分割线与滚动条在真实宿主中可读可用"
    human_judgment: true
    verification: []
    rationale: "版面是否真正不拥挤依赖目视与真实素材数量，自动化只能钉住结构与样式规则"

duration: 14min
completed: 2026-10-19
status: complete
---

# Phase 3 Plan 22: 转码弹窗版面与全局结果提示 Summary

**瘦身转码弹窗改为分区竖排、列表自滚动并显示「正在转码…」，结果改走 antd `message`，面板顶部提示行与常驻绿色提示块被移除**

## Performance

- **Duration:** 14 min
- **Tasks:** 2
- **Files modified:** 7（另新建 1 个测试文件）

## Accomplishments

- 弹窗正文分成「输出格式 / 素材选择 / 参数 / 覆盖选项」四区，相邻分区有分割线；素材列表竖向一行一个，超过 240px 时列表自身出现滚动条。
- 转码前明确写出产物：图片 → WebP（`.webp`），音频 → WebM 容器中的 Opus（`.webm`）；参数输入补上 `bps` / `Hz` 单位。
- 转码进行中弹窗保持打开，显示「正在转码…」并禁用开始与取消；完成后弹窗关闭。
- 面板顶部不再因上传拒绝 / 删除 / 保存 / 新增等操作顶出一行；转码成功后不再残留关不掉的绿色提示块，结果只经全局 `message.success` / `message.error` 提示。

## Task Commits

1. **Task 1: 弹窗分区、竖排列表与自滚动、输出格式与「正在转码」** - `68a1202` (feat)
2. **Task 2: 去掉顶部提示行与常驻绿色提示，转码结果改用全局 message** - `00f34d7` (fix)

## Files Created/Modified

- `packages/libs/editor-impl/src/asset/components/TranscodeModal.tsx` — 四区正文、`width=720`、busy 时显示状态并禁用取消
- `packages/libs/editor-impl/src/asset/transcode/types.ts` — 新增图片 / 音频输出格式与「正在转码…」三条文案常量
- `packages/libs/editor-impl/src/asset/asset.css` — 补齐 `.asset-transcode-*` 分区、列表、参数与覆盖行的样式
- `packages/libs/editor-impl/src/asset/components/AssetPanelView.tsx` — 删除顶部提示行与绿色汇总 `Alert`
- `packages/libs/editor-impl/src/asset/assetPanel.ts` — `publish` 提示参数改走 `antdMessage.info`；转码结果改走 `success` / `error`
- `packages/libs/editor-impl/src/asset/types.ts` — 移除 `IAssetPanelViewState.message` 与 `transcodeSummary`
- `packages/libs/editor-impl/src/asset/__tests__/transcodeModal.test.tsx` — 新增弹窗版面与 CSS 规则回归
- `packages/libs/editor-impl/src/asset/__tests__/transcode.uat.test.tsx` — ③④⑥⑩ 改为 spy 全局 `message`

## Decisions Made

- 样式回归改用 Vite 的 `?inline` 读取 CSS 文本：`editor-impl` 未引入 Node 类型，且 jsdom 环境下 `import.meta.url` 不是 `file:` URL，`readFileSync(new URL(...))` 不可用。
- `InputNumber` 的 `addonAfter` 在 antd 6 已标记弃用，但本计划明确要求用它标注单位，保留并接受测试输出中的弃用警告。
- `asset-transcode-notice`（当前环境不支持转码）继续保留，它是能力提示而不是操作结果。

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] CSS 样式断言改用 `?inline` 导入**
- **Found during:** Task 1（弹窗版面测试）
- **Issue:** 计划指定的 `readFileSync(new URL('../asset.css', import.meta.url), 'utf8')` 在 jsdom 下抛 `The URL must be of scheme file`；改用相对路径后 `tsc -b` 又因包内无 Node 类型而报 `node:fs` 找不到。
- **Fix:** 改为 `import assetCss from '../asset.css?inline'` 读取同一条样式文本，断言内容不变。
- **Files modified:** `packages/libs/editor-impl/src/asset/__tests__/transcodeModal.test.tsx`
- **Verification:** 新增用例 4/4 通过，`tsc -b` 退出 0。
- **Committed in:** `68a1202`

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** 只影响测试读取样式的途径，断言目标（竖排、自滚动、分割线）完全保留。

## Issues Encountered

- antd 6 对 `InputNumber.addonAfter` 给出弃用警告；不影响渲染与断言，按要求保留单位标注。

## Verification Evidence

- `pnpm --filter @motajs/editor-impl test -- src/asset/__tests__/transcodeModal.test.tsx` — 4 passed
- `pnpm --filter @motajs/editor-impl test -- src/asset/__tests__/transcode.uat.test.tsx` — 10 passed
- `pnpm --filter @motajs/editor-impl test -- src/asset` — 13 files / 129 passed
- `pnpm --filter @motajs/editor-impl test` — 40 files / 322 passed（原 318 + 新增 4）
- `pnpm --filter @motajs/editor-impl typecheck` — 退出 0
- `node scripts/verify/coreModuleState.js` — 退出 0
- `node scripts/verify/coreEngineNeutral.js` — 退出 0
- `node scripts/verify/coreImportType.js` — 退出 0
- `pnpm exec prettier --check`（本次改动文件）— 全部通过

## User Setup Required

None - 无外部服务配置。

## Next Phase Readiness

- G-03-3 的结构性修复已完成并通过自动化验证；弹窗观感仍需在真实宿主中用较多素材目视确认。
- 转码编排（覆盖 / 保留 / 失败隔离 / 屏障）行为未改变，相关回归全部通过。

---
*Phase: 03-asset*
*Completed: 2026-10-19*

## Self-Check: PASSED

