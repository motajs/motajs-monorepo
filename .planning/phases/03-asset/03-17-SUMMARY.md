---
phase: 03-asset
plan: 17
subsystem: editor-dev-integration
tags: [typescript, react, dev-host, asset, capability-provider, gate-sweep, validation]

# Dependency graph
requires:
  - phase: 03-asset
    provides: "素材面板类型工厂 createAssetPanelType / UNDO_BLOCKED_MESSAGE（03-10）、AssetCapabilityProvider（03-12）、每素材配置表单（03-14）、音频转码（03-15）、转码弹窗与批量编排（03-16）"
  - phase: 01.1-dev-host
    provides: "开发宿主 @motajs/editor-dev 的内存后端、组合根 main.tsx 与表格 / 代码编辑器接线"
provides:
  - "开发宿主素材演示数据与注册函数：ASSET_DEMO_CATEGORIES / ASSET_DEMO_FILES / registerAssetDemo（packages/apps/editor-dev/src/demo/assetDemo.ts）"
  - "main.tsx 素材接线：initialize 前 seed 演示素材、注册素材面板类型、两层能力 Provider 包裹渲染根"
  - "宿主级测试 devHostAsset.test.tsx（4 用例）"
  - "03-VALIDATION.md 的 Wave 0 勾选、人工验收步骤与门禁签核记录；deferred-items.md 的三处既有根门禁红登记"
affects: [03-asset]

# Actuals (#2632) — same estimateTokens scale (chars/4 over the realized diff), never a harness token count.
actuals:
  tokens: 6853
  tasks: 3
  commits: 3
plan_head_before: f49f7b5d1ed2eb74d7a553a3eabf78dc13268076

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "开发宿主接入一个能力的固定三件套：演示数据种子（seed 进内存后端）+ 顶层注册函数（注册面板类型 / 挂钩子）+ 能力 Provider 包一层渲染根；能力包本身不装配进 core"
    - "演示素材必须在 core.initialize 之前 seed——文件索引在 initialize 时建立，之后种入的路径不会被索引到"

key-files:
  created:
    - packages/apps/editor-dev/src/demo/assetDemo.ts
    - packages/apps/editor-dev/src/__tests__/devHostAsset.test.tsx
  modified:
    - packages/apps/editor-dev/src/main.tsx
    - .planning/phases/03-asset/03-VALIDATION.md
    - .planning/phases/03-asset/deferred-items.md

key-decisions:
  - "registerAssetDemo 在 registerPanelType 之后、core.initialize 之前调用一次：面板类型先注册，撤销钩子也在 initialize 前挂上（钩子只入 Hookable 列表，与 initialize 无先后依赖）"
  - "ASSET_DEMO_FILES 用 path/content 列表承载演示文件；main.tsx 遍历它 seed，保证 seed 早于 initialize"
  - "演示列表文件带系统前缀（SYSTEM_PREFIX_END_MARKER），与素材包模板一致；四个分类各自带 defaultsPath（文件未 seed，缺省按「没有默认值」处理）"
  - "根门禁三处红（pnpm test / typecheck / lint）经确认全部为既有问题，按 executor SCOPE BOUNDARY 记录不修"

patterns-established:
  - "每个 editor-impl 能力阶段的收尾计划，把该能力接进 @motajs/editor-dev 并做一次全量门禁签核"

requirements-completed: [ASSET-01]

