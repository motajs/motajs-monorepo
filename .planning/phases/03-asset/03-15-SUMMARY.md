---
phase: 03-asset
plan: 15
subsystem: editor-impl-asset
tags: [typescript, asset, transcode, opus, webm, mediabunny, webcodecs, jsdom]

# Dependency graph
requires:
  - phase: 03-asset
    provides: "`IAssetTranscodeService` 接口、`AssetTranscodeKind` / `IAssetAudioTranscodeOptions` 与转码默认值（03-03 `asset/transcode/types.ts`）"
  - phase: 03-asset
    provides: "可注入的浏览器转码服务骨架与图片转 WebP（03-09 `asset/transcode/browserTranscodeService.ts` / `imageWebp.ts`）"
provides:
  - "音频 → WebM/Opus：canUseAudioTranscode / transcodeAudioToWebmOpus（asset/transcode/audioOpus.ts）"
  - "`BrowserAssetTranscodeService` 的音频分支改为真实探测与委托（不再恒 false / 占位抛错）"
  - "新运行时依赖 `mediabunny@1.61.6` 进 catalog，`@motajs/editor-impl` 依赖 `catalog:default`"
affects: [03-16]

# Actuals (#2632) — same estimateTokens scale (chars/4 over the realized diff), never a harness token count.
actuals:
  tokens: 1816
  tasks: 3
  commits: 2
plan_head_before: e7385851225b99eee2d8e836a4c6ffae38c078ba

# Tech tracking
tech-stack:
  added:
    - "mediabunny@1.61.6（MPL-2.0，纯浏览器 / 基于 WebCodecs 的媒体工具箱，仅 @motajs/editor-impl 依赖）"
  patterns:
    - "音频转码经 Mediabunny 公共 API 解码 / 编码 / 封装，全程本地、不发网络请求"
    - "能力探测先于动作：入口先 `canUseAudioTranscode()`（内部 `canEncode('opus')`，异常回落 false），jsdom 下得到可读拒绝而非崩溃"
    - "两条失败路径都有中文错误：环境不支持 / 配置无效 / 产出为空，绝不静默返回空字节（T-03-48）"

key-files:
  created:
    - packages/libs/editor-impl/src/asset/transcode/audioOpus.ts
    - packages/libs/editor-impl/src/asset/transcode/__tests__/audioOpus.test.ts
  modified:
    - packages/libs/editor-impl/src/asset/transcode/browserTranscodeService.ts
    - packages/libs/editor-impl/src/asset/transcode/index.ts
    - packages/libs/editor-impl/package.json
    - pnpm-workspace.yaml
    - pnpm-lock.yaml

key-decisions:
  - "用户已以文字『批准安装』确认引入 `mediabunny@1.61.6`（MPL-2.0，仓库 github.com/Vanilagy/mediabunny，无 postinstall）——阻塞式安装确认门（T-03-46）已通过，本计划据此继续 Task 2 / Task 3"
  - "能力探测用 Mediabunny 的 `canEncode('opus')`，并以 try/catch 包裹、异常回落 `false`：环境缺 WebCodecs 时得到明确的『不可用』而不是 ReferenceError"
  - "`Conversion.init` 是异步的，实现里 `await` 它；音频参数用 `new Quality({ bitrate: options.bitrate })` 与 `sampleRate`（与 03-RESEARCH §Code Examples 一致）"
  - "不为空结果买保险：`conversion.isValid` 为 false 或输出缓冲为空（null / 零长度）都抛中文错误，绝不返回 `new Uint8Array(0)`（T-03-47 / T-03-48）"
  - "转码服务只做委托：`canTranscode(AudioOpus)` 转发 `canUseAudioTranscode()`，`audioToWebmOpus` 转发 `transcodeAudioToWebmOpus`；面板仍只依赖 `IAssetTranscodeService`"
  - "`index.ts` 把 `export * from './audioOpus'` 放在 imageWebp 之后、服务导出之前，与既有『实现在前、服务在后』的分组一致（计划只要求『追加』，位置为等价选择）"
  - "catalog 依赖值按 ABC 序落位（mediabunny 在 lodash-es 与 memfs 之间）；`pnpm install --frozen-lockfile` 退出码 0，锁文件只新增 mediabunny 与其 `@types/dom-*` 传递依赖"

patterns-established:
  - "需要浏览器专有能力的实现，统一『先探测、再动作、失败给中文可读错误』；探测函数可在 jsdom 下自动化验证，真实编码路径留给 dev host / Playwright"
  - "新第三方依赖一律经 catalog 固定版本，安装走本地代理并核对锁文件 diff"

requirements-completed: [ASSET-01]

