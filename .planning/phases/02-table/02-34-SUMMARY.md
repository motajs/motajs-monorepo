---
phase: 02-table
plan: 34
subsystem: ui
tags: [editor-impl, table, performance, uat-gap-closure, p29, intersection-observer]
gap_closure: true
gap_ids: [G-02-UAT4]

# Dependency graph
requires:
  - phase: 02-table
    provides: "02-26 的 GapRow 折叠行实现（本地 useState 折叠状态 + 整行 onClick + 箭头 stopPropagation）——本计划把默认值由展开改为折叠并加首次可见自动展开"
  - phase: 02-table
    provides: "02-32 的原地刷新 / React.memo / useMemo 行元素优化——本计划在其上进一步削减首屏挂载量（折叠子行不挂载）"
provides:
  - "分组（折叠）行**默认折叠**：`GapRow.expanded` 初值由 true 改为 false，折叠子行不进 DOM，折叠项多的表（schema）首屏只挂载顶层可见行（P29）"
  - "分组行**首次进入视野自动展开**：组件自持 `IntersectionObserver` 观察分组行 header，首次相交即 `setExpanded(true)` 并 `disconnect()`；打开时观察器的首次回调即充当初始可见性判定（P29）"
  - "**用户优先**：点整行或箭头即 `setAutoRevealPending(false)`，该行此后再不被自动展开；无 `IntersectionObserver` 时退化为立即展开，绝不永久隐藏内容（P29）"
  - "观察器建在组件 effect 闭包内并在接管 / 卸载后 `disconnect()`（T-02-34-01），无模块级状态、未触碰被禁全局"
affects: [verify-work]

# Actuals (#2632)
actuals:
  tokens: 3372
  tasks: 2
  commits: 2
  plan_head_before: bd7d6c7cc86ba974ca2484034fcd0dd2f0bae4fb

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "组件自持观察器：`useRef` 挂 header + `useEffect([autoRevealPending])` 闭包内 `new IntersectionObserver`、首次相交即 `disconnect()`、清理函数亦 `disconnect()`（对齐 tablePanel.ts 既有 ResizeObserver 写法）"
    - "`typeof IntersectionObserver === 'undefined'` 守卫的退化分支：观察器缺失时同步展开，保证内容永不永久隐藏（jsdom / 老浏览器）"
    - "受控观察器桩：测试内 `ControlledIntersectionObserver` 实现完整 `IntersectionObserver` 接口 + 静态实例表 + `triggerAll(isIntersecting)`，在无真实布局的 jsdom 里手动触发相交；经 `vi.stubGlobal` 装配与还原"

key-files:
  created:
    - packages/libs/editor-impl/src/table/__tests__/lazyReveal.uat.test.tsx
  modified:
    - packages/libs/editor-impl/src/table/components/GapRow.tsx

key-decisions:
  - "默认折叠 + 首次可见展开命中 P29 的根因：剖析（02-UAT P29）指向 react-dom 内一次性挂载大量元素的开销；默认折叠让折叠子树不挂载，首屏挂载量大幅下降，滚动进入视野的分组再逐个展开"
  - "自动展开只发生一次：`autoRevealPending` 本地标记区分「仍待自动展开」与「用户已接管 / 已自动展开」；相交回调与用户点击都把标记置 false 并触发 effect 清理 `disconnect()`"
  - "退化即展开：`typeof IntersectionObserver === 'undefined'` 时（jsdom / 老浏览器）直接 `setExpanded(true)`；这正是既有「子行默认可见」用例（tracer / interaction / indent 等）保持全绿的原因——jsdom 只桩了 ResizeObserver，未桩 IntersectionObserver"
  - "观察器按既有模式直接使用：`IntersectionObserver` 不在 PORT-02 被禁全局清单（fetch / document / navigator / localStorage / XMLHttpRequest），且 D-38 起 window 亦解禁；沿用 tablePanel.ts 的「effect 闭包内建观察器 + 清理 disconnect」写法，无需注入、无需绕行"
  - "折叠状态仍为组件本地 useState，不进撤销历史；`IGapRowProps` / `GapRow` 签名与对外导出不变——惰性子元素创建（children 改工厂）属接口变更，本轮明确不做（挂载量已由默认折叠解决）"

patterns-established:
  - "折叠懒展开三态机：`autoRevealPending` true→(相交 | 点击 | 无观察器)→false，配合 effect 依赖触发观察器生命周期，避免自动展开与用户操作打架"
  - "受控 IntersectionObserver 桩：以 `implements IntersectionObserver`（含 scrollMargin）整体赋给 `globalThis`，无连续 as；静态 `triggerAll` 驱动用例"

requirements-completed: [TABLE-01]

