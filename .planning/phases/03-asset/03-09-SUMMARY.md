---
phase: 03-asset
plan: 09
subsystem: editor-impl-asset
tags: [typescript, asset, transcode, webp, offscreen-canvas, jsdom]

# Dependency graph
requires:
  - phase: 03-asset
    provides: "`IAssetTranscodeService` 接口、`AssetTranscodeKind` / `IAssetAudioTranscodeOptions` 与转码默认值（03-03 `asset/transcode/types.ts`）"
provides:
  - "图片转 WebP：canUseImageTranscode / transcodeImageToWebp（asset/transcode/imageWebp.ts）"
  - "可注入的浏览器转码服务：IBrowserAssetTranscodeService / BrowserAssetTranscodeService（asset/transcode/browserTranscodeService.ts）"
  - "`./asset` 导出面新增 ./transcode 桶（含上述符号）"
affects: [03-15, 03-16]

actuals:
  tokens: 1692
  tasks: 3
  commits: 3
plan_head_before: 11f4a06

tech-stack:
  added: []
  patterns:
    - "图片编码只用浏览器原生的 OffscreenCanvas + createImageBitmap + convertToBlob，不碰 document / fetch / 网络"
    - "能力探测放在动作之前：环境缺 API 时先抛可读中文错误，绝不静默产出空字节"
    - "转码能力藏在 IAssetTranscodeService 之后，面板只依赖接口、测试可注入替身；jsdom 下探测与两个动作都给出明确的不可用结果"
    - "编码产物的 blob 类型必须是 image/webp，否则抛错——避免把 PNG 当成 WebP 写回"

key-files:
  created:
    - packages/libs/editor-impl/src/asset/transcode/imageWebp.ts
    - packages/libs/editor-impl/src/asset/transcode/browserTranscodeService.ts
    - packages/libs/editor-impl/src/asset/transcode/__tests__/transcodeService.test.ts
  modified:
    - packages/libs/editor-impl/src/asset/transcode/index.ts
    - packages/libs/editor-impl/src/asset/index.ts

key-decisions:
  - "图片解码 / 编码全程只用 OffscreenCanvas 与 createImageBitmap：`document` 在 editor-impl 是 error 级门禁，这条路径天然绕开（T-03-28）"
  - "`transcodeImageToWebp` 先判 `canUseImageTranscode()` 再碰任何浏览器 API：jsdom 下因此得到可读拒绝而不是 ReferenceError"
  - "质量值先夹到 0–100 再除以 100；非有限值回落到 `ASSET_DEFAULT_WEBP_QUALITY`，避免 NaN 传给编码器"
  - "音频转码本计划只留下明确不可用：`canTranscode(AudioOpus)` 返回 false、`audioToWebmOpus` 抛「当前环境不支持音频转码」，等 03-15 接入 mediabunny 后替换"
  - "`audioToWebmOpus` 实现不写未使用参数（项目规则要求未使用后置参数直接省略）；测试以 `IAssetTranscodeService` 类型持有服务，按接口签名调用"

patterns-established:
  - "浏览器专有能力先探测后使用：探测函数纯同步、可单测；真实编码路径留给 dev host / Playwright 验收"
  - "桶文件一律 `export *`，`asset/index.ts` 只在实现落地后再追加 transcode 导出（03-03 刻意留空）"

requirements-completed: [ASSET-01]

coverage:
  - id: D1
    description: "图片转码能力探测（OffscreenCanvas + createImageBitmap 同时存在才为 true）与不支持时的可读拒绝"
    requirement: "ASSET-01"
    verification:
      - kind: unit
        ref: "packages/libs/editor-impl/src/asset/transcode/__tests__/transcodeService.test.ts（canUseImageTranscode 返回 false；transcodeImageToWebp rejects '不支持图片转码'）"
        status: pass
      - kind: other
        ref: "结构检查（两个导出函数 + OffscreenCanvas / createImageBitmap / convertToBlob / image/webp + 无 document / fetch( / Image + 有 throw new Error）+ pnpm --filter @motajs/editor-impl typecheck（退出码 0）"
        status: pass
    human_judgment: false
  - id: D2
    description: "可注入的转码服务骨架：BrowserAssetTranscodeService 实现 IAssetTranscodeService，图片转发、音频明确不可用、桶与 ./asset 导出到位"
    requirement: "ASSET-01"
    verification:
      - kind: unit
        ref: "transcodeService.test.ts（canTranscode 图片 / 音频均为 false；audioToWebmOpus rejects '不支持音频转码'）"
        status: pass
      - kind: other
        ref: "结构检查（interface extends + class implements + 三个方法 + 三个桶项）+ pnpm --filter @motajs/editor-impl typecheck（退出码 0）"
        status: pass
    human_judgment: false
  - id: D3
    description: "真实浏览器里的图片 → WebP 编码路径（createImageBitmap 解码、OffscreenCanvas.convertToBlob 编码、产物类型校验）"
    requirement: "ASSET-01"
    verification:
      - kind: other
        ref: "结构检查（OffscreenCanvas / createImageBitmap / convertToBlob / image/webp 均出现且无 document / fetch( / Image）"
        status: pass
    human_judgment: true
    rationale: "jsdom 26 没有 OffscreenCanvas / createImageBitmap，真实编码只能在 Chromium dev host 或 Playwright 里验收；本计划只保证探测与失败路径自动化通过"