# Coverage metadata (#1602)
coverage:
  - id: D1
    description: "音频转码能力探测：canUseAudioTranscode 经 canEncode('opus') 判断，jsdom 下返回 false；转码动作在探测失败时以可读中文错误拒绝"
    requirement: "ASSET-01"
    verification:
      - kind: unit
        ref: "packages/libs/editor-impl/src/asset/transcode/__tests__/audioOpus.test.ts（canUseAudioTranscode 返回 false；transcodeAudioToWebmOpus rejects '不支持音频转码'）"
        status: pass
      - kind: other
        ref: "结构检查（canUseAudioTranscode / transcodeAudioToWebmOpus / canEncode / WebMOutputFormat / BufferTarget / await Conversion.init / new Quality({ bitrate: options.bitrate }) / 无法转码 均在且无 document）+ pnpm --filter @motajs/editor-impl typecheck（退出码 0）"
        status: pass
    human_judgment: false
  - id: D2
    description: "音频转码接进 IAssetTranscodeService：BrowserAssetTranscodeService 的 AudioOpus 探测与动作改为真实探测 / 委托，转码桶新增 audioOpus 导出"
    requirement: "ASSET-01"
    verification:
      - kind: unit
        ref: "audioOpus.test.ts（BrowserAssetTranscodeService().canTranscode(AudioOpus) 在 jsdom 下为 false）+ transcodeService.test.ts 既有 5 条用例"
        status: pass
      - kind: other
        ref: "结构检查（服务含 canUseAudioTranscode 与 transcodeAudioToWebmOpus；transcode/index.ts 含 './audioOpus'）+ pnpm --filter @motajs/editor-impl test -- src/asset/transcode（8 条全绿）"
        status: pass
    human_judgment: false
  - id: D3
    description: "真实浏览器里的音频 → WebM/Opus 编码路径（Mediabunny 解码 / 重采样 / Opus 编码 / WebM 封装，产物可播放且体积下降）"
    requirement: "ASSET-01"
    verification:
      - kind: manual_procedural
        ref: "在 Chromium dev host 打开素材管理器 → 瘦身转码 → 选一段音频 → 转换 → 验证产物可播放且缩小（jsdom 无 WebCodecs，只能手动验收）"
        status: unknown
    human_judgment: true
    rationale: "jsdom 26 没有 WebCodecs（AudioEncoder），真实的 Opus 编码 / 封装只能在 Chromium dev host 或 Playwright 里验收；本计划只保证能力探测、委托与失败路径自动化通过"

duration: 10min
completed: 2026-10-18
status: complete
---

# Phase 3 Plan 15: 音频 → WebM/Opus（Mediabunny） Summary

**引入 `mediabunny@1.61.6` 并经用户确认后，把音频转码成 WebM 容器里的 Opus；能力探测走 `canEncode('opus')`，环境不支持时给可读错误、绝不静默产出空字节。**

## Performance

- **Duration:** 约 10 min（其中 `pnpm install` 约 2m42s）
- **Started:** 2026-10-18T13:13:21Z
- **Completed:** 2026-10-18T13:23:44Z
- **Tasks:** 3（Task 1 为已解除的人工确认门）
- **Files modified:** 7（2 新建，5 修改）

## Accomplishments

- **Task 1（已由用户确认，未停）：** 用户以文字「批准安装」确认引入 `mediabunny@1.61.6`——MPL-2.0、仓库 `github.com/Vanilagy/mediabunny`、无 `postinstall`。安全检查门 T-03-46 通过，本计划据此进入 Task 2。
- **Task 2：** catalog 加 `mediabunny: 1.61.6`、`@motajs/editor-impl` 依赖 `"mediabunny": "catalog:default"`；经本地代理 `pnpm install`，锁文件只新增 mediabunny 与 `@types/dom-mediacapture-transform` / `@types/dom-webcodecs`。新建 `asset/transcode/audioOpus.ts`：`canUseAudioTranscode()` 用 `canEncode('opus')`（异常回落 false）；`transcodeAudioToWebmOpus()` 用 Mediabunny `Input` / `Output` / `Conversion` 转码，`await Conversion.init(...)`、`conversion.isValid` 为 false 抛「无法转码：环境不支持 Opus」、产出为空抛错，绝不返回空字节。
- **Task 3：** `BrowserAssetTranscodeService.canTranscode(AudioOpus)` 改为 `canUseAudioTranscode()`、`audioToWebmOpus` 委托 `transcodeAudioToWebmOpus`；`transcode/index.ts` 新增 `export * from './audioOpus'`；新增 `audioOpus.test.ts` 三条 jsdom 用例。`src/asset/transcode` 共 8 条测试全绿（03-09 的 5 条 + 新增 3 条）。

## Task Commits

Each task was committed atomically:

1. **Task 2: 加依赖并实现音频转码** - `9a970cb` (feat)
2. **Task 3: 接进转码服务并补能力探测测试** - `c2bf543` (test)

**Plan metadata:** (本 SUMMARY 提交) (docs)

_Note: Task 1 是人工确认门（checkpoint:human-verify），已由用户批准，无独立代码提交；无 TDD 循环。_

