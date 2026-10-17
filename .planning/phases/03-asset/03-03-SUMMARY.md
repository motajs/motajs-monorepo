---
phase: 03-asset
plan: 03
subsystem: editor-impl-asset
tags: [typescript, const-enum, asset, transcode, naming-conventions]

# Dependency graph
requires:
  - phase: 03-02
    provides: "中立 schema 类型（shared/schemaForm/types.ts 的 ITableSchemaNode / ITableRowNode）与 react 接缝上的素材分类类型（IAssetCategory / AssetCategoryKind / AssetListFormat）"
provides:
  - "asset 面板域类型：AssetPanelStatus / AssetPanelMode / AssetUndoType / AssetSchemaSource 四个枚举 + IAssetEntry / IAssetListEntry / IAssetSchemaResolution / IAssetPanelTarget / IAssetPanelParam / IAssetPanel / IAssetPanelViewState 七个接口"
  - "转码契约：AssetTranscodeKind / IAssetAudioTranscodeOptions / IAssetTranscodeOptions / IAssetTranscodeItemResult / IAssetTranscodeSummary / IAssetTranscodeService 与三个默认参数常量"
  - "面板级常量 ASSET_MAX_UPLOAD_BYTES（32 MiB）、UNDO_BLOCKED_MESSAGE（'无法撤销'）"
  - "命名约定常量 ASSET_LIST_FILE_NAME / ASSET_SCHEMA_FILE_NAME / ASSET_ORIGIN_SUFFIX"
  - "@motajs/editor-impl/asset 子路径桶（当前只导出 types / constants / model）"
affects: [03-07, 03-08, 03-09, 03-10, 03-11, 03-12, 03-13, 03-14, 03-16]

actuals:
  tokens: 1479
  tasks: 2
  commits: 2
plan_head_before: 05f36b565275edb028065f18f03726c037c028bf

tech-stack:
  added: []
  patterns:
    - "asset 域形状只声明在 asset/types.ts，零函数体、零类（先接口后实现）"
    - "枚举一律 const enum + 数字 + 大驼峰成员、不写枚举级 jsDoc；interface 成员逐个单行 jsDoc 且默认 readonly"

key-files:
  created:
    - packages/libs/editor-impl/src/asset/types.ts
    - packages/libs/editor-impl/src/asset/constants.ts
    - packages/libs/editor-impl/src/asset/transcode/types.ts
    - packages/libs/editor-impl/src/asset/transcode/index.ts
    - packages/libs/editor-impl/src/asset/model/assetPaths.ts
    - packages/libs/editor-impl/src/asset/model/index.ts
    - packages/libs/editor-impl/src/asset/index.ts
  modified: []

key-decisions:
  - "asset/types.ts 从 ../react 只引入 IAssetCategory：计划允许清单里另列了 AssetCategoryKind，但所声明的成员无一使用它，引入会成未用导入，故按成员清单精确引入"
  - "asset/transcode/types.ts 提前到 Task 1 落地：Task 1 的 types.ts 依赖 ./transcode/types，而 Task 1 的验证要跑 typecheck，故该文件随 Task 1 提交以保证任务级编译绿（Rule 3）"
  - "asset/index.ts 暂不导出 ./transcode（03-09 落地实现后再加），且不深路径转发 ./model/<file>"

patterns-established:
  - "转码能力经 IAssetTranscodeService 接口隔离：面板只依赖接口，浏览器能力（OffscreenCanvas / WebCodecs）挡在实现侧"
  - "三个命名约定（列表文件名 / 自带 schema 文件名 / 保留旧文件后缀）以常量固化，后续实现统一引用"

requirements-completed: [ASSET-01]

coverage:
  - id: D1
    description: "素材面板域类型与转码契约在 asset/types.ts 声明完毕（四个 const enum + 七个 interface，含 configErrors: readonly string[]），零实现"
    requirement: "ASSET-01"
    verification:
      - kind: other
        ref: "node 结构检查（12 类型名 + 3 转码方法名齐备、无 function/class）+ pnpm --filter @motajs/editor-impl typecheck（退出码 0）"
        status: pass
    human_judgment: false
  - id: D2
    description: "命名约定常量（.list.jsonc / .schema.jsonc / -origin）、转码默认值（80 / 96000 / 48000）与 ./asset 桶（types + constants + model）就位"
    requirement: "ASSET-01"
    verification:
      - kind: other
        ref: "node 结构检查（常量值逐字命中、桶三行且不含 ./transcode 与深路径）+ pnpm --filter @motajs/editor-impl typecheck（退出码 0）"
        status: pass
    human_judgment: false