duration: 10min
completed: 2026-10-18
status: complete
---

# Phase 3 Plan 09: 图片转 WebP 与转码服务骨架 Summary

**用浏览器自带的 OffscreenCanvas 把图片转成 WebP（不引入新依赖、不碰 document），同时把转码能力收进可注入的服务接口——音频路径先明确不可用，等 03-15 换真实实现。**

## Performance

- **Duration:** 约 10 min
- **Started:** 2026-10-18T00:09:00Z
- **Completed:** 2026-10-18T00:20:00Z
- **Tasks:** 3
- **Files modified:** 5（3 新建，2 修改）

## Accomplishments

- `asset/transcode/imageWebp.ts`：`canUseImageTranscode()` 同步判断 `OffscreenCanvas` 与 `createImageBitmap` 是否同时存在；`transcodeImageToWebp(bytes, quality)` 先探测再解码（`createImageBitmap`）、画到 `OffscreenCanvas`（`imageSmoothingEnabled = false`、画完立即 `bitmap.close()`）、用 `convertToBlob({ type: 'image/webp', quality })` 编码；拿不到 2D 上下文或产物类型不是 `image/webp` 都抛错，绝不返回空字节。质量值夹到 0–100 后除以 100，非法值回落默认质量。
- `asset/transcode/browserTranscodeService.ts`：`IBrowserAssetTranscodeService extends IAssetTranscodeService`，`BrowserAssetTranscodeService implements` 它；`canTranscode` 对图片转发探测、对音频明确 `false`；`imageToWebp` 转发实现；`audioToWebmOpus` 抛「当前环境不支持音频转码」（03-15 替换）。
- `asset/transcode/index.ts` 追加 imageWebp / browserTranscodeService 导出，`asset/index.ts` 追加 `export * from './transcode'`——`./asset` 现在能导出转码能力。
- `asset/transcode/__tests__/transcodeService.test.ts` 5 条用例全绿：jsdom 下探测为 `false`、图片转码以中文错误拒绝、服务对图片 / 音频的探测均为 `false`、音频动作以中文错误拒绝；全程走「先探测再拒绝」，没有 `ReferenceError`。

## Task Commits

Each task was committed atomically:

1. **Task 1: 图片转 WebP 与能力探测** - `7c58137` (feat)
2. **Task 2: 可注入的转码服务与桶导出** - `6a45c81` (feat)
3. **Task 3: jsdom 安全的能力探测用例** - `fb8a8a8` (test)

**Plan metadata:** (本 SUMMARY 提交) (docs)

_Note: 无 TDD 循环；三条任务各自一次提交，无后续修补提交。_

## Files Created/Modified

- `packages/libs/editor-impl/src/asset/transcode/imageWebp.ts` - 新：图片转 WebP 实现与能力探测
- `packages/libs/editor-impl/src/asset/transcode/browserTranscodeService.ts` - 新：`IBrowserAssetTranscodeService` / `BrowserAssetTranscodeService`
- `packages/libs/editor-impl/src/asset/transcode/index.ts` - 改：追加 imageWebp / browserTranscodeService 两个 `export *`
- `packages/libs/editor-impl/src/asset/index.ts` - 改：追加 `export * from './transcode'`
- `packages/libs/editor-impl/src/asset/transcode/__tests__/transcodeService.test.ts` - 新：5 条 jsdom 能力探测用例

## Decisions Made

