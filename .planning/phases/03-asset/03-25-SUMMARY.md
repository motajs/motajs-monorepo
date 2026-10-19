---
phase: 03-asset
plan: 25
subsystem: asset
tags: [asset, transcode, opus, mediabunny, probe, defaults, uat-gap]

# Dependency graph
requires:
  - phase: 03-asset
    provides: 转码默认值 128000 / 48000（03-24）、弹窗条目 + 读字节回调入口（03-24）、音频转码服务（03-15）
provides:
  - 真实的 `probeAudioSource`：经 Mediabunny 只读主音轨元数据，拿到源采样率 / 码率
  - 音频转码弹窗以第一条选中素材的源参数作为默认值，失效时回退常量
  - Node 环境探测回归与弹窗级探测回归（含用户输入保护）
affects: [03-asset]

# Actuals (#2632) — chars/4 over the realized diff
actuals:
  tokens: 5979
  tasks: 2
  commits: 2

tech-stack:
  added: []
  patterns:
    - "探测外部字节一律「有限正数才算读到」：null / 0 / 负数 / NaN / 抛错都退化为 undefined"
    - "弹窗副作用用「已手动修改」标记 + cleanup 取消位，保证异步结果永远不压过用户输入"

key-files:
  created:
    - packages/libs/editor-impl/src/asset/transcode/__tests__/audioProbe.test.ts
  modified:
    - packages/libs/editor-impl/src/asset/transcode/audioOpus.ts
    - packages/libs/editor-impl/src/asset/components/TranscodeModal.tsx
    - packages/libs/editor-impl/src/asset/__tests__/transcodeModal.test.tsx
    - packages/libs/editor-impl/src/__tests__/mapPolyfill.ts

key-decisions:
  - "probeAudioSource 只读主音轨的采样率与码率，不解码音频；任何异常静默返回 undefined，绝不抛穿到弹窗"
  - "探测只针对第一条仍被选中的素材；选择变化时重新探测，不平均也不猜测多条素材的参数"
  - "弹窗以 ref 保存最新 loadBytes，effect 只依赖 probePath，避免面板每次渲染都重新探测"
  - "共享测试 setup 的 window 访问加 typeof window 检查，让 Node 环境的探测用例能复用同一 setup"

patterns-established:
  - "可选元数据探测：返回 undefined 表示「读不到」，调用方无条件落回常量默认值"

requirements-completed: [ASSET-01]

coverage:
  - id: D1
    description: "probeAudioSource 用 Mediabunny 读出源 WAV 的 16000 Hz 采样率；无音轨 / 损坏字节 / 空字节静默返回 undefined"
    requirement: ASSET-01
    verification:
      - kind: unit
        ref: "src/asset/transcode/__tests__/audioProbe.test.ts"
        status: pass
      - kind: other
        ref: "pnpm --filter @motajs/editor-impl typecheck"
        status: pass
    human_judgment: false
  - id: D2
    description: "音频转码弹窗默认参数取第一条选中素材的源采样率 / 码率；读不到回退 128000 / 48000；用户改过的输入不被异步结果覆盖；图片分类不触发探测"
    requirement: ASSET-01
    verification:
      - kind: unit
        ref: "src/asset/__tests__/transcodeModal.test.tsx"
        status: pass
      - kind: unit
        ref: "pnpm --filter @motajs/editor-impl test -- src/asset (15 files / 144 tests)"
        status: pass
      - kind: other
        ref: "pnpm --filter @motajs/editor-impl typecheck"
        status: pass
    human_judgment: false

duration: 14min
completed: 2026-10-19
status: complete
---

# Phase 3 Plan 25: 音频源参数探测与转码默认值 Summary

**打开音频转码弹窗时用 Mediabunny 读出第一条选中素材自己的采样率 / 码率作为默认值；读不到就回退 128 kbps / 48 kHz，用户改过则以用户输入为准**

## Performance

- **Duration:** 14 min
- **Started:** 2026-10-19T21:14:00+08:00（约）
- **Completed:** 2026-10-19T21:28:00+08:00（约）
- **Tasks:** 2
- **Files modified:** 5（其中新建 1 个测试文件）

## Accomplishments