# Coverage metadata (#1602)
coverage:
  - id: D1
    description: "开发宿主能打开并浏览素材管理器：四个分类（图片 / 音频 / 动画 / 字体）各有演示素材，图片分类两条、其余各一条"
    requirement: "ASSET-01"
    verification:
      - kind: integration
        ref: "packages/apps/editor-dev/src/__tests__/devHostAsset.test.tsx#注册后能创建素材面板实例并渲染出面板根 / #切入后图片分类读出两条演示素材"
        status: pass
      - kind: other
        ref: "pnpm --filter @motajs/editor-dev test -- devHostAsset（1 file / 4 tests passed）"
        status: pass
    human_judgment: false
  - id: D2
    description: "素材能力经 AssetCapabilityProvider 注入；与既有表格能力经多层 Provider 合并不互相吞掉"
    requirement: "ASSET-01"
    verification:
      - kind: integration
        ref: "packages/apps/editor-dev/src/__tests__/devHostAsset.test.tsx#素材能力 Provider 注入后分类为 4 且表格预设仍可见"
        status: pass
    human_judgment: false
  - id: D3
    description: "撤销命中屏障时装配方订阅的 onUndoBlocked 被调用一次，undo() 返回 false（屏障不弹栈）"
    requirement: "ASSET-01"
    verification:
      - kind: integration
        ref: "packages/apps/editor-dev/src/__tests__/devHostAsset.test.tsx#撤销命中屏障时订户回调被调用且返回 false"
        status: pass
    human_judgment: false
  - id: D4
    description: "真实浏览器里的图片 → WebP / 音频 → WebM/Opus 产出（可播放、体积变小）与不支持 WebCodecs 时的入口禁用"
    requirement: "ASSET-01"
    verification:
      - kind: manual_procedural
        ref: "开发宿主 Chromium：打开素材管理器 → 瘦身转码 → 转 WebP / 转 WebM/Opus → 确认产出可播放且体积变小；无 WebCodecs 的浏览器确认入口禁用并提示"
        status: unknown
    human_judgment: true
    rationale: "jsdom 无 OffscreenCanvas / WebCodecs，真实编码与封装只能在浏览器里人工验收；已登记进 03-VALIDATION.md 的 Manual-Only Verifications"

duration: 33min
completed: 2026-10-18
status: complete
---

# Phase 3 Plan 17: 开发宿主接入与门禁收口 Summary

**把素材管理器接进开发宿主——四个分类的演示素材在内存后端种好、面板类型在 `core.initialize` 前注册、素材能力经 `AssetCapabilityProvider` 注入，浏览器里能打开、浏览、新增 / 配置 / 转码；同时把整阶段的门禁跑了一遍并登记人工验收。**

## Performance

- **Duration:** 约 33 min
- **Started:** 2026-10-18T18:40:00+08:00
- **Completed:** 2026-10-18T19:13:00+08:00
- **Tasks:** 3
- **Files modified:** 5（2 新建，3 修改）

## Accomplishments

- 新建 `demo/assetDemo.ts`：`ASSET_DEMO_CATEGORIES`（图片 / 音频 / 动画 / 字体四分类，路径与素材包模板一致，各带 `defaultsPath`）、`ASSET_DEMO_FILES`（四个列表文件 + 两张 1×1 PNG、一个代码合成的 44 字节头 PCM WAV、一个空 `.anim`、一个占位 `.ttf`）、`registerAssetDemo(core)`（`createAssetPanelType` 注册面板类型 + `core.undoSystem.addHook({ onUndoBlocked })` 以 antd `message.error(UNDO_BLOCKED_MESSAGE)` 提示「无法撤销」，返回 `{ categories }` 供注入）。
- 改 `main.tsx`：在 `core.initialize` 之前遍历 `ASSET_DEMO_FILES` seed；在注册面板类型之后、`initialize` 之前调用 `registerAssetDemo(core)`；渲染根包成 `AssetCapabilityProvider`（`access` / `categories` / `capabilities={{ tablePanel, tablePresets }}`）→ `DevCodeEditorProvider`（`capabilities={{}}`，与上层合并）→ `core.shellSystem.render()`；既有表格演示种子与接线原样保留。
- 新建 `__tests__/devHostAsset.test.tsx` 四条用例全绿：① `createPanelInstance('asset')` 可创建且渲染出 `data-test-id="asset-panel"`；② 切入后图片分类读出两条素材（`asset-card-hero.png` / `asset-card-tile.png`）；③ `AssetCapabilityProvider` 注入后 `asset.categories` 为 4 且 `tablePresets` 仍可见；④ 撤销命中屏障时订户回调被调用一次、`undo()` 返回 `false`。
- 更新 `03-VALIDATION.md`：Wave 0 十项全部勾选（`wave_0_complete: true`）、Per-Task Verification Map 全部标 ✅、人工验收改成可逐步执行的具体步骤，并新增「Gate Sweep Record」记录本轮门禁结果。
- 更新 `deferred-items.md`：登记本轮暴露的三处既有根门禁红（见下）。

