---
phase: 01-shell
verified: 2026-10-11T07:51:40Z
status: human_needed
score: 31/32 must-haves verified
covered_files:
  - .planning/phases/01-shell/01-01-PLAN.md
  - .planning/phases/01-shell/01-02-PLAN.md
  - .planning/phases/01-shell/01-03-PLAN.md
  - .planning/phases/01-shell/01-04-PLAN.md
  - .planning/phases/01-shell/01-01-SUMMARY.md
  - .planning/phases/01-shell/01-02-SUMMARY.md
  - .planning/phases/01-shell/01-03-SUMMARY.md
  - .planning/phases/01-shell/01-04-SUMMARY.md
  - .planning/phases/01-shell/01-CONTEXT.md
  - .planning/phases/01-shell/01-UI-SPEC.md
  - .planning/phases/01-shell/01-VALIDATION.md
  - .planning/phases/01-shell/INTERFACE-NAME.md
  - .planning/REQUIREMENTS.md
  - .planning/ROADMAP.md
  - packages/libs/editor-core/src/panel/types.ts
  - packages/libs/editor-core/src/panel/index.ts
  - packages/libs/editor-core/src/shell/types.ts
  - packages/libs/editor-core/src/shell/index.ts
  - packages/libs/editor-core/src/shell/shellSystem.ts
  - packages/libs/editor-core/src/shell/shell.css
  - packages/libs/editor-core/src/shell/__tests__/shellSystem.test.ts
  - packages/libs/editor-core/src/fs/types.ts
  - packages/libs/editor-core/src/fs/index.ts
  - packages/libs/editor-core/src/index.ts
  - packages/libs/editor-core/src/log/messages.ts
  - packages/libs/editor-core/src/global.d.ts
  - packages/libs/editor-core/package.json
  - packages/libs/editor-core/src/core.ts
  - packages/libs/editor-core/src/types.ts
  - packages/libs/editor-core/src/__tests__/core.test.ts
  - scripts/verify/coreFsSurface.js
covered_digest: "v3:sha256:5acad7a6c5bf87eea1de809e7db4123f7e9218b3db47aa4ebff48ee30bb1654e"
behavior_unverified: 1
overrides_applied: 0
behavior_unverified_items:
  - truth: "Tab row (nav) · overflow: when many tabs exceed the tab-row width, the tab strip clips with no wrap and the `+` control stays pinned right and always reachable."
    test: "Render the shell, open many blank tabs (e.g. 31) so the tab strip overflows the tab-row width in a real browser, then observe the tab row."
    expected: "The tab strip clips horizontally with no wrapping; the `+` control remains pinned to the right edge and is fully visible/clickable."
    why_human: "This is a layout/overflow invariant. jsdom (the test environment) does not apply CSS layout, so the existing test can only assert that the `.editor-shell-tab-new` element is present in the structure, not that it is actually pinned/reachable. Only a real browser can confirm the pinned position under overflow."
human_verification:
  - test: "Mount the shell root (`ShellSystem.render()`) inside a real editor host and look at it: menu row (top), tab row (below, with `+` rightmost), content area."
    expected: "Menu row 32px, tab row 36px, active tab uses the `--editor-selected` tint + 2px accent bottom bar; `+`/`×` are compact 24×24 hit targets; long names ellipsize with single-line ellipsis; overflow clips with no wrap."
    why_human: "Visual appearance (sizes, colours, ellipsis, clipping, focus rings) is not observable in jsdom. The phase's own VALIDATION.md and summaries record this as a manual-only acceptance item for SHELL-01; core has no standalone runnable shell — host integration lands with the later editor-impl phases."
  - test: "Confirm the must-NOT (prohibition) checks were not violated for this phase: no `dangerouslySetInnerHTML`; tab navigation never recorded in undo history; core imports no host/engine code and performs no file/network/storage IO; no fs-interface implementation/reference; the fs gate is genuinely failable; no new runtime/build dependency (no PandaCSS/antd/Semi/Tailwind)."
    expected: "All prohibitions hold."
    why_human: "These prohibitions are declared judgment-tier in the PLAN frontmatter (no `verification: test` tag). Most already have deterministic backing (see Prohibitions Checked); per ADR-550 D4 the judgment-tier items require explicit human resolution at the end-of-phase checkpoint."
  - test: "Acknowledge and decide on the carried-open item: `[flagged — SHELL-01/CORE-01, spec-less probe row unclassified/unresolved]` (this phase has no SPEC.md, so the spec-less edge probe could not classify the SHELL-01 / CORE-01 rows)."
    expected: "User is aware both rows remain `unresolved` (neither auto-resolved nor silently dropped); their acceptance面 is carried by the plans' must_haves. No code action required unless the user wants an explicit classification."
    why_human: "This is a process/classification open item requiring user awareness, not a code defect. It was deliberately carried through all four plans rather than silently closed."
