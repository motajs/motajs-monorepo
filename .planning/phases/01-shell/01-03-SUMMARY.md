---
phase: 01-shell
plan: 03
subsystem: editor-core
tags: [typescript, react, editor-core, shell, css, ui]

# Dependency graph
requires:
  - phase: 01-shell
    plan: 02
    provides: "ShellSystem 渲染根（ShellRoot/MenuRow/TabRow/ContentArea/BlankTabList/PanelHost）与 16 项外壳测试骨架"
provides:
  - "core 自带纯 CSS 外壳样式表 src/shell/shell.css（菜单行/标签行/内容区/空白标签列表/空·加载·错误态）"
  - "构建配套：src/global.d.ts 的 declare module '*.css' 与 package.json sideEffects: [\"./src/**/*.css\"]"
  - "外壳渲染元素上的 kebab-case 类名（editor-shell-*）与新增 7 项溢出/长文本/空态测试"
affects: [01-04 fs 面门禁, editor-host-integration]

# Actuals (#2632)
actuals:
  tokens: 4618
  tasks: 2
  commits: 2
  plan_head_before: b6a02f3967f65452f43b85f70730d6e83c54e1d0

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "core 自带 plain CSS：kebab-case 就近样式表，仅经 --editor-* 变量表达并以明色字面量兜底"
    - "CSS side-effect import 与 sideEffects 白名单：渲染根 import './shell.css'，manifest 声明 CSS 为必需副作用"
    - "环境声明 *.css 模块：src/global.d.ts 一行让 tsc -b 认可样式导入，零新依赖"

key-files:
  created:
    - packages/libs/editor-core/src/shell/shell.css
    - packages/libs/editor-core/src/global.d.ts
  modified:
    - packages/libs/editor-core/package.json
    - packages/libs/editor-core/src/shell/shellSystem.ts
    - packages/libs/editor-core/src/shell/__tests__/shellSystem.test.ts

key-decisions:
  - "外壳类名采用 editor-shell-* kebab-case，活动标签沿用仓库既有 is-active 修饰类（与 editor.css 的 .appWorkspaceButton.is-active 一致）"
  - "溢出与固定：菜单/标签行 overflow:hidden 不换行、标签 flex:0 1 auto 可收缩并由自身文本省略；+ 用 margin-left:auto + position:sticky right:0 钉在右端可达"
  - "内容区改由 shellSystem.ContentArea 统一包一层 div.editor-shell-content 承接滚动背景，面板/空白列表作为其子节点"
  - "为让 Task 2 能稳定断言，渲染元素补齐类名（纯表现层改动，导出面与交互行为不变）"

patterns-established:
  - "外壳样式可主题化：所有颜色经 --editor-* 变量（缺省照 UI-SPEC 明色），宿主覆盖变量即换肤，core 不设主题"

requirements-completed: [SHELL-01]

# Coverage metadata (#1602)
coverage:
  - id: D1
    description: "core 自带纯 CSS 外壳样式表（菜单行/标签行/内容区/空白标签列表/空·加载·错误态），经渲染根 import 随 core 打包，并用 sideEffects 白名单 + *.css 环境声明保证 typecheck 与打包都保留样式"
    requirement: "SHELL-01"
    verification:
      - kind: other
        ref: "pnpm --filter @motajs/editor-core typecheck"
        status: pass
      - kind: other
        ref: "node scripts/verify/coreImportType.js && node scripts/verify/coreEngineNeutral.js && node scripts/verify/coreModuleState.js"
        status: pass
    human_judgment: false
  - id: D2
    description: "外壳溢出/长文本/空态测试覆盖：外部文本按文本节点转义渲染（无注入元素）、完整文本暴露在 title、菜单/标签/类型名带单行省略类名、空白列表零/多类型、空菜单行、始终存在的 + 控件"
    requirement: "SHELL-01"
    verification:
      - kind: unit
        ref: "packages/libs/editor-core/src/shell/__tests__/shellSystem.test.ts"
        status: pass
    human_judgment: false
  - id: D3
    description: "外壳在真实宿主中的最终目视验收（菜单行/标签行/内容区/空白列表的实际观感、溢出裁剪与 + 可达）"
    verification: []
    human_judgment: true
    rationale: "本计划只写 core 自带样式与测试；jsdom 不应用布局，实际观感（尺寸/颜色/省略/钉右）须在真实宿主中人工判定，宿主接入属 @motajs/editor 阶段。"

