---
phase: 03-asset
plan: 16
subsystem: editor-impl-asset
tags: [typescript, react, antd, asset, transcode, webp, webm, orchestration, undo-barrier, integration-test]

# Dependency graph
requires:
  - phase: 03-asset
    provides: "可注入的浏览器转码服务与图片转 WebP（03-09 `asset/transcode/browserTranscodeService.ts` / `imageWebp.ts`）"
  - phase: 03-asset
    provides: "音频 → WebM/Opus 探测与委托（03-15 `asset/transcode/audioOpus.ts`）"
  - phase: 03-asset
    provides: "字节动作的「立即写字节 + 登记屏障」约定与 `AssetPanel.registerBarrier`（03-13）"
provides:
  - "`ASSET_WEBP_EXTENSION = '.webp'` / `ASSET_WEBM_EXTENSION = '.webm'`（asset/transcode/types.ts）"
  - "`AssetPanel.openTranscode` / `AssetPanel.closeTranscode` / `AssetPanel.transcodeAssets`（批量转码编排：覆盖或改名保留、逐项失败隔离、汇总、屏障）"
  - "面板视图状态 `transcodeOpen` / `transcoding` / `transcodeSummary`"
  - "`TranscodeModal`（批量选择 + 全选 / 全不选、分类参数、覆盖默认勾选、破坏性二次确认、进度）"
  - "`asset/__tests__/transcode.uat.test.tsx`（7 条编排集成用例，假转码服务驱动）"
affects: [03-17]

# Actuals (#2632) — same estimateTokens scale (chars/4 over the realized diff), never a harness token count.
actuals:
  tokens: 6737
  tasks: 3
  commits: 3
plan_head_before: dfb1680eda1eb6ac78037d88a2b6ad1ba3927820

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "批量字节动作逐项串行（`await` 每项），单项异常各自捕获成一条结果，绝不中断整批（T-03-52 的天然限流）"
    - "「覆盖」与「保留」两条写回分支：覆盖 = 写新文件 + 删旧文件；保留 = 旧文件改名 `{file}-origin.{ext}` + 写新文件；都不登记 origin 文件进列表"
    - "转码改扩展名并同步改内存列表条目名（`renameAssetListEntry` 顺带改 `ObjectList` 的来源字段），列表仍走手动 `save()` 落盘"
    - "「目标已存在」用分类目录的文件路径集合判定（一次性 `listDirectory` + 逐项就地更新），命中即该项失败且不改写任何字节"
    - "每项成功后 `registerBarrier({ action: 'transcode', path })`——转码改字节 = 不可撤销，撤销碰到屏障返回 false"
    - "面板构造可注入 `IAssetTranscodeService`（默认 `BrowserAssetTranscodeService`），编排测试用假实现驱动、不碰真实 WebCodecs"

key-files:
  created:
    - packages/libs/editor-impl/src/asset/components/TranscodeModal.tsx
    - packages/libs/editor-impl/src/asset/__tests__/transcode.uat.test.tsx
  modified:
    - packages/libs/editor-impl/src/asset/transcode/types.ts
    - packages/libs/editor-impl/src/asset/types.ts
    - packages/libs/editor-impl/src/asset/assetPanel.ts
    - packages/libs/editor-impl/src/asset/components/AssetPanelView.tsx
    - packages/libs/editor-impl/src/asset/components/index.ts
    - packages/libs/editor-impl/src/asset/__tests__/assetView.test.tsx

key-decisions:
  - "`transcodeAssets` 在空选择时立即返回：不置 `transcoding`、不写任何文件、不登记屏障（用例 ⑦ 断言 `undo()` 为 false 且文件无变化）"
  - "「目标已存在」用目录路径集合判定而非 `requestResource`——资源系统对任意路径都返回句柄（从不返回 null），只有真正读字节才会抛错；一次性列目录既准确又不读大文件"
  - "覆盖分支先写新文件再删旧文件；保留分支先把旧文件移到 `{file}-origin.{ext}` 再写新文件——两者都保证「新文件已落盘」后旧字节才消失"
  - "仅当有成功项时才把分类标记为未保存（`unsaved`）——整批全失败时不制造假的「有改动待保存」"
  - "转码完成后 `transcodeOpen = false` 关闭弹窗，但 `transcodeSummary` 保留在界面上，用 antd `Alert` 呈现失败明细（`asset-transcode-summary`）"
  - "面板视图新增 `asset-notice` 渲染 `state.message`——否则「转码完成，共 N 个」只写进状态、用户看不到（见偏离 3）"