---

# Phase 1: 编辑器外壳与通用 fs 接口 Verification Report

**Phase Goal:** 交付类似浏览器的编辑器外壳——顶部两行（菜单行 + 标签行）+ 内容区；支持动态注册/注销面板类型、动态创建/关闭面板实例（同类型可开多个独立实例）；加载后默认可开空白新标签页。并由 `editor-core` 定义引擎无关的通用 fs 接口（只定义、不实现，由外部注入真正的实现）。
**Verified:** 2026-10-11T07:51:40Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| #   | Truth   | Status     | Evidence       |
| --- | ------- | ---------- | -------------- |
| 1 | 编辑器加载后渲染外壳：菜单行 + 标签行 + 内容区，含 `+` 与一个默认空白标签 | ✓ VERIFIED | `ShellSystem.initialize()` auto-opens a blank tab (`shellSystem.ts:366-376`); tests `零注册时仍渲染菜单行、标签行与空白标签页`, `initialize 后默认存在一个空白标签页` pass |
| 2 | 加载后默认一个空白标签；允许多个空白标签 | ✓ VERIFIED | `openBlankTab()` appends + activates (`:466-474`); test `新建标签页追加标签并激活` |
| 3 | 空白标签列出已注册类型（图标 + 名称）；点击即在原标签打开该类型新实例 | ✓ VERIFIED | `BlankTabList` iterates `panelTypes`; `openPanelInTab` rewrites tab in place (`:476-497`); test `点击类型项后打开实例并渲染` |
| 4 | 同一类型可开多个互不冲突的独立实例，各自独立 dispose | ✓ VERIFIED | per-instance id/counter/maps (`:316-336`); test `同类型可开两个互不冲突的独立实例` |
| 5 | 关闭标签触发 dispose、移除标签、自动切到相邻（优先左邻）；无标签则重建空白标签 | ✓ VERIFIED | `closeTab` (`:499-522`); tests `关闭标签触发 dispose 并自动切到相邻标签`, `关闭最后一个标签后重建一个空白标签页` |
| 6 | 外部可动态注册/注销类型、注册/注销菜单项；注销类型关闭其全部实例与标签、不残留 | ✓ VERIFIED | `unregisterPanelType` closes tabs then leftover instances (`:394-410`); test `注销面板类型关闭其全部实例与标签` |
| 7 | 零注册空壳照常呈现菜单行 + 标签行（含 `+` 与空白标签），列表为空 | ✓ VERIFIED | test `零注册时仍渲染菜单行、标签行与空白标签页` |
| 8 | 重复的面板类型 id / 菜单项 id 被拒绝（不覆盖），返回 false 并 `logger.error` | ✓ VERIFIED | `:384-387`, `:443-446`; test `重复面板类型 id 被拒绝并记日志` |
| 9 | 标签的打开/关闭/切换不写入撤销历史 | ✓ VERIFIED | no `addUndoContext` in shell path; test `标签导航不写入撤销历史` |
| 10 | 加载态：实例 `initialize()` pending 时内容区显示居中 muted 加载行，标签已存在且激活 | ✓ VERIFIED | `initializeInstance` sets Loading (`:594-609`); `PanelHost` renders `加载中…`; test `实例初始化未完成时显示加载行` |
| 11 | 错误态：工厂抛错或 `initialize()` reject → 「面板打开失败」+「请关闭此标签页后重试，或联系该面板的提供方。」，标签保持可关闭 | ✓ VERIFIED | `PanelHost` error branch (`:210-217`); tests `工厂抛错时拒绝打开且标签保持空白`, `实例初始化失败时显示错误态` |
| 12 | 空白列表空态渲染「暂无可用面板」+「尚未注册任何面板类型。」；有类型时按注册顺序一行一个（icon + name） | ✓ VERIFIED | `BlankTabList` (`:231-264`); tests `空白标签页零类型时显示空态文案`, `空白标签页类型列表按注册顺序渲染` |
| 13 | `+` 始终渲染且 `aria-label`「新建标签页」；每标签一个 `×`，`aria-label`「关闭「{面板名}」」 | ✓ VERIFIED | `TabRow` (`:152-202`); test `标签行始终含 + 控件且多标签溢出时仍存在` |
| 14 | 外部文本以文本节点渲染（无 `dangerouslySetInnerHTML`）；完整文本经 `title` 暴露 | ✓ VERIFIED | no `dangerouslySetInnerHTML` in shell (grep); tests `外部文本以文本节点渲染且不生成元素`, `菜单、标签与类型名的完整文本暴露在 title 上` |
| 15 | 包根可导入 `IEditorFileSystem`/`IEditorPanelType`/`EditorPanelFactory`/`IShellSystem`/`IEditorMenuItem`/`IEditorTab`/`IShellInjection`（纯类型） | ✓ VERIFIED | `index.ts` exports `./shell` + `./fs`; `coreFsSurface.js` positive probe; test `从包根可导入 …` |
| 16 | `IEditorFileSystem` 恰含读/写/列目录/建目录/移动/删除六方法，均返回 `Promise`，无实现体 | ✓ VERIFIED | `fs/types.ts` (41 lines, signatures only) |
| 17 | `IEditorPanelType` 形状（id/name/icon/create）；`EditorPanelFactory` = `(param: IEditorPanelFactoryParam) => IEditorPanel`（同步单参数） | ✓ VERIFIED | `panel/types.ts:94-118` matches the user-approved 2026-10-10 amendment |
| 18 | 仓库内无 `IEditorFileSystem` 的 `implements`/调用；标识符只在其声明文件 | ✓ VERIFIED | grep: only `fs/types.ts`; `coreFsSurface.js` real-tree 0 hits |
| 19 | 外壳样式为 core 自带纯 CSS，经渲染根 `import`；无新运行时/构建依赖 | ✓ VERIFIED | `shellSystem.ts:1` `import './shell.css';`; `package.json` deps = react + @tanstack/store only |
| 20 | `package.json` 的 `sideEffects` == `["./src/**/*.css"]` | ✓ VERIFIED | `package.json:6-8` |
| 21 | `src/global.d.ts` == `declare module '*.css';` | ✓ VERIFIED | `global.d.ts:1` |
| 22 | 样式只用 UI-SPEC `--editor-*` 变量并以字面量兜底 | ✓ VERIFIED | `shell.css` — every `--editor-*` has a literal fallback; no hardcoded theme colours |
| 23 | 单行省略；行 `min-height:40px`；菜单 32px / 标签 36px；图标 16px；`+`/`×` 24×24 | ✓ VERIFIED | `shell.css:14-15,58,124-125,197,228-229`; test `菜单项、标签与类型名带单行省略类名` |
| 24 | 菜单/标签/类型名长文本省略并经 `title` 暴露；菜单行溢出裁剪不换行 | ✓ VERIFIED | `shell.css` `text-overflow: ellipsis` + `overflow:hidden; white-space:nowrap`; tests for `title` |
| 25 | 空白列表纵向滚动，块 `max-width:480px` | ✓ VERIFIED | `shell.css:173` (max-width 480) + `.editor-shell-content overflow:auto` |
| 26 | Tab 行溢出：多标签裁剪不换行且 `+` 钉右端可达 | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | CSS implements (`position:sticky; right:0; margin-left:auto`) but jsdom applies no layout; test only asserts `+` element exists under 31-tab load — see Human Verification |
| 27 | `node scripts/verify/coreFsSurface.js` 退出 0，断言两包生产源码无 fs 接口实现/引用 | ✓ VERIFIED | ran: `真实树通过（已扫描 33 个源码文件 … IEditorFileSystem 仅出现在声明文件 …、其余 0 命中）` |
| 28 | 门禁两极性：合成 `class X implements IEditorFileSystem` fixture 被拦下、真实树 0 命中、fixture 已删 | ✓ VERIFIED | ran: `两极性成立（… 被逐行命中、真实树 0 命中，且 fixture 已删除）` |
| 29 | 门禁含非空转下界（`MIN_EXPECTED_SOURCES=20`）且与既有门禁同构 | ✓ VERIFIED | `coreFsSurface.js:58`; run output reports 33 ≥ 20 |
| 30 | `IEditorFileSystem` 经包根可被外部导入作类型（typecheck 探针，正 + 负极性） | ✓ VERIFIED | ran: `包根导入两极性成立（正极性 tsc 退出 0；负极性 tsc 报 TS2305 且指向探针）` |
| 31 | 真实树中标识符只在声明文件 `fs/types.ts` | ✓ VERIFIED | grep found 1 match (the declaration); gate 0 other hits |
| 32 | 旧 `PanelSystem` 契约彻底移除（`panelSystem.ts` + 测试删除；无 `registerPanel`/`IPanelSystem`/`EditorPanelCreator`/`PanelUndoType`/`IPanelInjection` 残留） | ✓ VERIFIED | `panel/` lacks `panelSystem.ts`; grep over `editor-core/src` → 0 matches |

