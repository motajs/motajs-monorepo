---
phase: 03-asset
plan: 24
subsystem: asset
tags: [asset, transcode, opus, webp, defaults, uat-gap]

# Dependency graph
requires:
  - phase: 03-asset
    provides: 转码服务（03-09 / 03-15）、转码弹窗与批量编排（03-16）、弹窗版面（03-22）
provides:
  - 源音频参数探测契约 `IAssetAudioSourceInfo` 与直通入口 `probeAudioSource`
  - WebP 默认品质 100、Opus 回退码率 128000 / 采样率 48000
  - 转码弹窗以素材条目（含字节路径）与读字节回调为输入，为 03-25 真实探测备好入口
affects: [03-asset]

# Actuals (#2632) — chars/4 over the realized diff
actuals:
  tokens: 2462
  tasks: 2
  commits: 3

tech-stack:
  added: []
  patterns:
    - "探测类接口先直通返回「读不到」，真实实现留给下一个计划，调用方始终能落回默认常量"
    - "弹窗接收完整素材条目而非名字字符串，路径与读字节回调作为独立 seam 传入"

key-files:
  created:
    - packages/libs/editor-impl/src/asset/transcode/__tests__/transcodeDefaults.test.ts
  modified:
    - packages/libs/editor-impl/src/asset/transcode/types.ts
    - packages/libs/editor-impl/src/asset/transcode/audioOpus.ts
    - packages/libs/editor-impl/src/asset/components/TranscodeModal.tsx
    - packages/libs/editor-impl/src/asset/components/AssetPanelView.tsx
    - packages/libs/editor-impl/src/asset/__tests__/transcodeModal.test.tsx

key-decisions:
  - "probeAudioSource 本计划直通返回 undefined（等于「读不到」），不引入 Mediabunny 探测，保持接口与实现分离"
  - "ITranscodeModalProps.names 换成 entries + loadBytes；组件内部只派生名字列表，选择与全选行为不变"
  - "AssetPanelView.transcodeCandidates 改为返回过滤后的条目，路径因此能随条目进入弹窗"

patterns-established:
  - "可选字段的探测结果用 interface + 可选成员表达，undefined 表示完全读不到"

requirements-completed: [ASSET-01]

coverage:
  - id: D1
    description: "源音频参数契约与入口就位；WebP 默认品质 100、Opus 回退码率 128000、采样率 48000"
    requirement: ASSET-01
    verification:
      - kind: unit
        ref: "src/asset/transcode/__tests__/transcodeDefaults.test.ts"
        status: pass
      - kind: other
        ref: "pnpm --filter @motajs/editor-impl typecheck"
        status: pass
    human_judgment: false
  - id: D2
    description: "转码弹窗能拿到每个候选素材的字节路径与读字节回调，选择 / 全选 / 空态行为与 03-22 一致"
    requirement: ASSET-01
    verification:
      - kind: unit
        ref: "src/asset/__tests__/transcodeModal.test.tsx"
        status: pass
      - kind: unit
        ref: "pnpm --filter @motajs/editor-impl test -- src/asset (14 files / 136 tests)"
        status: pass
      - kind: other
        ref: "pnpm --filter @motajs/editor-impl typecheck"
        status: pass
    human_judgment: false

duration: 9min
completed: 2026-10-19
status: complete
---

# Phase 3 Plan 24: 音频源参数探测契约与转码默认值 Summary

**为「读源音频参数」定好契约与入口（先直通返回读不到），并把 WebP 默认品质改为 100、Opus 回退码率改为 128 kbps，弹窗同时拿到素材路径与读字节回调**

## Performance

- **Duration:** 9 min
- **Started:** 2026-10-19T20:33:00Z（约）
- **Completed:** 2026-10-19T20:43:00Z（约）
- **Tasks:** 2
- **Files modified:** 6（其中新建 1 个测试文件）

## Accomplishments