patterns-established:
  - "编排逻辑与真实编码解耦：面板只依赖 `IAssetTranscodeService`，构造可注入替身，测试断言编排结果（文件 / 列表 / 汇总 / 屏障）而非编码产物"
  - "破坏性动作（覆盖）走受控 antd `Modal` 二次确认（`danger` 按钮），文案逐字取 UI-SPEC，绝不用 `window.confirm`"

requirements-completed: [ASSET-01]

# Coverage metadata (#1602)
coverage:
  - id: D1
    description: "批量转码编排：逐项读字节 → 转码 → 覆盖或改名保留 → 改列表条目名 → 登记屏障；空选择直接返回；覆盖与保留两条分支都落地"
    requirement: "ASSET-01"
    verification:
      - kind: integration
        ref: "packages/libs/editor-impl/src/asset/__tests__/transcode.uat.test.tsx（① 不覆盖保留 origin + 改名 + unsaved；② 覆盖不留 origin；⑦ 空选择不写文件不登记屏障）"
        status: pass
      - kind: other
        ref: "结构检查（transcode/types.ts 含 ASSET_WEBP_EXTENSION / ASSET_WEBM_EXTENSION；assetPanel.ts 含 openTranscode / closeTranscode / transcodeAssets / transcodeService / resolveTranscodedPath / resolveOriginPath / renameAssetListEntry / 转码完成，共 / 转码失败： / 目标文件已存在；types.ts 含 transcodeOpen / transcoding / transcodeSummary）+ pnpm --filter @motajs/editor-impl typecheck（退出码 0）"
        status: pass
    human_judgment: false
  - id: D2
    description: "转码弹窗与工具栏接线：批量选择（全选 / 全不选）、按分类参数（WebP 质量；音频码率 / 采样率）、覆盖默认勾选、破坏性二次确认、进度与禁用态；面板挂载弹窗并呈现汇总"
    requirement: "ASSET-01"
    verification:
      - kind: other
        ref: "结构检查（TranscodeModal 含 WebP 质量 / 码率 / 采样率 / 覆盖旧文件 / 开始转换 / 原文件将被替换，无法找回。/ 覆盖旧文件？/ asset-transcode-start / asset-transcode-cover / asset-transcode-confirm / asset-transcode-select-all / asset-transcode-select-none / 全选 / 全不选 / asset-transcode-item-；AssetPanelView 含 TranscodeModal / transcodeOpen / asset-transcode-summary；components/index.ts 导出 ./TranscodeModal）+ pnpm --filter @motajs/editor-impl typecheck（退出码 0）"
        status: pass
      - kind: integration
        ref: "pnpm --filter @motajs/editor-impl test -- src/asset（11 files / 105 tests 通过，含 assetView.test.tsx 11 条对工具栏 / 详情的渲染断言）"
        status: pass
    human_judgment: false
  - id: D3
    description: "转码编排集成测试：7 条用例钉住覆盖 / 保留 / 目标已存在 / 单项失败隔离 / 撤销屏障 / 成功文案 / 空选择"
    requirement: "ASSET-01"
    verification:
      - kind: integration
        ref: "pnpm --filter @motajs/editor-impl test -- src/asset/__tests__/transcode.uat.test.tsx（7/7）；pnpm --filter @motajs/editor-impl test -- src/asset（11 files / 105 tests）；pnpm --filter @motajs/editor-impl test（37 files / 296 tests，基线 289 → 无回归）"
        status: pass
      - kind: other
        ref: "node scripts/verify/coreBoundaries.js / coreModuleState.js / coreEngineNeutral.js（均退出码 0）"
        status: pass
    human_judgment: false
  - id: D4
    description: "真实浏览器里的图片 → WebP、音频 → WebM/Opus 编码路径（产物可播放且体积下降；不支持 WebCodecs 的浏览器入口禁用）"
    requirement: "ASSET-01"
    verification:
      - kind: manual_procedural
        ref: "在 Chromium dev host 打开素材管理器 → 瘦身转码 → 选图片转 WebP / 选音频转 WebM/Opus → 验证产物可播放、体积变小（jsdom 无 WebCodecs，只能手动验收）"
        status: unknown
    human_judgment: true
    rationale: "jsdom 26 没有 WebCodecs / OffscreenCanvas，真实编码只能在 Chromium dev host 或 Playwright 里验收；本计划只保证批量编排、覆盖 / 保留、失败隔离、汇总与屏障自动化通过"