duration: 10min
completed: 2026-10-17
status: complete
---

# Phase 3 Plan 03: asset 域类型、转码契约、约定常量 Summary

**把素材面板的数据形状先钉死——面板状态 / 模式、一条素材长什么样、列表文件里的一条长什么样、schema 从哪来、转码服务要提供什么、三个命名约定常量——只声明类型与常量，不含一行实现。**

## Performance

- **Duration:** 约 10 min
- **Started:** 2026-10-17T13:57:00Z
- **Completed:** 2026-10-17T14:07:02Z
- **Tasks:** 2
- **Files modified:** 7（全部新建，0 修改）

## Accomplishments

- `asset/types.ts` 声明了素材面板这一层的全部数据形状：四个 `const enum`（`AssetPanelStatus` / `AssetPanelMode` / `AssetUndoType` / `AssetSchemaSource`）与七个接口（`IAssetEntry` / `IAssetListEntry` / `IAssetSchemaResolution` / `IAssetPanelTarget` / `IAssetPanelParam` / `IAssetPanel` / `IAssetPanelViewState`，其中 `IAssetPanelViewState` 含 `configErrors: readonly string[]`）以及 `IAssetTranscodeService`（`canTranscode` / `imageToWebp` / `audioToWebmOpus`）。整个文件零 `function` / 零 `class`。
- `asset/transcode/types.ts` 给出转码契约与默认参数：`AssetTranscodeKind`（`ImageWebp` / `AudioOpus`）、`IAssetAudioTranscodeOptions` / `IAssetTranscodeOptions` / `IAssetTranscodeItemResult` / `IAssetTranscodeSummary`，以及 `ASSET_DEFAULT_WEBP_QUALITY = 80`、`ASSET_DEFAULT_OPUS_BITRATE = 96000`、`ASSET_DEFAULT_OPUS_SAMPLE_RATE = 48000`。
- `asset/constants.ts` 固定两处唯一定义：`ASSET_MAX_UPLOAD_BYTES`（32 MiB，承接威胁 T-03-07 的体积闸门常量）与 `UNDO_BLOCKED_MESSAGE`（`'无法撤销'`）。
- `asset/model/assetPaths.ts` 固化三个命名约定：`ASSET_LIST_FILE_NAME`（`.list.jsonc`）、`ASSET_SCHEMA_FILE_NAME`（`.schema.jsonc`）、`ASSET_ORIGIN_SUFFIX`（`-origin`）；`asset/index.ts` 汇总为 `./asset` 子路径（当前只 `export *` types / constants / model）。

## Task Commits

Each task was committed atomically:

1. **Task 1: 面板与转码的域类型** - `ec2d131` (feat)
2. **Task 2: 命名约定常量、转码契约、`./asset` 桶** - `3b01f18` (feat)

**Plan metadata:** (本 SUMMARY 提交)

## Files Created/Modified

- `packages/libs/editor-impl/src/asset/types.ts` - 新：面板域形状（4 枚举 + 7 接口 + `IAssetTranscodeService`），从 `../react` 取 `IAssetCategory`、从 `../shared/schemaForm/types` 取 `ITableSchemaNode` / `ITableRowNode`、从 `./transcode/types` 取 `AssetTranscodeKind` / `IAssetAudioTranscodeOptions`
- `packages/libs/editor-impl/src/asset/constants.ts` - 新：`ASSET_MAX_UPLOAD_BYTES` / `UNDO_BLOCKED_MESSAGE`
- `packages/libs/editor-impl/src/asset/transcode/types.ts` - 新：转码种类 / 选项 / 结果 / 汇总类型与三个默认值常量
- `packages/libs/editor-impl/src/asset/transcode/index.ts` - 新：`export * from './types';`
- `packages/libs/editor-impl/src/asset/model/assetPaths.ts` - 新：三个命名约定常量
- `packages/libs/editor-impl/src/asset/model/index.ts` - 新：`export * from './assetPaths';`
- `packages/libs/editor-impl/src/asset/index.ts` - 新：`./asset` 桶（types + constants + model）

## Decisions Made