- 新增 `IAssetAudioSourceInfo`（可选 `sampleRate` / `bitrate`）与 `probeAudioSource`，从转码桶文件自动导出；本计划内直通返回 `undefined`，表示「读不到」。
- 图片转码默认品质由 80 改为 100；音频回退码率由 96000 改为 128000，采样率回退仍是 48000。
- 转码弹窗输入由名字列表改成完整素材条目，并新增按路径读字节的 `loadBytes` 回调；面板视图的候选过滤同时返回条目，路径得以带入弹窗。
- 弹窗的选择初始化、全选 / 全不选、列表渲染与空态判断全部改由内部派生的名字列表驱动，行为与 03-22 一致。

## Task Commits

1. **Task 1: 音频源参数契约、探测入口与默认值** - `c8dbb69` (feat)
2. **Task 2: 弹窗改收条目 + 读字节回调，保持现有行为** - `9badc2f` (feat)
3. **Task 1 收尾格式化** - `1356ec2` (style)

## Files Created/Modified

- `packages/libs/editor-impl/src/asset/transcode/types.ts` — 新增 `IAssetAudioSourceInfo`；三个默认值改为 100 / 128000 / 48000 并更新说明
- `packages/libs/editor-impl/src/asset/transcode/audioOpus.ts` — 新增直通的 `probeAudioSource`，不改既有转码函数
- `packages/libs/editor-impl/src/asset/transcode/__tests__/transcodeDefaults.test.ts` — 钉住三个默认值与直通返回 `undefined`
- `packages/libs/editor-impl/src/asset/components/TranscodeModal.tsx` — `names` 改为 `entries` + `loadBytes`，内部派生名字列表
- `packages/libs/editor-impl/src/asset/components/AssetPanelView.tsx` — `transcodeCandidates` 返回条目并传入弹窗
- `packages/libs/editor-impl/src/asset/__tests__/transcodeModal.test.tsx` — 渲染改用条目与恒返回 `undefined` 的 `loadBytes`

## Decisions Made

- 探测函数先直通：避免把「接口定义」与「真实元数据读取」混进同一个计划，03-25 只替换函数体。
- 弹窗不调用 `loadBytes`：本计划只搭入口，读取时机与「用户已改过」的判断属于 03-25。
- 默认常量同时被弹窗初始值与 `imageWebp.toQualityRatio` 的非法值回退使用；改值后两处语义一致。

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- 首次提交前测试文件的 import 未按 Prettier 合并为单行；已用 `prettier --write` 修正并以单独 `style` 提交收尾，未改变断言内容。

## User Setup Required

None - 无外部服务配置。

## Verification Evidence

- `pnpm --filter @motajs/editor-impl test -- src/asset/transcode/__tests__/transcodeDefaults.test.ts` — 4 passed
- `pnpm --filter @motajs/editor-impl test -- src/asset/__tests__/transcodeModal.test.tsx` — 4 passed
- `pnpm --filter @motajs/editor-impl test -- src/asset` — 14 files / 136 passed
- `pnpm --filter @motajs/editor-impl test` — 42 files / 333 passed（原 329 + 新增 4）
- `pnpm --filter @motajs/editor-impl typecheck` — 退出 0
- `node scripts/verify/coreImportType.js` — 退出 0
- `node scripts/verify/coreModuleState.js` — 退出 0
- `node scripts/verify/coreEngineNeutral.js` — 退出 0
- `pnpm exec prettier --check`（本次改动文件）— 全部通过

## Next Phase Readiness

- 03-25 可直接替换 `probeAudioSource` 函数体，并在弹窗里用 `entries.path` + `loadBytes` 读取第一条选中素材；读不到时仍落回 128000 / 48000。
- 转码编排、覆盖 / 保留逻辑与撤销屏障均未改动。

---

*Phase: 03-asset*
*Completed: 2026-10-19*

## Self-Check: PASSED