duration: ~14min
completed: 2026-10-18
status: complete
---

# Phase 3 Plan 16: 转码弹窗与批量编排 Summary

**把「瘦身转码」做成可用的批量动作：选素材（全选 / 全不选）、按分类调参数、「覆盖旧文件」默认勾选且覆盖前二次确认；逐项转换、覆盖或把旧文件改名 `{file}-origin.{ext}` 保留、列表文件名同步改扩展名，每项成功后登记不可撤销屏障，结束汇总「转码完成，共 N 个」/「转码失败：{原因}」。**

## Performance

- **Duration:** 约 14 min
- **Started:** 2026-10-18T09:30:33Z
- **Completed:** 2026-10-18T09:44:57Z
- **Tasks:** 3
- **Files modified:** 8（2 新建，6 修改）

## Accomplishments

- **Task 1：** `transcode/types.ts` 追加 `ASSET_WEBP_EXTENSION = '.webp'` 与 `ASSET_WEBM_EXTENSION = '.webm'`；`asset/types.ts` 给 `IAssetPanelViewState` 追加 `transcodeOpen` / `transcoding` / `transcodeSummary?`；`assetPanel.ts` 构造新增第三参 `transcodeService: IAssetTranscodeService = new BrowserAssetTranscodeService()`，并新增 `openTranscode()`（仅图片 / 音频分类）、`closeTranscode()`、`transcodeAssets(names, options)` 与私有 `transcodeEntry`。批量编排逐项：取条目 → `requestResource` / `requestBinary`（失败记「无法读取文件」）→ `imageToWebp` / `audioToWebmOpus` → 目标路径 `resolveTranscodedPath(...)`；目标 ≠ 原路径且已在目录集合中 → 记「目标文件已存在」；覆盖 → 写新文件 + 删旧文件，保留 → 旧文件 `moveResource` 到 `resolveOriginPath` + 写新文件；成功后用 `renameAssetListEntry` 改内存条目名并替换、`registerBarrier({ action: 'transcode', path })`。结束时标记未保存、关弹窗、发布汇总与文案。
- **Task 2：** 新建 `asset/components/TranscodeModal.tsx`（批量多选 + 全选 / 全不选、分类参数区、`覆盖旧文件` 默认勾选、点开始若勾覆盖先弹破坏性二次确认、`busy` 时 `Spin` 并禁用开始、空选择禁用开始）；`AssetPanelView` 在 `transcodeOpen` 时挂出弹窗、用 antd `Alert` 呈现汇总（`asset-transcode-summary`）、并渲染 `asset-notice` 呈现操作结果文案；`components/index.ts` 追加桶导出；`assetPanel.ts` 容器接线 `onTranscode` / `onCancelTranscode` / `onStartTranscode`。
- **Task 3：** 新建 `asset/__tests__/transcode.uat.test.tsx`，用假 `IAssetTranscodeService`（`canTranscode` 恒 true；两个动作返回带固定标记的字节；`failFirstByte` 命中即抛「假转码失败」）注入面板，覆盖 7 条用例（每条前 `//` 注释）：① 不覆盖保留 origin + 列表改名 + unsaved；② 覆盖不留 origin；③ 目标已存在失败且不改写；④ 单项失败不中断整批；⑤ 转码后 `undo()` 为 false；⑥ 全部成功提示「转码完成，共 2 个」；⑦ 空选择不写文件不登记屏障。

## Task Commits

Each task was committed atomically:

1. **Task 1: 视图状态、扩展名常量与批量编排** - `0904d2c` (feat)
2. **Task 2: 转码弹窗与工具栏接线** - `03a35e8` (feat)
3. **Task 3: 编排集成测试（假转码服务）** - `dbe8a7b` (test)

**Plan metadata:** （本 SUMMARY 提交）(docs)

_Note: 无 TDD 循环；三条任务各自一次提交，无后续修补提交。_