- **`asset/types.ts` 只引入 `IAssetCategory`。** 计划允许的三个 import 源不变（`./transcode/types`、`../react`、`../shared/schemaForm/types`），但计划括号里与 `IAssetCategory` 并列的 `AssetCategoryKind` 在所声明的成员里没有任何用处；引入会成未用导入，故按实际成员精确引入。
- **转码类型提前到 Task 1。** 计划把 `asset/transcode/types.ts` 放在 Task 2，但 Task 1 的 `types.ts` 要 import 它、Task 1 的验证又要跑 `typecheck`——若不同时落地，Task 1 的编译必然因 TS2307 失败。故该文件随 Task 1 提交（详见 Deviations）。
- **`asset/index.ts` 暂不导出 `./transcode`。** 按计划，转码实现的桶要等 03-09 落地后再加；当前桶恰好三行，不深路径转发 `./model/<file>`。

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `asset/transcode/types.ts` 从 Task 2 前移到 Task 1**
- **Found during:** Task 1（面板与转码的域类型）
- **Issue:** Task 1 的 `asset/types.ts` 按计划从 `./transcode/types` 引入 `AssetTranscodeKind` / `IAssetAudioTranscodeOptions`，而该文件被计划划在 Task 2；若不提前落地，Task 1 的验证（`pnpm --filter @motajs/editor-impl typecheck`）会因模块无法解析（TS2307）非零退出。两任务其实互相牵连：Task 2 的 `asset/index.ts` 又要 `export *` Task 1 的 `./types` / `./constants`——任何单侧先行都编译不过。
- **Fix:** 把 `asset/transcode/types.ts` 并入 Task 1 提交（内容与计划 Task 2 的描述逐字一致），使 Task 1 的 import 可解析、typecheck 绿；Task 2 只补其余四个文件。Task 2 的验证仍照常核对 `transcode/types.ts` 的内容，故该文件被两个任务的验证共同覆盖。
- **Files modified:** `packages/libs/editor-impl/src/asset/transcode/types.ts`（随 Task 1 提交）
- **Verification:** Task 1 结构检查 OK + `typecheck` 退出码 0；Task 2 结构检查 OK + `typecheck` 退出码 0。
- **Committed in:** `ec2d131`（Task 1 提交）

---

**Total deviations:** 1 auto-fixed (Rule 3)
**Impact on plan:** 仅调整两个提交之间的文件归属，不改任何类型 / 常量内容；命名与形状与 `INTERFACE-NAME.md` §03-03 完全一致，无范围蔓延。

## Issues Encountered

- **stale 计划基线台账：** `.git/gsd-plan-head-before-03-03` 已存在一份远古值（`2b936c43…`，是 03-01 / 03-02 之前的历史提交，来自更早的同名阶段残留）。已用真实派生基点 `05f36b56`（= 03-02 完成时的 HEAD，亦即本计划首个任务提交 `ec2d131` 的父提交）覆盖，实测 `commits` = 2 与事实一致。本 SUMMARY 的 `commits:` 由该台账实测，未叙述。

## User Setup Required

None - 本计划纯类型 / 常量声明，无外部服务、环境变量或依赖安装。

## Known Stubs

None - 本计划只声明类型与常量，不含运行期代码与桩；`asset/index.ts` 对 `./transcode` 的「暂不导出」是计划内既定顺序（03-09 落地后开启），非未完成的桩。

## Threat Flags

None - 未新增网络端点、鉴权路径或文件访问；`IAssetTranscodeService` 只是接口形状（T-03-09 按 accept 处置），浏览器能力不在本计划落地。`ASSET_MAX_UPLOAD_BYTES` 常量就位（T-03-07 的缓解前提），实际体积闸门由 03-13 实现。

## Next Phase Readiness

- 素材的域形状与转码契约就位，03-07（素材模型层）/ 03-09（图片转 WebP）/ 03-10（面板数据层）/ 03-11（视图层）/ 03-12（默认选择器）/ 03-13（字节生命周期）/ 03-14（配置表单）/ 03-16（转码弹窗）均可直接从 `@motajs/editor-impl/asset` 取类型。
- `asset` 目录零实现、零跨能力 import（只依赖 `../react` 与 `../shared/schemaForm/types`），五道门禁（typecheck / coreEngineNeutral / coreImportType / coreModuleState / coreBoundaries）全绿。
- 无阻塞。

---

## Self-Check: PASSED

- FOUND: packages/libs/editor-impl/src/asset/types.ts
- FOUND: packages/libs/editor-impl/src/asset/constants.ts
- FOUND: packages/libs/editor-impl/src/asset/transcode/types.ts
- FOUND: packages/libs/editor-impl/src/asset/transcode/index.ts
- FOUND: packages/libs/editor-impl/src/asset/model/assetPaths.ts
- FOUND: packages/libs/editor-impl/src/asset/model/index.ts
- FOUND: packages/libs/editor-impl/src/asset/index.ts
- FOUND commit: ec2d131 (Task 1)
- FOUND commit: 3b01f18 (Task 2)

*Phase: 03-asset*
*Completed: 2026-10-17*