- `probeAudioSource` 从直通返回 `undefined` 换成真实实现：本地用 Mediabunny 打开字节、取主音轨、读采样率与码率；无音轨、非法字节、空字节都静默返回 `undefined`。
- 数值校验收口到 `readPositiveNumber`：只有有限正数才算读到，`null` / `0` / 负数 / `NaN` / 抛错一律当「读不到」，落回 03-24 的常量。
- 转码弹窗在音频分类下探测第一条仍被选中的素材，把可读到的值写入码率 / 采样率；探测失败不提示、不阻断。
- 两个「已手动修改」标记 + effect cleanup 的取消位，保证用户先改的值不会被晚到的探测结果冲掉；图片分类完全跳过探测。
- 共享测试 setup 的 `window` 访问加了 `typeof window` 判断，Node 环境的探测用例不再在 setup 阶段 `ReferenceError`。

## Task Commits

1. **Task 1: 用 Mediabunny 读源音频的采样率与码率** - `e61c512` (feat)
2. **Task 2: 弹窗用源参数做默认值，且不覆盖用户输入** - `fa20897` (feat)

**Plan metadata:** 本次 SUMMARY 提交（docs: complete plan）

## Files Created/Modified

- `packages/libs/editor-impl/src/asset/transcode/audioOpus.ts` — `probeAudioSource` 真实实现 + `readPositiveNumber`
- `packages/libs/editor-impl/src/asset/transcode/__tests__/audioProbe.test.ts` — Node 环境；合成 WAV 读出 16000 Hz，坏字节 / 空字节返回 `undefined`
- `packages/libs/editor-impl/src/asset/components/TranscodeModal.tsx` — 探测副作用、用户输入保护、按 `probePath` 触发
- `packages/libs/editor-impl/src/asset/__tests__/transcodeModal.test.tsx` — 探测值成为默认值 / 回退 / 不覆盖用户输入 / 图片不探测
- `packages/libs/editor-impl/src/__tests__/mapPolyfill.ts` — `window` 访问加 Node 环境保护

## Decisions Made

- 探测只读元数据、不解码：满足「大文件不卡界面」与威胁表 T-03-85 的处置。
- 只探测第一条选中素材：多条素材参数不同时不做平均或猜测，避免误导性默认值。
- `loadBytes` 存进 ref、effect 只依赖 `probePath`：面板每次渲染都会给新的读字节回调，直接进依赖会导致反复探测。
- 探测失败完全静默：一个坏文件不能拖垮整个转码入口。

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] effect 内不做局部 async 函数，改用 Promise 链**

- **Found during:** Task 2（弹窗探测副作用）
- **Issue:** 计划原文描述用 `await` 顺序读取，但项目代码风格禁止在函数内定义局部函数；effect 里写局部 `async` helper 会违反该规则。
- **Fix:** 用 `Promise.resolve().then(...)` 链完成「读字节 → 探测 → 回写」，语义、取消位与静默失败完全一致。
- **Files modified:** `packages/libs/editor-impl/src/asset/components/TranscodeModal.tsx`
- **Verification:** 弹窗 7 条用例全绿；typecheck 退出 0。
- **Committed in:** `fa20897`（Task 2 提交）

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** 仅实现手法调整，行为与计划一致，无范围蔓延。

## Issues Encountered

- 首版弹窗用例在「探测函数已被调用」后立刻断言输入值，此时 Promise 链还没把状态写回，导致一次时序性失败；改为等待输入值本身变动（并显式 flush 一次微任务）后稳定通过。
- `react-hooks-better-stable/exhaustive-deps` 对 effect 的 `[probePath]` 依赖给出一条 warning（提示 `bitrateState` / `sampleRateState`），这是计划明确要求的依赖写法，且为 warn 级、非 error，未改动。

## User Setup Required

None - 无外部服务配置。

## Verification Evidence

- `pnpm --filter @motajs/editor-impl test -- src/asset/transcode/__tests__/audioProbe.test.ts` — 3 passed
- `pnpm --filter @motajs/editor-impl test -- src/asset/__tests__/transcodeModal.test.tsx` — 7 passed
- `pnpm --filter @motajs/editor-impl test -- src/asset` — 15 files / 144 passed
- `pnpm --filter @motajs/editor-impl test` — 43 files / 341 passed（无回归；原 335 + 新增 6）
- `pnpm --filter @motajs/editor-impl typecheck` — 退出 0
- `node scripts/verify/coreModuleState.js` — 退出 0
- `node scripts/verify/coreEngineNeutral.js` — 退出 0
- `node scripts/verify/coreImportType.js` — 退出 0
- `pnpm exec prettier --check`（本次改动文件）— 全部通过

## Next Phase Readiness

- G-03-5 的两个部分（默认常量 + 真实源参数探测）均已落地，可在真实浏览器里按 UAT #2 验收。
- 转码编排、覆盖确认与撤销屏障未改动。

---

*Phase: 03-asset*
*Completed: 2026-10-19*

## Self-Check: PASSED