- **只用浏览器原生编码器。** `OffscreenCanvas.convertToBlob({ type: 'image/webp' })` 不需要额外依赖，也天然避开 `document` 这条 error 级门禁；解码用 `createImageBitmap`，同样不需要 DOM 节点。
- **探测先于动作。** `transcodeImageToWebp` 第一行就调 `canUseImageTranscode()`，因此 jsdom 里得到的是可读中文错误，而不是 `ReferenceError`；UI 侧（03-16）也能据此禁用入口。
- **类型断言改用产物校验。** 不假设浏览器一定支持 WebP 编码：`convertToBlob` 返回的 `blob.type` 必须是 `image/webp`，否则抛「当前环境不支持 WebP 编码」（威胁 T-03-27 的缓解）。
- **音频留白但可读。** 能力探测返回 `false`、动作直接抛错，不留空实现、也不假装成功；真实实现与 `mediabunny` 依赖一起留给 03-15。
- **未使用参数直接省略。** 按项目规则，`audioToWebmOpus` 实现不声明未使用参数；测试用 `IAssetTranscodeService` 类型持有服务，按接口签名调用，从而既符合接口契约又不产生 lint 警告。

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `imageWebp.ts` 的文件级注释里出现了门禁禁止的词**
- **Found during:** Task 1（结构检查）
- **Issue:** 计划给的检查脚本对整份源码做子串匹配，注释里写的「不碰被门禁禁止的 document」命中了 `document` 子串，结构检查判为使用了禁用 API。
- **Fix:** 注释改为「不碰 DOM 与网络」，实现本身未改动。
- **Files modified:** `packages/libs/editor-impl/src/asset/transcode/imageWebp.ts`
- **Verification:** 结构检查输出 `structural check OK`；`coreModuleState.js` 退出码 0。
- **Committed in:** `7c58137`（Task 1 提交）

**2. [Rule 1 - Bug] 测试文件把接口从错误的相对路径导入**
- **Found during:** Task 3（typecheck）
- **Issue:** 测试位于 `asset/transcode/__tests__/`，`'../types'` 指向 `transcode/types.ts`；`IAssetTranscodeService` 实际在 `asset/types.ts`，typecheck 报 `TS2305`。
- **Fix:** `IAssetTranscodeService` 改为从 `'../../types'` 导入，`AssetTranscodeKind` 仍从 `'../types'` 导入。
- **Files modified:** `packages/libs/editor-impl/src/asset/transcode/__tests__/transcodeService.test.ts`
- **Verification:** `pnpm --filter @motajs/editor-impl typecheck` 退出码 0；5 条用例全绿。
- **Committed in:** `fb8a8a8`（Task 3 提交）

---

**Total deviations:** 2 auto-fixed（2 × Rule 1）
**Impact on plan:** 两处都只改注释文案与导入路径，不改任何对外签名、行为或数据结构；命名与 `INTERFACE-NAME.md` §03-09 完全一致，无范围蔓延。

## Issues Encountered

- **ESLint 对空接口给出 1 条 warning。** `IBrowserAssetTranscodeService extends IAssetTranscodeService {}` 触发 `@typescript-eslint/no-empty-object-type`（warning，不是 error；`pnpm lint` 仍退出 0）。接口形状是计划指定的，且新增成员需要先确认命名，故保留现状。

## User Setup Required

None - 本计划只用浏览器标准 API，无外部服务、环境变量或依赖安装（`mediabunny` 属 03-15）。

## Known Stubs

- `BrowserAssetTranscodeService.audioToWebmOpus` 当前直接抛「当前环境不支持音频转码」，`canTranscode(AudioOpus)` 恒为 `false`。这是计划内的有意占位：真实实现随 `mediabunny` 依赖在 03-15 接入，界面（03-16）在此之前会据此禁用音频转码入口。

## Threat Flags

None - 未新增网络端点、鉴权路径或文件访问。威胁登记表 T-03-26（解码失败直接抛错、不重试放大）/ T-03-27（产物类型必须是 `image/webp`）/ T-03-28（只用 `OffscreenCanvas`，结构检查禁止 `document` / `fetch(` / `Image`，`coreModuleState.js` 兜底）均已落地。

## Next Phase Readiness

- 03-15 可在 `BrowserAssetTranscodeService.audioToWebmOpus` 处接入 `mediabunny` 的 `Conversion`，并把 `canTranscode(AudioOpus)` 换成 `canEncode('opus')`；接口与桶导出无需再改。
- 03-16 的转码弹窗可直接依赖 `IAssetTranscodeService`：先 `canTranscode` 决定入口可用性，再 `imageToWebp` 转发；测试可注入假实现。
- 真实 WebP 编码路径需在 Chromium dev host / Playwright 中手动验收（jsdom 无 canvas 能力）。
- 无阻塞。

---

## Self-Check: PASSED

- FOUND: packages/libs/editor-impl/src/asset/transcode/imageWebp.ts
- FOUND: packages/libs/editor-impl/src/asset/transcode/browserTranscodeService.ts
- FOUND: packages/libs/editor-impl/src/asset/transcode/index.ts
- FOUND: packages/libs/editor-impl/src/asset/index.ts
- FOUND: packages/libs/editor-impl/src/asset/transcode/__tests__/transcodeService.test.ts
- FOUND commit: 7c58137 (Task 1)
- FOUND commit: 6a45c81 (Task 2)
- FOUND commit: fb8a8a8 (Task 3)

*Phase: 03-asset*
*Completed: 2026-10-18*