# Metrics
duration: 6min
completed: 2026-10-11
status: complete
---

# Phase 1 Plan 03: 外壳样式与状态覆盖 Summary

**为引擎无关的外壳补上 core 自带的纯 CSS 样式表（菜单行/标签行/内容区/空白标签列表/空·加载·错误态），并配套 *.css 环境声明与 sideEffects 白名单，再用 7 项测试锁定溢出、长文本与空态边界**

## Performance

- **Duration:** 约 6 min
- **Started:** 2026-10-11T07:01Z (approx)
- **Completed:** 2026-10-11T07:05Z (approx)
- **Tasks:** 2
- **Files modified:** 5（2 新增 / 3 修改）

## Accomplishments
- 新增 `src/shell/shell.css`：菜单行（32px）、标签行（36px，活动标签用 `--editor-selected` 背景 + 2px 强调底条）、内容区（滚动背景）、`+`/`×`（24×24 命中区）、空白标签列表（`max-width: 480px`、行 `min-height: 40px`、纵向滚动）、空/加载/错误态排版；全部颜色经 UI-SPEC 的 `--editor-*` 变量表达并以明色字面量兜底，无 UI 框架、无外链 `@import`、零新依赖。
- 两处配套工程改动落地：`src/global.d.ts` 的 `declare module '*.css';`（让 `tsc -b` 认可 `import './shell.css'`）与 `package.json` 的 `sideEffects: ["./src/**/*.css"]`（防打包器摇掉样式表）。
- 渲染根 `shellSystem.ts` 首行 `import './shell.css';`，并给渲染元素补齐 kebab-case 类名（`editor-shell` / `editor-shell-menu` / `editor-shell-tab` / `editor-shell-blank-item` 等）；导出符号与交互行为不变。
- 外壳测试从 16 项扩到 23 项：文本转义（含尖括号输入不生成元素）、`title` 完整文本、单行省略类名、空态文案、注册顺序行数、空菜单行、`+` 始终存在（含 31 标签溢出场景）。

## Task Commits

Each task was committed atomically:

1. **Task 1: 纯 CSS 外壳样式 + 两处配套工程改动** - `a4c9ce7` (feat)
2. **Task 2: 扩展外壳测试覆盖溢出 / 长文本 / 空态状态** - `f9c18ee` (test)

**Plan metadata:** 本次 SUMMARY 提交（docs: complete plan）

## Files Created/Modified
- `packages/libs/editor-core/src/shell/shell.css` - 新增。core 自带纯 CSS 外壳样式表，只使用 `--editor-*` 变量 + 字面量兜底。
- `packages/libs/editor-core/src/global.d.ts` - 新增。一行 `declare module '*.css';`，让 `tsc -b` 认识 CSS 模块导入。
- `packages/libs/editor-core/package.json` - `sideEffects` 由 `false` 改为 `["./src/**/*.css"]`（其余字段不动）。
- `packages/libs/editor-core/src/shell/shellSystem.ts` - 首行 `import './shell.css';`；各渲染组件补齐 kebab-case 类名；`ContentArea` 统一包一层 `div.editor-shell-content`。导出面与行为不变。
- `packages/libs/editor-core/src/shell/__tests__/shellSystem.test.ts` - 追加 `ShellSystem 外壳状态覆盖` describe 共 7 用例。

## Decisions Made
- **类名约定**：外壳类名统一 `editor-shell-*` kebab-case；活动标签沿用仓库既有 `is-active` 修饰类（对齐 `editor.css` 的 `.appWorkspaceButton.is-active`），而非另造命名。
- **溢出不换行 + `+` 可达**：菜单/标签行 `overflow: hidden; white-space: nowrap`；标签 `flex: 0 1 auto; min-width: 0` 可收缩并由自身文本省略；`+` 以 `margin-left: auto` + `position: sticky; right: 0` 钉在右端，标签再多也保持可达。
- **内容区包装**：由 `shellSystem.ContentArea` 统一输出 `div.editor-shell-content` 承接滚动/底色，面板或空白列表作为其子节点，使滚动区稳定。
- **类名补齐属表现层**：Task 1 action 只字面要求加 style import，但 `read_first` 明确「类名 / 结构需要与 CSS 对齐」且 Task 2 要求断言类名，故一并补齐类名——这不改变任何导出符号或交互行为。

## Deviations from Plan

### Auto-fixed / in-plan adjustments