## Files Created/Modified

- `packages/libs/editor-impl/src/asset/transcode/types.ts` - 改：追加 `ASSET_WEBP_EXTENSION` / `ASSET_WEBM_EXTENSION`
- `packages/libs/editor-impl/src/asset/types.ts` - 改：`IAssetPanelViewState` 追加 `transcodeOpen` / `transcoding` / `transcodeSummary?`
- `packages/libs/editor-impl/src/asset/assetPanel.ts` - 改：可注入转码服务、`openTranscode` / `closeTranscode` / `transcodeAssets` / 私有 `transcodeEntry`、`publish` 带转码字段、容器接线
- `packages/libs/editor-impl/src/asset/components/TranscodeModal.tsx` - 新：转码弹窗（批量选择 / 参数 / 覆盖勾选 / 二次确认 / 进度）
- `packages/libs/editor-impl/src/asset/components/AssetPanelView.tsx` - 改：挂载 `TranscodeModal`、渲染 `asset-notice` 与 `asset-transcode-summary`
- `packages/libs/editor-impl/src/asset/components/index.ts` - 改：追加 `TranscodeModal` 桶导出
- `packages/libs/editor-impl/src/asset/__tests__/transcode.uat.test.tsx` - 新：7 条编排集成用例
- `packages/libs/editor-impl/src/asset/__tests__/assetView.test.tsx` - 改：`makeView` 补上新必填视图字段（见偏离 1）

## Decisions Made

- **空选择立即返回。** `transcodeAssets([])` 不置 `transcoding`、不写文件、不登记屏障——用例 ⑦ 断言 `undo()` 为 false 且原文件无变化。
- **「目标已存在」用目录集合判定。** 资源系统对任意路径都返回句柄（从不返回 null），只有真读字节才抛错；故一次性 `listDirectory(category.dir)` 建路径集合、逐项就地更新，既准确又不读大文件。
- **两条写回分支的次序。** 覆盖 = 写新文件后删旧文件；保留 = 旧文件先 `moveResource` 到 `{file}-origin.{ext}` 再写新文件——都保证新文件先落盘。
- **`unsaved` 只随成功翻转。** 整批全失败时不把分类标记为未保存，避免假的「有改动待保存」。
- **汇总保留、弹窗关闭。** 转码结束后关弹窗，但 `transcodeSummary` 留在界面上，用 `Alert` 呈现失败明细。
- **列表改名走 `renameAssetListEntry`。** 对 `ObjectList` 分类顺带把来源字段改成新名，`StringList` 直接换名；列表仍由 `save()` 落盘。

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] 给 `assetView.test.tsx` 的视图状态工厂补上新必填字段**
- **Found during:** Task 1（typecheck）
- **Issue:** 计划要求给 `IAssetPanelViewState` 追加必填的 `transcodeOpen` / `transcoding`，而 `assetView.test.tsx` 的 `makeView` 基底对象缺这两项，`tsc -b` 报 `TS2739`。
- **Fix:** 在 `makeView` 的基底对象补 `transcodeOpen: false` / `transcoding: false`。
- **Files modified:** `packages/libs/editor-impl/src/asset/__tests__/assetView.test.tsx`
- **Verification:** `pnpm --filter @motajs/editor-impl typecheck` 退出码 0；`src/asset` 全量绿。
- **Committed in:** `0904d2c`（Task 1 提交）

**2. [Rule 2 - Missing Critical] `AssetPanelView` 补 `asset-notice` 呈现操作结果文案**
- **Found during:** Task 2
- **Issue:** `AssetPanel.publish(status, message)` 一直把「已保存」/「已新增素材，请记得保存」/「转码完成，共 N 个」等写进视图状态，但视图从未渲染 `message`——用户看不到任何操作结果；而本计划 must_have 要求「全部成功提示『转码完成，共 N 个』」，必须可见。
- **Fix:** 在 `AssetPanelView` 根节点内渲染 `state.message`（`data-test-id="asset-notice"`），沿用表格侧 `.etable-notice` / `table-notice` 的既有模式。
- **Files modified:** `packages/libs/editor-impl/src/asset/components/AssetPanelView.tsx`
- **Verification:** 用例 ⑥ 断言 `asset-notice` 文本为「转码完成，共 2 个」；`assetView.test.tsx` 11 条仍绿。
- **Committed in:** `03a35e8`（Task 2 提交）