**Score:** 31/32 truths verified (1 present, behavior-unverified)

### Required Artifacts

| Artifact | Expected    | Status | Details |
| -------- | ----------- | ------ | ------- |
| `packages/libs/editor-core/src/panel/types.ts` | panel-type contract + `EditorPanelFactory` | ✓ VERIFIED | `IEditorPanelType`, `IEditorPanelFactoryParam`, `EditorPanelFactory` present; imports `ReactNode` (not `import type`) |
| `packages/libs/editor-core/src/shell/types.ts` | shell contract | ✓ VERIFIED | `IShellSystem` (16 methods), `IShellInjection`, `IEditorMenuItem`, `IEditorTab` |
| `packages/libs/editor-core/src/shell/index.ts` | barrel | ✓ VERIFIED | `export * from './types'` + `'./shellSystem'` |
| `packages/libs/editor-core/src/shell/shellSystem.ts` | `ShellSystem` + components + hooks | ✓ VERIFIED | 669 lines, full implementation; `ShellPanelHooks`; `ShellRoot`/`MenuRow`/`TabRow`/`ContentArea`/`BlankTabList`/`PanelHost` |
| `packages/libs/editor-core/src/shell/shell.css` | core-owned plain CSS | ✓ VERIFIED | 295 lines, `--editor-*` vars + fallbacks |
| `packages/libs/editor-core/src/shell/__tests__/shellSystem.test.ts` | shell behavior tests | ✓ VERIFIED | 23 tests, all pass |
| `packages/libs/editor-core/src/fs/types.ts` | fs contract (declaration only) | ✓ VERIFIED | 6 `Promise` methods, no bodies |
| `packages/libs/editor-core/src/fs/index.ts` | barrel | ✓ VERIFIED | single `export * from './types';` |
| `packages/libs/editor-core/src/index.ts` | package root | ✓ VERIFIED | re-exports `./shell` and `./fs` |
| `packages/libs/editor-core/src/global.d.ts` | `*.css` ambient decl | ✓ VERIFIED | one line |
| `packages/libs/editor-core/package.json` | `sideEffects` | ✓ VERIFIED | `["./src/**/*.css"]` |
| `packages/libs/editor-core/src/log/messages.ts` | 7 `shell.*` log ids | ✓ VERIFIED | all 7 present; old `panel.*`/`core.*` retained |
| `packages/libs/editor-core/src/core.ts` | shell wiring | ✓ VERIFIED | constructs `ShellSystem`, exposes `shellSystem`, init/dispose in order |
| `packages/libs/editor-core/src/types.ts` | core injection/interface | ✓ VERIFIED | `IEditorCoreInjection extends … IShellInjection`; `IEditorCore.shellSystem` |
| `scripts/verify/coreFsSurface.js` | CORE-01 failable gate | ✓ VERIFIED | real-tree + two-polarity + root-import probes; 347 lines |
| `packages/libs/editor-core/src/panel/panelSystem.ts` | deleted | ✓ GONE | replaced by `ShellSystem` |