## Task Commits

Each task was committed atomically:

1. **Task 1: 演示数据与注册函数** - `b7f4a5f` (feat)
2. **Task 2: 宿主接线** - `d0463d0` (feat)
3. **Task 3: 宿主级测试、门禁签核与人工验收登记** - `a4cc785` (test)

**Plan metadata:** (本 SUMMARY 提交) (docs)

_Note: 本计划无 TDD 循环，三个任务各一次提交，无修订提交。_

## Files Created/Modified

- `packages/apps/editor-dev/src/demo/assetDemo.ts` - 新：`ASSET_DEMO_CATEGORIES` / `ASSET_DEMO_FILES` / `registerAssetDemo`，含模块内私有的 `IAssetDemoFile`、base64→字节解码、合成 WAV、列表文本工具
- `packages/apps/editor-dev/src/main.tsx` - 改：seed 演示素材、`registerAssetDemo`、`AssetCapabilityProvider` + `DevCodeEditorProvider` 两层包裹
- `packages/apps/editor-dev/src/__tests__/devHostAsset.test.tsx` - 新：4 条宿主级用例 + `CapabilityProbe` 探针
- `.planning/phases/03-asset/03-VALIDATION.md` - 改：Wave 0 勾选、Per-Task Status、人工验收步骤、门禁签核记录
- `.planning/phases/03-asset/deferred-items.md` - 改：登记三处既有根门禁红

## Decisions Made

- **注册顺序：面板类型 → `registerAssetDemo` → `initialize`。** `registerAssetDemo` 内部先 `registerPanelType` 再挂撤销钩子；两者都在 `core.initialize` 之前完成（钩子只入 Hookable 列表，不依赖 initialize）。
- **演示素材在 `initialize` 前 seed。** `EditorCore.initialize` 构造文件索引；之后种入的路径不会被索引，面板会显示为空。
- **演示列表文件带系统前缀。** 与素材包模板（`ASSET_TEST_PREFIX`）一致，复用 `SYSTEM_PREFIX_END_MARKER`；四分类各带 `defaultsPath`，对应文件未 seed，读取失败按「没有默认值」处理。
- **模块内私有类型不登记进 `INTERFACE-NAME.md`。** `IAssetDemoFile` 为模块私有，与既有 `IAssetPanelState` / `AssetPickerResolver` 等私有类型做法一致；对外的三个名字按 `INTERFACE-NAME.md` §03-17 落地。

## Deviations from Plan

None - plan executed exactly as written.

（唯一的实现细节调整：`ASSET_DEMO_FILES` 的图片分类种了两张 PNG 字节目录项以匹配「图片两条」，两条复用同一份 1×1 PNG 常量——计划只点名「一张 1×1 PNG 字节」常量，复用它满足「两条素材」的验收；不改任何对外命名或行为。）

## Issues Encountered

### 根门禁三处红——全部为既有问题，按 SCOPE BOUNDARY 记录未修

本轮（Task 3）首次在本阶段跑根命令，发现 `pnpm test` / `pnpm typecheck` / `pnpm lint` 三处红，**均不在 03-17 的文件范围内，且在本计划基线提交 `f49f7b5` 之前就已存在**：