**1. [Within-plan] 为渲染元素补齐 kebab-case 类名并包装内容区**
- **Found during:** Task 1（纯 CSS 外壳样式）
- **Issue:** Plan 02 产出的渲染元素没有任何 `className`，纯 CSS 无从附着；而 Task 2 明确要求「长文本标签 / 菜单项的元素带单行省略所需类名（断言存在对应 class）」。Task 1 action 只字面写了「加 import」，但 `read_first` 已注明「类名 / 结构需要与 CSS 对齐」。
- **Fix:** 给渲染元素补齐 `editor-shell-*` 类名；`ContentArea` 统一包一层 `div.editor-shell-content`。仅新增样式属性与一层布局包装，不改变任何导出符号或交互行为。
- **Files modified:** `packages/libs/editor-core/src/shell/shellSystem.ts`
- **Verification:** `pnpm --filter @motajs/editor-core test` 51/51 绿（含原 16 项外壳用例未回归）；三个 core 门禁通过。
- **Committed in:** `a4c9ce7`

**2. [Within-plan] 用 `flex` 收缩 + `sticky` 钉右实现「标签溢出而 `+` 可达」backstop**
- **Found during:** Task 1
- **Issue:** 若标签 `flex: 0 0 auto`，标签溢出时末尾的 `+` 会被裁掉；UI-SPEC 允许 `position: sticky`/`flex` 两种实现。
- **Fix:** 标签 `flex: 0 1 auto; min-width: 0`（可收缩并由文本省略），`+` 用 `margin-left: auto` + `position: sticky; right: 0` 固定右端。
- **Files modified:** `packages/libs/editor-core/src/shell/shell.css`
- **Verification:** jsdom 不验布局，改由 Task 2 的结构断言（31 标签场景 `+` 仍在）兜底；实际观感留待人工 UAT。
- **Committed in:** `a4c9ce7`

---

**Total deviations:** 2（均为计划内实现选择，0 项越界修复）
**Impact on plan:** 均为让样式可附着与满足 Task 2 断言所必需；无范围蔓延，未引入新依赖。

## Issues Encountered
- 计划 `estimate.tokens` 为 40000（raw 20000），实测 realized diff 仅约 4.6k tokens（chars/4）——本计划实际工作量为估算的约 1/9，属明显高估，已如实记入 `actuals`（不向估算凑数）。
- 计划携带的 `[flagged — SHELL-01, spec-less probe row unclassified/unresolved]` 仍未归类：本计划以 `must_haves.truths` 覆盖其视觉/溢出/长文本面，但 spec-less 探针归类未决，须用户知悉（不由本执行器决定）。

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- 外壳视觉与溢出/长文本/空态边界已由 core 自带 CSS + 单测锁定；01-04（fs 面门禁）不影响这些改动。
- 待用户确认：`INTERFACE-NAME.md` Plan 03 的 `shell.css` / `global.d.ts` / `package.json` 改动即本计划落地内容；其中**未列入 `INTERFACE-NAME.md` 的外壳 CSS 类名**（`editor-shell-*` / `is-active`）为执行期新增的纯表现层命名。
- 本计划**未**触碰 STATE.md / ROADMAP.md（由编排器负责），也**未**引入任何新依赖。

## Verification Evidence
- `pnpm --filter @motajs/editor-core typecheck`（`tsc -b`）→ 退出 0（含 `import './shell.css'`，无 `TS2307` / `Cannot find module './shell.css'`）。
- `pnpm --filter @motajs/editor-core test` → 5 文件 / 51 用例全绿（外壳 16 → 23）。
- `node scripts/verify/coreImportType.js` → 真实树 33 文件（新增 `global.d.ts` 被纳入）、0 条 `import type`；两极性成立。
- `node scripts/verify/coreEngineNeutral.js` → 真实树 27 生产文件、0 条引擎术语；两极性成立。
- `node scripts/verify/coreModuleState.js` → 真实树 33 文件、0 条 error 级受限规则；豁免与覆盖面成立。
- `pnpm exec prettier --check`（改动文件）→ 全部符合 Prettier 风格。

## Self-Check: PASSED

- 文件 `packages/libs/editor-core/src/shell/shell.css` → FOUND
- 文件 `packages/libs/editor-core/src/global.d.ts` → FOUND
- 文件 `packages/libs/editor-core/src/shell/__tests__/shellSystem.test.ts` → FOUND
- 提交 `a4c9ce7` → FOUND
- 提交 `f9c18ee` → FOUND

---
*Phase: 01-shell*
*Completed: 2026-10-11*