### Key Link Verification

| From | To  | Via | Status | Details |
| ---- | --- | --- | ------ | ------- |
| `shell/types.ts` | `../panel` | `import { IEditorPanel, IEditorPanelType }` | ✓ WIRED | internal dep, no cycle |
| `src/index.ts` | `./shell`, `./fs` | `export *` | ✓ WIRED | reached package root; import probe tsc exit 0 |
| `shell/shellSystem.ts` | `./shell.css` | `import './shell.css';` | ✓ WIRED | first line; `sideEffects` keeps it in bundle |
| `core.ts` | `ShellSystem` | `new ShellSystem(undoSystem, resourceSystem)` + `shellSystem` | ✓ WIRED | `EditorCore.initialize`/`dispose` drive it |
| `ShellRoot` | `ShellSystem` state | `useSyncExternalStore(subscribe, getSnapshot)` | ✓ WIRED | cached snapshot; no infinite re-render in tests |
| `BlankTabList` row click | `ShellSystem.openPanelInTab` | `onClick` | ✓ WIRED | test asserts tab rewritten + instance rendered |
| `ShellSystem` | `ResourceSystem` hooks | `resourceSystem.addHook` / `IHookController.unload` | ✓ WIRED | tests `updateResource`/`updateResourceList` notify panel |
| `scripts/verify/coreFsSurface.js` | core `tsc` + `fs/types.ts` | `spawnSync pnpm … exec tsc -p tsconfig.json` | ✓ WIRED | positive exit 0, negative TS2305 pointing at probe |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| -------- | ------------- | ------ | ------------------ | ------ |
| `BlankTabList` rows | `view.panelTypes` | `panelTypes: Map` via `buildViewState` | yes — real registered types (test `…按注册顺序渲染` → 3 rows) | ✓ FLOWING |
| `TabRow` tabs | `view.tabs` | `tabs: IEditorTab[]` state machine | yes — reflects live open/close | ✓ FLOWING |
| `PanelHost` body | `activePanel` + `activePanelStatus` | `instances`/`instanceStatuses` maps | yes — renders instance component / loading / error | ✓ FLOWING |
| `MenuRow` items | `view.menuItems` | `menuItems: []` registration list | yes — registration order | ✓ FLOWING |
| `IEditorFileSystem` | — | type-only declaration (D-13) | n/a — no runtime data path by design | ✓ N/A (intended) |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| editor-core typechecks (incl. `import './shell.css'`) | `pnpm --filter @motajs/editor-core typecheck` | `tsc -b` exit 0 | ✓ PASS |
| all editor-core tests | `pnpm --filter @motajs/editor-core test` | 5 files / **51 tests passed** | ✓ PASS |
| fs surface gate | `node scripts/verify/coreFsSurface.js` | exit 0 (real tree 33 files 0 hits; two-polarity; root probes) | ✓ PASS |
| no-`import type` gate | `node scripts/verify/coreImportType.js` | exit 0 (33 files, 0 violations) | ✓ PASS |
| engine-neutral gate | `node scripts/verify/coreEngineNeutral.js` | exit 0 (28 files, 0 violations) | ✓ PASS |
| module-state / PORT-02 gate | `node scripts/verify/coreModuleState.js` | exit 0 (0 error-level; failable fixtures) | ✓ PASS |
| old contract removed | grep `registerPanel\b\|IPanelSystem\|EditorPanelCreator\|PanelUndoType\|IPanelInjection` in `editor-core/src` | 0 matches | ✓ PASS |
| fs identifier confined | grep `IEditorFileSystem` under `packages/libs` | 1 match (declaration only) | ✓ PASS |