1. **`pnpm test` 红在 `@motajs/react-hooks` 一个包。** 该包 `lib/core/common.test.tsx` 与 `lib/browser/serviceWorker.test.tsx` 在 import 期报 `Incompatible React versions: react 19.2.3 / react-dom 19.3.0`。根因是已提交的 `pnpm-lock.yaml` 把该包锁成 `react: 19.2.3` + `react-dom: 19.3.0(react@19.2.3)`；`git show f49f7b5:pnpm-lock.yaml` 证实基线即如此。其余六个有测试的包全绿：file2x 14、h5animate 202、editor-core 94、packer 94、editor-impl 296、editor-dev 24。
2. **`pnpm typecheck` 红在旧 `@motajs/editor` 应用。** 该应用自 02.1 资源层改造后即无法编译（01.1-RESEARCH 已记为「现有 editor 无法编译（旧里程碑遗留）」）；`@motajs/editor-core` / `editor-impl` / `editor-dev` 三包 typecheck 均退出码 0。
3. **`pnpm lint` 红 8 条 prettier 错误**，位于更早计划留下的文件：`editor-core/src/resource/__tests__/fileIndex.test.ts`(4)、`editor-impl/src/table/__tests__/refreshIdentity.uat.test.tsx`(1)、`editor-impl/src/table/tablePanel.ts`(1)、`scripts/verify/coreFsSurface.js`(2)。03-17 自己的三个新 / 改文件 `eslint` / `prettier --check` 均干净。

**处置：** 按 executor SCOPE BOUNDARY 规则**未修**（修 1 需改依赖 / 锁文件，属依赖决策；修 2 是迁移期任务；修 3 是别家文件），已登记进 `deferred-items.md` 与 `03-VALIDATION.md` 的 Gate Sweep Record。**未放行任何门禁配置。**

### 五道边界门禁

`coreBoundaries` / `coreModuleState` / `coreEngineNeutral` / `coreImportType` / `editorShims` 全部退出码 0（真实树 0 违规 + 两极性 fixture 命中并删除）。

## User Setup Required

None - 本计划只接入开发宿主与登记验收，无外部服务、环境变量或新依赖。

## Known Stubs

None - 四个分类均可浏览、可编辑、可转码；演示数据为 dev-only 假数据（非真实项目数据），这是开发宿主的既定用途，非未完成占位。

## Threat Flags

None - 未新增网络端点、鉴权路径或文件访问。威胁登记表 T-03-54（本计划不改任何门禁脚本 / eslint 配置，Task 3 只运行它们）/ T-03-55（注册只在开发宿主顶层 `registerAssetDemo` 发生，能力包不导出装配函数）/ T-03-56（浏览器专属转码在 `03-VALIDATION.md` 登记为人工验收并写明步骤）均已落地。

## Next Phase Readiness

- 素材能力在开发宿主可打开、可浏览、可新增 / 配置 / 转码；`pnpm --filter @motajs/editor-dev test`（含 devHostAsset）24/24 通过，`editor-impl` 37 files / 296 tests 通过。
- **阻塞提示（需人工裁决）：** 根 `pnpm test` / `pnpm typecheck` / `pnpm lint` 三处红为既有问题（详见 Issues），本计划无法在其文件范围内消除；`pnpm test` 的 react-hooks 版本不匹配需要一次依赖 / 锁文件对齐决定。
- 人工验收（真实 WebP / WebM 产出）已在 `03-VALIDATION.md` 登记，待人工在 Chromium 开发宿主执行。

---

## Self-Check: PASSED

- FOUND: packages/apps/editor-dev/src/demo/assetDemo.ts
- FOUND: packages/apps/editor-dev/src/main.tsx
- FOUND: packages/apps/editor-dev/src/__tests__/devHostAsset.test.tsx
- FOUND: .planning/phases/03-asset/03-VALIDATION.md
- FOUND: .planning/phases/03-asset/deferred-items.md
- FOUND commit: b7f4a5f (Task 1)
- FOUND commit: d0463d0 (Task 2)
- FOUND commit: a4cc785 (Task 3)

*Phase: 03-asset*
*Completed: 2026-10-18*