# Coverage metadata (#1602)
coverage:
  - id: D1
    description: "分组行默认折叠：首屏不挂载折叠子行（受控观察器下 `aria-expanded` 为 false 且子行不在 DOM）"
    requirement: TABLE-01
    verification:
      - kind: unit
        ref: "src/table/__tests__/lazyReveal.uat.test.tsx#分组行默认折叠，子行不挂载"
        status: pass
    human_judgment: false
  - id: D2
    description: "首次可见自动展开；用户点击折叠后不再被自动展开；无 IntersectionObserver 时退化展开；首次相交后观察器断开"
    requirement: TABLE-01
    verification:
      - kind: unit
        ref: "src/table/__tests__/lazyReveal.uat.test.tsx#分组行首次可见即自动展开"
        status: pass
      - kind: unit
        ref: "src/table/__tests__/lazyReveal.uat.test.tsx#用户点击折叠后不再被自动展开"
        status: pass
      - kind: unit
        ref: "src/table/__tests__/lazyReveal.uat.test.tsx#无 IntersectionObserver 时立即展开（退化）"
        status: pass
      - kind: unit
        ref: "src/table/__tests__/lazyReveal.uat.test.tsx#首次相交后观察器断开"
        status: pass
    human_judgment: false
  - id: D3
    description: "手动核对（非功能，P29 性能观感）：打开折叠项多的 schema 表首屏明显更快；可见分组自动展开、滚到的分组随后展开；点击折叠仍可用；撤销 / 重做不影响折叠状态"
    requirement: TABLE-01
    verification:
      - kind: manual
        ref: "在编辑器打开 table.demo 与 table#schema.demo（折叠项多）看首屏渲染速度；滚动看分组逐个展开；点折叠行确认仍可折叠/展开；撤销/重做确认折叠状态不受影响"
        status: pending
    human_judgment: true
    rationale: "首屏渲染速度与滚动展开的体感属人工性能验收，自动化断言只能证明行为路径（默认折叠 / 可见展开 / 用户优先 / 退化），无法证明「明显更快」这一主观观感"

# Metrics
duration: 11min
completed: 2026-10-14
status: complete
---

# Phase 2 Plan 34: 分组行默认折叠 + 首次可见自动展开（P29）Summary

**折叠（分组）行改为默认折叠，首屏只挂载顶层可见行、折叠子树不进 DOM；分组行首次滚入视野时自动展开（打开时先做一次初始可见性判定），用户一旦点过就不再被自动展开，无观察器时退化为全部展开。**

## Performance

- **Duration:** ~11 min
- **Started:** 2026-10-14T15:09Z
- **Completed:** 2026-10-14T15:20Z
- **Tasks:** 2
- **Files created/modified:** 2 (1 created, 1 modified)

## Accomplishments

- **P29 默认折叠**：`GapRow.expanded` 初值由 `true` 改为 `false`。折叠项多的表（schema）首屏只挂载顶层可见行，折叠子行不进入 DOM——命中「一次性挂载大量元素」的根因，降低首屏挂载量。分组行 header 与标题在折叠时照常渲染，只有子行受影响。
- **首次可见自动展开**：组件自持一个 `IntersectionObserver`（默认视口 root；祖先滚动容器 `.etable-body` 的 `overflow` 裁剪使 `isIntersecting` 反映「在表体内可见」）观察分组行 header，首次相交即 `setExpanded(true)` 并 `disconnect()`；打开时观察器的首次回调即充当初始可见性判定。观察器建在 `useEffect([autoRevealPending])` 闭包内，清理函数 `disconnect()`，无模块级状态。
- **用户优先**：点整行或箭头按钮（箭头先 `stopPropagation()`）都先 `setAutoRevealPending(false)` 再切换折叠——用户一旦点过该行即视为接管，此后不再被自动展开；两处切换共用组件内 `const toggleExpanded` 箭头函数（沿用 TableRow 既有写法）。
- **退化即展开**：`typeof IntersectionObserver === 'undefined'` 时（jsdom / 老浏览器）直接同步 `setExpanded(true)`，绝不把内容永久隐藏；这也让既有「子行默认可见」用例（tracer / interaction / indent / openParam 等）保持全绿。
- **回归覆盖**：新增 `lazyReveal.uat.test.tsx`，受控 `IntersectionObserver` 桩下覆盖四条路径（默认折叠 / 可见展开 / 用户优先 / 退化展开）与观察器断开断言，共 5 例。
- **零接口变更**：`IGapRowProps` / `GapRow` 签名与对外导出不变；未新增依赖；未使用 `import type`；未新增 `data-test-id`；折叠状态仍为组件本地界面状态、不进撤销。

## Task Commits

Each task was committed atomically:

1. **Task 1: 分组行默认折叠 + 首次可见自动展开（GapRow 自持 IntersectionObserver）**（tracer）- `5168150` (feat)
2. **Task 2: 补齐用户优先 / 退化展开 / 断开清理用例并核对既有套件与门禁** - `9dbf685` (test)

**Plan metadata:** 见本 SUMMARY 的最终文档提交

## Files Created/Modified