---

**Total deviations:** 2 auto-fixed（1 × Rule 3，1 × Rule 2）
**Impact on plan:** 一处补测试工厂字段、一处补用户可见的结果提示，都不改对外签名与编排语义。无范围蔓延。

> **任务边界说明（非偏离）：** 计划的 Task 2 文件清单未列 `assetPanel.ts`，但弹窗回调（`onTranscode` / `onCancelTranscode` / `onStartTranscode`）必须由面板容器透传；若在 Task 1 一并接线，Task 1 自己的 typecheck 会因视图尚未接收新 props 而失败。故容器接线随 Task 2 一起落地（`assetPanel.ts` 本就属本计划 `files_modified`）。这与 03-13 记录的任务边界处理同源。
>
> **假服务按字节选失败项（非偏离）：** `IAssetTranscodeService` 的签名只收字节、不收素材名，故假服务用 `failFirstByte`（首字节命中即抛错）替代计划里建议的 `failNames`，效果等价（用例 ④ 让第二条失败）。

## Issues Encountered

- 无阻塞。`src/asset` 全量 11 files / 105 tests、全量 `editor-impl` 37 files / 296 tests（基线 289 + 新增 7）一次跑绿；`typecheck` 与 `coreBoundaries.js` / `coreModuleState.js` / `coreEngineNeutral.js` 四道门禁均退出码 0。
- jsdom 下 antd 弹层仍会打印既有的 `window.getComputedStyle` 噪声，不影响任何用例结果（与 03-10 / 03-11 / 03-13 记录一致）。

## User Setup Required

None - 本计划纯编排、界面与集成测试，无外部服务、环境变量或依赖安装（`mediabunny` 属 03-15）。

## Known Stubs

None.

## Threat Flags

None - 未引入计划 `<threat_model>` 之外的新信任面。T-03-50（覆盖旧文件的数据丢失）由「覆盖默认勾选 + 点开始先弹破坏性二次确认」落地；T-03-51（目标同名被静默覆盖）由「目标已存在即该项失败、不改写」落地（用例 ③）；T-03-52（批量过大）由逐项串行 `await` 天然限流；T-03-53（转码可撤销的错觉）由每项 `registerBarrier` 落地（用例 ⑤）。

## Next Phase Readiness

- 转码编排就位：03-17（dev 宿主接入与门禁收口）可经工具栏「瘦身转码」驱动真实弹窗，并在 Chromium dev host 里手动验收真实 WebP / WebM 编码路径。
- 真实图片 / 音频编码路径需在 Chromium dev host / Playwright 中手动验收（jsdom 无 WebCodecs / OffscreenCanvas）。
- 无阻塞。

---

## Self-Check: PASSED

- FOUND: packages/libs/editor-impl/src/asset/components/TranscodeModal.tsx
- FOUND: packages/libs/editor-impl/src/asset/__tests__/transcode.uat.test.tsx
- FOUND: packages/libs/editor-impl/src/asset/assetPanel.ts (transcodeAssets)
- FOUND: packages/libs/editor-impl/src/asset/types.ts (transcodeOpen/transcoding/transcodeSummary)
- FOUND: packages/libs/editor-impl/src/asset/transcode/types.ts (ASSET_WEBP_EXTENSION/ASSET_WEBM_EXTENSION)
- FOUND commit: 0904d2c (Task 1)
- FOUND commit: 03a35e8 (Task 2)
- FOUND commit: dbe8a7b (Task 3)
- PASS: `pnpm --filter @motajs/editor-impl test -- src/asset/__tests__/transcode.uat.test.tsx` (7/7)
- PASS: `pnpm --filter @motajs/editor-impl test -- src/asset` (11 files / 105 tests)
- PASS: `pnpm --filter @motajs/editor-impl test` (37 files / 296 tests)
- PASS: `pnpm --filter @motajs/editor-impl typecheck` (exit 0)
- PASS: `node scripts/verify/coreBoundaries.js` (exit 0)
- PASS: `node scripts/verify/coreModuleState.js` (exit 0)
- PASS: `node scripts/verify/coreEngineNeutral.js` (exit 0)

*Phase: 03-asset*
*Completed: 2026-10-18*