## Files Created/Modified

- `packages/libs/editor-impl/src/asset/transcode/audioOpus.ts` - 新：`canUseAudioTranscode` / `transcodeAudioToWebmOpus`
- `packages/libs/editor-impl/src/asset/transcode/__tests__/audioOpus.test.ts` - 新：3 条 jsdom 能力探测用例
- `packages/libs/editor-impl/src/asset/transcode/browserTranscodeService.ts` - 改：音频分支改为真实探测与委托
- `packages/libs/editor-impl/src/asset/transcode/index.ts` - 改：桶追加 `./audioOpus`
- `packages/libs/editor-impl/package.json` - 改：依赖加 `mediabunny: catalog:default`
- `pnpm-workspace.yaml` - 改：catalog 加 `mediabunny: 1.61.6`
- `pnpm-lock.yaml` - 改：新增 mediabunny 及其传递类型依赖

## Decisions Made

- **安装确认门通过。** 用户在 Task 1 明确以文字「批准安装」同意引入 `mediabunny@1.61.6`：核对结论为 MPL-2.0、仓库指向 `github.com/Vanilagy/mediabunny`、无安装脚本。因此本计划继续执行 Task 2 / Task 3（不停止等待 checkpoint）。
- **能力探测包在 try/catch 里。** `canUseAudioTranscode()` = `await canEncode('opus')`，异常回落 `false`；jsdom 里因此稳定得到 `false`，UI（03-16）可据此禁用入口。
- **`Conversion.init` 必须 `await`。** 它是 `Promise<Conversion>`；音频参数用 `codec: 'opus'` + `new Quality({ bitrate })` + `sampleRate`，与 RESEARCH §Code Examples 一致。
- **空产物即错误。** `conversion.isValid` 为 false 抛「无法转码：环境不支持 Opus」；输出缓冲为 null 或零长度抛「无法转码：转码未产出数据」，不返回 `new Uint8Array(0)`（T-03-48）。
- **服务只做转发。** 面板仍只依赖 `IAssetTranscodeService`；`BrowserAssetTranscodeService` 对音频的两个方法分别转发探测与转码。
- **桶导出位置。** `export * from './audioOpus'` 置于 imageWebp 之后、服务导出之前，保持『实现在前、服务在后』的分组（计划仅要求『追加』）。

## Deviations from Plan

None - plan executed exactly as written. Task 1 是计划内的人工确认门，已由用户批准；Task 2 / Task 3 的接口、命名（`canUseAudioTranscode` / `transcodeAudioToWebmOpus`，见 `INTERFACE-NAME.md` §03-15）与错误文案均按计划落地。

## Issues Encountered

- **`@typescript-eslint/no-empty-object-type` 对空接口的 1 条 warning。** `IBrowserAssetTranscodeService extends IAssetTranscodeService {}` 仍给出 1 条 warning（非 error，`eslint` 退出码 0）。接口形状是 03-09 计划指定的，且新增成员需先确认命名，故保留现状（与 03-09 的说明一致）。

## User Setup Required

None - 依赖已通过代理安装并固定进 catalog；无外部服务或环境变量。

## Known Stubs

None - 03-09 遗留的音频占位（`audioToWebmOpus` 恒抛错、`canTranscode(AudioOpus)` 恒 false）已在本计划替换为真实的 Mediabunny 探测与转码。

## Threat Flags

None - 未新增网络端点、鉴权路径或文件访问。威胁登记表 T-03-46（阻塞式人工确认后安装、版本在 catalog 定死）/ T-03-47（`isValid` false 直接失败、不重试）/ T-03-48（空缓冲抛错、绝不返回空字节）/ T-03-49（Mediabunny 纯本地执行、不发请求）均已落地。

## Next Phase Readiness

- 03-16 的转码弹窗可直接依赖 `IAssetTranscodeService`：先 `canTranscode(AudioOpus)` 决定入口可用性，再 `audioToWebmOpus` 转发；测试可注入假实现。
- 真实音频编码路径需在 Chromium dev host / Playwright 中手动验收（jsdom 无 WebCodecs）。
- 无阻塞。

---

## Self-Check: PASSED

- FOUND: packages/libs/editor-impl/src/asset/transcode/audioOpus.ts
- FOUND: packages/libs/editor-impl/src/asset/transcode/__tests__/audioOpus.test.ts
- FOUND: packages/libs/editor-impl/src/asset/transcode/browserTranscodeService.ts
- FOUND: packages/libs/editor-impl/src/asset/transcode/index.ts
- FOUND: pnpm-workspace.yaml (catalog mediabunny 1.61.6)
- FOUND: packages/libs/editor-impl/package.json (mediabunny catalog:default)
- FOUND commit: 9a970cb (Task 2)
- FOUND commit: c2bf543 (Task 3)

*Phase: 03-asset*
*Completed: 2026-10-18*