- `packages/libs/editor-impl/src/table/components/GapRow.tsx` - `expanded` 初值改 `false`（默认折叠）；新增 `headerRef`（挂分组行 header）、`autoRevealPending` 本地标记与 `useEffect`（建 `IntersectionObserver`、首次相交展开并断开、无观察器退化展开、清理 `disconnect()`）；新增组件内 `toggleExpanded`（先标记用户接管再切换），整行 `onClick` 与箭头 `onClick` 共用。签名与 `IGapRowProps` 不变。
- `packages/libs/editor-impl/src/table/__tests__/lazyReveal.uat.test.tsx` - 新建。含受控 `ControlledIntersectionObserver` 桩类（实现完整 `IntersectionObserver` 接口 + 静态实例表 + `triggerAll`）与 5 条用例：默认折叠、首次可见即展开、用户点击后不再自动展开、无观察器退化展开、首次相交后观察器断开。

## Decisions Made

- **默认折叠是 P29 的直接解**——剖析指向 react-dom 内的一次性元素挂载开销；折叠子行不挂载即可命中该开销，无需为每个分组行改成惰性子元素创建（那会改 `IGapRowProps` 形状）。
- **`autoRevealPending` 三态机**——用一个本地布尔区分「仍待自动展开」与「用户已接管 / 已自动展开」；effect 依赖它，置 false 时清理 `disconnect()`，从而自动展开永不与用户操作打架。
- **退化分支是既有用例保持绿的关键**——jsdom 仅桩了 `ResizeObserver`，`IntersectionObserver` 为 undefined → 走退化立即展开 → 原有「子行默认可见」断言不受影响。
- **直接使用 `IntersectionObserver`（不注入）**——它不在 PORT-02 被禁全局清单，`ResizeObserver` 已按同一模式在产品代码里直用；满足门禁只需不碰那 5 个被禁全局且不新增模块级状态。
- **测试桩一次性实现完整接口（含 `scrollMargin`）**——使桩可整体赋给 `globalThis.IntersectionObserver`，无需连续 `as`。

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] 测试桩补齐 `scrollMargin` 成员**
- **Found during:** Task 1（`typecheck` 首次运行）
- **Issue:** 本仓库 TypeScript 的 DOM lib 中 `IntersectionObserver` 接口含 `scrollMargin: string`；桩类 `implements IntersectionObserver` 因缺该成员编译失败（TS2420 / TS2345）。
- **Fix:** 在 `ControlledIntersectionObserver` 增加 `readonly scrollMargin: string = '0px';`。
- **Files modified:** packages/libs/editor-impl/src/table/__tests__/lazyReveal.uat.test.tsx
- **Verification:** `pnpm --filter @motajs/editor-impl typecheck` 退出 0。
- **Committed in:** `5168150` (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** 仅为测试桩满足 DOM 类型面，无产品代码影响、无范围蔓延。

## Issues Encountered

- 无阻塞。整包 `test` 输出中出现的 `Not implemented: window.getComputedStyle(elt, pseudoElt)` 为既有（antd 弹窗测量）stderr 噪声，非失败；21 个测试文件全绿。

## Verification

- `pnpm --filter @motajs/editor-impl test -- __tests__/lazyReveal.uat.test.tsx __tests__/tracer.test.tsx __tests__/interaction.uat.test.tsx` → 退出 0（3 files / 23 tests，Task 1）
- `pnpm --filter @motajs/editor-impl test -- __tests__/lazyReveal.uat.test.tsx` → 退出 0（5 tests，Task 2）
- `pnpm --filter @motajs/editor-impl test` → 退出 0（21 files / 163 tests）
- `pnpm --filter @motajs/editor-impl typecheck` → 退出 0
- `pnpm --filter @motajs/editor-core test` → 退出 0（9 files / 70 tests）
- 四个门禁脚本（串行）均退出 0：
  - `node scripts/verify/coreImportType.js` → 95 文件、0 条 import type
  - `node scripts/verify/coreEngineNeutral.js` → 62 生产文件、0 条引擎标识违规
  - `node scripts/verify/coreModuleState.js` → 真实树 25 文件、受限规则 error 级 0 条、任意级别 0 条
  - `node scripts/verify/coreFsSurface.js` → 95 文件、`IEditorFileSystem` 仅在声明文件
- `npx prettier --check` 两个改动文件 → 全通过
- `git diff` 确认：仅 `GapRow.tsx` 与新增 `lazyReveal.uat.test.tsx`；`IGapRowProps` / `GapRow` 签名未变；无新依赖；无 `import type`；无连续 `as`。

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- P29 代码侧完成，无产品代码新增命名（测试文件与测试内桩类已按项目规则登记待确认：`lazyReveal.uat.test.tsx` / `ControlledIntersectionObserver`）。
- 需求用户侧 `verify-work` 做最终人工确认（非功能）：打开折叠项多的 schema 表首屏明显更快；可见分组自动展开、滚到的分组随后展开；点击折叠仍可用；撤销 / 重做不影响折叠状态。

---

*Phase: 02-table*
*Completed: 2026-10-14*

## Self-Check: PASSED

- FOUND: `packages/libs/editor-impl/src/table/components/GapRow.tsx`
- FOUND: `packages/libs/editor-impl/src/table/__tests__/lazyReveal.uat.test.tsx`
- FOUND: `.planning/phases/02-table/02-34-SUMMARY.md`
- FOUND commit: `5168150` (Task 1)
- FOUND commit: `9dbf685` (Task 2)
