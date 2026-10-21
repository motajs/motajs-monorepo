---
phase: 03-asset
plan: 32
subsystem: asset-contract
tags: [asset-panel, asset-entry, transcode-presets, defaults, types-only, vitest]

# Dependency graph
requires:
  - phase: 03-asset
    provides: "IAssetEntry 现有五个成员与 byteVersion 语义（03-03 / 03-28）"
  - phase: 03-asset
    provides: "transcode/types.ts 的转码契约与默认值（03-03 / 03-31 UAT 修订）"
provides:
  - "IAssetEntry.registered：必填只读 boolean，区分「已登记进 .list.jsonc」与「只在分类目录里」"
  - "AssetImagePreset / AssetAudioPreset：图片三档 + 自定义、音频三档 + 自定义"
  - "ASSET_IMAGE_PRESETS（80 / 92 / 100）与 ASSET_AUDIO_PRESETS（64+44.1 / 92+48 / 128+48，kbps+kHz）"
  - "ASSET_DEFAULT_IMAGE_PRESET = Lossless、ASSET_DEFAULT_AUDIO_PRESET = Standard、ASSET_TRANSCODE_CUSTOM_LABEL"
  - "ASSET_TRANSCODE_QUALITY_NOTE / PIXEL_ART_NOTE / KEEP_ORIGIN_HINT 三段说明文案"
  - "IAssetImagePresetOption / IAssetAudioPresetOption / IAssetAudioCustomOptions"
affects: [03-33 未登记扫描, 03-34 注册-注销界面, 03-35 转码预设界面, 03-37 开发宿主整合]

actuals:
  tokens: 3700
  tasks: 2
  commits: 0

tech-stack:
  added: []
  patterns:
    - "默认值只有一个真值来源：图片默认档指向预设表里的 Lossless，其 quality 与 ASSET_DEFAULT_WEBP_QUALITY 同为 100"
    - "预设表只存 kbps / kHz，界面不需要二次换算；bps / Hz 仍只属于内部转码契约"
    - "必填布尔而非可选：所有条目构造点显式赋值，杜绝「忘填 → 未登记条目被写回列表」"

key-files:
  created:
    - packages/libs/editor-impl/src/asset/transcode/presets.ts
  modified:
    - packages/libs/editor-impl/src/asset/types.ts
    - packages/libs/editor-impl/src/asset/assetPanel.ts
    - packages/libs/editor-impl/src/asset/transcode/types.ts
    - packages/libs/editor-impl/src/asset/transcode/index.ts
    - packages/libs/editor-impl/src/asset/transcode/__tests__/transcodeDefaults.test.ts
    - packages/libs/editor-impl/src/asset/__tests__/assetDetailSize.test.tsx
    - packages/libs/editor-impl/src/asset/__tests__/assetDetailBytes.test.tsx
    - packages/libs/editor-impl/src/asset/__tests__/assetView.test.tsx
    - packages/libs/editor-impl/src/asset/__tests__/transcodeModal.test.tsx
  deleted: []

key-decisions:
  - "`IAssetEntry.registered` 设为必填只读 boolean：写回过滤的唯一判据不靠缺省值"
  - "列表派生条目与新增条目一律 `registered: true`；重建条目（替换 / 转码 / 存配置）沿用 `entry.registered`"
  - "图片默认档走 Lossless（质量 100），`ASSET_DEFAULT_WEBP_QUALITY` 保持 100 不下调；音频默认档 Standard（128 kbps + 48 kHz）"
  - "预设项 `id` 用完整枚举类型（含 Custom），预设表本身只列三档固定值，不额外引入窄化类型"

patterns-established:
  - "契约批次写法：只改类型 / 常量 / 默认值，界面与扫描逻辑零改动，靠 typecheck 逼出全部构造点"
  - "默认值一致性用测试钉死：默认档枚举 + 预设表中该档的 quality / 回退值换算后一致"

requirements-completed: [ASSET-01]

# Coverage metadata (#1602)
coverage:
  - id: D1
    description: "每条素材条目都显式携带「是否已登记进 .list.jsonc」"
    requirement: "ASSET-01"
    verification:
      - kind: other
        ref: "`pnpm --filter @motajs/editor-impl typecheck` exit 0：必填字段强制五个构造点与四个测试字面量全部补齐"
        status: pass
    human_judgment: false
  - id: D2
    description: "图片三档预设 80 / 92 / 100 + 自定义，默认无损压缩 100"
    requirement: "ASSET-01"
    verification:
      - kind: unit
        ref: "packages/libs/editor-impl/src/asset/transcode/__tests__/transcodeDefaults.test.ts#图片默认预设为无损压缩且质量为 100"
        status: pass
    human_judgment: false
  - id: D3
    description: "音频三档预设 64 kbps+44.1 kHz / 92 kbps+48 kHz / 128 kbps+48 kHz + 自定义，默认常规压缩"
    requirement: "ASSET-01"
    verification:
      - kind: unit
        ref: "packages/libs/editor-impl/src/asset/transcode/__tests__/transcodeDefaults.test.ts#音频默认预设为常规压缩"
        status: pass
    human_judgment: false
  - id: D4
    description: "三段说明文案可直接取用；默认质量仍为 100、音频回退值仍为 128000 bps / 48000 Hz"
    requirement: "ASSET-01"
    verification:
      - kind: unit
        ref: "packages/libs/editor-impl/src/asset/transcode/__tests__/transcodeDefaults.test.ts（既有三条默认值断言保持不变）"
        status: pass
    human_judgment: false