> Note: running the gates in parallel causes a benign race (`coreFsSurface.js` briefly writes a probe file that `coreModuleState.js`'s ESLint scan can see). Run them sequentially — each passes on its own, which is how the phase's verification contract invokes them.

### Probe Execution

| Probe | Command | Result | Status |
| ----- | ------- | ------ | ------ |
| `scripts/verify/coreFsSurface.js` | `node scripts/verify/coreFsSurface.js` | exit 0; `真实树通过 … 两极性成立 … 包根导入两极性成立 … 全部断言通过` | PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| ----------- | ---------- | ----------- | ------ | -------- |
| SHELL-01 | 01-01, 01-02, 01-03 | 编辑器以固定外壳呈现（固定布局 + 命名插槽），完成后画面与现状一致（用户可看到并操作外壳） | ✓ SATISFIED (visual sign-off pending) | `ShellSystem` renders menu/tab/content; 23 shell tests + 51 total pass; visual acceptance is a human item (see Human Verification) |
| CORE-01 | 01-01, 01-04 | `editor-core` 暴露通用 fs 接口（只定义接口、不提供实现），由外部注入真正的实现 | ✓ SATISFIED | `fs/types.ts` declaration + package-root export; `coreFsSurface.js` proves no impl/reference in core/impl and root-importable |

No orphaned requirements: `REQUIREMENTS.md` maps only SHELL-01 and CORE-01 to Phase 1; all other IDs map to Phases 2–5.

### Prohibitions Checked

| Plan | Prohibition (must NOT) | Status | Evidence |
| ---- | ---------------------- | ------ | -------- |
| 01 | No implementation bodies in the interface plan | ✓ NOT VIOLATED | plan-01 files are declaration-only |
| 01 | Do not implement/reference `IEditorFileSystem` | ✓ NOT VIOLATED | `coreFsSurface.js` real tree 0 hits |
| 02 | No `dangerouslySetInnerHTML` for external text | ✓ NOT VIOLATED | grep 0; test with `<b>`/`<img>` inputs generates no elements |
| 02 | Tab open/close/switch not recorded in undo history | ✓ NOT VIOLATED | test `标签导航不写入撤销历史` |
| 02 | core imports no host/engine code; no file/network/storage IO | ✓ NOT VIOLATED | coreImportType / coreEngineNeutral / coreModuleState gates pass |
| 03 | No new runtime/build dependency | ✓ NOT VIOLATED | deps remain react + @tanstack/store; plain CSS |
| 03 | No `dangerouslySetInnerHTML` | ✓ NOT VIOLATED | grep 0 |
| 04 | No fs-interface implementation/reference | ✓ NOT VIOLATED | gate real tree 0 hits |
| 04 | No "unfailable gate" (needs two-polarity + non-vacuous bound) | ✓ NOT VIOLATED | fixture caught; `MIN_EXPECTED_SOURCES=20`; run reports 33 |

### Anti-Patterns Found

None. No `TODO`/`FIXME`/`XXX`/`HACK`/placeholder markers in any phase file; no `dangerouslySetInnerHTML`; no static-empty stub returns in the shell render path. (An `info`-level `DEP0190` Node deprecation warning appears when `coreFsSurface.js` spawns `tsc` with `shell:true` — same invocation style as the pre-existing `coreBoundaries.js`; does not affect exit code or assertions.)

### Human Verification Required

#### 1. Shell visual acceptance in a real host

**Test:** Mount `ShellSystem.render()` inside a real editor host and inspect the menu row, tab row (with `+` rightmost), and content area, including hover/focus states and long-name ellipsis.
**Expected:** Menu row 32px, tab row 36px, active tab uses `--editor-selected` tint + 2px accent bar; `+`/`×` are 24×24; long names ellipsize; overflow clips with no wrap.
**Why human:** Visual layout/colour is not observable in jsdom; the phase's own VALIDATION.md and summaries record this as a manual-only SHELL-01 acceptance item. Core has no standalone runnable shell — host integration lands with the later editor-impl phases.

#### 2. Tab-row overflow backstop (pinned `+`)

**Test:** Open enough tabs that the tab strip overflows the tab-row width in a real browser; observe the tab row.
**Expected:** Tab strip clips horizontally with no wrap; `+` stays pinned to the right edge and is fully reachable/clickable.
**Why human:** Layout invariant; jsdom applies no layout, so the test can only assert the `+` element exists, not its pinned position under overflow.

#### 3. Carried-open spec-less probe item (awareness/decision)

**Test:** Acknowledge `[flagged — SHELL-01/CORE-01, spec-less probe row unclassified/unresolved]` carried in all four plans: this phase has no SPEC.md, so the spec-less edge probe could not classify the SHELL-01 / CORE-01 rows.
**Expected:** User is aware both rows remain `unresolved` (neither auto-resolved nor silently dropped); their acceptance面 is carried by the plans' must_haves. No code action required unless an explicit classification is wanted.
**Why human:** Process/classification item requiring user awareness, not a code defect.

#### 4. Judgment-tier prohibition sign-off (ADR-550 D4)

**Test:** Confirm the phase's must-NOT items (listed in Prohibitions Checked) were not violated.
**Expected:** All prohibitions hold.
**Why human:** Declared judgment-tier in PLAN frontmatter (no `verification: test` tag); most already have deterministic backing above, but ADR-550 D4 requires explicit human resolution of judgment-tier items at the end-of-phase checkpoint.

### Gaps Summary

No gaps found. All four plans' must-haves are present, substantive, wired, and behaviorally exercised (or, for the fs interface, proven type-only and confined to its declaration file). The old `PanelSystem` contract is fully removed with no residual references. The sole non-`VERIFIED` truth is the tab-overflow **backstop** (item 26): the code is present and wired, but its layout invariant cannot be exercised in jsdom — it routes to human verification rather than blocking, and the phase status is `human_needed` because a UI deliverable requires visual acceptance that no automated check can supply.

---

_Verified: 2026-10-11T07:51:40Z_
_Verifier: the agent (gsd-verifier)_