duration: 18min
completed: 2026-10-21
status: complete
---

# Phase 03 Plan 32: 追加批次契约（登记标记 + 转码预设）Summary

**每条素材现在都带「是否已登记」标记；图片 / 音频转码各有三档固定预设与一个自定义档，三个说明文案就位，图片默认无损压缩 100**

## Performance

- **Duration:** 18 min
- **Tasks:** 2
- **Files modified:** 10（1 新增，9 修改）

## Accomplishments
- `IAssetEntry` 新增必填只读 `registered: boolean`，jsDoc 说明「false = 文件只在分类目录里、不进游戏」
- 五个条目构造点全部显式补齐：`AssetPanel.buildEntries` / `AssetPanel.addAsset` 为 `true`，`AssetPanel.replaceAsset` / `AssetPanel.transcodeAssets` / `AssetPanel.storeEntryConfig` 沿用原值；未新增任何注册 / 注销方法，界面未读取该字段
- 四个测试文件的条目字面量补齐 `registered: true`，原有断言一条未改
- `transcode/types.ts` 新增 `AssetImagePreset`（`VolumeFirst` / `Standard` / `Lossless` / `Custom`）与 `AssetAudioPreset`（`SmallestSize` / `VolumeFirst` / `Standard` / `Custom`），以及 `IAssetImagePresetOption` / `IAssetAudioPresetOption` / `IAssetAudioCustomOptions`
- 新增 `transcode/presets.ts`：`ASSET_IMAGE_PRESETS`（80 / 92 / 100）、`ASSET_AUDIO_PRESETS`（64+44.1 / 92+48 / 128+48，kbps+kHz）、两个默认档、自定义档标签、三段说明文案
- `transcode/index.ts` 追加 `export * from './presets';`，桶文件仍只有 `export *`
- 转码默认值测试新增两条：图片默认档为 `Lossless` 且该档 `quality` 为 100；音频默认档为 `Standard`。`ASSET_DEFAULT_WEBP_QUALITY` 保持 100，`ASSET_DEFAULT_OPUS_BITRATE` / `ASSET_DEFAULT_OPUS_SAMPLE_RATE` 保持 128000 / 48000

## Task Outcomes

1. **Task 1: 条目增加必填的「已登记」标记** —— 类型与五处构造点、四处测试字面量补齐；typecheck 与素材测试全绿
2. **Task 2: 图片 / 音频转码预设契约与说明文案** —— 枚举、接口、预设表、默认档、三段文案与两条新断言；转码测试与 typecheck 全绿

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Formatting] Prettier 重排两处新增代码**
- **Found during:** Task 2 完成后的 `prettier --check`
- **Issue:** `presets.ts` 的 import 与长文案行、`assetDetailSize.test.tsx` 补齐 `registered` 后的条目字面量超出 120 列，`prettier --check` 报两文件不合规
- **Fix:** 对这两个文件执行 `prettier --write`；只改换行，不改任何取值、断言或行为
- **Files modified:** `presets.ts`、`assetDetailSize.test.tsx`
- **Verification:** 重新运行 typecheck、素材测试、转码测试与 `prettier --check`，全部通过

---

**Total deviations:** 1 auto-fixed（格式）
**Impact on plan:** 无行为影响；未改界面、未引入依赖、未新增 `as` 断言或内联对象类型。

## Issues Encountered
- 测试输出里出现 jsdom `window.getComputedStyle` 未实现与 antd `addonAfter` 弃用警告，均为既有测试环境噪音，不影响退出码与用例结果。

## Verification Evidence

| 命令 | 结果 |
|------|------|
| `pnpm --filter @motajs/editor-impl typecheck` | exit 0（`tsc -b` 无输出） |
| `pnpm --filter @motajs/editor-impl test -- asset` | 20 files / 183 tests passed，exit 0 |
| `pnpm --filter @motajs/editor-impl test -- transcode` | 6 files / 35 tests passed，exit 0 |
| `pnpm exec prettier --check <10 个改动文件>` | All matched files use Prettier code style |

## Next Phase Readiness
- 03-33 可直接用 `entry.registered` 作为「只写回已登记条目」的判据，无需再猜缺省值
- 03-35 可直接取 `ASSET_IMAGE_PRESETS` / `ASSET_AUDIO_PRESETS` / 两个默认档 / 三段文案；kbps / kHz 到 bps / Hz 的换算留在该计划
- 界面与扫描行为未变：本计划没有任何可见变化

---

*Phase: 03-asset*
*Completed: 2026-10-21*

## Self-Check: PASSED

- 文件存在：`presets.ts`、`transcodeDefaults.test.ts`、`types.ts`、`assetPanel.ts` 及四个测试文件
- `IAssetEntry.registered` 为必填只读 `boolean`
- `ASSET_DEFAULT_WEBP_QUALITY` 仍为 100；音频回退值仍为 128000 / 48000
- 未修改 `STATE.md`、`ROADMAP.md` 与计划外源文件；本计划未产生提交（用户未要求提交）
